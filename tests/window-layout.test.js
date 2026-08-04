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
assert.ok(
  html.indexOf("src/window-layout.js") < html.indexOf("src/ui-runtime-guards.js") &&
  html.indexOf("src/window-layout.js") < html.indexOf("src/bootstrap.js"),
  "window layout must initialize before the application starts"
);

console.log("Full-size resizable window layout validation passed.");
