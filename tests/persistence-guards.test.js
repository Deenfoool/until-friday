"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

let rejectWrites = false;
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => {
    if (rejectWrites) {
      const error = new Error("Quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    }
    storage.set(key, String(value));
  },
  removeItem: (key) => storage.delete(key)
};
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelector: () => null, createElement: () => null };
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => {};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) { this.type = type; this.detail = options?.detail; }
};

globalThis.UntilFridayEngine = require("../src/engine.js");
globalThis.UNTIL_FRIDAY_STORY = require("../src/story-v2.js");
globalThis.UntilFridayMigration = { ENGINE_SAVE_KEY: "until-friday-save-v2" };
require("../src/rules-extension.js");
require("../src/integrity-fixes.js");
require("../src/time-boundary-guard.js");
require("../src/runtime-engine.js");
require("../src/persistent-engine-guard.js");

const Engine = globalThis.UntilFridayEngine;
const story = globalThis.UNTIL_FRIDAY_STORY;
const engine = Engine.createEngine(story, null, { seed: "atomic-save", truthId: "player" });
engine.startDay();

rejectWrites = true;
let result = engine.applyAction("mon-report-final");
assert.equal(result.ok, false);
assert.equal(result.reason, "save-failed");
assert.equal(result.rolledBack, true);
assert.equal(Boolean(engine.getState().completedActions["mon-report-final"]), false, "failed persistence must roll back completion");
assert.equal(engine.getState().stats.work, 0, "failed persistence must roll back all action effects");

rejectWrites = false;
result = engine.applyAction("mon-report-final");
assert.equal(result.ok, true);
assert.equal(result.persisted, true);
assert.ok(engine.getState().completedActions["mon-report-final"]);
assert.equal(engine.getState().stats.work, 2);
assert.ok(storage.has("until-friday-save-v2"), "successful action must be written immediately");
assert.equal(
  globalThis.UntilFridayPersistentEngineGuard.getEngine(),
  engine,
  "compatibility controllers must receive the shared runtime engine"
);

const runtimeSource = read("src/runtime-engine.js");
const persistentSource = read("src/persistent-engine-guard.js");
assert.doesNotThrow(() => new Function(runtimeSource));
assert.doesNotThrow(() => new Function(persistentSource));
assert.match(runtimeSource, /rolledBack: true/);
assert.match(runtimeSource, /action-exception/);
assert.match(runtimeSource, /save-failed/);
assert.doesNotMatch(persistentSource, /Engine\.createEngine\s*=/, "persistence compatibility must not wrap the factory");

const notices = [];
const workflowContext = {
  UntilFridayWorkflow: {
    saveAttachment() {
      const error = new Error("localStorage quota");
      error.name = "QuotaExceededError";
      throw error;
    }
  },
  document: {
    querySelector: () => ({ appendChild: (item) => notices.push(item) }),
    createElement: () => ({
      type: "",
      className: "",
      textContent: "",
      children: [],
      append(...items) { this.children.push(...items); },
      addEventListener() {},
      remove() {}
    })
  },
  window: { addEventListener() {} },
  Date,
  console
};
workflowContext.globalThis = workflowContext;
vm.runInNewContext(read("src/storage-error-guard.js"), workflowContext, { filename: "storage-error-guard.js" });
assert.throws(() => workflowContext.UntilFridayWorkflow.saveAttachment({ id: "x" }), /localStorage quota/);
assert.equal(notices.length, 1, "workflow storage errors must be visible to the player");
assert.equal(workflowContext.UntilFridayStorageErrorGuard.isStorageError(new Error("Quota exceeded")), true);

const html = read("index.html");
assert.ok(
  html.indexOf("src/runtime-engine.js") < html.indexOf("src/persistent-engine-guard.js") &&
  html.indexOf("src/persistent-engine-guard.js") < html.indexOf("src/day-end-control.js"),
  "persistence facade must load after the single runtime and before day-end controls"
);
assert.ok(
  html.indexOf("src/workflow-extension.js") < html.indexOf("src/storage-error-guard.js") &&
  html.indexOf("src/storage-error-guard.js") < html.indexOf("src/workflow-reset.js"),
  "workflow storage errors must be guarded immediately after workflow setup"
);

console.log("Unified persistence runtime validation passed.");
