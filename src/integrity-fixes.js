(function (root) {
  "use strict";

  const Engine = root.UntilFridayEngine;
  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Engine || !Story || root.UntilFridayIntegrityFixes) return;

  const ENGINE_SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const WORKFLOW_KEY = "until-friday-workflow-files-v1";
  const FRIDAY_SCENE_KEY = "until-friday-friday-scene-v1";
  const ENDING_SNAPSHOT_KEY = "until-friday-ending-snapshot-v1";
  const WORKDAY_END_MINUTE = 18 * 60;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function uniqueStrings(value) {
    return [...new Set((Array.isArray(value) ? value : []).filter((item) => typeof item === "string" && item))];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function patchStoryRules() {
    (Story.days || []).forEach((day, dayIndex) => {
      if (day && day.dayIndex === undefined) day.dayIndex = dayIndex;
    });

    const mondayRequirement = Story.days?.[0]?.requirements?.find((item) => item.id === "monday-core-work");
    if (mondayRequirement) {
      mondayRequirement.label = "Не выполнены обе основные рабочие задачи";
      mondayRequirement.satisfiedWhen = {
        all: [
          {
            any: [
              { actionDone: "mon-report-final" },
              { actionDone: "mon-report-old" }
            ]
          },
          {
            any: [
              { actionDone: "mon-invoice-fix" },
              { actionDone: "mon-invoice-report" }
            ]
          }
        ]
      };
    }
  }

  function dedupeObjects(items, keyOf) {
    const result = [];
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || typeof item !== "object") continue;
      const key = keyOf(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  function validTruthId(story, value, seed) {
    const ids = new Set((story.truths || []).map((item) => item.id));
    if (ids.has(value)) return value;
    return Engine.chooseWeighted?.(story.truths || [], seed || "repaired-save") || story.truths?.[0]?.id || value || null;
  }

  function validEndingId(story, value) {
    const endings = Array.isArray(story.endings) ? story.endings : Object.values(story.endings || {});
    if (endings.some((item) => item.id === value)) return value;
    return story.fallbackEnding?.id || endings[0]?.id || value || null;
  }

  function repairScheduledEvents(story, state) {
    const delivered = new Set(uniqueStrings(state.deliveredEvents));
    const events = story.events || {};
    const repaired = [];
    const seen = new Set();

    function append(item) {
      if (!item || !events[item.eventId] || delivered.has(item.eventId)) return;
      const dayIndex = clamp(item.dayIndex, 0, Math.max(0, (story.days?.length || 1) - 1));
      if (dayIndex < state.dayIndex) return;
      const minute = Math.max(0, Number(item.minute) || Number(story.days?.[dayIndex]?.startMinute) || 0);
      const key = `${item.eventId}:${dayIndex}:${minute}`;
      if (seen.has(key)) return;
      seen.add(key);
      repaired.push({
        eventId: item.eventId,
        dayIndex,
        minute,
        sourceAction: item.sourceAction || null
      });
    }

    (Array.isArray(state.scheduledEvents) ? state.scheduledEvents : []).forEach(append);

    for (const actionId of Object.keys(state.completedActions || {})) {
      const action = story.actions?.[actionId];
      for (const schedule of action?.effects?.schedule || []) {
        append({
          eventId: schedule.eventId,
          dayIndex: schedule.dayIndex ?? action.dayIndex ?? state.dayIndex,
          minute: schedule.minute ?? state.completedActions[actionId]?.minute ?? state.minute,
          sourceAction: actionId
        });
      }
    }

    return repaired;
  }

  function repairEngineState(story, rawState) {
    if (!isObject(rawState)) return rawState;
    const state = clone(rawState);
    const lastDayIndex = Math.max(0, (story.days?.length || 1) - 1);

    state.seed = String(state.seed || "repaired-save");
    state.truthId = validTruthId(story, state.truthId, state.seed);
    state.dayIndex = clamp(state.dayIndex, 0, lastDayIndex);
    state.minute = clamp(state.minute || story.days?.[state.dayIndex]?.startMinute || 0, 0, WORKDAY_END_MINUTE);
    state.dayStarted = Boolean(state.dayStarted);
    state.ended = Boolean(state.ended);
    state.endingId = state.ended ? validEndingId(story, state.endingId) : null;

    state.stats = isObject(state.stats) ? state.stats : {};
    state.trust = isObject(state.trust) ? state.trust : {};
    state.flags = isObject(state.flags) ? state.flags : {};
    state.completedActions = isObject(state.completedActions) ? state.completedActions : {};
    state.metadata = isObject(state.metadata) ? state.metadata : {};
    state.metadata.dailyFocus = isObject(state.metadata.dailyFocus) ? state.metadata.dailyFocus : {};

    state.access = uniqueStrings(state.access);
    state.inventory = uniqueStrings(state.inventory);
    state.unlockedContent = uniqueStrings(state.unlockedContent);
    state.deliveredEvents = uniqueStrings(state.deliveredEvents);
    state.missedRequirements = Array.isArray(state.missedRequirements) ? state.missedRequirements.filter(isObject) : [];
    state.journal = Array.isArray(state.journal) ? state.journal.filter(isObject) : [];
    state.inbox = dedupeObjects(state.inbox, (item) => item.id || `${item.dayIndex}:${item.minute}:${item.source}:${item.title}`);
    state.scheduledEvents = repairScheduledEvents(story, state);

    return state;
  }

  function sanitizeWorkflowStorage() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(WORKFLOW_KEY) || "null");
    } catch {
      localStorage.removeItem(WORKFLOW_KEY);
      return;
    }
    if (!raw) return;

    const files = dedupeObjects(raw.files, (item) => String(item.id || ""));
    const fileIds = new Set(files.map((item) => String(item.id)));
    const trash = dedupeObjects(raw.trash, (item) => String(item.id || ""))
      .filter((item) => !fileIds.has(String(item.id)));
    const log = Array.isArray(raw.log) ? raw.log.filter(isObject).slice(0, 30) : [];

    try {
      localStorage.setItem(WORKFLOW_KEY, JSON.stringify({ files, trash, log }));
    } catch {
      // The game will continue without rewriting the optional workflow cache.
    }
  }

  function clearStaleFinaleData() {
    let save = null;
    try {
      save = JSON.parse(localStorage.getItem(ENGINE_SAVE_KEY) || "null");
    } catch {
      save = null;
    }

    if (!save) {
      localStorage.removeItem(FRIDAY_SCENE_KEY);
      try { sessionStorage.removeItem(ENDING_SNAPSHOT_KEY); } catch { /* unavailable */ }
      return;
    }

    if (!save.ended) {
      try { sessionStorage.removeItem(ENDING_SNAPSHOT_KEY); } catch { /* unavailable */ }
    }
  }

  patchStoryRules();
  sanitizeWorkflowStorage();
  clearStaleFinaleData();

  const originalCreateEngine = Engine.createEngine.bind(Engine);
  Engine.createEngine = function createEngineWithIntegrity(story, rawState = null, options = {}) {
    return originalCreateEngine(story, rawState ? repairEngineState(story, rawState) : rawState, options);
  };

  root.UntilFridayIntegrityFixes = {
    WORKDAY_END_MINUTE,
    patchStoryRules,
    repairEngineState,
    repairScheduledEvents,
    sanitizeWorkflowStorage
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
