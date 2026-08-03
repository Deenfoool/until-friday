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

function createRuntime(truthId, seed) {
  const storage = new Map();
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
    sessionStorage: {
      getItem: () => null,
      setItem() {},
      removeItem() {}
    },
    document: {
      hidden: false,
      documentElement: {},
      body: { appendChild() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: () => null
    },
    MutationObserver: class MutationObserver {
      observe() {}
      disconnect() {}
    },
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
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

  const engine = context.UntilFridayEngine.createEngine(
    context.UNTIL_FRIDAY_STORY,
    null,
    { seed, truthId }
  );

  function savedState() {
    const raw = storage.get(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  return { context, engine, storage, savedState };
}

function assertPersisted(runtime, label) {
  const engineState = runtime.engine.getState();
  const saved = runtime.savedState();
  assert.ok(saved, `${label}: runtime must persist a save`);
  assert.equal(saved.dayIndex, engineState.dayIndex, `${label}: saved day must match the engine`);
  assert.equal(saved.minute, engineState.minute, `${label}: saved time must match the engine`);
  assert.equal(saved.ended, engineState.ended, `${label}: saved ending state must match the engine`);
  assert.deepEqual(saved.completedActions, engineState.completedActions, `${label}: completed actions must be identical`);
}

function start(runtime) {
  const result = runtime.engine.startDay();
  assert.equal(result.ok, true, "the first day must start");
  assert.equal(result.persisted, true, "day start must be persisted atomically");
  assertPersisted(runtime, "day start");
}

function apply(runtime, actionId) {
  const check = runtime.engine.canApplyAction(actionId);
  assert.equal(
    check.ok,
    true,
    `${actionId} must be reachable, got ${check.reason || "unknown rejection"}`
  );
  const result = runtime.engine.applyAction(actionId);
  assert.equal(result.ok, true, `${actionId} must complete`);
  assert.equal(result.persisted, true, `${actionId} must be persisted by the runtime`);
  assertPersisted(runtime, actionId);
  return result;
}

function advanceTo(runtime, targetMinute) {
  const before = runtime.engine.getState();
  const delta = Math.max(0, Number(targetMinute) - Number(before.minute));
  if (!delta) return { ok: true, events: [], state: before };
  const result = runtime.engine.advanceTime(delta);
  assert.equal(result.ok, true, `time must advance to ${targetMinute}`);
  assert.equal(result.persisted, true, "time advance must be persisted atomically");
  assert.equal(result.state.minute, targetMinute, `clock must reach ${targetMinute}`);
  assertPersisted(runtime, `advance to ${targetMinute}`);
  return result;
}

function nextDay(runtime, expectedDayIndex) {
  const result = runtime.engine.endDay();
  assert.equal(result.ok, true, `day ${expectedDayIndex} transition must succeed`);
  assert.equal(result.final, false, `day ${expectedDayIndex} must not end the week`);
  assert.equal(result.persisted, true, "day transition must be persisted atomically");
  assert.equal(result.state.dayIndex, expectedDayIndex, `transition must reach day ${expectedDayIndex}`);
  assert.equal(result.state.dayStarted, true, "the next day must be ready immediately");
  assertPersisted(runtime, `transition to day ${expectedDayIndex}`);
  return result;
}

function finishWeek(runtime, expectedEnding) {
  const result = runtime.engine.endDay();
  assert.equal(result.ok, true, "Friday must finish successfully");
  assert.equal(result.final, true, "Friday must produce a final result");
  assert.equal(result.persisted, true, "the ending must be persisted atomically");
  assert.equal(result.ending.id, expectedEnding, `route must end as ${expectedEnding}`);
  assert.notEqual(result.ending.id, "ordinary-friday", "a supported route must not use the fallback ending");
  assert.equal(result.state.ended, true, "the final save must be marked as ended");
  assertPersisted(runtime, expectedEnding);
  return result;
}

function playHonestWork() {
  const runtime = createRuntime("player", "full-honest-work");
  start(runtime);

  apply(runtime, "mon-report-final");
  apply(runtime, "mon-invoice-fix");
  nextDay(runtime, 1);

  advanceTo(runtime, 590);
  apply(runtime, "tue-client-confirm");
  apply(runtime, "tue-help-accountant");
  nextDay(runtime, 2);

  apply(runtime, "wed-finish-backlog");
  nextDay(runtime, 3);

  apply(runtime, "thu-finish-project");
  nextDay(runtime, 4);

  apply(runtime, "fri-wait-meeting");
  assert.ok(runtime.engine.getState().deliveredEvents.includes("fri-meeting"), "waiting must unlock the meeting");
  apply(runtime, "fri-meeting-work");
  finishWeek(runtime, "saved-by-work");
}

function playDossier() {
  const runtime = createRuntime("player", "full-dossier");
  start(runtime);

  apply(runtime, "mon-report-final");
  apply(runtime, "mon-invoice-fix");
  apply(runtime, "mon-tell-friend");
  nextDay(runtime, 1);

  advanceTo(runtime, 590);
  apply(runtime, "tue-client-confirm");
  apply(runtime, "tue-help-accountant");
  apply(runtime, "tue-copy-payment-list");
  nextDay(runtime, 2);

  assert.ok(runtime.engine.getState().deliveredEvents.includes("wed-security-audit"), "copied payments must trigger the audit");
  apply(runtime, "wed-audit-explain");
  advanceTo(runtime, 780);
  assert.ok(runtime.engine.getState().access.includes("hr-temp"), "Wednesday must grant the temporary HR window");
  apply(runtime, "wed-copy-hr-draft");
  nextDay(runtime, 3);

  apply(runtime, "thu-build-case");
  nextDay(runtime, 4);

  apply(runtime, "fri-wait-meeting");
  apply(runtime, "fri-meeting-blackmail");
  finishWeek(runtime, "blackmail-deal");
}

function playComplaintAndTampering() {
  const runtime = createRuntime("contractor", "full-complaint");
  start(runtime);

  apply(runtime, "mon-report-final");
  apply(runtime, "mon-invoice-fix");
  apply(runtime, "mon-tell-friend");
  nextDay(runtime, 1);

  advanceTo(runtime, 590);
  apply(runtime, "tue-client-confirm");
  apply(runtime, "tue-help-accountant");
  apply(runtime, "tue-copy-payment-list");
  nextDay(runtime, 2);

  apply(runtime, "wed-audit-delete");
  apply(runtime, "wed-finish-backlog");
  nextDay(runtime, 3);

  const complaintCheck = runtime.engine.canApplyAction("thu-frame-chief");
  assert.equal(complaintCheck.ok, true, "payment list plus access level one must unlock the complaint route");
  apply(runtime, "thu-frame-chief");
  nextDay(runtime, 4);

  apply(runtime, "fri-wait-meeting");
  apply(runtime, "fri-meeting-calm");
  finishWeek(runtime, "caught");
}

function playResignation() {
  const runtime = createRuntime("department", "full-resignation");
  start(runtime);

  apply(runtime, "mon-report-final");
  apply(runtime, "mon-invoice-fix");
  nextDay(runtime, 1);

  apply(runtime, "tue-client-confirm");
  nextDay(runtime, 2);

  apply(runtime, "wed-finish-backlog");
  nextDay(runtime, 3);

  apply(runtime, "thu-resign");
  nextDay(runtime, 4);

  apply(runtime, "fri-wait-meeting");
  apply(runtime, "fri-send-resignation");
  finishWeek(runtime, "voluntary-exit");
}

playHonestWork();
playDossier();
playComplaintAndTampering();
playResignation();

console.log("Four complete five-day playthroughs validated.");
