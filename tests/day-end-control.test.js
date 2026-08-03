"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/day-end-control.js");

assert.doesNotThrow(() => new Function(source), "day end controller must contain valid JavaScript");

const story = require("../src/story-v2.js");
const storage = new Map();
const context = {
  UNTIL_FRIDAY_STORY: story,
  UntilFridayMigration: { ENGINE_SAVE_KEY: "until-friday-save-v2" },
  UntilFridayDayTransitionGuard: { getEngine: () => null },
  UntilFridayPassiveClock: { getEngine: () => null, resetDayClock: () => {} },
  MutationObserver: class MutationObserver { observe() {} },
  requestAnimationFrame: (callback) => callback(),
  document: {
    documentElement: {},
    body: { appendChild() {} },
    addEventListener() {},
    querySelectorAll() { return []; }
  },
  window: {
    addEventListener() {},
    location: { reload() {} }
  },
  localStorage: {
    setItem: (key, value) => storage.set(key, String(value)),
    getItem: (key) => storage.get(key) || null,
    removeItem: (key) => storage.delete(key)
  },
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "day-end-control.js" });

const api = context.UntilFridayDayEndControl;
assert.ok(api, "day end controller API must be exported");
assert.equal(api.storageAvailable(), true, "day transition must preflight local storage before mutating the engine");

const completeMonday = {
  dayIndex: 0,
  completedActions: {
    "mon-report-final": {},
    "mon-invoice-fix": {}
  }
};
const incompleteMonday = {
  dayIndex: 0,
  completedActions: {
    "mon-report-final": {}
  }
};
const conditionEngine = { conditionPasses: () => true };

assert.deepEqual(
  JSON.parse(JSON.stringify(api.progress(conditionEngine, completeMonday))),
  { done: 2, total: 2, complete: true },
  "both Monday tasks must display 2 of 2"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.progress(conditionEngine, incompleteMonday))),
  { done: 1, total: 2, complete: false },
  "one completed Monday task must display 1 of 2"
);

for (const text of [
  "#clock",
  "data-day-end-control",
  "Завершить рабочий день",
  "Начать следующий день",
  "window.location.reload()",
  "event.stopImmediatePropagation()",
  "__pendingTransition",
  "Повторить сохранение",
  "state.dayIndex <= before.dayIndex",
  "dataset.locked"
]) {
  assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `day end controller must contain: ${text}`);
}

const css = read("day-end-control.css");
assert.match(css, /z-index: 9000/, "day end dialog must appear above application windows");
assert.match(css, /day-end-task-card/, "Tasks fallback card must be styled");

const html = read("index.html");
assert.match(html, /day-end-control\.css/, "day end stylesheet must be connected");
assert.match(html, /src\/day-end-control\.js/, "day end controller must be connected");
assert.ok(
  html.indexOf("src/day-transition-guard.js") < html.indexOf("src/day-end-control.js") &&
  html.indexOf("src/day-end-control.js") < html.indexOf("src/bootstrap.js"),
  "day end controller must load after engine guards and before the application"
);

console.log("Reliable day end control validation passed.");
