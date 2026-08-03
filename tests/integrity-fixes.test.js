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

for (const [eventId, actionId] of Object.entries(Integrity.BASE_EVENT_ACTION_GUARDS)) {
  assert.equal(
    Story.events[eventId].requires.actionDone || Story.events[eventId].requires.all?.[0]?.actionDone,
    actionId,
    `${eventId} must depend on ${actionId}`
  );
}

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

{
  const raw = Engine.createState(Story, { seed: "late-restored-event", truthId: "player" });
  raw.dayStarted = true;
  raw.minute = 710;
  raw.completedActions["mon-report-final"] = { dayIndex: 0, minute: 700 };
  raw.scheduledEvents = [
    { eventId: "mon-chief-thanks", dayIndex: 0, minute: 690, sourceAction: "mon-report-final" },
    { eventId: "mon-chief-thanks", dayIndex: 0, minute: 1500, sourceAction: "mon-report-final" }
  ];
  const repaired = Integrity.repairEngineState(Story, raw);
  const entries = repaired.scheduledEvents.filter((item) => item.eventId === "mon-chief-thanks");
  assert.equal(entries.length, 1, "one-shot events must not remain scheduled twice");
  assert.equal(entries[0].minute, 705, "a restored response must occur after its source action");
  assert.equal(Story.events["mon-chief-thanks"].minute, 705, "mail display time must follow the repaired schedule");
}

{
  const raw = Engine.createState(Story, { seed: "invalid-events", truthId: "player" });
  raw.dayStarted = true;
  raw.stats.anxiety = 3;
  raw.stats.access = 1;
  raw.trust.chief = 0;
  raw.deliveredEvents = ["mon-chief-thanks", "mon-chief-angry", "tue-accountant-request"];
  raw.inbox = [
    { id: "mon-chief-thanks", minute: 690 },
    { id: "mon-chief-angry", minute: 675 },
    { id: "tue-accountant-request", minute: 590 }
  ];
  raw.journal = [
    { type: "event", details: { eventId: "mon-chief-thanks" } },
    { type: "event", details: { eventId: "tue-accountant-request" } }
  ];
  const repaired = Integrity.repairEngineState(Story, raw);
  assert.deepEqual(repaired.deliveredEvents, [], "events without their source actions must be removed from old saves");
  assert.equal(repaired.inbox.length, 0, "impossible event messages must be removed from the inbox");
  assert.equal(repaired.journal.length, 0, "impossible event journal entries must be removed");
  assert.equal(repaired.stats.access, 0, "effects of an impossible accountant request must be reversed");
  assert.equal(repaired.stats.anxiety, 3, "opposite report reactions must cancel when both were incorrectly delivered");
  assert.equal(repaired.trust.chief, 0, "opposite report trust effects must be repaired");
}

const workflow = JSON.parse(storage.get("until-friday-workflow-files-v1"));
assert.equal(workflow.files.length, 1, "duplicate workflow files must be removed");
assert.equal(workflow.trash.length, 1, "a file cannot exist in Documents and Trash simultaneously");
assert.deepEqual(workflow.log, [], "broken workflow log must be replaced with an empty array");

const html = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../index.html"), "utf8");
assert.match(html, /src\/integrity-fixes\.js/, "integrity repair layer must be connected");
assert.ok(
  html.indexOf("src/state-migration.js") < html.indexOf("src/integrity-fixes.js") &&
  html.indexOf("src/integrity-fixes.js") < html.indexOf("src/time-boundary-guard.js"),
  "integrity repairs must run after migration definitions and before time wrappers"
);

console.log("Integrity repair validation passed.");
