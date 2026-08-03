"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const storage = new Map();
const story = require("../src/story-v2.js");
const Engine = require("../src/engine.js");

const context = {
  UNTIL_FRIDAY_STORY: story,
  UntilFridayEngine: Engine,
  UntilFridayMigration: { ENGINE_SAVE_KEY: "until-friday-save-v2" },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  MutationObserver: class MutationObserver { observe() {} },
  document: {
    documentElement: {},
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    setTimeout: () => {},
    clearTimeout: () => {}
  },
  requestAnimationFrame: (callback) => callback(),
  console,
  Date
};
context.globalThis = context;

for (const file of [
  "src/rules-extension.js",
  "src/integrity-fixes.js",
  "src/story-consistency-fixes.js",
  "src/tuesday-minigames.js",
  "src/tuesday-event-guards.js",
  "src/wednesday-minigames.js",
  "src/thursday-minigames.js",
  "src/thursday-event-guards.js"
]) {
  vm.runInNewContext(read(file), context, { filename: file });
}

function collectReferences(condition, refs = { actions: new Set(), events: new Set() }) {
  if (!condition || typeof condition !== "object") return refs;
  if (Array.isArray(condition)) {
    condition.forEach((item) => collectReferences(item, refs));
    return refs;
  }
  if (condition.actionDone) refs.actions.add(condition.actionDone);
  if (condition.actionNotDone) refs.actions.add(condition.actionNotDone);
  if (condition.eventDelivered) refs.events.add(condition.eventDelivered);
  Object.values(condition).forEach((value) => collectReferences(value, refs));
  return refs;
}

function containsAction(condition, actionId) {
  if (!condition || typeof condition !== "object") return false;
  if (Array.isArray(condition)) return condition.some((item) => containsAction(item, actionId));
  if (condition.actionDone === actionId) return true;
  return Object.values(condition).some((value) => containsAction(value, actionId));
}

function evaluate(condition, state) {
  return Engine.conditionPasses(condition, state);
}

const channels = new Set(["explorer", "mail", "chat", "tasks", "terminal", "meeting"]);
for (const [id, action] of Object.entries(story.actions)) {
  assert.equal(action.id, id, `action key mismatch: ${id}`);
  assert.ok(channels.has(action.channel), `unknown action channel for ${id}: ${action.channel}`);
  assert.ok(Number.isFinite(Number(action.minutes)) && Number(action.minutes) >= 0, `invalid action time for ${id}`);
  assert.ok(action.dayIndex >= 0 && action.dayIndex < story.days.length, `invalid day for ${id}`);

  const refs = collectReferences(action.requires);
  refs.actions.forEach((actionId) => assert.ok(story.actions[actionId], `${id} requires unknown action ${actionId}`));
  refs.events.forEach((eventId) => assert.ok(story.events[eventId], `${id} requires unknown event ${eventId}`));

  for (const schedule of action.effects?.schedule || []) {
    const event = story.events[schedule.eventId];
    assert.ok(event, `${id} schedules unknown event ${schedule.eventId}`);
    assert.ok(
      containsAction(event.requires, id),
      `${schedule.eventId} can be delivered without its source action ${id}`
    );
    assert.ok(Number(schedule.minute) <= 1080, `${id} schedules ${schedule.eventId} after 18:00`);
  }
}

for (const [id, event] of Object.entries(story.events)) {
  assert.equal(event.id, id, `event key mismatch: ${id}`);
  assert.ok(event.dayIndex >= 0 && event.dayIndex < story.days.length, `invalid event day for ${id}`);
  assert.ok(Number(event.minute) >= 0 && Number(event.minute) <= 1080, `invalid event time for ${id}`);
  const refs = collectReferences(event.requires);
  refs.actions.forEach((actionId) => assert.ok(story.actions[actionId], `${id} requires unknown action ${actionId}`));
  refs.events.forEach((eventId) => assert.ok(story.events[eventId], `${id} requires unknown event ${eventId}`));
}

const mondayRequirement = story.days[0].requirements.find((item) => item.id === "monday-core-work");
assert.ok(mondayRequirement.satisfiedWhen.all, "expanded story must retain the corrected two-task Monday requirement");

const wednesdayRequirement = story.days[2].requirements.find((item) => item.id === "wednesday-audit");
const cleanWednesday = Engine.createState(story, { seed: "clean-wednesday", truthId: "player" });
cleanWednesday.dayIndex = 2;
cleanWednesday.dayStarted = true;
assert.equal(
  evaluate(wednesdayRequirement.satisfiedWhen, cleanWednesday),
  true,
  "a clean Wednesday without a security audit must not report a missed audit"
);
cleanWednesday.deliveredEvents.push("wed-security-audit");
assert.equal(
  evaluate(wednesdayRequirement.satisfiedWhen, cleanWednesday),
  false,
  "a delivered audit must require an actual response"
);

const thursdayRequirement = story.days[3].requirements.find((item) => item.id === "thursday-choice");
const complaintThursday = Engine.createState(story, { seed: "complaint-thursday", truthId: "player" });
complaintThursday.dayIndex = 3;
complaintThursday.dayStarted = true;
complaintThursday.completedActions["thu-frame-chief"] = { dayIndex: 3, minute: 700 };
assert.equal(
  evaluate(thursdayRequirement.satisfiedWhen, complaintThursday),
  true,
  "the complaint route must count as a prepared Thursday position"
);

const normalWednesday = story.events["wed-normal-morning"];
const paymentState = Engine.createState(story, { seed: "payment-audit", truthId: "player" });
paymentState.dayIndex = 2;
paymentState.dayStarted = true;
paymentState.inventory.push("payment-list");
assert.equal(
  evaluate(normalWednesday.requires, paymentState),
  false,
  "the normal Wednesday mail cannot appear together with the payment-list security audit"
);

assert.equal(story.actions["wed-audit-delete"].channel, "mail");
assert.equal(story.actions["wed-copy-hr-draft"].channel, "tasks");
assert.ok(story.actions["fri-wait-meeting"], "Friday wait action must exist in the expanded story");
assert.ok(story.days[4].focusLimit >= 2, "Friday must have enough focus for waiting and one meeting choice");

const contractorDamage = Engine.createState(story, {
  seed: "contractor-blackmail",
  truthId: "contractor",
  stats: { suspicion: 1, collateral: 0 }
});
contractorDamage.dayIndex = 4;
contractorDamage.dayStarted = true;
contractorDamage.flags.attemptedBlackmail = true;
const cleanEnding = story.endings.find((item) => item.id === "false-alarm-clean");
const damagedEnding = story.endings.find((item) => item.id === "false-alarm-damage");
assert.equal(evaluate(cleanEnding.requires, contractorDamage), false);
assert.equal(evaluate(damagedEnding.requires, contractorDamage), true);

console.log(`Expanded story validated: ${Object.keys(story.actions).length} actions, ${Object.keys(story.events).length} events.`);
