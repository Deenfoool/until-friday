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
  let lastNoticeKey = "";

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
    const noticeKey = `${String(title || "")}\n${String(text || "")}`;
    if (noticeKey === lastNoticeKey && now - lastNoticeAt < 800) return;
    lastNoticeKey = noticeKey;
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

    function rollbackSaveFailure(before, saved, title, text, extra = {}) {
      recreate(before);
      notify(title, text);
      return {
        ok: false,
        reason: saved.reason || "save-failed",
        message: saved.message,
        rolledBack: true,
        state: getState(),
        ...extra
      };
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
        Time.restoreSchedules(scheduleChanges, true);
        return rollbackSaveFailure(
          before,
          saved,
          "Действие не сохранено",
          "Изменение полностью отменено. Освободите место в браузере и повторите действие.",
          { action: result.action || action || null }
        );
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
      const before = getState();
      const allowed = Time.clampAdvance(before, minutes);
      let result;

      try {
        result = core.advanceTime(allowed);
      } catch (error) {
        recreate(before);
        return {
          ok: false,
          reason: "time-exception",
          message: error?.message || String(error),
          rolledBack: true,
          events: [],
          state: getState()
        };
      }

      if (!result?.ok) return result;
      const nextState = result.state || getState();
      const saved = persist(nextState);
      if (!saved.ok) {
        return rollbackSaveFailure(
          before,
          saved,
          "Время не сохранено",
          "Ход времени отменён, потому что браузер не смог записать сохранение.",
          { events: [], advancedMinutes: 0 }
        );
      }

      dispatchStateChange(nextState, "time", { minutes: allowed, events: result.events || [] });
      return { ...result, persisted: true, advancedMinutes: allowed, state: nextState };
    }

    function flushPendingConsequencesInternal() {
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
      return core.advanceTime(Math.max(0, targetMinute - state.minute)).events || [];
    }

    function flushPendingConsequences() {
      const before = getState();
      let events;
      try {
        events = flushPendingConsequencesInternal();
      } catch (error) {
        recreate(before);
        return { ok: false, reason: "time-exception", message: error?.message || String(error), events: [], state: getState() };
      }
      const nextState = getState();
      const saved = persist(nextState);
      if (!saved.ok) {
        return rollbackSaveFailure(
          before,
          saved,
          "Последствия не сохранены",
          "Доставка отложенных событий отменена из-за ошибки сохранения.",
          { events: [] }
        );
      }
      dispatchStateChange(nextState, "event-flush", { events });
      return { ok: true, persisted: true, events, state: nextState };
    }

    function endDay(...args) {
      const before = getState();
      let flushedEvents = [];
      let result;

      try {
        if (before.dayStarted) flushedEvents = flushPendingConsequencesInternal();

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
          rolledBack: true,
          state: getState()
        };
      }

      if (result?.ok === false && result.reason === "day-not-started" && !before.ended) {
        const started = core.startDay();
        if (started?.ok) {
          flushedEvents = flushPendingConsequencesInternal();
          result = core.endDay(...args);
        }
      }

      if (result?.ok && flushedEvents.length) {
        result = { ...result, events: [...flushedEvents, ...(result.events || [])] };
      }

      const normalized = normalizeTransition(core, before, result);
      if (!normalized.ok || !normalized.state) {
        recreate(before);
        return { ...normalized, rolledBack: true, state: getState() };
      }

      recreate(normalized.state);
      normalized.state = getState();
      const saved = persist(normalized.state);
      if (!saved.ok) {
        return rollbackSaveFailure(
          before,
          saved,
          "Переход не сохранён",
          "Завершение дня полностью отменено. Освободите место в браузере и повторите переход.",
          { final: false, events: [] }
        );
      }

      dispatchStateChange(normalized.state, normalized.final ? "game-ended" : "day-transition", {
        events: normalized.events || []
      });
      return { ...normalized, persisted: true };
    }

    function startDay(...args) {
      const before = getState();
      let result;
      try {
        result = core.startDay(...args);
      } catch (error) {
        recreate(before);
        return {
          ok: false,
          reason: "day-start-exception",
          message: error?.message || String(error),
          rolledBack: true,
          events: [],
          state: getState()
        };
      }

      if (!result?.ok) return result;
      const state = result.state || getState();
      if (result.alreadyStarted) return { ...result, persisted: true, state };

      const saved = persist(state);
      if (!saved.ok) {
        return rollbackSaveFailure(
          before,
          saved,
          "Рабочий день не сохранён",
          "Запуск рабочего дня отменён, потому что браузер не смог записать сохранение.",
          { events: [] }
        );
      }

      dispatchStateChange(state, "day-start", { events: result.events || [] });
      return { ...result, persisted: true, state };
    }

    function updateState(updater, reason = "state-update") {
      const before = getState();
      const draft = clone(before);
      try {
        if (typeof updater === "function") updater(draft);
        else if (updater && typeof updater === "object") Object.assign(draft, clone(updater));
        else return { ok: false, reason: "invalid-state-update", state: before };
      } catch (error) {
        return {
          ok: false,
          reason: "state-update-exception",
          message: error?.message || String(error),
          rolledBack: true,
          state: before
        };
      }

      const repairedState = Integrity.repairEngineState(story, draft);
      recreate(repairedState);
      const nextState = getState();
      const saved = persist(nextState);
      if (!saved.ok) {
        return rollbackSaveFailure(
          before,
          saved,
          "Изменение не сохранено",
          "Служебное изменение состояния полностью отменено.",
          { updateReason: reason }
        );
      }

      dispatchStateChange(nextState, reason);
      return { ok: true, persisted: true, state: nextState };
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
      updateState,
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
