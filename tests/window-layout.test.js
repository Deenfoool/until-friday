"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/window-layout.js");

assert.doesNotThrow(() => new Function(source), "window layout manager must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, "window layout must use lifecycle events instead of a DOM observer");

for (const appId of ["explorer", "mail", "chat", "tasks", "terminal", "journal", "trash"]) {
  assert.match(source, new RegExp(`\\"${appId}\\"`), `${appId} must open at full workspace size`);
}

for (const phrase of [
  "initialFullSizeApplied",
  "windowMaximized",
  "data-window-resize-grip",
  "resizeDirection",
  "pointerdown",
  "pointermove",
  "pointerup",
  "dblclick",
  "until-friday-ui-render",
  "until-friday-state-change",
  "until-friday-app-ready"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `window layout must contain: ${phrase}`);
}

const listeners = new Map();
const bodyClasses = new Set();
const context = {
  document: {
    body: {
      classList: {
        add: (value) => bodyClasses.add(value),
        remove: (value) => bodyClasses.delete(value)
      },
      style: {}
    },
    querySelector(selector) {
      if (selector === "#windows-layer") {
        return { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 700 }) };
      }
      if (selector === ".taskbar") {
        return { getBoundingClientRect: () => ({ height: 42 }) };
      }
      return null;
    },
    querySelectorAll: () => [],
    addEventListener(type, callback) { listeners.set(type, callback); },
    createElement() {
      return {
        className: "",
        dataset: {},
        setAttribute() {}
      };
    }
  },
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback) => callback(),
  matchMedia: () => ({ matches: false }),
  addEventListener(type, callback) { listeners.set(type, callback); },
  innerWidth: 1200,
  innerHeight: 742,
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(source, context, { filename: "window-layout.js" });
const api = context.UntilFridayWindowLayout;
assert.ok(api, "window layout API must be exported");
assert.equal(api.CORE_APPS.size, 7, "all seven desktop applications must be recognized");
assert.deepEqual(
  JSON.parse(JSON.stringify(api.constrainedBounds({ left: -50, top: -20, width: 2000, height: 1200 }))),
  { left: 6, top: 6, width: 1188, height: 688 },
  "oversized windows must fit inside the desktop above the taskbar"
);
assert.equal(api.cursorFor("se"), "nwse-resize");
assert.equal(api.cursorFor("w"), "ew-resize");

const dragSource = read("src/window-drag.js");
assert.doesNotThrow(() => new Function(dragSource), "window drag manager must contain valid JavaScript");
for (const phrase of [
  "window-titlebar",
  "app-window",
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "windowRestoreBounds",
  "windowDragging"
]) {
  assert.match(dragSource, new RegExp(phrase), `window drag manager must contain: ${phrase}`);
}

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    contains: (value) => values.has(value),
    has: (value) => values.has(value)
  };
}

const dragListeners = new Map();
const dragBodyClasses = makeClassList();
const dragWindow = {
  dataset: { windowMaximized: "false" },
  style: { left: "100px", top: "80px", width: "500px", height: "320px", zIndex: "20" },
  classList: makeClassList(["app-window"]),
  isConnected: true,
  getBoundingClientRect() {
    const left = Number.parseFloat(this.style.left) || 0;
    const top = Number.parseFloat(this.style.top) || 0;
    const width = Number.parseFloat(this.style.width) || 500;
    const height = Number.parseFloat(this.style.height) || 320;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
};
const titlebar = {
  closest(selector) {
    if (selector === ".app-window") return dragWindow;
    if (selector === ".window-titlebar") return this;
    return null;
  }
};
const titleTarget = {
  closest(selector) {
    if (selector === ".window-titlebar") return titlebar;
    return null;
  }
};
const interactiveTarget = {
  closest(selector) {
    if (selector.includes("button")) return {};
    return null;
  }
};
const dragContext = {
  document: {
    body: { classList: dragBodyClasses },
    querySelector(selector) {
      if (selector === "#windows-layer") {
        return { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 700 }) };
      }
      if (selector === ".taskbar") {
        return { getBoundingClientRect: () => ({ height: 42 }) };
      }
      return null;
    },
    querySelectorAll(selector) {
      return selector === ".app-window" ? [dragWindow] : [];
    },
    addEventListener(type, callback) { dragListeners.set(`document:${type}`, callback); }
  },
  matchMedia: () => ({ matches: false }),
  addEventListener(type, callback) { dragListeners.set(`window:${type}`, callback); },
  innerWidth: 1200,
  innerHeight: 742,
  console
};
dragContext.window = dragContext;
dragContext.globalThis = dragContext;

vm.runInNewContext(dragSource, dragContext, { filename: "window-drag.js" });
const dragApi = dragContext.UntilFridayWindowDrag;
assert.ok(dragApi, "window drag API must be exported");
assert.ok(dragListeners.has("document:pointerdown"), "all current and future windows must use delegated pointer dragging");
assert.ok(dragListeners.has("window:pointermove"), "dragging must continue outside the titlebar");
assert.equal(dragApi.isInteractiveTarget(interactiveTarget), true, "titlebar buttons must not start dragging");

let prevented = false;
const downEvent = {
  target: titleTarget,
  button: 0,
  isPrimary: true,
  pointerId: 7,
  clientX: 160,
  clientY: 100,
  preventDefault() { prevented = true; },
  stopPropagation() {},
  stopImmediatePropagation() {}
};
assert.equal(dragApi.beginDrag(downEvent), true, "a titlebar pointer press must start dragging");
assert.equal(prevented, true, "dragging must suppress legacy mouse handlers");
assert.equal(dragWindow.style.left, "100px", "a normal window must not jump horizontally when grabbed");
assert.equal(dragWindow.style.top, "80px", "a normal window must not jump vertically when grabbed");
assert.equal(dragBodyClasses.has("window-dragging"), true, "desktop must enter dragging mode");

assert.equal(dragApi.dragActive({ pointerId: 7, clientX: 360, clientY: 260, preventDefault() {} }), true);
assert.equal(dragWindow.style.left, "300px");
assert.equal(dragWindow.style.top, "240px");
assert.equal(dragApi.endDrag({ pointerId: 7 }), true);
assert.equal(dragBodyClasses.has("window-dragging"), false, "dragging mode must end on pointer release");
assert.deepEqual(
  JSON.parse(dragWindow.dataset.windowRestoreBounds),
  { left: 300, top: 240, width: 500, height: 320 },
  "the moved position must be remembered for maximize and restore"
);

const secondDown = { ...downEvent, clientX: 340, clientY: 260, preventDefault() {} };
assert.equal(dragApi.beginDrag(secondDown), true);
dragApi.dragActive({ pointerId: 7, clientX: -500, clientY: -500, preventDefault() {} });
assert.equal(dragWindow.style.left, "6px", "a window cannot be dragged beyond the left edge");
assert.equal(dragWindow.style.top, "6px", "a window cannot be dragged above the desktop");
dragApi.endDrag({ pointerId: 7 });

const css = read("window-layout.css");
for (const phrase of [
  "window-layout-maximize",
  "window-resize-grip",
  "desktop-app-window",
  "grid-template-columns: repeat(2",
  "grid-template-columns: repeat(3",
  "@media (max-width: 760px)"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `window CSS must contain: ${phrase}`);
}

const html = read("index.html");
assert.match(html, /window-layout\.css/, "window layout stylesheet must be connected");
assert.match(html, /src\/window-layout\.js/, "window layout manager must be connected");
assert.match(html, /src\/window-drag\.js/, "global window dragging must be connected");
assert.ok(
  html.indexOf("src/window-layout.js") < html.indexOf("src/window-drag.js") &&
  html.indexOf("src/window-drag.js") < html.indexOf("src/ui-runtime-guards.js") &&
  html.indexOf("src/window-drag.js") < html.indexOf("src/bootstrap.js"),
  "window dragging must initialize after layout and before the application starts"
);

console.log("Full-size resizable and draggable window layout validation passed.");
