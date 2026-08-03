"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const SAVE_KEY = "until-friday-save-v2";

const runtimeFiles = [
  "src/engine.js",
  "src/story-v2.js",
  "src/rules-extension.js",
  "src/state-migration.js",
  "src/integrity-fixes.js",
  "src/story-consistency-fixes.js",
  "src/time-boundary-guard.js",
  "src/runtime-engine.js",
  "src/tuesday-minigames.js",
  "src/tuesday-event-guards.js",
  "src/wednesday-minigames.js",
  "src/thursday-minigames.js",
  "src/thursday-event-guards.js"
];

function loadRuntime(storage, options = {}) {
  const context = {
    console,
    Date,
    Math,
    JSON,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      hidden: false,
      documentElement: {},
      body: { appendChild() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: () => null
    },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} },
    CustomEvent: class CustomEvent {
      constructor(type, eventOptions) {
        this.type = type;
        this.detail = eventOptions?.detail;
      }
    },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    addEventListener() {},
    dispatchEvent() { return true; }
  };
  context.window = context;
  context.globalThis = context;

  for (const file of runtimeFiles) {
    vm.runInNewContext(read(file), context, { filename: file });
  }

  const raw = storage.get(SAVE_KEY);
  const saved = raw ? JSON.parse(raw) : null;
  const engine = context.UntilFridayEngine.createEngine(
    context.UNTIL_FRIDAY_STORY,
    saved,
    saved ? {} : options
  );
  return { context, engine };
}

function snapshot(storage) {
  const raw = storage.get(SAVE_KEY);
  assert.ok(raw, "the engine save must exist before reload");
  return JSON.parse(raw);
}

function reload(storage, expectedDay, expectedActions = []) {
  const before = snapshot(storage);
  const runtime = loadRuntime(storage);
  const state = runtime.engine.getState();

  assert.equal(state.dayIndex, expectedDay, `reload must restore day ${expectedDay}`);
  assert.equal(state.dayStarted, true, `day ${expectedDay} must remain started after reload`);
  assert.equal(state.minute, before.minute, "reload must preserve exact game time");
  assert.equal(state.truthId, before.truthId, "reload must preserve the hidden truth");
  assert.deepEqual(
    JSON.parse(JSON.stringify(state.completedActions)),
    before.completedActions,
    "reload must preserve completed actions"
  );
  for (const actionId of expectedActions) {
    assert.ok(state.completedActions[actionId], `reload must retain ${actionId}`);
  }
  assert.equal(new Set(state.deliveredEvents).size, state.deliveredEvents.length, "reload must not duplicate delivered events");
  return runtime;
}

function apply(runtime, actionId) {
  const check = runtime.engine.canApplyAction(actionId);
  assert.equal(check.ok, true, `${actionId} must remain reachable after reload: ${check.reason || ""}`);
  const result = runtime.engine.applyAction(actionId);
  assert.equal(result.ok, true, `${actionId} must complete after reload`);
  assert.equal(result.persisted, true, `${actionId} must be persisted`);
  return result;
}

function nextDay(runtime, dayIndex) {
  const result = runtime.engine.endDay();
  assert.equal(result.ok, true, `transition to day ${dayIndex} must succeed`);
  assert.equal(result.final, false, `transition to day ${dayIndex} must not end the week`);
  assert.equal(result.persisted, true, `transition to day ${dayIndex} must be persisted`);
  assert.equal(result.state.dayIndex, dayIndex);
  assert.equal(result.state.dayStarted, true);
  return result;
}

const storage = new Map();
let runtime = loadRuntime(storage, { seed: "resume-every-day", truthId: "player" });
let result = runtime.engine.startDay();
assert.equal(result.ok, true);
assert.equal(result.persisted, true);

apply(runtime, "mon-report-final");
apply(runtime, "mon-invoice-fix");
nextDay(runtime, 1);
runtime = reload(storage, 1, ["mon-report-final", "mon-invoice-fix"]);

apply(runtime, "tue-client-confirm");
nextDay(runtime, 2);
runtime = reload(storage, 2, ["tue-client-confirm"]);

apply(runtime, "wed-finish-backlog");
nextDay(runtime, 3);
runtime = reload(storage, 3, ["wed-finish-backlog"]);

apply(runtime, "thu-finish-project");
nextDay(runtime, 4);
runtime = reload(storage, 4, ["thu-finish-project"]);

apply(runtime, "fri-wait-meeting");
assert.ok(runtime.engine.getState().deliveredEvents.includes("fri-meeting"), "meeting event must survive Friday waiting");

runtime = reload(storage, 4, ["fri-wait-meeting"]);
assert.ok(runtime.engine.getState().deliveredEvents.includes("fri-meeting"), "meeting event must survive a reload at 17:00");
apply(runtime, "fri-meeting-work");

result = runtime.engine.endDay();
assert.equal(result.ok, true);
assert.equal(result.final, true);
assert.equal(result.persisted, true);
assert.equal(result.ending.id, "saved-by-work");

const endedSave = snapshot(storage);
runtime = loadRuntime(storage);
const endedState = runtime.engine.getState();
assert.equal(endedState.ended, true, "completed week must remain ended after reload");
assert.equal(endedState.endingId, endedSave.endingId, "ending id must survive reload");
assert.equal(runtime.engine.resolveEnding().id, "saved-by-work", "reopened final must use the stored ending");
assert.equal(runtime.engine.applyAction("fri-meeting-calm").reason, "game-ended", "ended saves must reject further actions");

console.log("Save continuation validated after every working day and at the final meeting.");
