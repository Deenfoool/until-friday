(function (root) {
  "use strict";

  if (root.UntilFridayBrowserSiteRouter) return;

  const BrowserUI = root.UntilFridayPersonalBrowserUIV2;
  if (!BrowserUI) return;

  const NAVIGATION_SELECTOR = [
    "[data-rb-page]",
    "[data-rb-address-value]",
    "[data-rb-nav]",
    "[data-rb-tab]",
    "[data-rb-close-tab]",
    "[data-rb-menu-action]",
    "[data-rb-new-tab]",
    "[data-rb-bookmark]",
    "[data-rb-menu]"
  ].join(",");

  const FORM_SELECTOR = [
    "[data-rb-address]",
    "[data-rb-search]",
    "[data-rb-site-search]"
  ].join(",");

  let microtaskQueued = false;
  let frameQueued = false;

  function browserWindow() {
    return document.querySelector(".personal-browser-window");
  }

  function currentAddress(windowElement = browserWindow()) {
    return windowElement?.querySelector(".rb-address input")?.value || "";
  }

  function clearInactiveFlags(windowElement, activeSite) {
    if (!windowElement) return;
    if (activeSite !== "market") delete windowElement.dataset.marketplaceActive;
    if (activeSite !== "video") delete windowElement.dataset.videoPlatformActive;
  }

  function renderCurrentSite() {
    microtaskQueued = false;
    frameQueued = false;

    const windowElement = browserWindow();
    if (!windowElement) return false;

    const address = currentAddress(windowElement).toLowerCase();

    if (address.includes("kupitut.local")) {
      clearInactiveFlags(windowElement, "market");
      root.UntilFridayMarketplaceParody?.renderMarketplace?.();
      return true;
    }

    if (address.includes("video.local")) {
      clearInactiveFlags(windowElement, "video");
      root.UntilFridayVideoPlatformParody?.render?.();
      root.UntilFridayVideoPlatformRuntimeFixes?.schedule?.();
      return true;
    }

    clearInactiveFlags(windowElement, "base");
    return false;
  }

  function queueAfterNavigation() {
    if (microtaskQueued) return;
    microtaskQueued = true;
    const run = () => renderCurrentSite();
    if (typeof root.queueMicrotask === "function") root.queueMicrotask(run);
    else Promise.resolve().then(run);
  }

  function queueAfterBrowserFrame() {
    if (frameQueued) return;
    frameQueued = true;
    const run = () => renderCurrentSite();
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(run);
    else root.setTimeout?.(run, 0);
  }

  const originalNavigate = BrowserUI.navigate.bind(BrowserUI);
  BrowserUI.navigate = function routedNavigate(...args) {
    const result = originalNavigate(...args);
    renderCurrentSite();
    return result;
  };

  const originalRender = BrowserUI.render.bind(BrowserUI);
  BrowserUI.render = function routedRender(...args) {
    const result = originalRender(...args);
    renderCurrentSite();
    return result;
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest?.(NAVIGATION_SELECTOR)) queueAfterNavigation();
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target.closest?.(FORM_SELECTOR)) queueAfterNavigation();
  }, true);

  root.addEventListener?.("keydown", (event) => {
    if (!event.ctrlKey) return;
    if (["t", "w", "h", "j"].includes(String(event.key || "").toLowerCase())) {
      queueAfterNavigation();
    }
  }, true);

  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "browser") queueAfterBrowserFrame();
  });

  root.UntilFridayBrowserSiteRouter = {
    NAVIGATION_SELECTOR,
    FORM_SELECTOR,
    browserWindow,
    currentAddress,
    renderCurrentSite,
    queueAfterNavigation,
    queueAfterBrowserFrame
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
