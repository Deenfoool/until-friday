"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const story = require("../src/story-v2.js");
const Migration = require("../src/state-migration.js");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function newEngine(options = {}) {
  return Engine.createEngine(story, null, { seed: "test-seed", truthId: "player", ...options });
}

test("truth selection is deterministic for one seed", () => {
  const a = Engine.createState(story, { seed: "same-seed" });
  const b = Engine.createState(story, { seed: "same-seed" });
  assert.equal(a.truthId, b.truthId);
});

test("day starts and exposes only current-day actions", () => {
  const engine = newEngine();
  engine.startDay();
  const actions = engine.listActions();
  assert(actions.some((item) => item.id === "mon-report-final"));
  assert(!actions.some((item) => item.id === "tue-client-confirm"));
});

test("action effects are applied once", () => {
  const engine = newEngine();
  engine.startDay();
  const result = engine.applyAction("mon-report-final");
  assert.equal(result.ok, true);
  assert.equal(engine.getState().stats.work, 2);
  assert.equal(engine.applyAction("mon-report-final").reason, "already-completed");
});

test("scheduled event is delivered when time reaches it", () => {
  const engine = newEngine();
  engine.startDay();
  engine.applyAction("mon-report-final");
  const result = engine.advanceTime(200);
  assert(result.events.some((event) => event.id === "mon-chief-thanks"));
});

test("Monday choice creates a conditional Tuesday consequence", () => {
  const engine = newEngine();
  engine.startDay();
  engine.applyAction("mon-invoice-fix");
  const transition = engine.endDay();
  assert.equal(transition.nextDay.id, "tuesday");
  const eventResult = engine.advanceTime(60);
  assert(eventResult.events.some((event) => event.id === "tue-accountant-request"));
});

test("missed requirement applies penalty at end of day", () => {
  const engine = newEngine();
  engine.startDay();
  const result = engine.endDay();
  assert(result.missed.includes("monday-core-work"));
  assert.equal(engine.getState().stats.work, -2);
});

test("conditional action unlocks after event and access gain", () => {
  const engine = newEngine();
  engine.startDay();
  engine.applyAction("mon-invoice-fix");
  engine.endDay();
  engine.advanceTime(60);
  assert(engine.listActions("tasks").some((item) => item.id === "tue-help-accountant"));
});

test("ending resolver prioritizes caught ending", () => {
  const state = Engine.createState(story, { truthId: "contractor", seed: "caught", stats: { suspicion: 9 } });
  state.dayIndex = 4;
  state.dayStarted = true;
  const engine = Engine.createEngine(story, state);
  const ending = engine.resolveEnding();
  assert.equal(ending.id, "caught");
});

test("false alarm ending reacts to collateral damage", () => {
  const cleanState = Engine.createState(story, { truthId: "contractor", seed: "clean", stats: { suspicion: 1, collateral: 0 } });
  cleanState.dayIndex = 4;
  cleanState.dayStarted = true;
  const damagedState = Engine.createState(story, { truthId: "contractor", seed: "damage", stats: { suspicion: 5, collateral: 3 } });
  damagedState.dayIndex = 4;
  damagedState.dayStarted = true;
  assert.equal(Engine.createEngine(story, cleanState).resolveEnding().id, "false-alarm-clean");
  assert.equal(Engine.createEngine(story, damagedState).resolveEnding().id, "false-alarm-damage");
});

test("unlocked content becomes visible through conditions", () => {
  const engine = newEngine();
  engine.startDay();
  engine.endDay();
  assert(engine.listVisibleContent("files").some((item) => item.id === "badge-list"));
});

test("legacy Monday save migrates decisions and hidden stats", () => {
  const legacy = {
    bootComplete: true,
    currentMinute: 702,
    workQuality: 3,
    suspicion: 2,
    evidence: 1,
    anxiety: 4,
    trust: { friend: 2 },
    copiedFiles: ["invoice-copy"],
    openedFiles: ["vacancy"],
    flags: { toldFriend: true, askedAdmin: true },
    completedTasks: {
      "t-report": { option: "task-report-final", message: "Готово" },
      "t-invoice": { option: "task-invoice-report", message: "Передано" }
    }
  };
  const migrated = Migration.migrateLegacyState(legacy, Engine, story);
  assert.equal(migrated.stats.work, 3);
  assert.equal(migrated.stats.suspicion, 2);
  assert(migrated.completedActions["mon-report-final"]);
  assert(migrated.completedActions["mon-invoice-report"]);
  assert(migrated.completedActions["mon-open-vacancy"]);
  assert(migrated.completedActions["mon-tell-friend"]);
  assert.equal(migrated.flags.legacySaveMigrated, true);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error.stack || error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log(`\n${tests.length} tests passed.`);