(function (root) {
  "use strict";

  if (root.UntilFridayBrowserStateRenderGate) return;

  const originalAddEventListener = root.addEventListener;
  if (typeof originalAddEventListener !== "function") return;

  const wrappedListeners = new WeakMap();

  function isPassiveClockTick(event) {
    return event?.detail?.reason === "time";
  }

  function gatedAddEventListener(type, listener, options) {
    if (type !== "until-friday-state-change" || typeof listener !== "function") {
      return originalAddEventListener.call(root, type, listener, options);
    }

    const wrapped = function browserStateListener(event) {
      if (isPassiveClockTick(event)) return;
      return listener.call(this, event);
    };
    wrappedListeners.set(listener, wrapped);
    return originalAddEventListener.call(root, type, wrapped, options);
  }

  root.addEventListener = gatedAddEventListener;
  root.UntilFridayBrowserStateRenderGate = {
    originalAddEventListener,
    wrappedListeners,
    isPassiveClockTick,
    restore() {
      if (root.addEventListener === gatedAddEventListener) {
        root.addEventListener = originalAddEventListener;
      }
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
