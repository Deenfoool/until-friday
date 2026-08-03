"use strict";

const assert = require("node:assert/strict");

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = {
  addEventListener: () => {},
  querySelector: () => null,
  createElement: () => ({
    dataset: {},
    className: "",
    textContent: "",
    append: () => {},
    addEventListener: () => {},
    querySelector: () => null
  })
};
globalThis.window = {
  setTimeout: () => 0,
  dispatchEvent: () => {},
  location: { reload: () => {} }
};
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => {};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
};

globalThis.UntilFridayEngine = require("../src/engine.js");
globalThis.UNTIL_FRIDAY_STORY = require("../src/story-v2.js");
globalThis.UntilFridayMigration = { ENGINE_SAVE_KEY: "until-friday-save-v2" };
require("../src/rules-extension.js");
require("../src/integrity-fixes.js");
require("../src/story-consistency-fixes.js");
require("../src/time-boundary-guard.js");
require("../src/runtime-engine.js");
require("../src/day-transition-guard.js");

const Engine = globalThis.UntilFridayEngine;
const Story = globalThis.UNTIL_FRIDAY_STORY;
const Guard = globalThis.UntilFridayDayTransitionGuard;

{
  const engine = Engine.createEngine(Story, null, {
    seed: "monday-transition-complete",
    truthId: "player"
  });
  assert.equal(globalThis.UntilFridayRuntimeEngine.getEngine(), engine, "transition UI must use the shared runtime engine");
  assert.equal(Guard.getEngine, undefined, "transition guard must not expose an alternate engine accessor");
  assert.equal(engine.startDay().ok, true);
  assert.equal(engine.applyAction("mon-report-final").ok, true);
  assert.equal(engine.applyAction("mon-invoice-fix").ok, true);

  const transition = engine.endDay();
  assert.equal(transition.ok, true, "completed Monday must end without an error");
  assert.equal(transition.persisted, true, "the runtime must persist the transition before UI recovery");
  assert.equal(transition.final, false);
  assert.equal(transition.nextDay.id, "tuesday", "Monday must transition to Tuesday");
  assert.equal(transition.state.dayIndex, 1);
  assert.equal(transition.state.dayStarted, true, "Tuesday session must already be started");
  assert.equal(engine.getState().dayIndex, 1);
  assert.ok(
    transition.events.some((event) => event.id === "mon-chief-thanks"),
    "an earned same-day reaction must be delivered before Monday closes"
  );
  assert.ok(
    !transition.events.some((event) => event.id === "mon-chief-angry"),
    "the opposite report reaction must never be delivered"
  );
  assert.ok(
    transition.state.deliveredEvents.includes("mon-chief-thanks"),
    "the flushed reaction must remain recorded in the transitioned save"
  );
}

{
  const brokenSave = Engine.createState(Story, {
    seed: "monday-transition-recovery",
    truthId: "player"
  });
  brokenSave.dayIndex = 0;
  brokenSave.dayStarted = false;
  brokenSave.completedActions["mon-report-final"] = {
    dayIndex: 0,
    minute: 560,
    result: "Финальная версия отчёта отправлена начальнику."
  };
  brokenSave.completedActions["mon-invoice-fix"] = {
    dayIndex: 0,
    minute: 580,
    result: "Ошибка в счёте исправлена и передана бухгалтеру."
  };

  const engine = Engine.createEngine(Story, brokenSave);
  const transition = engine.endDay();
  assert.equal(transition.ok, true, "runtime must recover a save with dayStarted=false");
  assert.equal(transition.persisted, true);
  assert.equal(transition.nextDay.id, "tuesday");
  assert.equal(transition.state.dayIndex, 1);
  assert.equal(transition.state.dayStarted, true);
}

const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.resolve(__dirname, "../src/day-transition-guard.js"), "utf8");
const runtimeSource = fs.readFileSync(path.resolve(__dirname, "../src/runtime-engine.js"), "utf8");
assert.doesNotMatch(source, /Engine\.createEngine\s*=/, "transition UI must not wrap the engine factory");
assert.doesNotMatch(source, /Runtime\.persist|localStorage/, "transition UI must not save state independently");
assert.match(source, /UntilFridayRuntimeEngine/, "transition UI must obtain the shared runtime");
assert.match(source, /flushPendingConsequences/, "transition UI may request the runtime to flush consequences");
assert.match(source, /data-recovered-start/, "the UI must offer a recovery button after a rendering failure");
assert.match(source, /window\.location\.reload\(\)/, "recovered transition must reload the synchronized save");
assert.match(runtimeSource, /transition-exception/, "transition exceptions must be handled inside the runtime");
assert.match(runtimeSource, /transition-did-not-advance/, "invalid day transitions must be rejected inside the runtime");

const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
assert.match(html, /src\/day-transition-guard\.js/, "day transition guard must be connected");
assert.ok(
  html.indexOf("src/runtime-engine.js") < html.indexOf("src/day-transition-guard.js") &&
  html.indexOf("src/day-transition-guard.js") < html.indexOf("src/bootstrap.js"),
  "transition UI must load after the unified runtime and before app bootstrap"
);

console.log("Unified day transition validation passed.");
