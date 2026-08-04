(function (root) {
  "use strict";

  if (root.UntilFridayPersonalBrowserNotificationGuard) return;

  const Runtime = root.UntilFridayRuntimeEngine;
  const originalNotify = Runtime?.notify?.bind(Runtime) || null;

  if (Runtime && originalNotify && !Runtime.__personalBrowserNotificationGuard) {
    Runtime.__personalBrowserNotificationGuard = true;
    Runtime.notify = function browserNotify(title, text) {
      if (title === "Личное время") return;
      return originalNotify(title, text);
    };
  }

  root.UntilFridayPersonalBrowserNotificationGuard = { originalNotify };
})(typeof globalThis !== "undefined" ? globalThis : window);
