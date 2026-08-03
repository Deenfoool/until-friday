(function (root) {
  "use strict";

  const Engine = root.UntilFridayEngine;
  if (!Engine || root.UntilFridayTimeBoundaryGuard) return;

  const WORKDAY_END_MINUTE = 18 * 60;
  const FRIDAY_MEETING_MINUTE = 17 * 60;
  const originalCreateEngine = Engine.createEngine.bind(Engine);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function adjustedActionMinutes(story, state, actionId, payload = {}) {
    if (actionId === "fri-wait-meeting") {
      return Math.max(0, FRIDAY_MEETING_MINUTE - Number(state.minute || 0));
    }
    const action = story.actions?.[actionId];
    return Math.max(0, Number(payload.minutes ?? action?.minutes ?? 0));
  }

  function prepareSchedules(story, action, state, actionMinutes) {
    const changes = [];
    const completionMinute = Math.min(WORKDAY_END_MINUTE, Number(state.minute || 0) + actionMinutes);

    for (const schedule of action?.effects?.schedule || []) {
      const dayIndex = Number(schedule.dayIndex ?? action.dayIndex ?? state.dayIndex);
      if (dayIndex !== state.dayIndex) continue;
      const originalMinute = Number(schedule.minute ?? state.minute);
      const event = story.events?.[schedule.eventId] || null;
      const originalEventMinute = event ? Number(event.minute) : null;
      const adjustedMinute = Math.min(
        WORKDAY_END_MINUTE,
        Math.max(originalMinute, completionMinute + 5)
      );
      changes.push({ schedule, originalMinute, event, originalEventMinute });
      schedule.minute = adjustedMinute;
      if (event) event.minute = adjustedMinute;
    }
    return changes;
  }

  function restoreSchedules(changes, restoreEventTime = false) {
    changes.forEach(({ schedule, originalMinute, event, originalEventMinute }) => {
      schedule.minute = originalMinute;
      if (restoreEventTime && event && Number.isFinite(originalEventMinute)) event.minute = originalEventMinute;
    });
  }

  Engine.createEngine = function createEngineWithTimeBoundary(story, rawState = null, options = {}) {
    let core = originalCreateEngine(story, rawState, options);

    function getState() {
      return core.getState();
    }

    function canApplyAction(actionId) {
      const state = getState();
      const action = story.actions?.[actionId] || null;
      if (state.dayIndex < story.days.length - 1 && state.minute >= WORKDAY_END_MINUTE) {
        return { ok: false, reason: "workday-ended", action };
      }

      const base = core.canApplyAction(actionId);
      if (!base.ok) return base;

      if (state.dayIndex < story.days.length - 1) {
        const requested = adjustedActionMinutes(story, state, actionId);
        const remaining = Math.max(0, WORKDAY_END_MINUTE - state.minute);
        if (requested > remaining) {
          return {
            ok: false,
            reason: "not-enough-time",
            requested,
            remaining,
            action
          };
        }
      }
      return base;
    }

    function applyAction(actionId, payload = {}) {
      const check = canApplyAction(actionId);
      if (!check.ok) return check;

      const state = getState();
      const requested = adjustedActionMinutes(story, state, actionId, payload);
      const remaining = Math.max(0, WORKDAY_END_MINUTE - state.minute);
      if (state.dayIndex < story.days.length - 1 && requested > remaining) {
        return {
          ok: false,
          reason: "not-enough-time",
          requested,
          remaining,
          action: story.actions?.[actionId] || null
        };
      }

      const allowed = Math.max(0, Math.min(requested, remaining));
      const action = story.actions?.[actionId];
      const scheduleChanges = prepareSchedules(story, action, state, allowed);
      let result;

      try {
        result = core.applyAction(actionId, { ...payload, minutes: allowed });
      } catch (error) {
        restoreSchedules(scheduleChanges, true);
        throw error;
      }
      restoreSchedules(scheduleChanges, !result?.ok);

      if (!result?.ok) return result;
      const next = result.state || core.getState();
      if (next.minute > WORKDAY_END_MINUTE) {
        const repaired = clone(next);
        repaired.minute = WORKDAY_END_MINUTE;
        core = originalCreateEngine(story, repaired);
      }

      return {
        ...result,
        requestedMinutes: requested,
        appliedMinutes: allowed,
        clippedToWorkday: allowed < requested,
        state: core.getState()
      };
    }

    function advanceTime(minutes) {
      const state = getState();
      const allowed = Math.max(0, Math.min(Number(minutes) || 0, WORKDAY_END_MINUTE - state.minute));
      return core.advanceTime(allowed);
    }

    function listActions(channel = null) {
      const state = getState();
      if (state.dayIndex < story.days.length - 1 && state.minute >= WORKDAY_END_MINUTE) return [];
      return core.listActions(channel).filter((action) => canApplyAction(action.id).ok);
    }

    return {
      startDay: (...args) => core.startDay(...args),
      currentDay: (...args) => core.currentDay(...args),
      listActions,
      listVisibleContent: (...args) => core.listVisibleContent(...args),
      canApplyAction,
      applyAction,
      advanceTime,
      endDay: (...args) => core.endDay(...args),
      resolveEnding: (...args) => core.resolveEnding(...args),
      conditionPasses: (...args) => core.conditionPasses(...args),
      getState,
      serialize: () => JSON.stringify(getState())
    };
  };

  root.UntilFridayTimeBoundaryGuard = {
    WORKDAY_END_MINUTE,
    FRIDAY_MEETING_MINUTE,
    adjustedActionMinutes,
    prepareSchedules
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
