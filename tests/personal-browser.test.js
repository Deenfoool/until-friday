"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/personal-browser-core.js");

assert.doesNotThrow(() => new Function(source), "clean browser core must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/);
assert.doesNotMatch(source, /ВидеоЛента|video\.local|UntilFridayVideoPlatform/, "old VideoLenta implementation must not exist in the browser core");

for (const phrase of [
  "metadata.personalBrowser",
  "advanceTime",
  "updateState",
  "replaceState",
  "personalBrowsingExcessive",
  "DAILY_WARNING_MINUTES = 45",
  "until-friday-app-ready",
  "until-friday-state-change",
  "UntilFridayWindowLayout",
  "videotok"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `browser core must contain: ${phrase}`);
}

let state = {
  seed: "personal-browser-core-test",
  dayIndex: 0,
  minute: 540,
  dayStarted: true,
  ended: false,
  metadata: {},
  stats: { suspicion: 0 },
  flags: {}
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const engine = {
  getState: () => clone(state),
  advanceTime(minutes) {
    state.minute += Number(minutes) || 0;
    return { ok: true, persisted: true, advancedMinutes: Number(minutes) || 0, events: [], state: clone(state) };
  },
  updateState(updater) {
    const draft = clone(state);
    updater(draft);
    state = draft;
    return { ok: true, persisted: true, state: clone(state) };
  },
  replaceState(next) { state = clone(next); return clone(state); }
};
const context = {
  UntilFridayRuntimeEngine: { getEngine: () => engine, notify() {}, persist: () => ({ ok: true }) },
  UntilFridayWindowLayout: null,
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  addEventListener() {},
  dispatchEvent() {},
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "personal-browser-core.js" });

const api = context.UntilFridayPersonalBrowser;
assert.ok(api);
assert.equal(api.APP_ID, "browser");
assert.equal(api.DAILY_WARNING_MINUTES, 45);
assert.equal(api.MESSAGES.length, 6);
assert.deepEqual(clone(api.createDefaultPersonalState().bookmarks), ["market", "videotok", "messages"]);

let result = api.performActivity({
  id: "videotok-test",
  minutes: 10,
  label: "Тестовый ролик",
  category: "videotok",
  site: "Видеоток",
  url: "https://videotok.local/watch/vt-001",
  apply(personal) { personal.videotok = { watched: ["vt-001"] }; }
});
assert.equal(result.ok, true);
assert.equal(state.minute, 550);
assert.equal(state.metadata.personalBrowser.dailyMinutes["0"], 10);
assert.deepEqual(state.metadata.personalBrowser.videotok.watched, ["vt-001"]);
assert.equal(state.metadata.personalBrowser.history[0].site, "Видеоток");
assert.equal(state.metadata.personalBrowser.history[0].url, "https://videotok.local/watch/vt-001");

result = api.performActivity({ id: "videotok-test", minutes: 10, label: "Повтор" });
assert.equal(result.ok, false);
assert.equal(result.reason, "already-completed");
assert.equal(state.minute, 550);

result = api.performActivity({ id: "long-break", minutes: 35, label: "Долгий перерыв", category: "videotok", site: "Видеоток" });
assert.equal(result.ok, true);
assert.equal(state.stats.suspicion, 1);
assert.ok(state.metadata.personalBrowser.excessiveDays.includes(0));
assert.equal(state.flags.personalBrowsingExcessive, true);

const normalized = clone(api.normalizePersonalState({ bookmarks: ["market", "video", "messages"], favorites: ["a", "a"] }));
assert.deepEqual(normalized.bookmarks, ["market", "videotok", "messages"], "old video bookmark must migrate to Videotok");
assert.deepEqual(normalized.favorites, ["a"]);

const beforeFailure = clone(state);
const originalUpdate = engine.updateState;
engine.updateState = () => ({ ok: false, reason: "save-failed" });
result = api.performActivity({ id: "rollback-test", minutes: 7, label: "Неудачное сохранение" });
assert.equal(result.ok, false);
assert.equal(result.rolledBack, true);
assert.deepEqual(state, beforeFailure);
engine.updateState = originalUpdate;

const html = read("index.html");
assert.match(html, /src\/personal-browser-core\.js\?v=20260804-7/);
assert.doesNotMatch(html, /src\/personal-browser\.js/);
assert.ok(html.indexOf("src/window-layout.js") < html.indexOf("src/personal-browser-core.js") && html.indexOf("src/personal-browser-core.js") < html.indexOf("src/bootstrap.js"));

console.log("Clean personal browser core validation passed.");
