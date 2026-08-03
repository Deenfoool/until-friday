"use strict";

const assert = require("node:assert/strict");

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
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

assert.ok(globalThis.UntilFridayRules, "rules must be exported as pure helpers");
assert.ok(globalThis.UntilFridayRuntimeEngine, "unified runtime must be installed");
assert.equal(Engine.__runtimeInstalled, true, "engine factory must be owned by the unified runtime");

{
  const engine = Engine.createEngine(Story, null, { seed: "rules-choice-test", truthId: "player" });
  engine.startDay();
  assert.equal(engine.applyAction("mon-report-final").ok, true);
  const blocked = engine.canApplyAction("mon-report-old");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "choice-locked");
  assert.equal(blocked.chosenActionId, "mon-report-final");
}

{
  const engine = Engine.createEngine(Story, null, { seed: "rules-focus-test", truthId: "player" });
  engine.startDay();
  assert.equal(engine.applyAction("mon-report-final").ok, true);
  assert.equal(engine.applyAction("mon-invoice-fix").ok, true);
  assert.equal(engine.applyAction("mon-open-vacancy").ok, true);
  assert.equal(engine.applyAction("mon-request-leadership-access").ok, true);
  const blocked = engine.canApplyAction("mon-tell-friend");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "focus-exhausted");
  assert.equal(blocked.limit, 4);
}

{
  const raw = Engine.createState(Story, { seed: "rules-friday-test", truthId: "contractor" });
  raw.dayIndex = 4;
  raw.dayStarted = true;
  raw.stats.work = 10;
  raw.stats.evidence = 10;
  raw.flags.resignationPrepared = true;
  const engine = Engine.createEngine(Story, raw);
  assert.equal(engine.applyAction("fri-meeting-calm").ok, true);
  const otherChoices = ["fri-meeting-work", "fri-meeting-blackmail", "fri-send-resignation"];
  for (const actionId of otherChoices) {
    const blocked = engine.canApplyAction(actionId);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "choice-locked");
  }
}

console.log("Unified runtime rule tests passed.");
