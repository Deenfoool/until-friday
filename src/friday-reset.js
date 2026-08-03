(function () {
  "use strict";

  const SCENE_KEY = "until-friday-friday-scene-v1";
  const SNAPSHOT_KEY = "until-friday-ending-snapshot-v1";
  const ENGINE_SAVE_KEY = "until-friday-save-v2";
  const LEGACY_SAVE_KEY = "until-friday-save-v1";
  let resetRequested = false;

  function clearFinaleData() {
    localStorage.removeItem(SCENE_KEY);
    try { sessionStorage.removeItem(SNAPSHOT_KEY); } catch { /* unavailable */ }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-new-game]")) {
      window.setTimeout(() => {
        const saveExists = localStorage.getItem(ENGINE_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
        if (!saveExists) clearFinaleData();
      }, 0);
    }

    if (event.target.closest("#reset-button")) {
      resetRequested = true;
      window.setTimeout(() => { resetRequested = false; }, 0);
    }
  }, true);

  window.addEventListener("beforeunload", () => {
    if (resetRequested) clearFinaleData();
  });

  window.UntilFridayFridayReset = { SCENE_KEY, SNAPSHOT_KEY, clearFinaleData };
})();
