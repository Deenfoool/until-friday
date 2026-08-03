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
const TimeGuard = globalThis.UntilFridayTimeBoundaryGuard;
assert.ok(TimeGuard, "time boundary guard API must be exported");
assert.equal(TimeGuard.WORKDAY_END_MINUTE, 1080);
assert.equal(TimeGuard.FRIDAY_MEETING_MINUTE, 1020);

{
  const state = Engine.createState(Story, { seed: "late-action", truthId: "player" });
  state.dayStarted = true;
  state.minute = 1075;
  const engine = Engine.createEngine(Story, state);
  const result = engine.applyAction("mon-invoice-fix");
  assert.equal(result.ok, false, "an action must not receive a full result when the shift is too short");
  assert.equal(result.reason, "not-enough-time");
  assert.equal(result.requested, 20);
  assert.equal(result.remaining, 5);
  assert.equal(engine.getState().minute, 1075);
  assert.equal(Boolean(engine.getState().completedActions["mon-invoice-fix"]), false);
}

{
  const state = Engine.createState(Story, { seed: "exact-action", truthId: "player" });
  state.dayStarted = true;
  state.minute = 1060;
  const engine = Engine.createEngine(Story, state);
  const result = engine.applyAction("mon-invoice-fix");
  assert.equal(result.ok, true);
  assert.equal(result.requestedMinutes, 20);
  assert.equal(result.appliedMinutes, 20);
  assert.equal(result.state.minute, 1080);
  assert.equal(engine.listActions().length, 0, "ordinary actions must disappear after the workday ends");
  assert.equal(engine.canApplyAction("mon-report-final").reason, "workday-ended");
}

{
  const state = Engine.createState(Story, { seed: "late-reaction", truthId: "player" });
  state.dayStarted = true;
  state.minute = 700;
  const engine = Engine.createEngine(Story, state);
  const result = engine.applyAction("mon-report-final");
  assert.equal(result.ok, true);
  assert.equal(result.state.minute, 718);
  assert.equal(result.events.some((event) => event.id === "mon-chief-thanks"), false, "a reply cannot arrive before the action finishes");
  const reaction = engine.advanceTime(5);
  assert.equal(reaction.events.some((event) => event.id === "mon-chief-thanks"), true, "same-day replies must arrive after completion");
  assert.equal(Story.events["mon-chief-thanks"].minute, 723, "displayed message time must match the adjusted schedule");
}

{
  Story.actions["fri-wait-meeting"] = {
    id: "fri-wait-meeting",
    dayIndex: 4,
    channel: "tasks",
    label: "Работать до встречи в 17:00",
    minutes: 475,
    once: true,
    focusCost: 1,
    result: "Наступило время встречи.",
    effects: { setFlags: { fridayWorkdayCompleted: true } }
  };
  Story.days[4].focusLimit = 2;
  const state = Engine.createState(Story, { seed: "friday-wait", truthId: "player" });
  state.dayIndex = 4;
  state.dayStarted = true;
  state.minute = 720;
  const engine = Engine.createEngine(Story, state);
  const result = engine.applyAction("fri-wait-meeting");
  assert.equal(result.ok, true);
  assert.equal(result.requestedMinutes, 300, "Friday wait must target 17:00 instead of adding a fixed 475 minutes");
  assert.equal(result.state.minute, 1020);
  assert.equal(result.events.some((event) => event.id === "fri-meeting"), true);
}

const html = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../index.html"), "utf8");
assert.match(html, /src\/time-boundary-guard\.js/);
assert.match(html, /src\/runtime-engine\.js/);
assert.ok(
  html.indexOf("src/time-boundary-guard.js") < html.indexOf("src/runtime-engine.js") &&
  html.indexOf("src/runtime-engine.js") < html.indexOf("src/passive-clock.js"),
  "time rules must load before the single runtime and passive timing after it"
);

console.log("Unified runtime time boundary validation passed.");
