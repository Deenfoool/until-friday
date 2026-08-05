"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const Story = require("../src/story-v2.js");
require("../src/min-npc-dialogues.js");
require("../src/min-npc-dialogue-schedules.js");
require("../src/monday-live-story.js");
const Live = require("../src/tuesday-live-story.js");

assert.equal(Story.metadata.tuesdayLiveStoryVersion, Live.VERSION, "Tuesday live story patch must be applied once");
assert.equal(Live.FIXED_EVENT_IDS.length, 3, "Tuesday must have three neutral office background events");
assert.equal(Live.CONDITIONAL_EVENT_IDS.length, 7, "Tuesday must carry Monday and admin consequences forward");
assert.equal(Live.MARINA_ACTION_IDS.length, 3, "Marina must expose three mutually exclusive replies");
assert.equal(Live.MARINA_REPLY_IDS.length, 3, "Every Marina choice must receive a delayed answer");

const fixedEvents = Live.FIXED_EVENT_IDS.map((id) => Story.events[id]);
assert.ok(fixedEvents.every(Boolean));
assert.deepEqual(fixedEvents.map((event) => event.minute), [650, 820, 930]);
assert.deepEqual(fixedEvents.map((event) => event.type), ["mail", "mail", "mail"]);

for (const actionId of Live.MARINA_ACTION_IDS) {
  const action = Story.actions[actionId];
  assert.ok(action, `${actionId} must exist`);
  assert.equal(action.dayIndex, 1);
  assert.equal(action.channel, "chat");
  assert.equal(action.contactKey, "marina");
  assert.equal(action.choiceGroup, "tuesday-marina-invoices");
  assert.deepEqual(action.requires, { eventDelivered: "tue-live-marina-followup" });
  assert.equal(action.effects.schedule.length, 1);
}

function tuesdayState(overrides = {}) {
  const seed = Engine.createEngine(Story, null, { truthId: "player", seed: "live-tuesday-test" }).getState();
  return {
    ...seed,
    dayIndex: 1,
    minute: 535,
    dayStarted: true,
    ended: false,
    deliveredEvents: [],
    scheduledEvents: [],
    completedActions: {},
    flags: { ...seed.flags },
    ...overrides
  };
}

let engine = Engine.createEngine(Story, tuesdayState({ flags: { ...Story.initialFlags, encouragedOlegRumor: true } }));
let result = engine.advanceTime(55);
assert.ok(result.events.some((event) => event.id === "tue-live-oleg-encouraged"), "Oleg must remember that the player encouraged rumors on Monday");
assert.equal(engine.getState().flags.olegFeedsRumors, true);

engine = Engine.createEngine(Story, tuesdayState({
  minute: 599,
  deliveredEvents: ["tue-accountant-request"]
}));
result = engine.advanceTime(1);
assert.ok(result.events.some((event) => event.id === "tue-live-marina-followup"), "Marina chat must follow the accounting mail");

let marinaActions = engine.listActions("chat").filter((action) => Live.MARINA_ACTION_IDS.includes(action.id));
assert.equal(marinaActions.length, 3);
result = engine.applyAction("tue-accountant-ask-pattern");
assert.equal(result.ok, true);
assert.equal(result.events.some((event) => event.id === "tue-accountant-reply-pattern"), false, "Marina must not answer in the same instant");
result = engine.advanceTime(7);
assert.ok(result.events.some((event) => event.id === "tue-accountant-reply-pattern"));
assert.equal(engine.getState().flags.accountantSavedInvoiceCopy, true);
assert.equal(engine.getState().stats.evidence, 1);

engine = Engine.createEngine(Story, tuesdayState({
  minute: 699,
  flags: { ...Story.initialFlags, answeredAdminHonestly: true }
}));
result = engine.advanceTime(1);
assert.ok(result.events.some((event) => event.id === "tue-live-roman-honest-tip"), "An honest answer to Roman must unlock a useful consequence");
assert.equal(engine.getState().stats.access, 1);
assert.equal(engine.getState().flags.romanSharedBadgeTip, true);

engine = Engine.createEngine(Story, tuesdayState({
  minute: 699,
  flags: { ...Story.initialFlags, liedToAdmin: true }
}));
result = engine.advanceTime(1);
assert.ok(result.events.some((event) => event.id === "tue-live-roman-lie-log"));
assert.equal(engine.getState().stats.suspicion, 1, "A verified lie must have a visible mechanical consequence");

console.log("Live Tuesday carryover and Marina dialogue validation passed.");
