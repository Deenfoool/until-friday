"use strict";

const assert = require("node:assert/strict");

globalThis.UntilFridayEngine = require("../src/engine.js");
globalThis.UNTIL_FRIDAY_STORY = require("../src/story-v2.js");
require("../src/rules-extension.js");

const Engine = globalThis.UntilFridayEngine;
const Story = globalThis.UNTIL_FRIDAY_STORY;

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

console.log("Rules extension tests passed.");
