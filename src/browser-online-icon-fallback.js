(function (root) {
  "use strict";

  if (root.UntilFridayBrowserOnlineIconFallback) return;
  const FALLBACK = "https://img.icons8.com/fluency/96/package.png";

  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (!image.src.includes("img.icons8.com") || image.dataset.iconFallback === "true") return;
    image.dataset.iconFallback = "true";
    image.src = FALLBACK;
  }, true);

  root.UntilFridayBrowserOnlineIconFallback = { FALLBACK };
})(typeof globalThis !== "undefined" ? globalThis : window);
