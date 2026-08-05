"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const story = require("../src/story-v2.js");
const Dialogues = require("../src/min-npc-dialogues.js");
const Schedules = require("../src/min-npc-dialogue-schedules.js");

Dialogues.patchStory(story);

assert.equal(story.metadata.minNpcDialoguesVersion, Dialogues.VERSION, "Dialogue patch version must be stored on the story");
for (const id of Dialogues.ACTION_IDS) assert(story.actions[id], `Missing MIN dialogue action: ${id}`);
for (const id of Dialogues.EVENT_IDS) assert(story.events[id], `Missing MIN dialogue event: ${id}`);
for (const [actionId, reply] of Object.entries(Schedules.REPLY_SCHEDULES)) {
  assert(
    story.actions[actionId]?.effects?.schedule?.some((item) => item.eventId === reply.eventId),
    `Dialogue action ${actionId} must schedule reply ${reply.eventId}`
  );
}

{
  const engine = Engine.createEngine(story, null, { seed: "min-dialogue-monday", truthId: "player" });
  assert.equal(engine.startDay().ok, true);

  const opening = engine.listActions("chat").filter((action) => action.choiceGroup === "monday-dima-opening");
  assert.deepEqual(
    new Set(opening.map((action) => action.id)),
    new Set(["mon-tell-friend", "mon-friend-hide", "mon-friend-probe", "mon-friend-ask-changes"]),
    "Monday must begin with four different ways to answer Dima"
  );

  const sent = engine.applyAction("mon-tell-friend");
  assert.equal(sent.ok, true);
  assert.equal(sent.state.flags.friendInvestigating, true);
  assert.equal(sent.state.trust.friend, 2);
  assert(!sent.events.some((event) => event.id === "mon-friend-reply-truth"), "Dima must not answer before the planned game minute");

  const reply = engine.advanceTime(3).events;
  assert(reply.some((event) => event.id === "mon-friend-reply-truth"), "Dima must answer after the player tells the truth");

  const followups = engine.listActions("chat").filter((action) => action.choiceGroup === "monday-dima-followup");
  assert.equal(followups.length, 3, "The truthful opening must unlock a second dialogue turn");

  const restoredState = Engine.hydrateState(story, JSON.parse(engine.serialize()));
  restoredState.dayIndex = 1;
  restoredState.dayStarted = true;
  restoredState.minute = 555;
  const restored = Engine.createEngine(story, restoredState);
  const tuesdayEvents = restored.advanceTime(0).events;
  assert(tuesdayEvents.some((event) => event.id === "tue-friend-rumor"), "Dima's Tuesday follow-up must survive save and resume");
}

{
  const hiddenState = Engine.createState(story, { seed: "min-dialogue-hidden", truthId: "player" });
  hiddenState.dayIndex = 1;
  hiddenState.dayStarted = true;
  hiddenState.minute = 552;
  hiddenState.flags.hidConcernFromFriend = true;
  const hidden = Engine.createEngine(story, hiddenState);
  const events = hidden.advanceTime(0).events;
  assert(events.some((event) => event.id === "tue-friend-hidden-check"), "Dima must remember that the player hid the problem on Monday");
  assert(!events.some((event) => event.id === "tue-friend-rumor"), "The confidential rumor branch must not appear when the player never told Dima");
  const options = hidden.listActions("chat").filter((action) => action.choiceGroup === "tuesday-dima-hidden");
  assert.equal(options.length, 2, "The hidden-concern route must offer a late confession or another refusal");
}

{
  const state = Engine.createState(story, { seed: "min-dialogue-roman", truthId: "player" });
  state.dayIndex = 1;
  state.dayStarted = true;
  state.minute = 565;
  state.flags.requestedLeadershipAccess = true;
  const engine = Engine.createEngine(story, state);
  const question = engine.advanceTime(0).events;
  assert(question.some((event) => event.id === "tue-admin-question"), "Roman must question the player about the access request");

  const answers = engine.listActions("chat").filter((action) => action.choiceGroup === "tuesday-admin");
  assert.deepEqual(
    new Set(answers.map((action) => action.id)),
    new Set(["tue-answer-admin-honest", "tue-answer-admin-lie", "tue-answer-admin-deflect"]),
    "Roman's conversation must provide honest, dishonest, and confrontational replies"
  );

  const honest = engine.applyAction("tue-answer-admin-honest");
  assert.equal(honest.ok, true);
  assert.equal(honest.state.flags.answeredAdminHonestly, true);
  const reply = engine.advanceTime(3).events;
  assert(reply.some((event) => event.id === "tue-admin-reply-honest"), "Roman must answer the honest confession");
}

console.log(`✓ ${Dialogues.ACTION_IDS.length} MIN dialogue actions registered`);
console.log(`✓ ${Dialogues.EVENT_IDS.length} MIN dialogue events registered`);
console.log("✓ Dima and Roman remember Monday–Tuesday choices across saves");