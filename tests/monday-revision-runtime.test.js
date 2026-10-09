"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const modules = [
  "src/engine.js",
  "src/story-v2.js",
  "src/rules-extension.js",
  "src/state-migration.js",
  "src/integrity-fixes.js",
  "src/story-consistency-fixes.js",
  "src/time-boundary-guard.js",
  "src/runtime-engine.js",
  "src/office-work-pack.js",
  "src/work-minigames.js"
];
const store = new Map();
const listeners = new Map();
const context = {
  console,
  Date, Math, JSON, Map, Set, WeakMap, WeakSet, Promise,
  localStorage: {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  },
  document: { querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {} },
  CustomEvent: class {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  },
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout() {},
  addEventListener(name, handler) {
    const handlers = listeners.get(name) || [];
    handlers.push(handler);
    listeners.set(name, handlers);
  },
  dispatchEvent(event) {
    for (const handler of listeners.get(event.type) || []) handler(event);
    return true;
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const name of modules) vm.runInContext(read(name), context, { filename: name });

const engine = context.UntilFridayEngine.createEngine(
  context.UNTIL_FRIDAY_STORY, null, { seed: "monday-document-revision", truthId: "player" }
);
const pack = context.UntilFridayOfficeWorkPack;
const documents = context.UntilFridayWorkMinigames;
assert.ok(engine.startDay().ok);
assert.ok(engine.advanceTime(6).ok, "Monday office work unlocks at 08:53");

const id = "office-mon-requests-sum";
const task = pack.TASK_BY_ID[id];
assert.ok(pack.completeTask(task, 0, { values: { C6: "246" } }).ok);
const first = engine.getState();
assert.equal(first.metadata.officeWork.completed[id].quality, "needs-review");
assert.equal(first.stats.work, -1);

const revision = pack.reviseTask(id, { values: { C6: "247" } });
assert.equal(revision.ok, true, "An inaccurate Monday result can be corrected");
const updated = engine.getState();
const record = updated.metadata.officeWork.completed[id];
assert.equal(record.quality, "accepted");
assert.equal(record.score, task.score);
assert.equal(record.history.length, 1);
assert.equal(record.history[0].quality, "needs-review");
assert.equal(record.history[0].submission.values.C6, "246");
assert.equal(record.submission.values.C6, "247");
assert.equal(updated.minute - first.minute, 6, "Correction must consume work time");
assert.equal(updated.stats.work - first.stats.work, 2, "Corrected submission adjusts score, not a second bonus");
assert.equal(pack.reviseTask(id, { values: { C6: "247" } }).ok, false, "Accepted work cannot be resubmitted");
const archived = documents.documents(updated).find((file) => file.id === "office-output-" + id);
assert.ok(archived);
assert.match(archived.content, /C6 = 247/);
assert.match(archived.content, /История переданных версий/);
assert.match(archived.content, /C6 = 246/);

const saved = JSON.parse(store.get("until-friday-save-v2"));
assert.equal(saved.metadata.officeWork.completed[id].quality, "accepted");
assert.equal(saved.metadata.officeWork.completed[id].history.length, 1);
assert.ok(engine.advanceTime(30).ok);
const supplier = "office-mon-supplier-letter";
assert.ok(pack.completeTask(pack.TASK_BY_ID[supplier], 0, { text: "Неполное письмо." }).ok);
assert.ok(engine.endDay().ok, "A flawed office task must not block day transition");
assert.equal(engine.getState().dayIndex, 1);
assert.equal(pack.reviseTask(supplier, {
  text: "Подтвердите получение 24 бухт кабеля КС-18 до 12:00. Документы доставил курьер."
}).ok, true, "Previously submitted Monday documents should remain correctable on Tuesday");
assert.equal(engine.getState().metadata.officeWork.completed[supplier].quality, "accepted");
assert.equal(pack.completedForDay(engine.getState()).length, 0, "Tuesday task list must remain independent");
assert.ok(documents.documents(engine.getState()).some((file) => file.id === "office-output-" + supplier),
  "The corrected document is still available in Explorer on Tuesday");
console.log("Monday revision, history, next-day correction and main-save integration passed.");
