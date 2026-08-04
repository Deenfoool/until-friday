(function (root) {
  "use strict";

  if (root.UntilFridayMarketplaceScrollPreserver) return;

  let token = 0;
  let savedTop = 0;
  let savedLeft = 0;

  function marketPage() {
    const windowElement = document.querySelector(".personal-browser-window[data-marketplace-active='true']");
    if (!windowElement) return null;
    const address = windowElement.querySelector(".rb-address input")?.value || "";
    if (!address.includes("kupitut.local")) return null;
    return windowElement.querySelector(".rb-page");
  }

  function remember() {
    const page = marketPage();
    if (!page) return false;
    savedTop = page.scrollTop;
    savedLeft = page.scrollLeft;
    return true;
  }

  function restore(expectedToken) {
    if (expectedToken !== token) return;
    const page = marketPage();
    if (!page) return;
    page.scrollTop = savedTop;
    page.scrollLeft = savedLeft;
  }

  function preserveAfterInteraction() {
    if (!remember()) return;
    const expectedToken = ++token;
    root.setTimeout?.(() => restore(expectedToken), 0);
    root.requestAnimationFrame?.(() => {
      restore(expectedToken);
      root.requestAnimationFrame?.(() => restore(expectedToken));
    });
    root.setTimeout?.(() => restore(expectedToken), 40);
  }

  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest?.(".personal-browser-window[data-marketplace-active='true']")) {
      preserveAfterInteraction();
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target.closest?.(".personal-browser-window[data-marketplace-active='true']")) {
      preserveAfterInteraction();
    }
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target.closest?.(".personal-browser-window[data-marketplace-active='true']")) {
      preserveAfterInteraction();
    }
  }, true);

  root.UntilFridayMarketplaceScrollPreserver = {
    marketPage,
    remember,
    restore,
    preserveAfterInteraction
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
