(function (root) {
  "use strict";

  const Engine = root.UntilFridayEngine;
  const Story = root.UNTIL_FRIDAY_STORY;
  const Rules = root.UntilFridayRules;
  const Integrity = root.UntilFridayIntegrityFixes;
  const Time = root.UntilFridayTimeBoundaryGuard;

  if (!Engine || !Story || !Rules || !Integrity || !Time || root.UntilFridayRuntimeEngine) return;
  if (Engine.__runtimeInstalled) return;

  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const baseCreateEngine = Engine.createEngine.bind(Engine);
  let activeEngine = null;
  let lastNoticeAt = 0;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function dedupeEvents(events) {
    const seen = new Set();
    return (events || []).filter((event) => {
      const id = event?.id || `${event?.source || ""}:${event?.title || ""}:${event?.minute || ""}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function notify(title, text) {
    const now = Date.now();
    if (now - lastNoticeAt < 800) return;
    lastNoticeAt = now;
    const doc = root.document;
    const container = doc?.querySelector?.("#notifications");
    if (!container || !doc?.createElement) return;

    const item = doc.createElement("button");
    item.type = "button";
    item.className = "notification runtime-engine-notification";
    const strong = doc.createElement("strong");
    const span = doc.createElement("span");
    strong.textContent = title;
    span.textContent = text;
    item.append(strong, span);
    item.addEventListener("click", () => item.remove());
    container.appendChild(item);
    root.setTimeout?.(() => item.remove(), 7500);
  }

  function persist(state) {
    try {
      root.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: "save-failed",
        message: error?.message || String(error),
        error
      };
    }
  }

  function dispatchStateChange(state, reason, detail = {}) {
    if (!root.dispatchEvent || typeof root.CustomEvent !== "function") return;
    root.dispatchEvent(new root.CustomEvent("until-friday-state-change", {
      detail: { state: clone(state), reason, ...detail }
    }));
  }

  function normalizeTransition(instance, before, result) {
    if (!result || typeof result !== "object") {
      return { ok: false, reason: "empty-transition-result", state: instance.getState() };
    }
    if (!result.ok) return result;

    let state = result.state || instance.getState();
    let events = [...(result.events || [])];

    if (!result.final && !state.dayStarted) {
      const started = instance.startDay();
      if (started?.ok) {
        state = started.state || instance.getState();
        events.push(...(started.events || []));
      }
    }

    const nextDay = result.final
      ? null
      : result.nextDay || clone(Story.days?.[state.dayIndex]) || instance.currentDay?.();

    if (!result.final && (!nextDay || state.dayIndex <= before.dayIndex)) {
      return {
        ok: false,
        reason: "transition-did-not-advance",
        state,
        beforeDayIndex: before.dayIndex,
        currentDayIndex: state.dayIndex
      };
    }

    return {
      ...result,
      ok: true,
      state,
      nextDay,
      events: dedupeEvents(events)
    };
  }

  Engine.createEngine = function createRuntimeEngine(story, rawState = null, options = {}) {
    const repaired = rawState ? Integrity.repairEngineState(story, rawState) : rawState;
    let core = baseCreateEngine(story, repaired, options);
    let wrapper = null;

    function recreate(state) {
      core = baseCreateEngine(story, state, options);
      return core;
    }

    function getState() {
      return core.getState();
    }

    function canApplyAction(actionId, payload = {}) {
      const state = getState();
      const ruleResult = Rules.ruleCheck(story, core, state, actionId);
      if (!ruleResult.ok) return ruleResult;

      const timeResult = Time.checkActionTime(story, state, actionId, payload);
      if (!timeResult.ok) return { ...ruleResult, ...timeResult, ok: false };

      return {
        ...ruleResult,
        requested: timeResult.requested,
        remaining: timeResult.remaining
      };
    }

    function listActions(channel = null) {
      const state = getState();
      if (state.dayIndex < story.days.length - 1 && state.minute >= Time.WORKDAY_END_MINUTE) return [];
      return core.listActions(channel).filter((action) => canApplyAction(action.id).ok);
    }

    function applyAction(actionId, payload = {}) {
      const before = getState();
      const check = canApplyAction(actionId, payload);
      if (!check.ok) return check;

      const action = story.actions?.[actionId] || check.action;
      const scheduleChanges = Time.prepareSchedules(story, action, before, check.requested);
      let result;

      try {
        result = core.applyAction(actionId, { ...payload, minutes: check.requested });
      } catch (error) {
        Time.restoreSchedules(scheduleChanges, true);
        recreate(before);
        notify("Действие отменено", "Произошла внутренняя ошибка. Состояние восстановлено до клика.");
        return {
          ok: false,
          reason: "action-exception",
          message: error?.message || String(error),
          rolledBack: true,
          state: getState()
        };
      }

      Time.restoreSchedules(scheduleChanges, !result?.ok);
      if (!result?.ok) return result;

      const withFocus = Rules.applyFocus(result.state || getState(), check);
      recreate(withFocus);
      const nextState = getState();
      const saved = persist(nextState);

      if (!saved.ok) {
        recreate(before);
        notify("Действие не сохранено", "Изменение полностью отменено. Освободите место в браузере и повторите действие.");
        return {
          ok: false,
          reason: saved.reason,
          message: saved.message,
          rolledBack: true,
          action: result.action || action || null,
          state: getState()
        };
      }

      dispatchStateChange(nextState, "action", { actionId, events: result.events || [] });
      return {
        ...result,
        persisted: true,
        requestedMinutes: check.requested,
        appliedMinutes: check.requested,
        clippedToWorkday: false,
        focus: { used: check.used + check.cost, limit: check.limit },
        state: nextState
      };
    }

    function advanceTime(minutes) {
      const state = getState();
      const allowed = Time.clampAdvance(state, minutes);
      const result = core.advanceTime(allowed);
      const nextState = result.state || getState();
      dispatchStateChange(nextState, "time", { minutes: allowed, events: result.events || [] });
      return { ...result, advancedMinutes: allowed, state: nextState };
    }

    function flushPendingConsequences() {
      const state = getState();
      if (!state.dayStarted || state.ended) return [];
      const delivered = new Set(state.deliveredEvents || []);
      const pending = (state.scheduledEvents || []).filter((item) =>
        item.dayIndex === state.dayIndex &&
        !delivered.has(item.eventId) &&
        (!item.sourceAction || Boolean(state.completedActions?.[item.sourceAction]))
      );
      if (!pending.length) return [];
      const targetMinute = Math.max(...pending.map((item) => Number(item.minute) || state.minute));
      return advanceTime(Math.max(0, targetMinute - state.minute)).events || [];
    }

    function endDay(...args) {
      const before = getState();
      let flushedEvents = [];
      let result;

      try {
        if (before.dayStarted) flushedEvents = flushPendingConsequences();

        if (Rules.shouldSkipAuditRequirement(getState())) {
          const temporaryState = clone(getState());
          temporaryState.completedActions ||= {};
          temporaryState.completedActions["wed-audit-explain"] = {
            dayIndex: 2,
            minute: temporaryState.minute,
            synthetic: true,
            result: "Проверка не назначалась."
          };
          const temporaryCore = baseCreateEngine(story, temporaryState, options);
          result = temporaryCore.endDay(...args);
          if (result?.ok && result.state) {
            const cleaned = clone(result.state);
            delete cleaned.completedActions?.["wed-audit-explain"];
            recreate(cleaned);
            result = {
              ...result,
              state: getState(),
              skippedRequirement: "wednesday-audit"
            };
          }
        } else {
          result = core.endDay(...args);
        }
      } catch (error) {
        recreate(before);
        return {
          ok: false,
          reason: "transition-exception",
          message: error?.message || String(error),
          state: getState()
        };
      }

      if (result?.ok === false && result.reason === "day-not-started" && !before.ended) {
        const started = core.startDay();
        if (started?.ok) {
          flushedEvents = flushPendingConsequences();
          result = core.endDay(...args);
        }
      }

      if (result?.ok && flushedEvents.length) {
        result = { ...result, events: [...flushedEvents, ...(result.events || [])] };
      }

      const normalized = normalizeTransition(core, before, result);
      if (normalized.ok && normalized.state) {
        recreate(normalized.state);
        normalized.state = getState();
        dispatchStateChange(normalized.state, normalized.final ? "game-ended" : "day-transition", {
          events: normalized.events || []
        });
      }
      return normalized;
    }

    function startDay(...args) {
      const result = core.startDay(...args);
      if (result?.ok) {
        const state = result.state || getState();
        dispatchStateChange(state, "day-start", { events: result.events || [] });
        return { ...result, state };
      }
      return result;
    }

    function resolveEnding(...args) {
      const stored = Rules.storedEnding(story, getState());
      return stored ? clone(stored) : core.resolveEnding(...args);
    }

    function replaceState(state, reason = "replace-state") {
      const repairedState = Integrity.repairEngineState(story, state);
      recreate(repairedState);
      const nextState = getState();
      dispatchStateChange(nextState, reason);
      return nextState;
    }

    wrapper = {
      startDay,
      currentDay: (...args) => core.currentDay(...args),
      listActions,
      listVisibleContent: (...args) => core.listVisibleContent(...args),
      canApplyAction,
      applyAction,
      advanceTime,
      endDay,
      resolveEnding,
      conditionPasses: (...args) => core.conditionPasses(...args),
      getState,
      replaceState,
      flushPendingConsequences,
      serialize: () => JSON.stringify(getState())
    };

    activeEngine = wrapper;
    dispatchStateChange(getState(), "engine-created");
    return wrapper;
  };

  Engine.__runtimeInstalled = true;

  root.UntilFridayRuntimeEngine = {
    SAVE_KEY,
    baseCreateEngine,
    persist,
    notify,
    normalizeTransition,
    getEngine: () => activeEngine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
