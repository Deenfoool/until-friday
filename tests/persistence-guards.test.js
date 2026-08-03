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

globalThis.UntilFridayEngine = require("../src/engine.js");
globalThis.UntilFridayMigration = { ENGINE_SAVE_KEY: "until-friday-save-v2" };
globalThis.UntilFridayDayTransitionGuard = { getEngine: () => null };
require("../src/persistent-engine-guard.js");

const Engine = globalThis.UntilFridayEngine;
const story = require("../src/story-v2.js");
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
  globalThis.UntilFridayDayTransitionGuard.getEngine(),
  engine,
  "other runtime controllers must receive the atomic engine wrapper"
);

const persistentSource = read("src/persistent-engine-guard.js");
assert.doesNotThrow(() => new Function(persistentSource));
assert.match(persistentSource, /rolledBack: true/);
assert.match(persistentSource, /action-exception/);
assert.match(persistentSource, /save-failed/);

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
  html.indexOf("src/day-transition-guard.js") < html.indexOf("src/persistent-engine-guard.js") &&
  html.indexOf("src/persistent-engine-guard.js") < html.indexOf("src/day-end-control.js"),
  "atomic persistence must wrap the transition engine before day-end controls"
);
assert.ok(
  html.indexOf("src/workflow-extension.js") < html.indexOf("src/storage-error-guard.js") &&
  html.indexOf("src/storage-error-guard.js") < html.indexOf("src/workflow-reset.js"),
  "workflow storage errors must be guarded immediately after workflow setup"
);

console.log("Persistence guard validation passed.");
