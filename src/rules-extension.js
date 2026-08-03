(function (root) {
  "use strict";

  const Engine = root.UntilFridayEngine;
  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Engine || !Story || Engine.__rulesExtended) return;

  const originalCreateEngine = Engine.createEngine;

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

  Object.entries(Story.actions || {}).forEach(([id, action]) => {
    if (groupAssignments[id]) action.choiceGroup = groupAssignments[id];
    action.focusCost = Number(focusCosts[id] || action.focusCost || 1);
  });
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

    return {
      startDay: (...args) => core.startDay(...args),
      currentDay: (...args) => core.currentDay(...args),
      listActions,
      listVisibleContent: (...args) => core.listVisibleContent(...args),
      canApplyAction: ruleCheck,
      applyAction,
      advanceTime: (...args) => core.advanceTime(...args),
      endDay: (...args) => core.endDay(...args),
      resolveEnding: (...args) => core.resolveEnding(...args),
      conditionPasses: (...args) => core.conditionPasses(...args),
      getState,
      serialize: () => JSON.stringify(getState())
    };
  };

  Engine.__rulesExtended = true;
})(typeof globalThis !== "undefined" ? globalThis : window);
