"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const source = read("src/office-work-pack.js");
const requirementSource = read("src/office-work-requirements.js");

assert.doesNotThrow(() => new Function(source), "office work pack must contain valid JavaScript");
assert.doesNotThrow(() => new Function(requirementSource), "office quota module must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, "office work pack must use app and state events instead of a global DOM observer");
assert.match(source, /until-friday-ui-render/);
assert.match(source, /until-friday-state-change/);
assert.match(source, /advanceTime\(task\.minutes\)/);
assert.match(source, /metadata\.officeWork/);
assert.match(requirementSource, /office-work-quota-/);
assert.match(requirementSource, /missedEffects/);

const listeners = new Map();
const context = {
  UntilFridayRuntimeEngine: { getEngine: () => null, notify() {}, persist() {} },
  addEventListener(type, callback) { listeners.set(type, callback); },
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "office-work-pack.js" });

const api = context.UntilFridayOfficeWorkPack;
assert.ok(api, "office work pack API must be exported");
assert.equal(api.DAILY_QUOTA, 5);
assert.equal(api.TASKS.length, 40, "the pack must contain forty office tasks");
assert.equal(api.TASKS_BY_DAY.length, 5);
assert.equal(new Set(api.TASKS.map((task) => task.id)).size, 40, "task IDs must be unique");
assert.ok(listeners.has("until-friday-ui-render"));
assert.ok(listeners.has("until-friday-state-change"));

for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
  const tasks = api.tasksForDay(dayIndex);
  assert.equal(tasks.length, 8, `day ${dayIndex} must contain eight office tasks`);
  assert.ok(tasks.every((task) => task.dayIndex === dayIndex));
  assert.deepEqual(plain(tasks.map((task) => task.slot)), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(tasks.every((task, index) => index === 0 || task.unlockMinute > tasks[index - 1].unlockMinute), "tasks must unlock gradually");
  assert.ok(tasks.filter((task) => task.type === "sheet").length >= 2, "every day must contain at least two spreadsheet tasks");
  assert.ok(tasks.filter((task) => task.type === "document").length >= 2, "every day must contain at least two document tasks");
  assert.ok(tasks.some((task) => ["template", "organize", "sort", "audit"].includes(task.type)), "every day must include another office workflow type");
}

for (const task of api.TASKS) {
  assert.ok(task.title.length > 5);
  assert.ok(task.description.length > 10);
  assert.ok(task.source.length > 2);
  assert.ok(task.minutes >= 10 && task.minutes <= 15);
  assert.equal(api.validateTask(task, task.answer), true, `${task.id} sample answer must pass validation`);

  let wrong;
  if (task.type === "sheet") wrong = { values: {} };
  else if (task.type === "document") wrong = { text: "неверный текст" };
  else if (task.type === "template") wrong = { fields: {} };
  else if (task.type === "audit") wrong = { selected: [] };
  else if (task.type === "sort") wrong = { order: [...task.answer.order].reverse() };
  else wrong = { assignments: {} };
  assert.equal(api.validateTask(task, wrong), false, `${task.id} invalid answer must fail validation`);
}

assert.equal(api.validateTask("office-mon-requests-sum", { values: { C6: "=СУММ(C2:C5)" } }), true);
assert.equal(api.validateTask("office-mon-requests-sum", { values: { C6: "247" } }), true);
assert.equal(api.validateTask("office-tue-completion-percent", { values: { D2: "96%", D3: "88", D4: "=C4/B4*100" } }), true);
assert.equal(api.validateTask("office-fri-forecast", { values: { C2: "462", C3: "346,5", C4: "198" } }), true);

const normalized = api.normalizeOfficeState({ completed: { a: { minute: 600 } }, attempts: { a: 2 } });
assert.equal(normalized.version, 1);
assert.equal(normalized.completed.a.minute, 600);
assert.equal(normalized.attempts.a, 2);
assert.deepEqual(plain(api.normalizeOfficeState(null)), { version: 1, completed: {}, attempts: {} });
assert.equal(api.formatMinute(527), "08:47");
assert.equal(api.formatMinute(1080), "18:00");

const firstMonday = api.TASKS_BY_DAY[0][0];
const secondMonday = api.TASKS_BY_DAY[0][1];
const state = {
  dayIndex: 0,
  minute: firstMonday.unlockMinute,
  dayStarted: true,
  ended: false,
  metadata: { officeWork: { completed: {}, attempts: {} } }
};
assert.deepEqual(plain(api.availableTasks(state).map((task) => task.id)), [firstMonday.id]);
state.minute = secondMonday.unlockMinute;
assert.deepEqual(plain(api.availableTasks(state).map((task) => task.id)), [firstMonday.id, secondMonday.id]);
state.metadata.officeWork.completed[firstMonday.id] = { minute: state.minute };
assert.deepEqual(plain(api.availableTasks(state).map((task) => task.id)), [secondMonday.id]);
assert.deepEqual(plain(api.completedForDay(state).map((task) => task.id)), [firstMonday.id]);

const quotaListeners = new Map();
const story = {
  days: ["monday", "tuesday", "wednesday", "thursday", "friday"].map((id) => ({ id, requirements: [] }))
};
const quotaContext = {
  UNTIL_FRIDAY_STORY: story,
  UntilFridayOfficeWorkPack: api,
  UntilFridayRuntimeEngine: { getEngine: () => null },
  addEventListener(type, callback) { quotaListeners.set(type, callback); },
  setTimeout() {},
  console
};
quotaContext.window = quotaContext;
quotaContext.globalThis = quotaContext;
vm.runInNewContext(requirementSource, quotaContext, { filename: "office-work-requirements.js" });

const quotaApi = quotaContext.UntilFridayOfficeWorkRequirements;
assert.ok(quotaApi);
assert.equal(story.days.every((day) => day.requirements.length === 1), true);
assert.equal(story.days.every((day, index) => day.requirements[0].satisfiedWhen.flag === `officeWorkQuotaDay${index}`), true);
assert.equal(story.days.every((day) => day.requirements[0].missedEffects.stats.work === -2), true);
assert.ok(quotaListeners.has("until-friday-state-change"));

const fiveDone = {
  dayIndex: 0,
  metadata: {
    officeWork: {
      completed: Object.fromEntries(api.tasksForDay(0).slice(0, 5).map((task) => [task.id, { minute: 700 }]))
    }
  }
};
assert.equal(quotaApi.completedCount(fiveDone, 0), 5);
assert.equal(quotaApi.flagForDay(4), "officeWorkQuotaDay4");

const css = read("office-work-pack.css");
for (const phrase of [
  ".office-work-pack",
  ".office-task-card",
  ".office-work-window",
  ".office-sheet",
  ".office-formula-bar",
  ".office-document-editor",
  ".office-template-form",
  ".office-audit",
  ".office-sort",
  ".office-organize",
  "@media(max-width:760px)"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `stylesheet must contain ${phrase}`);
}

const html = read("index.html");
assert.match(html, /office-work-pack\.css\?v=20260805-1/);
assert.match(html, /src\/office-work-pack\.js\?v=20260805-1/);
assert.match(html, /src\/office-work-requirements\.js\?v=20260805-1/);
assert.ok(html.indexOf("src/window-layout.js") < html.indexOf("src/office-work-pack.js"));
assert.ok(html.indexOf("src/office-work-pack.js") < html.indexOf("src/office-work-requirements.js"));
assert.ok(html.indexOf("src/office-work-requirements.js") < html.indexOf("src/bootstrap.js"));

const workflow = read(".github/workflows/test.yml");
assert.match(workflow, /node tests\/office-work-pack\.test\.js/);

console.log("Five-day office work task pack validation passed.");
