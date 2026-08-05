"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const Story = require("../src/story-v2.js");
require("../src/min-npc-dialogues.js");
require("../src/min-npc-dialogue-schedules.js");
const Live = require("../src/monday-live-story.js");

assert.equal(Story.metadata.mondayLiveStoryVersion, Live.VERSION, "Monday live story patch must be applied once");
assert.equal(Live.FIXED_EVENT_IDS.length, 4, "Monday must receive four ambient office beats in addition to task mail");
assert.equal(Live.CONDITIONAL_EVENT_IDS.length, 2, "Oleg follow-up must depend on the player's response");
assert.equal(Live.OLEG_ACTION_IDS.length, 3, "Oleg rumor must expose three player responses");
assert.equal(Live.OLEG_REPLY_IDS.length, 3, "Every Oleg choice must receive a reply");

const fixedEvents = Live.FIXED_EVENT_IDS.map((id) => Story.events[id]);
assert.ok(fixedEvents.every(Boolean), "Every fixed Monday event must exist in the story");
assert.deepEqual(
  fixedEvents.map((event) => event.minute),
  [552, 620, 710, 850],
  "Ambient Monday beats must be spread between routine tasks"
);
assert.deepEqual(
  fixedEvents.map((event) => event.type),
  ["chat", "mail", "chat", "mail"],
  "Office background must arrive through believable Mail and MIN channels"
);
assert.equal(Story.events["mon-live-oleg-rumor"].contactKey, "oleg");
assert.equal(Story.events["mon-live-roman-rights"].contactKey, "roman");
assert.match(Story.events["mon-live-room-booking"].text, /пятницу/i);
assert.match(Story.events["mon-live-workspace-move"].text, /два стола/i);

for (const actionId of Live.OLEG_ACTION_IDS) {
  const action = Story.actions[actionId];
  assert.ok(action, `${actionId} must exist`);
  assert.equal(action.dayIndex, 0);
  assert.equal(action.channel, "chat");
  assert.equal(action.contactKey, "oleg");
  assert.equal(action.choiceGroup, "monday-oleg-rumor");
  assert.deepEqual(action.requires, { eventDelivered: "mon-live-oleg-rumor" });
  assert.equal(action.effects.schedule.length, 1, `${actionId} must schedule one delayed reply`);
}
assert.equal(new Set(Live.OLEG_ACTION_IDS.map((id) => Story.actions[id].choiceGroup)).size, 1, "Runtime choice rules must receive one shared Oleg choice group");

const engine = Engine.createEngine(Story, null, { truthId: "player", seed: "live-monday-test" });
const started = engine.startDay();
assert.equal(started.ok, true);

let result = engine.advanceTime(25); // 08:47 -> 09:12
assert.deepEqual(
  result.events.map((event) => event.id),
  ["mon-live-oleg-rumor"],
  "Oleg rumor must arrive without duplicating routine task mail"
);

const olegActions = engine.listActions("chat").filter((action) => Live.OLEG_ACTION_IDS.includes(action.id));
assert.equal(olegActions.length, 3, "All Oleg responses must become available after his message");

result = engine.applyAction("mon-gossip-ask-details");
assert.equal(result.ok, true);
assert.equal(result.events.some((event) => event.id === "mon-gossip-reply-details"), false, "Oleg must not reply in the same instant");
assert.equal(engine.listActions("chat").some((action) => action.id === "mon-gossip-ask-details"), false, "The chosen one-time response must disappear");

result = engine.advanceTime(5);
assert.equal(result.events.some((event) => event.id === "mon-gossip-reply-details"), true, "Oleg reply must arrive after a short in-game delay");

result = engine.advanceTime(390); // 09:20 -> 15:50
assert.ok(result.events.some((event) => event.id === "mon-live-room-booking"), "The Friday room booking must surface during the day");
assert.ok(result.events.some((event) => event.id === "mon-live-roman-rights"), "Roman must explain the access cleanup");
assert.ok(result.events.some((event) => event.id === "mon-live-workspace-move"), "The ambiguous desk move must surface after lunch");
assert.ok(result.events.some((event) => event.id === "mon-live-oleg-followup-details"), "Questioning Oleg must produce a later follow-up");
assert.equal(result.events.some((event) => event.id === "mon-live-oleg-followup-encouraged"), false, "Only the chosen Oleg branch may continue");

const restored = Engine.createEngine(Story, engine.getState());
assert.equal(restored.getState().deliveredEvents.includes("mon-live-oleg-rumor"), true, "Monday beats must survive save hydration");
assert.equal(restored.listActions("chat").some((action) => action.id === "mon-gossip-ask-details"), false, "Chosen Oleg response must remain completed after reload");

console.log("Live Monday story pacing and Oleg dialogue validation passed.");
