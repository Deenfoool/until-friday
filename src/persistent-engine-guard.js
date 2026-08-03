(function (root) {
  "use strict";

  const Engine = root.UntilFridayEngine;
  if (!Engine || root.UntilFridayPersistentEngineGuard) return;

  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const originalCreateEngine = Engine.createEngine.bind(Engine);
  let activeEngine = null;
  let lastNoticeAt = 0;

  function notify(title, text) {
    const now = Date.now();
    if (now - lastNoticeAt < 800) return;
    lastNoticeAt = now;
    const doc = root.document;
    const container = doc?.querySelector?.("#notifications");
    if (!container || !doc?.createElement) return;
    const item = doc.createElement("button");
    item.type = "button";
    item.className = "notification atomic-save-notification";
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
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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

  Engine.createEngine = function createEngineWithAtomicActions(story, rawState = null, options = {}) {
    let core = originalCreateEngine(story, rawState, options);

    function getState() {
      return core.getState();
    }

    function applyAction(actionId, payload = {}) {
      const before = getState();
      let result;
      try {
        result = core.applyAction(actionId, payload);
      } catch (error) {
        core = originalCreateEngine(story, before, options);
        notify("Действие отменено", "Произошла внутренняя ошибка. Состояние восстановлено до клика.");
        return {
          ok: false,
          reason: "action-exception",
          message: error?.message || String(error),
          rolledBack: true,
          state: getState()
        };
      }
      if (!result?.ok) return result;

      const nextState = result.state || getState();
      const saved = persist(nextState);
      if (saved.ok) return { ...result, persisted: true, state: nextState };

      core = originalCreateEngine(story, before, options);
      notify("Действие не сохранено", "Изменение полностью отменено. Освободите место в браузере и повторите действие.");
      return {
        ok: false,
        reason: saved.reason,
        message: saved.message,
        rolledBack: true,
        action: result.action || story.actions?.[actionId] || null,
        state: getState()
      };
    }

    const wrapper = {
      startDay: (...args) => core.startDay(...args),
      currentDay: (...args) => core.currentDay(...args),
      listActions: (...args) => core.listActions(...args),
      listVisibleContent: (...args) => core.listVisibleContent(...args),
      canApplyAction: (...args) => core.canApplyAction(...args),
      applyAction,
      advanceTime: (...args) => core.advanceTime(...args),
      endDay: (...args) => core.endDay(...args),
      resolveEnding: (...args) => core.resolveEnding(...args),
      conditionPasses: (...args) => core.conditionPasses(...args),
      getState,
      serialize: () => JSON.stringify(getState())
    };

    activeEngine = wrapper;
    return wrapper;
  };

  if (root.UntilFridayDayTransitionGuard) {
    root.UntilFridayDayTransitionGuard.getEngine = () => activeEngine;
  }

  root.UntilFridayPersistentEngineGuard = {
    SAVE_KEY,
    persist,
    notify,
    getEngine: () => activeEngine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
