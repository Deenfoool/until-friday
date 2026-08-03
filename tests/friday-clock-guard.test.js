"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/friday-clock-guard.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "Friday clock guard must contain valid JavaScript");

const storage = new Map();
const context = {
  UNTIL_FRIDAY_STORY: { days: [{}, {}, {}, {}, {}] },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  document: { addEventListener() {} },
  window: { setTimeout() {} },
  Date,
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "friday-clock-guard.js" });

const api = context.UntilFridayFridayClockGuard;
assert.ok(api, "Friday clock guard API must be exported");

const state = {
  dayIndex: 4,
  ended: false,
  completedActions: {}
};
assert.equal(api.canFinishFriday(state), false, "Friday cannot finish before a meeting route is chosen");

state.completedActions["fri-meeting-work"] = { dayIndex: 4, minute: 1020 };
assert.equal(api.canFinishFriday(state), false, "a committed route still requires the meeting scene to finish");

storage.set("until-friday-friday-scene-v1", JSON.stringify({ completed: true }));
assert.equal(api.canFinishFriday(state), true, "the finale may use the clock only after the meeting scene is complete");

storage.set("until-friday-friday-scene-v1", "broken-json");
assert.equal(api.canFinishFriday(state), false, "corrupted scene metadata must fail safely instead of bypassing the finale");

for (const text of [
  "Сначала завершите встречу в переговорной №1",
  "event.stopImmediatePropagation()",
  "fri-meeting-calm",
  "fri-meeting-work",
  "fri-meeting-blackmail",
  "fri-send-resignation",
  "data-app=\\\"tasks\\\""
]) {
  assert.match(source, new RegExp(text), `Friday clock guard must contain: ${text}`);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /src\/friday-clock-guard\.js/);
assert.ok(
  html.indexOf("src/friday-scene-guard.js") < html.indexOf("src/friday-clock-guard.js") &&
  html.indexOf("src/friday-clock-guard.js") < html.indexOf("src/friday-ending-reopen.js"),
  "Friday clock guard must load with the final-scene protections before app bootstrap"
);

console.log("Friday clock bypass validation passed.");
