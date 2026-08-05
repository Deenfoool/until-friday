"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const Story = require("../src/story-v2.js");
require("../src/min-npc-dialogues.js");
require("../src/min-npc-dialogue-schedules.js");
const Live = require("../src/monday-live-story.js");

assert.equal(Story.metadata.mondayLiveStoryVersion, Live.VERSION, "Monday live story patch must be applied once");
assert.equal(Live.FIXED_EVENT_IDS.length, 9, "Monday must receive nine paced office beats");
assert.equal(Live.OLEG_ACTION_IDS.length, 3, "Oleg rumor must expose three player responses");
assert.equal(Live.OLEG_REPLY_IDS.length, 3, "Every Oleg choice must receive a reply");

const fixedEvents = Live.FIXED_EVENT_IDS.map((id) => Story.events[id]);
assert.ok(fixedEvents.every(Boolean), "Every fixed Monday event must exist in the story");
assert.deepEqual(
  fixedEvents.map((event) => event.minute),
  [534, 552, 565, 609, 659, 729, 805, 883, 961],
  "Monday beats must be paced throughout the workday"
);
assert.deepEqual(
  fixedEvents.map((event) => event.type),
  ["mail", "chat", "mail", "mail", "mail", "mail", "chat", "mail", "mail"],
  "Office context must arrive through believable Mail and MIN channels"
);
assert.equal(Story.events["mon-live-oleg-rumor"].contactKey, "oleg");
assert.equal(Story.events["mon-live-invoice-check"].source, "Андрей Соколов");

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

const engine = Engine.createEngine(Story, null, { truthId: "player", seed: "live-monday-test" });
const started = engine.startDay();
assert.equal(started.ok, true);

let result = engine.advanceTime(25); // 08:47 -> 09:12
assert.deepEqual(
  result.events.map((event) => event.id),
  ["mon-live-support-brief", "mon-live-oleg-rumor"],
  "First work mail and Oleg rumor must arrive without opening every app"
);

const olegActions = engine.listActions("chat").filter((action) => Live.OLEG_ACTION_IDS.includes(action.id));
assert.equal(olegActions.length, 3, "All Oleg responses must become available after his message");

result = engine.applyAction("mon-gossip-ask-details");
assert.equal(result.ok, true);
assert.equal(result.events.some((event) => event.id === "mon-gossip-reply-details"), false, "Oleg must not reply in the same instant");
assert.equal(engine.listActions("chat").some((action) => Live.OLEG_ACTION_IDS.includes(action.id)), false, "Choice group must hide the other Oleg responses");

result = engine.advanceTime(5);
assert.equal(result.events.some((event) => event.id === "mon-gossip-reply-details"), true, "Oleg reply must arrive after a short in-game delay");

const restored = Engine.createEngine(Story, engine.getState());
assert.equal(restored.getState().deliveredEvents.includes("mon-live-oleg-rumor"), true, "Monday beats must survive save hydration");
assert.equal(restored.listActions("chat").some((action) => Live.OLEG_ACTION_IDS.includes(action.id)), false, "Completed Oleg branch must remain locked after reload");

console.log("Live Monday story pacing and Oleg dialogue validation passed.");
