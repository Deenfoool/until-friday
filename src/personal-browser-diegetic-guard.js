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

  function browserWindow() {
    return document.querySelector(".personal-browser-window");
  }

  function currentAddress(windowElement = browserWindow()) {
    return windowElement?.querySelector(".rb-address input")?.value || "";
  }

  function hideLegacyFrame() {
    const windowElement = browserWindow();
    if (windowElement && !windowElement.dataset.browserV2) {
      windowElement.dataset.browserV2 = "pending";
    }
  }

  function refreshBrowser() {
    const windowElement = browserWindow();
    if (!windowElement) return;

    const address = currentAddress(windowElement);
    if (address.includes("video.local")) {
      root.UntilFridayVideoPlatformParody?.schedule?.();
      root.UntilFridayVideoPlatformRuntimeFixes?.schedule?.();
      return;
    }
    if (address.includes("kupitut.local")) {
      root.UntilFridayMarketplaceParody?.schedule?.();
      return;
    }

    hideLegacyFrame();
    root.UntilFridayPersonalBrowserUIV2?.schedule?.();
  }

  root.addEventListener?.("until-friday-state-change", refreshBrowser);
  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "browser") refreshBrowser();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-personal-browser-launcher]")) {
      root.setTimeout?.(refreshBrowser, 0);
    }
  }, true);

  root.UntilFridayPersonalBrowserDiegeticGuard = {
    browserWindow,
    currentAddress,
    hideLegacyFrame,
    refreshBrowser
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
