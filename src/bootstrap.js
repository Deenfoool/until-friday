(function () {
  "use strict";

  let fallbackStarted = false;
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

    window.addEventListener("error", (event) => {
      if (!window.__UNTIL_FRIDAY_V2_READY__) loadLegacy(event.message);
    }, { once: true });

    const script = document.createElement("script");
    script.src = "src/app-v2.js";
    script.onload = () => {
      if (!window.__UNTIL_FRIDAY_V2_READY__) {
        loadLegacy("v2-did-not-signal-ready");
        return;
      }
      window.dispatchEvent(new CustomEvent("until-friday-app-ready"));
      finishLoading();
    };
    script.onerror = () => loadLegacy("v2-script-load-error");
    document.body.appendChild(script);
  }

  if (new URLSearchParams(window.location.search).get("legacy") === "1") {
    loadLegacy("forced-by-query");
    return;
  }

  Promise.resolve(Onboarding?.run?.())
    .then(loadGame)
    .catch((error) => {
      console.error("Не удалось запустить вступление.", error);
      loadGame();
    });
})();
