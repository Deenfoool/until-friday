(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UntilFridayMigration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LEGACY_SAVE_KEY = "until-friday-save-v1";
  const ENGINE_SAVE_KEY = "until-friday-save-v2";

  const taskActionMap = {
    "task-report-final": "mon-report-final",
    "task-report-old": "mon-report-old",
    "task-report-copy": "mon-copy-reports",
    "task-invoice-fix": "mon-invoice-fix",
    "task-invoice-report": "mon-invoice-report"
  };

  function migrateLegacyState(legacy, Engine, story) {
    if (!legacy || typeof legacy !== "object") return null;
    if (!Engine?.createState || !story) throw new Error("Engine and story are required for migration.");

    const state = Engine.createState(story, {
      seed: legacy.seed || `legacy-${Date.now()}`,
      stats: {
        work: Number(legacy.workQuality || 0),
        suspicion: Number(legacy.suspicion || 0),
        evidence: Number(legacy.evidence || 0),
        anxiety: Number(legacy.anxiety ?? 1)
      },
      trust: legacy.trust || {},
      flags: legacy.flags || {},
      inventory: legacy.copiedFiles || []
    });

    state.dayStarted = Boolean(legacy.bootComplete);
    state.minute = Number(legacy.currentMinute || state.minute);
    state.flags.legacySaveMigrated = true;
    state.flags.introCompleted = Boolean(legacy.bootComplete);
    state.deliveredEvents = [...new Set(legacy.events || [])];

    for (const completed of Object.values(legacy.completedTasks || {})) {
      const actionId = taskActionMap[completed?.option];
      if (!actionId) continue;
      state.completedActions[actionId] = {
        dayIndex: 0,
        minute: state.minute,
        result: completed.message || "Перенесено из сохранения первой версии.",
        migrated: true
      };
    }

    if (legacy.openedFiles?.includes("vacancy")) {
      state.flags.sawVacancy = true;
      state.completedActions["mon-open-vacancy"] = {
        dayIndex: 0,
        minute: state.minute,
        result: "Вакансия была открыта в первой версии.",
        migrated: true
      };
    }
    if (legacy.flags?.openedRestricted || legacy.flags?.askedAdmin) {
      state.flags.requestedLeadershipAccess = true;
      state.completedActions["mon-request-leadership-access"] = {
        dayIndex: 0,
        minute: state.minute,
        result: "Запрос доступа перенесён из первой версии.",
        migrated: true
      };
    }
    if (legacy.flags?.toldFriend) {
      state.flags.toldFriend = true;
      state.completedActions["mon-tell-friend"] = {
        dayIndex: 0,
        minute: state.minute,
        result: "Разговор с Димой перенесён из первой версии.",
        migrated: true
      };
    }

    state.journal.push({
      type: "migration",
      text: "Сохранение понедельника перенесено в игровой движок v2.",
      details: { legacyVersion: 1 },
      dayIndex: 0,
      minute: state.minute
    });
    return state;
  }

  function migrateLocalStorage(storage, Engine, story) {
    if (!storage) return { migrated: false, reason: "storage-unavailable" };
    if (storage.getItem(ENGINE_SAVE_KEY)) return { migrated: false, reason: "v2-save-exists" };
    const raw = storage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return { migrated: false, reason: "legacy-save-missing" };

    try {
      const migratedState = migrateLegacyState(JSON.parse(raw), Engine, story);
      storage.setItem(ENGINE_SAVE_KEY, JSON.stringify(migratedState));
      return { migrated: true, state: migratedState };
    } catch (error) {
      return { migrated: false, reason: "invalid-legacy-save", error: String(error?.message || error) };
    }
  }

  return {
    LEGACY_SAVE_KEY,
    ENGINE_SAVE_KEY,
    migrateLegacyState,
    migrateLocalStorage
  };
});