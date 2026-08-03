"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const story = require("../src/story-v2.js");
const Engine = require("../src/engine.js");
const source = fs.readFileSync(path.join(root, "src/story-consistency-fixes.js"), "utf8");

const context = { UNTIL_FRIDAY_STORY: story };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "story-consistency-fixes.js" });

const requirement = story.days[0].requirements.find((item) => item.id === "monday-core-work");
assert.ok(requirement?.satisfiedWhen?.all, "Monday must contain two independent required groups");

function stateWith(...actions) {
  const state = Engine.createState(story, { seed: actions.join("-") || "none", truthId: "player" });
  state.dayStarted = true;
  for (const actionId of actions) {
    state.completedActions[actionId] = { dayIndex: 0, minute: 600 };
  }
  return state;
}

assert.equal(
  Engine.conditionPasses(requirement.satisfiedWhen, stateWith()),
  false,
  "Monday cannot be complete without either core task"
);
assert.equal(
  Engine.conditionPasses(requirement.satisfiedWhen, stateWith("mon-report-final")),
  false,
  "a report alone must not complete Monday"
);
assert.equal(
  Engine.conditionPasses(requirement.satisfiedWhen, stateWith("mon-invoice-fix")),
  false,
  "an invoice decision alone must not complete Monday"
);
assert.equal(
  Engine.conditionPasses(requirement.satisfiedWhen, stateWith("mon-report-final", "mon-invoice-fix")),
  true,
  "the correct report plus invoice correction must complete Monday"
);
assert.equal(
  Engine.conditionPasses(requirement.satisfiedWhen, stateWith("mon-report-old", "mon-invoice-report")),
  true,
  "the risky alternatives still count as completed core tasks"
);

console.log("Monday engine requirement validated as two of two core tasks.");
