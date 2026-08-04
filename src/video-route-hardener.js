(function (root) {
  "use strict";

  if (root.UntilFridayVideoRouteHardener) return;

  const VIDEO_ROOT = "https://video.local/";
  let settleToken = 0;

  function browserWindow() {
    return document.querySelector(".personal-browser-window");
  }

  function currentAddress() {
    return browserWindow()?.querySelector(".rb-address input")?.value || "";
  }

  function isVideoAddress(value = currentAddress()) {
    return String(value || "").toLowerCase().includes("video.local");
  }

  function renderVideoRoute() {
    if (!isVideoAddress()) return false;
    root.UntilFridayVideoPlatformParody?.render?.();
    root.UntilFridayVideoPlatformRuntimeFixes?.schedule?.();
    return true;
  }

  function settleVideoRoute() {
    const token = ++settleToken;
    const settle = () => {
      if (token !== settleToken) return;
      renderVideoRoute();
    };

    root.setTimeout?.(settle, 0);
    root.requestAnimationFrame?.(() => {
      settle();
      root.requestAnimationFrame?.(settle);
    });
    root.setTimeout?.(settle, 50);
  }

  function openVideoAddress(url = VIDEO_ROOT, title = "ВидеоЛента") {
    root.UntilFridayPersonalBrowserUIV2?.navigate?.("video", {
      url: String(url || VIDEO_ROOT),
      title
    });
    settleVideoRoute();
  }

  document.addEventListener("click", (event) => {
    const videoPageLink = event.target.closest?.('[data-rb-page="video"]');
    const storedAddress = event.target.closest?.("[data-rb-address-value]")?.dataset?.rbAddressValue;

    if (videoPageLink || isVideoAddress(storedAddress)) {
      root.setTimeout?.(settleVideoRoute, 0);
      return;
    }

    if (event.target.closest?.(".personal-browser-window") && isVideoAddress()) {
      root.setTimeout?.(settleVideoRoute, 0);
    }
  });

  document.addEventListener("submit", (event) => {
    const addressForm = event.target.closest?.("[data-rb-address]");
    const submittedAddress = addressForm?.querySelector("input")?.value || "";

    if (isVideoAddress(submittedAddress)) {
      root.setTimeout?.(settleVideoRoute, 0);
      return;
    }

    if (event.target.closest?.(".personal-browser-window") && isVideoAddress()) {
      root.setTimeout?.(settleVideoRoute, 0);
    }
  });

  root.addEventListener?.("until-friday-app-ready", settleVideoRoute);
  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "browser") settleVideoRoute();
  });

  root.UntilFridayVideoRouteHardener = {
    VIDEO_ROOT,
    currentAddress,
    isVideoAddress,
    renderVideoRoute,
    settleVideoRoute,
    openVideoAddress
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
