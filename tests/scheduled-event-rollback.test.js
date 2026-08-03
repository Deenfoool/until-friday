"use strict";

const assert = require("node:assert/strict");

let rejectWrites = false;
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => {
    if (rejectWrites) throw new Error("Quota exceeded");
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

const Engine = globalThis.UntilFridayEngine;
const Story = globalThis.UNTIL_FRIDAY_STORY;
const originalMinute = Story.events["mon-chief-thanks"].minute;
const raw = Engine.createState(Story, { seed: "schedule-rollback", truthId: "player" });
raw.dayStarted = true;
raw.minute = 700;
const engine = Engine.createEngine(Story, raw);

rejectWrites = true;
let result = engine.applyAction("mon-report-final");
assert.equal(result.ok, false);
assert.equal(result.reason, "save-failed");
assert.equal(result.rolledBack, true);
assert.equal(Story.events["mon-chief-thanks"].minute, originalMinute, "failed action save must restore the global event timestamp");
assert.equal(Boolean(engine.getState().completedActions["mon-report-final"]), false);

rejectWrites = false;
result = engine.applyAction("mon-report-final");
assert.equal(result.ok, true);
assert.equal(result.persisted, true);
assert.equal(Story.events["mon-chief-thanks"].minute, 723, "successful late action may commit its adjusted response time");

console.log("Scheduled event timestamp rollback validation passed.");
