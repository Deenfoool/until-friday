(function (root) {
  "use strict";

  if (root.UntilFridayWindowLayout) return;

  const CORE_APPS = new Set([
    "explorer",
    "mail",
    "chat",
    "tasks",
    "terminal",
    "journal",
    "trash"
  ]);
  const MARGIN = 6;
  const EDGE_SIZE = 9;
  const MIN_WIDTH = 360;
  const MIN_HEIGHT = 240;

  let queued = false;
  let activeResize = null;
  let hoverWindow = null;

  function compactViewport() {
    return Boolean(root.matchMedia?.("(max-width: 760px)")?.matches);
  }

  function workspace() {
    const layer = document.querySelector("#windows-layer");
    const rect = layer?.getBoundingClientRect?.();
    const taskbar = document.querySelector(".taskbar")?.getBoundingClientRect?.().height || 42;
    return {
      width: Math.max(0, Number(rect?.width) || Number(root.innerWidth) || 0),
      height: Math.max(0, Number(rect?.height) || (Number(root.innerHeight) || 0) - taskbar)
    };
  }

  function currentBounds(element) {
    const layerRect = document.querySelector("#windows-layer")?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - Number(layerRect.left || 0),
      top: rect.top - Number(layerRect.top || 0),
      width: rect.width,
      height: rect.height
    };
  }

  function clamp(value, minimum, maximum) {
    if (maximum < minimum) return minimum;
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function constrainedBounds(bounds) {
    const area = workspace();
    const maximumWidth = Math.max(0, area.width - MARGIN * 2);
    const maximumHeight = Math.max(0, area.height - MARGIN * 2);
    const minimumWidth = Math.min(MIN_WIDTH, maximumWidth);
    const minimumHeight = Math.min(MIN_HEIGHT, maximumHeight);
    const width = clamp(bounds.width, minimumWidth, maximumWidth);
    const height = clamp(bounds.height, minimumHeight, maximumHeight);
    return {
      left: clamp(bounds.left, MARGIN, area.width - MARGIN - width),
      top: clamp(bounds.top, MARGIN, area.height - MARGIN - height),
      width,
      height
    };
  }

  function applyBounds(element, bounds) {
    const next = constrainedBounds(bounds);
    element.style.left = `${Math.round(next.left)}px`;
    element.style.top = `${Math.round(next.top)}px`;
    element.style.width = `${Math.round(next.width)}px`;
    element.style.height = `${Math.round(next.height)}px`;
    return next;
  }

  function fullBounds() {
    const area = workspace();
    return {
      left: MARGIN,
      top: MARGIN,
      width: Math.max(0, area.width - MARGIN * 2),
      height: Math.max(0, area.height - MARGIN * 2)
    };
  }

  function readRestoreBounds(element) {
    try {
      const value = JSON.parse(element.dataset.windowRestoreBounds || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function rememberRestoreBounds(element, bounds = currentBounds(element)) {
    element.dataset.windowRestoreBounds = JSON.stringify(bounds);
  }

  function updateMaximizeButton(element) {
    const button = element.querySelector("[data-window-layout-action='maximize']");
    if (!button) return;
    const maximized = element.dataset.windowMaximized === "true";
    button.textContent = maximized ? "❐" : "□";
    button.title = maximized ? "Восстановить размер" : "Развернуть";
    button.setAttribute("aria-label", button.title);
  }

  function setMaximized(element, maximized) {
    element.dataset.windowMaximized = String(Boolean(maximized));
    element.classList.toggle("window-maximized", Boolean(maximized));
    updateMaximizeButton(element);
  }

  function maximize(element, options = {}) {
    if (!element?.isConnected) return null;
    if (!options.preserveRestore && element.dataset.windowMaximized !== "true") {
      rememberRestoreBounds(element);
    }
    const bounds = applyBounds(element, fullBounds());
    setMaximized(element, true);
    return bounds;
  }

  function restore(element) {
    if (!element?.isConnected) return null;
    const area = workspace();
    const fallback = {
      left: Math.max(MARGIN, area.width * 0.12),
      top: Math.max(MARGIN, area.height * 0.08),
      width: Math.min(840, area.width - MARGIN * 2),
      height: Math.min(560, area.height - MARGIN * 2)
    };
    const bounds = applyBounds(element, readRestoreBounds(element) || fallback);
    setMaximized(element, false);
    rememberRestoreBounds(element, bounds);
    return bounds;
  }

  function toggleMaximize(element) {
    if (compactViewport()) return maximize(element, { preserveRestore: true });
    return element.dataset.windowMaximized === "true" ? restore(element) : maximize(element);
  }

  function addMaximizeButton(element) {
    const controls = element.querySelector(".window-controls");
    if (!controls || controls.querySelector("[data-window-layout-action='maximize']")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "window-layout-maximize";
    button.dataset.windowLayoutAction = "maximize";
    const close = controls.querySelector("[data-window-action='close']");
    controls.insertBefore(button, close || null);
    updateMaximizeButton(element);
  }

  function addResizeGrip(element) {
    if (element.querySelector("[data-window-resize-grip]")) return;
    const grip = document.createElement("span");
    grip.className = "window-resize-grip";
    grip.dataset.windowResizeGrip = "true";
    grip.setAttribute("aria-hidden", "true");
    element.appendChild(grip);
  }

  function enhance(element, appId = element?.dataset?.windowId || "") {
    if (!element?.matches?.(".app-window")) return null;
    element.classList.add("window-layout-managed");
    element.dataset.windowResizable = "true";
    if (CORE_APPS.has(appId)) element.classList.add("desktop-app-window");
    addMaximizeButton(element);
    addResizeGrip(element);

    if (CORE_APPS.has(appId) && element.dataset.initialFullSizeApplied !== "true") {
      element.dataset.initialFullSizeApplied = "true";
      maximize(element);
    } else {
      constrain(element);
    }
    return element;
  }

  function enhanceAll() {
    document.querySelectorAll(".app-window").forEach((element) => {
      enhance(element, element.dataset.windowId || "");
    });
  }

  function queueEnhance() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceAll();
    });
  }

  function constrain(element) {
    if (!element?.isConnected || element.classList.contains("minimized")) return null;
    if (compactViewport() || element.dataset.windowMaximized === "true") {
      return maximize(element, { preserveRestore: true });
    }
    return applyBounds(element, currentBounds(element));
  }

  function resizeDirection(event, element) {
    if (!element || compactViewport()) return "";
    if (event.target.closest?.("[data-window-resize-grip]")) return "se";
    if (event.target.closest?.(".window-controls")) return "";

    const rect = element.getBoundingClientRect();
    const west = event.clientX - rect.left <= EDGE_SIZE;
    const east = rect.right - event.clientX <= EDGE_SIZE;
    const north = event.clientY - rect.top <= EDGE_SIZE;
    const south = rect.bottom - event.clientY <= EDGE_SIZE;
    return `${north ? "n" : south ? "s" : ""}${west ? "w" : east ? "e" : ""}`;
  }

  function cursorFor(direction) {
    if (direction === "n" || direction === "s") return "ns-resize";
    if (direction === "e" || direction === "w") return "ew-resize";
    if (direction === "ne" || direction === "sw") return "nesw-resize";
    if (direction === "nw" || direction === "se") return "nwse-resize";
    return "";
  }

  function beginResize(event, element, direction) {
    const start = currentBounds(element);
    activeResize = {
      element,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      left: start.left,
      top: start.top,
      right: start.left + start.width,
      bottom: start.top + start.height
    };
    setMaximized(element, false);
    document.body.classList.add("window-resizing");
    document.body.style.cursor = cursorFor(direction);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function resizeActive(event) {
    if (!activeResize) return;
    const { element, direction, startX, startY } = activeResize;
    if (!element.isConnected) {
      endResize();
      return;
    }

    const area = workspace();
    const minimumWidth = Math.min(MIN_WIDTH, Math.max(0, area.width - MARGIN * 2));
    const minimumHeight = Math.min(MIN_HEIGHT, Math.max(0, area.height - MARGIN * 2));
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    let left = activeResize.left;
    let right = activeResize.right;
    let top = activeResize.top;
    let bottom = activeResize.bottom;

    if (direction.includes("w")) {
      left = clamp(activeResize.left + deltaX, MARGIN, right - minimumWidth);
    }
    if (direction.includes("e")) {
      right = clamp(activeResize.right + deltaX, left + minimumWidth, area.width - MARGIN);
    }
    if (direction.includes("n")) {
      top = clamp(activeResize.top + deltaY, MARGIN, bottom - minimumHeight);
    }
    if (direction.includes("s")) {
      bottom = clamp(activeResize.bottom + deltaY, top + minimumHeight, area.height - MARGIN);
    }

    applyBounds(element, {
      left,
      top,
      width: right - left,
      height: bottom - top
    });
    event.preventDefault();
  }

  function endResize() {
    if (!activeResize) return;
    const element = activeResize.element;
    if (element?.isConnected) rememberRestoreBounds(element, currentBounds(element));
    activeResize = null;
    document.body.classList.remove("window-resizing");
    document.body.style.cursor = "";
  }

  document.addEventListener("pointerdown", (event) => {
    const maximizeButton = event.target.closest?.("[data-window-layout-action='maximize']");
    if (maximizeButton) return;
    const element = event.target.closest?.(".app-window.window-layout-managed");
    if (!element) return;
    const direction = resizeDirection(event, element);
    if (direction) beginResize(event, element, direction);
  }, true);

  root.addEventListener?.("pointermove", (event) => {
    if (activeResize) {
      resizeActive(event);
      return;
    }

    const element = event.target.closest?.(".app-window.window-layout-managed") || null;
    if (hoverWindow && hoverWindow !== element) hoverWindow.style.cursor = "";
    hoverWindow = element;
    if (!element) return;
    element.style.cursor = cursorFor(resizeDirection(event, element));
  });

  root.addEventListener?.("pointerup", endResize);
  root.addEventListener?.("pointercancel", endResize);

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-window-layout-action='maximize']");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleMaximize(button.closest(".app-window"));
      return;
    }
    root.setTimeout?.(queueEnhance, 0);
  }, true);

  document.addEventListener("dblclick", (event) => {
    const titlebar = event.target.closest?.(".window-titlebar");
    if (!titlebar || event.target.closest?.("button")) return;
    const element = titlebar.closest(".app-window");
    if (!element) return;
    event.preventDefault();
    toggleMaximize(element);
  }, true);

  root.addEventListener?.("resize", () => {
    document.querySelectorAll(".app-window.window-layout-managed").forEach(constrain);
  });
  root.addEventListener?.("until-friday-ui-render", (event) => {
    const element = event.detail?.element;
    if (element) enhance(element, event.detail?.appId || element.dataset.windowId || "");
    queueEnhance();
  });
  root.addEventListener?.("until-friday-state-change", queueEnhance);
  root.addEventListener?.("until-friday-app-ready", queueEnhance);
  document.addEventListener("DOMContentLoaded", queueEnhance, { once: true });
  queueEnhance();

  root.UntilFridayWindowLayout = {
    CORE_APPS,
    workspace,
    currentBounds,
    constrainedBounds,
    applyBounds,
    maximize,
    restore,
    toggleMaximize,
    constrain,
    enhance,
    enhanceAll,
    resizeDirection,
    cursorFor
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
