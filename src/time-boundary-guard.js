(function (root) {
  "use strict";

  if (root.UntilFridayTimeBoundaryGuard) return;

  const WORKDAY_END_MINUTE = 18 * 60;
  const FRIDAY_MEETING_MINUTE = 17 * 60;

  function adjustedActionMinutes(story, state, actionId, payload = {}) {
    if (actionId === "fri-wait-meeting") {
      return Math.max(0, FRIDAY_MEETING_MINUTE - Number(state.minute || 0));
    }
    const action = story.actions?.[actionId];
    return Math.max(0, Number(payload.minutes ?? action?.minutes ?? 0));
  }

  function checkActionTime(story, state, actionId, payload = {}) {
    const action = story.actions?.[actionId] || null;
    if (state.dayIndex < story.days.length - 1 && state.minute >= WORKDAY_END_MINUTE) {
      return { ok: false, reason: "workday-ended", action };
    }
    const requested = adjustedActionMinutes(story, state, actionId, payload);
    const remaining = Math.max(0, WORKDAY_END_MINUTE - Number(state.minute || 0));
    if (state.dayIndex < story.days.length - 1 && requested > remaining) {
      return { ok: false, reason: "not-enough-time", requested, remaining, action };
    }
    return { ok: true, requested, remaining, action };
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
      if (restoreEventTime && event && Number.isFinite(originalEventMinute)) {
        event.minute = originalEventMinute;
      }
    });
  }

  function clampAdvance(state, minutes) {
    return Math.max(0, Math.min(
      Number(minutes) || 0,
      WORKDAY_END_MINUTE - Number(state.minute || 0)
    ));
  }

  root.UntilFridayTimeBoundaryGuard = {
    WORKDAY_END_MINUTE,
    FRIDAY_MEETING_MINUTE,
    adjustedActionMinutes,
    checkActionTime,
    prepareSchedules,
    restoreSchedules,
    clampAdvance
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
