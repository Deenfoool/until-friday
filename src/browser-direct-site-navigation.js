(function (root) {
  "use strict";

  if (root.UntilFridayBrowserDirectSiteNavigation) return;

  const BrowserUI = root.UntilFridayPersonalBrowserUIV2;
  const Marketplace = root.UntilFridayMarketplaceParody;
  const VideoPlatform = root.UntilFridayVideoPlatformParody;
  const VideoFixes = root.UntilFridayVideoPlatformRuntimeFixes;

  if (!BrowserUI || !Marketplace || !VideoPlatform) return;

  const SITE_CONFIG = {
    market: {
      url: "https://kupitut.local/",
      title: "КупиТут",
      render() {
        Marketplace.renderMarketplace?.();
      }
    },
    video: {
      url: "https://video.local/",
      title: "ВидеоЛента",
      render() {
        VideoPlatform.render?.();
        VideoFixes?.schedule?.();
      }
    }
  };

  const DIRECT_PAGE_SELECTOR = '[data-rb-page="market"], [data-rb-page="video"]';
  const AFTER_NAV_SELECTOR = [
    "[data-rb-nav]",
    "[data-rb-tab]",
    "[data-rb-close-tab]",
    "[data-rb-new-tab]",
    "[data-rb-menu-action]"
  ].join(",");

  const originalNavigate = BrowserUI.navigate.bind(BrowserUI);
  let renderToken = 0;

  function browserWindow() {
    return document.querySelector(".personal-browser-window");
  }

  function currentAddress() {
    return browserWindow()?.querySelector(".rb-address input")?.value || "";
  }

  function pageFromAddress(value) {
    const address = String(value || "").toLowerCase();
    if (address.includes("kupitut.local")) return "market";
    if (address.includes("video.local")) return "video";
    return null;
  }

  function clearWrongSiteFlag(page) {
    const windowElement = browserWindow();
    if (!windowElement) return;
    if (page !== "market") delete windowElement.dataset.marketplaceActive;
    if (page !== "video") delete windowElement.dataset.videoPlatformActive;
  }

  function renderSite(page) {
    const config = SITE_CONFIG[page];
    if (!config) return false;

    clearWrongSiteFlag(page);
    config.render();

    const expectedToken = ++renderToken;
    root.requestAnimationFrame?.(() => {
      if (expectedToken !== renderToken) return;
      if (pageFromAddress(currentAddress()) !== page) return;

      const windowElement = browserWindow();
      const ready = page === "market"
        ? windowElement?.dataset.marketplaceActive === "true"
        : windowElement?.dataset.videoPlatformActive === "true";

      if (!ready) config.render();
    });

    return true;
  }

  function openSite(page, data = {}) {
    const config = SITE_CONFIG[page];
    if (!config) return false;

    originalNavigate(page, {
      url: data.url || config.url,
      title: data.title || config.title,
      query: data.query || ""
    }, Boolean(data.replace));

    renderSite(page);
    return true;
  }

  function renderCurrentSite() {
    const page = pageFromAddress(currentAddress());
    if (!page) {
      clearWrongSiteFlag(null);
      return false;
    }
    return renderSite(page);
  }

  function addressFromButton(button) {
    return button?.dataset?.rbAddressValue || "";
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(DIRECT_PAGE_SELECTOR);
    if (!button) return;

    const page = button.dataset.rbPage;
    event.preventDefault();
    event.stopImmediatePropagation();
    openSite(page);
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-rb-address-value]");
    const address = addressFromButton(button);
    const page = pageFromAddress(address);
    if (!page) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openSite(page, { url: address });
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("[data-rb-address]");
    if (!form) return;

    const address = form.querySelector("input")?.value || "";
    const page = pageFromAddress(address);
    if (!page) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openSite(page, { url: address });
  }, true);

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.(AFTER_NAV_SELECTOR)) return;
    root.setTimeout?.(renderCurrentSite, 0);
  });

  BrowserUI.navigate = function directSiteNavigate(page, data = {}, replace = false) {
    const result = originalNavigate(page, data, replace);
    if (SITE_CONFIG[page]) renderSite(page);
    else root.setTimeout?.(renderCurrentSite, 0);
    return result;
  };

  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "browser") {
      root.requestAnimationFrame?.(renderCurrentSite);
    }
  });

  root.UntilFridayBrowserDirectSiteNavigation = {
    SITE_CONFIG,
    DIRECT_PAGE_SELECTOR,
    pageFromAddress,
    currentAddress,
    renderSite,
    openSite,
    renderCurrentSite
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
