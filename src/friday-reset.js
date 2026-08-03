(function (root) {
  "use strict";

  const SCENE_KEY = "until-friday-friday-scene-v1";
  const SNAPSHOT_KEY = "until-friday-ending-snapshot-v1";
  const NOTIFICATION_HISTORY_KEY = "until-friday-notification-history-v1";
  const AUTO_CONTINUE_KEY = "until-friday-auto-continue-v1";

  function clearFinaleData() {
    try { localStorage.removeItem(SCENE_KEY); } catch { /* unavailable */ }
    try { localStorage.removeItem(NOTIFICATION_HISTORY_KEY); } catch { /* unavailable */ }
    try { sessionStorage.removeItem(SNAPSHOT_KEY); } catch { /* unavailable */ }
    try { sessionStorage.removeItem(AUTO_CONTINUE_KEY); } catch { /* unavailable */ }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-new-game]")) clearFinaleData();
  }, true);

  root.UntilFridayFridayReset = {
    SCENE_KEY,
    SNAPSHOT_KEY,
    NOTIFICATION_HISTORY_KEY,
    AUTO_CONTINUE_KEY,
    clearFinaleData
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
