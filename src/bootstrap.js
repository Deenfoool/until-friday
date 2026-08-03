(function () {
  "use strict";

  let fallbackStarted = false;
  let v2LoadFinished = false;
  const Loading = window.UntilFridayLoading;
  const Onboarding = window.UntilFridayOnboarding;

  function finishLoading() {
    Loading?.hideScreen();
  }

  function loadLegacy(reason) {
    if (fallbackStarted || window.__UNTIL_FRIDAY_V2_READY__) return;
    fallbackStarted = true;
    console.warn("Новая версия интерфейса не запустилась, загружается совместимый прототип.", reason || "unknown");
    Loading?.showScreen("Запуск совместимого режима...");

    const script = document.createElement("script");
    script.src = "src/app.js";
    script.dataset.fallback = "legacy";
    script.onload = finishLoading;
    script.onerror = finishLoading;
    document.body.appendChild(script);
  }

  function loadGame() {
    Loading?.showScreen("Загрузка корпоративной системы...");

    const script = document.createElement("script");
    script.src = "src/app-v2.js";
    script.onload = () => {
      v2LoadFinished = true;
      if (fallbackStarted) return;
      if (!window.__UNTIL_FRIDAY_V2_READY__) {
        loadLegacy("v2-did-not-signal-ready");
        return;
      }
      window.dispatchEvent(new CustomEvent("until-friday-app-ready"));
      finishLoading();
    };
    script.onerror = () => {
      v2LoadFinished = true;
      loadLegacy("v2-script-load-error");
    };
    document.body.appendChild(script);
  }

  if (new URLSearchParams(window.location.search).get("legacy") === "1") {
    loadLegacy("forced-by-query");
    return;
  }

  Promise.resolve(Onboarding?.run?.())
    .then(() => {
      if (!v2LoadFinished && !fallbackStarted) loadGame();
    })
    .catch((error) => {
      console.error("Не удалось запустить вступление.", error);
      if (!v2LoadFinished && !fallbackStarted) loadGame();
    });
})();
