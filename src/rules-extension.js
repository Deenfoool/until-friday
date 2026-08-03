(function (root) {
  "use strict";

  const Engine = root.UntilFridayEngine;
  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Engine || !Story || Engine.__rulesExtended) return;

  const originalCreateEngine = Engine.createEngine;
  const AUDIT_EVENT_ID = "wed-security-audit";
  const AUDIT_ACTION_IDS = ["wed-audit-explain", "wed-audit-delete", "wed-audit-blame"];

  const groupAssignments = {
    "mon-report-final": "monday-report",
    "mon-report-old": "monday-report",
    "mon-invoice-fix": "monday-invoice",
    "mon-invoice-report": "monday-invoice",
    "tue-client-confirm": "tuesday-client",
    "tue-client-delay": "tuesday-client",
    "tue-answer-admin-honest": "tuesday-admin",
    "tue-answer-admin-lie": "tuesday-admin",
    "wed-audit-explain": "wednesday-audit",
    "wed-audit-delete": "wednesday-audit",
    "wed-audit-blame": "wednesday-audit",
    "fri-meeting-calm": "friday-meeting",
    "fri-meeting-work": "friday-meeting",
    "fri-meeting-blackmail": "friday-meeting",
    "fri-send-resignation": "friday-meeting"
  };

  const focusCosts = {
    "mon-copy-reports": 1,
    "mon-request-leadership-access": 1,
    "mon-tell-friend": 1,
    "tue-help-accountant": 2,
    "tue-copy-payment-list": 1,
    "tue-check-badge-list": 1,
    "wed-finish-backlog": 2,
    "wed-copy-hr-draft": 2,
    "thu-finish-project": 3,
    "thu-build-case": 2,
    "thu-resign": 1,
    "thu-frame-chief": 2
  };

  const focusLimits = [4, 4, 3, 3, 1];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function requireAuditEvent(action) {
    if (!action) return;
    const auditCondition = { eventDelivered: AUDIT_EVENT_ID };
    if (!action.requires) {
      action.requires = auditCondition;
      return;
    }
    if (action.requires.eventDelivered === AUDIT_EVENT_ID) return;
    action.requires = { all: [auditCondition, action.requires] };
  }

  Object.entries(Story.actions || {}).forEach(([id, action]) => {
    if (groupAssignments[id]) action.choiceGroup = groupAssignments[id];
    action.focusCost = Number(focusCosts[id] || action.focusCost || 1);
  });
  AUDIT_ACTION_IDS.forEach((id) => requireAuditEvent(Story.actions?.[id]));
  (Story.days || []).forEach((day, index) => {
    day.focusLimit = Number(day.focusLimit || focusLimits[index] || 4);
  });

  function ensureUsage(state) {
    state.metadata ||= {};
    state.metadata.dailyFocus ||= {};
    return state.metadata.dailyFocus;
  }

  function calculateUsedFocus(story, state, dayIndex) {
    return Object.keys(state.completedActions || {}).reduce((sum, actionId) => {
      const action = story.actions?.[actionId];
      if (!action || Number(action.dayIndex) !== Number(dayIndex)) return sum;
      return sum + Math.max(0, Number(action.focusCost || 1));
    }, 0);
  }

  function usedFocus(story, state, dayIndex) {
    const usage = ensureUsage(state);
    if (usage[dayIndex] === undefined) usage[dayIndex] = calculateUsedFocus(story, state, dayIndex);
    return Number(usage[dayIndex] || 0);
  }

  function completedGroupAction(story, state, group) {
    return Object.keys(state.completedActions || {}).find((id) => story.actions?.[id]?.choiceGroup === group) || null;
  }

  function auditEventDelivered(state) {
    return (state.deliveredEvents || []).includes(AUDIT_EVENT_ID);
  }

  function auditActionCompleted(state) {
    return AUDIT_ACTION_IDS.some((id) => Boolean(state.completedActions?.[id]));
  }

  function storedEnding(story, state) {
    if (!state.ended || !state.endingId) return null;
    const endings = Array.isArray(story.endings) ? story.endings : Object.values(story.endings || {});
    return endings.find((ending) => ending.id === state.endingId) || story.fallbackEnding || null;
  }

  Engine.createEngine = function createEngineWithRules(story, rawState = null, options = {}) {
    let core = originalCreateEngine(story, rawState, options);

    function getState() {
      return core.getState();
    }

    function ruleCheck(actionId) {
      const base = core.canApplyAction(actionId);
      if (!base.ok) return base;

      const action = story.actions?.[actionId];
      const state = getState();
      if (!action) return { ok: false, reason: "unknown-action" };

      if (action.choiceGroup) {
        const chosenActionId = completedGroupAction(story, state, action.choiceGroup);
        if (chosenActionId && chosenActionId !== actionId) {
          return { ok: false, reason: "choice-locked", chosenActionId, action };
        }
      }

      const used = usedFocus(story, state, state.dayIndex);
      const cost = Math.max(0, Number(action.focusCost || 1));
      const limit = Number(story.days?.[state.dayIndex]?.focusLimit || 4);
      if (used + cost > limit) {
        return { ok: false, reason: "focus-exhausted", used, cost, limit, action };
      }

      return { ok: true, action, used, cost, limit };
    }

    function applyAction(actionId, payload = {}) {
      const check = ruleCheck(actionId);
      if (!check.ok) return check;
      const result = core.applyAction(actionId, payload);
      if (!result.ok) return result;

      const nextState = result.state;
      const usage = ensureUsage(nextState);
      usage[nextState.dayIndex] = check.used + check.cost;
      core = originalCreateEngine(story, nextState);
      return { ...result, state: core.getState(), focus: { used: usage[nextState.dayIndex], limit: check.limit } };
    }

    function listActions(channel = null) {
      return core.listActions(channel).filter((action) => ruleCheck(action.id).ok);
    }

    function endDay(...args) {
      const state = getState();
      const shouldSkipAuditRequirement = state.dayIndex === 2 && !auditEventDelivered(state) && !auditActionCompleted(state);
      if (!shouldSkipAuditRequirement) return core.endDay(...args);

      const temporaryState = clone(state);
      temporaryState.completedActions ||= {};
      temporaryState.completedActions["wed-audit-explain"] = {
        dayIndex: 2,
        minute: temporaryState.minute,
        synthetic: true,
        result: "Проверка не назначалась."
      };

      const temporaryCore = originalCreateEngine(story, temporaryState);
      const result = temporaryCore.endDay(...args);
      if (!result?.ok || !result.state) return result;

      const cleanedState = clone(result.state);
      delete cleanedState.completedActions?.["wed-audit-explain"];
      core = originalCreateEngine(story, cleanedState);
      return { ...result, state: core.getState(), skippedRequirement: "wednesday-audit" };
    }

    function resolveEnding(...args) {
      const ending = storedEnding(story, getState());
      return ending ? clone(ending) : core.resolveEnding(...args);
    }

    return {
      startDay: (...args) => core.startDay(...args),
      currentDay: (...args) => core.currentDay(...args),
      listActions,
      listVisibleContent: (...args) => core.listVisibleContent(...args),
      canApplyAction: ruleCheck,
      applyAction,
      advanceTime: (...args) => core.advanceTime(...args),
      endDay,
      resolveEnding,
      conditionPasses: (...args) => core.conditionPasses(...args),
      getState,
      serialize: () => JSON.stringify(getState())
    };
  };

  Engine.__rulesExtended = true;
})(typeof globalThis !== "undefined" ? globalThis : window);
