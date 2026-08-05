(function (root) {
  "use strict";

  if (root.UntilFridayWindowDrag) return;

  const MARGIN = 6;
  const TITLEBAR_GRAB_Y = 18;
  let activeDrag = null;

  function compactViewport() {
    return Boolean(root.matchMedia?.("(max-width: 760px)")?.matches);
  }

  function workspace() {
    const layer = document.querySelector?.("#windows-layer");
    const rect = layer?.getBoundingClientRect?.() || {};
    const taskbarHeight = document.querySelector?.(".taskbar")?.getBoundingClientRect?.().height || 42;
    return {
      left: Number(rect.left) || 0,
      top: Number(rect.top) || 0,
      width: Math.max(0, Number(rect.width) || Number(root.innerWidth) || 0),
      height: Math.max(0, Number(rect.height) || (Number(root.innerHeight) || 0) - taskbarHeight)
    };
  }

  function currentBounds(element) {
    const area = workspace();
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - area.left,
      top: rect.top - area.top,
      width: rect.width,
      height: rect.height
    };
  }

  function clamp(value, minimum, maximum) {
    if (maximum < minimum) return minimum;
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function isInteractiveTarget(target) {
    return Boolean(target?.closest?.(
      "button, input, textarea, select, option, a, [contenteditable='true'], [data-window-resize-grip], [data-window-layout-action]"
    ));
  }

  function titlebarForEvent(event) {
    if (isInteractiveTarget(event.target)) return null;
    return event.target?.closest?.(".window-titlebar") || null;
  }

  function focusWindow(element) {
    const windows = Array.from(document.querySelectorAll?.(".app-window") || []);
    const highest = windows.reduce((value, item) => {
      return Math.max(value, Number.parseInt(item.style?.zIndex || "0", 10) || 0);
    }, 20);
    windows.forEach((item) => item.classList?.remove?.("focused"));
    element.classList?.add?.("focused");
    element.style.zIndex = String(highest + 1);
  }

  function restoreForDrag(element, event) {
    if (element.dataset.windowMaximized !== "true") return currentBounds(element);

    const area = workspace();
    const pointerX = event.clientX - area.left;
    const ratio = clamp(pointerX / Math.max(1, area.width), 0.08, 0.92);
    const layout = root.UntilFridayWindowLayout;

    if (typeof layout?.restore === "function") {
      layout.restore(element);
    } else {
      element.dataset.windowMaximized = "false";
      element.classList?.remove?.("window-maximized");
    }

    const bounds = currentBounds(element);
    const left = clamp(pointerX - bounds.width * ratio, MARGIN, area.width - MARGIN - bounds.width);
    const top = clamp(event.clientY - area.top - TITLEBAR_GRAB_Y, MARGIN, area.height - MARGIN - bounds.height);
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
    return currentBounds(element);
  }

  function beginDrag(event) {
    if (compactViewport() || event.isPrimary === false || Number(event.button) !== 0) return false;
    const titlebar = titlebarForEvent(event);
    const element = titlebar?.closest?.(".app-window");
    if (!element || element.classList?.contains?.("minimized")) return false;

    const bounds = restoreForDrag(element, event);
    const area = workspace();
    activeDrag = {
      element,
      pointerId: event.pointerId,
      offsetX: clamp(event.clientX - area.left - bounds.left, 0, bounds.width),
      offsetY: clamp(event.clientY - area.top - bounds.top, 0, bounds.height)
    };

    focusWindow(element);
    element.dataset.windowDragging = "true";
    document.body?.classList?.add?.("window-dragging");
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    return true;
  }

  function dragActive(event) {
    if (!activeDrag) return false;
    if (activeDrag.pointerId !== undefined && event.pointerId !== undefined && event.pointerId !== activeDrag.pointerId) return false;

    const { element, offsetX, offsetY } = activeDrag;
    if (!element?.isConnected) {
      endDrag();
      return false;
    }

    const area = workspace();
    const bounds = currentBounds(element);
    const left = clamp(event.clientX - area.left - offsetX, MARGIN, area.width - MARGIN - bounds.width);
    const top = clamp(event.clientY - area.top - offsetY, MARGIN, area.height - MARGIN - bounds.height);
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
    event.preventDefault?.();
    return true;
  }

  function endDrag(event) {
    if (!activeDrag) return false;
    if (event && activeDrag.pointerId !== undefined && event.pointerId !== undefined && event.pointerId !== activeDrag.pointerId) return false;

    const element = activeDrag.element;
    if (element?.isConnected) {
      delete element.dataset.windowDragging;
      element.dataset.windowRestoreBounds = JSON.stringify(currentBounds(element));
    }
    activeDrag = null;
    document.body?.classList?.remove?.("window-dragging");
    return true;
  }

  document.addEventListener("pointerdown", beginDrag, true);
  root.addEventListener?.("pointermove", dragActive);
  root.addEventListener?.("pointerup", endDrag);
  root.addEventListener?.("pointercancel", endDrag);
  root.addEventListener?.("blur", () => endDrag());

  root.UntilFridayWindowDrag = {
    workspace,
    currentBounds,
    clamp,
    isInteractiveTarget,
    titlebarForEvent,
    focusWindow,
    restoreForDrag,
    beginDrag,
    dragActive,
    endDrag,
    isDragging: () => Boolean(activeDrag)
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
