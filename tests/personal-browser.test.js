"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/personal-browser.js");

assert.doesNotThrow(() => new Function(source), "personal browser module must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, "personal browser must use lifecycle events instead of observing the DOM");

for (const phrase of [
  "market",
  "video",
  "messages",
  "history",
  "metadata.personalBrowser",
  "advanceTime",
  "updateState",
  "replaceState",
  "personalBrowsingExcessive",
  "personalHistoryCleared",
  "DAILY_WARNING_MINUTES = 45",
  "until-friday-app-ready",
  "until-friday-state-change",
  "UntilFridayWindowLayout",
  "КупиТут",
  "ВидеоЛента"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `personal browser must contain: ${phrase}`);
}

let state = {
  seed: "personal-browser-test",
  dayIndex: 0,
  minute: 540,
  dayStarted: true,
  ended: false,
  metadata: {},
  stats: { suspicion: 0 },
  flags: {}
};
const notices = [];
const listeners = new Map();
const clone = (value) => JSON.parse(JSON.stringify(value));

const engine = {
  getState: () => clone(state),
  advanceTime(minutes) {
    state.minute += Number(minutes) || 0;
    return {
      ok: true,
      persisted: true,
      advancedMinutes: Number(minutes) || 0,
      events: [],
      state: clone(state)
    };
  },
  updateState(updater) {
    const draft = clone(state);
    updater(draft);
    state = draft;
    return { ok: true, persisted: true, state: clone(state) };
  },
  replaceState(next) {
    state = clone(next);
    return clone(state);
  }
};

const context = {
  UntilFridayRuntimeEngine: {
    getEngine: () => engine,
    notify: (title, text) => notices.push({ title, text }),
    persist: () => ({ ok: true })
  },
  UntilFridayWindowLayout: null,
  document: {
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => []
  },
  CustomEvent: class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  },
  addEventListener(type, callback) { listeners.set(type, callback); },
  dispatchEvent() {},
  setTimeout: (callback) => callback(),
  innerWidth: 1200,
  innerHeight: 742,
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(source, context, { filename: "personal-browser.js" });
const api = context.UntilFridayPersonalBrowser;
assert.ok(api, "personal browser API must be exported");
assert.equal(api.APP_ID, "browser");
assert.equal(api.DAILY_WARNING_MINUTES, 45);
assert.equal(api.PRODUCTS.length >= 6, true, "marketplace must contain items across the week");
assert.equal(api.VIDEOS.length >= 6, true, "video feed must contain items across the week");
assert.equal(api.MESSAGES.length >= 6, true, "personal messages must span the week");

const defaultState = api.createDefaultPersonalState();
assert.equal(defaultState.balance, 8420);
assert.deepEqual(defaultState.history, []);
assert.deepEqual(defaultState.replies, {});

let result = api.performActivity({
  id: "test-video",
  minutes: 10,
  label: "Тестовый ролик",
  category: "video",
  site: "ВидеоЛента",
  apply(personal) { personal.watched.push("test-video"); }
});
assert.equal(result.ok, true);
assert.equal(state.minute, 550, "personal activity must consume game time");
assert.equal(state.metadata.personalBrowser.dailyMinutes["0"], 10);
assert.ok(state.metadata.personalBrowser.watched.includes("test-video"));
assert.equal(state.metadata.personalBrowser.history.length, 1);
assert.equal(state.metadata.personalBrowser.history[0].site, "ВидеоЛента");

result = api.performActivity({ id: "test-video", minutes: 10, label: "Повтор" });
assert.equal(result.ok, false);
assert.equal(result.reason, "already-completed");
assert.equal(state.minute, 550, "a completed personal activity must not consume time twice");

result = api.performActivity({
  id: "long-break",
  minutes: 35,
  label: "Долгий перерыв",
  category: "video",
  site: "ВидеоЛента"
});
assert.equal(result.ok, true);
assert.equal(state.metadata.personalBrowser.dailyMinutes["0"], 45);
assert.equal(state.stats.suspicion, 1, "forty-five personal minutes must create one audit concern");
assert.ok(state.metadata.personalBrowser.excessiveDays.includes(0));
assert.equal(state.flags.personalBrowsingExcessive, true);

const normalized = api.normalizePersonalState({
  favorites: ["a", "a", "b"],
  history: [{ id: "old" }],
  dailyMinutes: { 0: 12 }
});
assert.deepEqual(Array.from(normalized.favorites), ["a", "b"]);
assert.equal(normalized.dailyMinutes[0], 12);

const visible = api.visibleHistory({
  ...api.createDefaultPersonalState(),
  clearedBefore: { dayIndex: 1, minute: 600 },
  history: [
    { id: "monday", dayIndex: 0, minute: 700 },
    { id: "before", dayIndex: 1, minute: 590 },
    { id: "after", dayIndex: 1, minute: 610 },
    { id: "future", dayIndex: 2, minute: 500 }
  ]
});
assert.deepEqual(Array.from(visible, (item) => item.id), ["after", "future"], "cleared history must hide all earlier visits");

const beforeFailure = clone(state);
const originalUpdate = engine.updateState;
engine.updateState = () => ({ ok: false, reason: "save-failed" });
result = api.performActivity({ id: "rollback-test", minutes: 7, label: "Неудачное сохранение" });
assert.equal(result.ok, false);
assert.equal(result.rolledBack, true);
assert.deepEqual(state, beforeFailure, "failed personal persistence must roll back consumed game time");
engine.updateState = originalUpdate;

const css = read("personal-browser.css");
for (const phrase of [
  "personal-browser-window",
  "personal-browser-toolbar",
  "browser-product-grid",
  "browser-video-list",
  "browser-message-list",
  "browser-history-list",
  "@media (max-width: 620px)"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `personal browser styles must contain: ${phrase}`);
}

const html = read("index.html");
assert.match(html, /personal-browser\.css/, "personal browser stylesheet must be connected");
assert.match(html, /src\/personal-browser\.js/, "personal browser script must be connected");
assert.ok(
  html.indexOf("src/window-layout.js") < html.indexOf("src/personal-browser.js") &&
  html.indexOf("src/personal-browser.js") < html.indexOf("src/bootstrap.js"),
  "personal browser must load after the window manager and before application startup"
);

console.log("Personal browser activity validation passed.");
