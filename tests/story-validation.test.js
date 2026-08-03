"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/engine.js");
const story = require("../src/story-v2.js");

function collectConditionReferences(condition, refs = { actions: new Set(), events: new Set() }) {
  if (!condition || typeof condition !== "object") return refs;
  if (Array.isArray(condition)) {
    condition.forEach((item) => collectConditionReferences(item, refs));
    return refs;
  }
  if (condition.actionDone) refs.actions.add(condition.actionDone);
  if (condition.actionNotDone) refs.actions.add(condition.actionNotDone);
  if (condition.eventDelivered) refs.events.add(condition.eventDelivered);
  Object.values(condition).forEach((value) => {
    if (value && typeof value === "object") collectConditionReferences(value, refs);
  });
  return refs;
}

const dayIds = story.days.map((day) => day.id);
assert.equal(new Set(dayIds).size, dayIds.length, "Day IDs must be unique");
assert.equal(story.days.length, 5, "The main story must contain five working days");

for (const [key, action] of Object.entries(story.actions)) {
  assert.equal(action.id, key, `Action key mismatch: ${key}`);
  assert(action.dayIndex >= 0 && action.dayIndex < story.days.length, `Invalid dayIndex for ${key}`);
  for (const scheduled of action.effects?.schedule || []) {
    assert(story.events[scheduled.eventId], `Action ${key} schedules unknown event ${scheduled.eventId}`);
  }
  const refs = collectConditionReferences(action.requires);
  for (const actionId of refs.actions) assert(story.actions[actionId], `Action ${key} requires unknown action ${actionId}`);
  for (const eventId of refs.events) assert(story.events[eventId], `Action ${key} requires unknown event ${eventId}`);
}

for (const [key, event] of Object.entries(story.events)) {
  assert.equal(event.id, key, `Event key mismatch: ${key}`);
  assert(event.dayIndex >= 0 && event.dayIndex < story.days.length, `Invalid dayIndex for event ${key}`);
  const refs = collectConditionReferences(event.requires);
  for (const actionId of refs.actions) assert(story.actions[actionId], `Event ${key} requires unknown action ${actionId}`);
  for (const eventId of refs.events) assert(story.events[eventId], `Event ${key} requires unknown event ${eventId}`);
}

for (const day of story.days) {
  for (const requirement of day.requirements || []) {
    const refs = collectConditionReferences(requirement.satisfiedWhen);
    for (const actionId of refs.actions) assert(story.actions[actionId], `Requirement ${requirement.id} references unknown action ${actionId}`);
    for (const eventId of refs.events) assert(story.events[eventId], `Requirement ${requirement.id} references unknown event ${eventId}`);
  }
}

const endingIds = story.endings.map((ending) => ending.id);
assert.equal(new Set(endingIds).size, endingIds.length, "Ending IDs must be unique");

for (const truth of story.truths) {
  const state = Engine.createState(story, { truthId: truth.id, seed: `validation-${truth.id}` });
  state.dayIndex = 4;
  state.dayStarted = true;
  const ending = Engine.createEngine(story, state).resolveEnding();
  assert(ending && ending.id, `No ending resolved for truth ${truth.id}`);
}

console.log(`✓ ${story.days.length} days validated`);
console.log(`✓ ${Object.keys(story.actions).length} actions validated`);
console.log(`✓ ${Object.keys(story.events).length} events validated`);
console.log(`✓ ${story.endings.length} endings validated`);