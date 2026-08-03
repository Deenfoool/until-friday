"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const story = require("../src/story-v2.js");

globalThis.UNTIL_FRIDAY_STORY = story;
require("../src/story-consistency-fixes.js");

function stateFor(truthId, route, overrides = {}) {
  const state = Engine.createState(story, {
    seed: `${truthId}-${route}`,
    truthId,
    stats: {
      work: route === "work" ? 5 : 0,
      evidence: route === "blackmail" ? 2 : 0,
      suspicion: 0,
      ...(overrides.stats || {})
    },
    trust: overrides.trust,
    flags: overrides.flags
  });
  state.dayIndex = 4;
  state.dayStarted = true;
  if (route === "resignation") state.flags.resignationPrepared = true;
  return state;
}

const actionFor = {
  calm: "fri-meeting-calm",
  work: "fri-meeting-work",
  blackmail: "fri-meeting-blackmail",
  resignation: "fri-send-resignation"
};

function play(truthId, route, overrides = {}) {
  const engine = Engine.createEngine(story, stateFor(truthId, route, overrides));
  const action = engine.applyAction(actionFor[route]);
  assert.equal(action.ok, true, `${truthId}/${route} route must be playable`);
  return engine.resolveEnding().id;
}

const expected = {
  player: {
    calm: "fired-clean",
    work: "fired-clean",
    blackmail: "fired-for-cause",
    resignation: "voluntary-exit"
  },
  newcomer: {
    calm: "wrong-person",
    work: "wrong-person",
    blackmail: "wrong-person",
    resignation: "voluntary-exit"
  },
  department: {
    calm: "department-cut",
    work: "department-cut",
    blackmail: "department-cut",
    resignation: "voluntary-exit"
  },
  contractor: {
    calm: "false-alarm-clean",
    work: "false-alarm-clean",
    blackmail: "false-alarm-damage",
    resignation: "voluntary-exit"
  }
};

for (const [truthId, routes] of Object.entries(expected)) {
  for (const [route, endingId] of Object.entries(routes)) {
    assert.equal(play(truthId, route), endingId, `${truthId}/${route} must resolve to ${endingId}`);
  }
}

assert.equal(
  play("player", "work", { stats: { work: 9, suspicion: 1 }, trust: { chief: 2 } }),
  "saved-by-work",
  "strong clean work must save the player's position"
);
assert.equal(
  play("player", "work", { stats: { work: 9, suspicion: 5 }, trust: { chief: 2 } }),
  "fired-for-cause",
  "the ending must agree when the meeting dialogue refuses to save a suspicious employee"
);
assert.equal(
  play("player", "blackmail", { stats: { evidence: 5, suspicion: 0 } }),
  "blackmail-deal",
  "five strong evidence points must match the successful meeting response"
);
assert.equal(
  play("contractor", "resignation", { stats: { suspicion: 9 } }),
  "caught",
  "a critical security case must override voluntary resignation"
);

for (const truthId of Object.keys(expected)) {
  for (const route of Object.keys(actionFor)) {
    assert.notEqual(play(truthId, route), "ordinary-friday", `${truthId}/${route} must not fall back to the generic ending`);
  }
}

console.log("Friday ending coverage validation passed.");
