(function (root) {
  "use strict";

  const Runtime = root.UntilFridayRuntimeEngine;
  if (!Runtime || root.UntilFridayPersistentEngineGuard) return;

  root.UntilFridayPersistentEngineGuard = {
    SAVE_KEY: Runtime.SAVE_KEY,
    persist: Runtime.persist,
    notify: Runtime.notify,
    getEngine: Runtime.getEngine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
