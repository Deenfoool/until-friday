(function (root) {
  "use strict";

  if (root.UntilFridayMarketplaceListenerGate) return;

  const doc = root.document;
  const originalAddEventListener = doc?.addEventListener;
  if (!doc || typeof originalAddEventListener !== "function") return;

  const blocked = [];

  function usesCapture(options) {
    return options === true || Boolean(options && typeof options === "object" && options.capture);
  }

  function gatedDocumentAddEventListener(type, listener, options) {
    const redundantMarketplaceRefresh =
      (type === "click" || type === "submit") &&
      typeof listener === "function" &&
      usesCapture(options);

    if (redundantMarketplaceRefresh) {
      blocked.push({ type, listener, options });
      return;
    }

    return originalAddEventListener.call(doc, type, listener, options);
  }

  doc.addEventListener = gatedDocumentAddEventListener;

  root.UntilFridayMarketplaceListenerGate = {
    blocked,
    originalAddEventListener,
    restore() {
      if (doc.addEventListener === gatedDocumentAddEventListener) {
        doc.addEventListener = originalAddEventListener;
      }
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
