"use strict";

const assert = require("node:assert/strict");

const storage = new Map();
storage.set("until-friday-workflow-files-v1", JSON.stringify({
  files: [{ id: "same", name: "A" }, { id: "same", name: "B" }],
  trash: [{ id: "same", name: "A" }, { id: "trash", name: "C" }],
  log: "broken"
}));

globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

globalThis.UntilFridayEngine = require("../src/engine.js");
globalThis.UNTIL_FRIDAY_STORY = require("../src/story-v2.js");
globalThis.UntilFridayMigration = { ENGINE_SAVE_KEY: "until-friday-save-v2" };
require("../src/rules-extension.js");
require("../src/integrity-fixes.js");

const Engine = globalThis.UntilFridayEngine;
const Story = globalThis.UNTIL_FRIDAY_STORY;
const Integrity = globalThis.UntilFridayIntegrityFixes;
assert.ok(Integrity, "integrity repair API must be exported");

const mondayRequirement = Story.days[0].requirements.find((item) => item.id === "monday-core-work");
assert.ok(mondayRequirement.satisfiedWhen.all, "Monday requirement must contain both work groups");

{
  const state = Engine.createState(Story, { seed: "only-report", truthId: "player" });
  state.dayStarted = true;
  state.completedActions["mon-report-final"] = { dayIndex: 0, minute: 560 };
  const engine = Engine.createEngine(Story, state);
  assert.equal(engine.conditionPasses(mondayRequirement.satisfiedWhen), false, "one Monday task must not satisfy both core tasks");
}

{
  const state = Engine.createState(Story, { seed: "both-groups", truthId: "player" });
  state.dayStarted = true;
  state.completedActions["mon-report-old"] = { dayIndex: 0, minute: 560 };
  state.completedActions["mon-invoice-report"] = { dayIndex: 0, minute: 580 };
  const engine = Engine.createEngine(Story, state);
  assert.equal(engine.conditionPasses(mondayRequirement.satisfiedWhen), true, "one report choice and one invoice choice must complete Monday core work");
}

{
  const raw = Engine.createState(Story, { seed: "repair-schedule", truthId: "player" });
  raw.dayStarted = true;
  raw.minute = 9999;
  raw.completedActions["mon-invoice-fix"] = { dayIndex: 0, minute: 570 };
  raw.scheduledEvents = [];
  raw.inbox = [{ id: "duplicate" }, { id: "duplicate" }];
  const repaired = Integrity.repairEngineState(Story, raw);
  assert.equal(repaired.minute, 1080, "invalid time must be clamped to the workday end");
  assert.equal(repaired.inbox.length, 1, "duplicate inbox entries must be removed");
  assert.ok(
    repaired.scheduledEvents.some((item) => item.eventId === "tue-accountant-request" && item.dayIndex === 1),
    "completed legacy actions must restore their future consequences"
  );
}

const workflow = JSON.parse(storage.get("until-friday-workflow-files-v1"));
assert.equal(workflow.files.length, 1, "duplicate workflow files must be removed");
assert.equal(workflow.trash.length, 1, "a file cannot exist in Documents and Trash simultaneously");
assert.deepEqual(workflow.log, [], "broken workflow log must be replaced with an empty array");

const html = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../index.html"), "utf8");
assert.match(html, /src\/integrity-fixes\.js/, "integrity repair layer must be connected");
assert.ok(
  html.indexOf("src/state-migration.js") < html.indexOf("src/integrity-fixes.js") &&
  html.indexOf("src/integrity-fixes.js") < html.indexOf("src/passive-clock.js"),
  "integrity repairs must run after migration definitions and before engine wrappers"
);

console.log("Integrity repair validation passed.");
