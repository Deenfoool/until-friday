(function () {
  "use strict";

  const SCENE_KEY = "until-friday-friday-scene-v1";
  const ENGINE_SAVE_KEY = "until-friday-save-v2";
  const LEGACY_SAVE_KEY = "until-friday-save-v1";
  let resetRequested = false;

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-new-game]")) {
      window.setTimeout(() => {
        const saveExists = localStorage.getItem(ENGINE_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
        if (!saveExists) localStorage.removeItem(SCENE_KEY);
      }, 0);
    }

    if (event.target.closest("#reset-button")) {
      resetRequested = true;
      window.setTimeout(() => { resetRequested = false; }, 0);
    }
  }, true);

  window.addEventListener("beforeunload", () => {
    if (resetRequested) localStorage.removeItem(SCENE_KEY);
  });

  window.UntilFridayFridayReset = { SCENE_KEY };
})();
