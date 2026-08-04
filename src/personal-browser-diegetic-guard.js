(function (root) {
  "use strict";

  if (root.UntilFridayPersonalBrowserDiegeticGuard) return;
  const Runtime = root.UntilFridayRuntimeEngine;
  const originalNotify = Runtime?.notify?.bind(Runtime) || null;

  if (Runtime && originalNotify && !Runtime.__personalBrowserDiegeticNotify) {
    Runtime.__personalBrowserDiegeticNotify = true;
    Runtime.notify = function browserNotify(title, text) {
      if (title === "Личное время") return;
      return originalNotify(title, text);
    };
  }

  function hideLegacyFrame() {
    const windowElement = document.querySelector(".personal-browser-window");
    if (windowElement) windowElement.dataset.browserV2 = "pending";
  }

  function refreshBrowser() {
    hideLegacyFrame();
    root.UntilFridayPersonalBrowserUIV2?.schedule?.();
  }

  root.addEventListener?.("until-friday-state-change", refreshBrowser);
  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "browser") refreshBrowser();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".personal-browser-window, [data-personal-browser-launcher]")) {
      root.setTimeout?.(refreshBrowser, 0);
    }
  }, true);

  root.UntilFridayPersonalBrowserDiegeticGuard = { hideLegacyFrame, refreshBrowser };
})(typeof globalThis !== "undefined" ? globalThis : window);
