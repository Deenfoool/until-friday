"use strict";

const assert = require("node:assert/strict");

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
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
require("../src/day-transition-guard.js");

const Engine = globalThis.UntilFridayEngine;
const Story = globalThis.UNTIL_FRIDAY_STORY;

{
  const engine = Engine.createEngine(Story, null, {
    seed: "monday-transition-complete",
    truthId: "player"
  });
  assert.equal(engine.startDay().ok, true);
  assert.equal(engine.applyAction("mon-report-final").ok, true);
  assert.equal(engine.applyAction("mon-invoice-fix").ok, true);

  const transition = engine.endDay();
  assert.equal(transition.ok, true, "completed Monday must end without an error");
  assert.equal(transition.final, false);
  assert.equal(transition.nextDay.id, "tuesday", "Monday must transition to Tuesday");
  assert.equal(transition.state.dayIndex, 1);
  assert.equal(transition.state.dayStarted, true, "Tuesday session must already be started");
  assert.equal(engine.getState().dayIndex, 1);
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
  assert.equal(transition.ok, true, "guard must recover a save with dayStarted=false");
  assert.equal(transition.nextDay.id, "tuesday");
  assert.equal(transition.state.dayIndex, 1);
  assert.equal(transition.state.dayStarted, true);
}

const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../src/day-transition-guard.js"), "utf8");
assert.match(source, /transition-exception/, "transition exceptions must be converted to recoverable results");
assert.match(source, /transition-did-not-advance/, "a transition that stays on the same day must be detected");
assert.match(source, /data-recovered-start/, "the UI must offer a recovery button after a rendering failure");
assert.match(source, /window\.location\.reload\(\)/, "recovered transition must reload the synchronized save");

const html = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../index.html"), "utf8");
assert.match(html, /src\/day-transition-guard\.js/, "day transition guard must be connected");
assert.ok(
  html.indexOf("src/passive-clock.js") < html.indexOf("src/day-transition-guard.js") &&
  html.indexOf("src/day-transition-guard.js") < html.indexOf("src/bootstrap.js"),
  "transition guard must wrap the final engine before app bootstrap"
);

console.log("Day transition recovery validation passed.");
