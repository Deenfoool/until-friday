"use strict";

// Regression: Monday editors must not advertise autosave while discarding work.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const project = path.resolve(__dirname, "..");
const modules = [
  "src/engine.js",
  "src/story-v2.js",
  "src/rules-extension.js",
  "src/state-migration.js",
  "src/integrity-fixes.js",
  "src/story-consistency-fixes.js",
  "src/time-boundary-guard.js",
  "src/runtime-engine.js",
  "src/office-work-pack.js"
];
const memory = new Map();
const listeners = new Map();
let saves = 0;
const context = {
  console, JSON, Date, Math, Map, Set, WeakMap, WeakSet, Promise,
  Event: class { constructor(type, options) { this.type = type; this.bubbles = Boolean(options?.bubbles); } },
  location: { href: "https://test.local/" },
  localStorage: {
    getItem: (key) => memory.get(key) || null,
    setItem(key, value) { saves++; memory.set(key, String(value)); },
    removeItem: (key) => memory.delete(key)
  },
  document: { querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {} },
  CustomEvent: class {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  },
  setTimeout() { return 1; },
  clearTimeout() {},
  requestAnimationFrame() {},
  addEventListener(type, callback) {
    const handlers = listeners.get(type) || [];
    handlers.push(callback);
    listeners.set(type, handlers);
  },
  dispatchEvent(event) {
    for (const handler of listeners.get(event.type) || []) handler(event);
    return true;
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const name of modules) {
  vm.runInContext(fs.readFileSync(path.join(project, name), "utf8"), context, { filename: name });
}
const engine = context.UntilFridayEngine.createEngine(
  context.UNTIL_FRIDAY_STORY, null, { seed: "draft-autosave", truthId: "player" }
);
const pack = context.UntilFridayOfficeWorkPack;
assert.ok(engine.startDay().ok);
assert.ok(engine.advanceTime(25).ok);
const task = pack.TASK_BY_ID["office-mon-requests-sum"];
const before = engine.getState();
const save = pack.saveDraft(task.id, { values: { C6: "246" } });
assert.equal(save.ok, true);
assert.equal(pack.draftFor(task.id).submission.values.C6, "246");
assert.equal(engine.getState().minute, before.minute, "Autosave must not advance the clock");
assert.equal(engine.getState().stats.work, before.stats.work, "Autosave must not score unfinished work");
const checkpoint = JSON.parse(memory.get("until-friday-save-v2"));
assert.equal(checkpoint.metadata.officeWork.drafts[task.id].submission.values.C6, "246");

const storedWrites = saves;
const noChange = pack.saveDraft(task.id, { values: { C6: "246" } });
assert.equal(noChange.ok, true);
assert.equal(noChange.unchanged, true);
assert.equal(saves, storedWrites, "Identical input must not trigger another browser save");
assert.equal(pack.saveDraft(task.id, { values: { C6: "247" } }).ok, true);
assert.equal(pack.draftFor(task.id).submission.values.C6, "247");

assert.ok(pack.completeTask(task, 0, { values: { C6: "247" } }).ok);
assert.equal(pack.draftFor(task.id), null, "Final submission must clear its draft");
assert.equal(pack.saveDraft(task.id, { values: { C6: "wrong" } }).ok, false,
  "A completed task must not recreate a draft");

const letter = pack.TASK_BY_ID["office-mon-supplier-letter"];
assert.ok(engine.advanceTime(Math.max(0, letter.unlockMinute - engine.getState().minute)).ok);
const letterStartedAt = engine.getState().minute;
assert.ok(pack.completeTask(letter, 0, { text: "Missing delivery details" }).ok);
assert.equal(engine.getState().metadata.officeWork.completed[letter.id].quality, "needs-review");
assert.ok(pack.saveDraft(letter.id, { text: "Please confirm receipt of 24 reels of KS-18 cable by 12:00. The courier has the documents." }, true).ok);
assert.equal(pack.draftFor(letter.id, true).submission.text.includes("KS-18"), true);
assert.equal(pack.draftFor(letter.id), null, "Correction draft must use a separate key");
assert.equal(engine.getState().minute, letterStartedAt + letter.minutes,
  "Work time is charged only for submissions");
assert.ok(pack.reviseTask(letter.id, pack.draftFor(letter.id, true).submission).ok);
assert.equal(pack.draftFor(letter.id, true), null, "Accepted correction must clear its pending draft");
assert.equal(engine.getState().metadata.officeWork.completed[letter.id].quality, "accepted");

const after = JSON.parse(memory.get("until-friday-save-v2"));
assert.equal(after.metadata.officeWork.drafts[task.id], undefined);
assert.equal(after.metadata.officeWork.drafts[letter.id + ":revision"], undefined);
assert.equal(after.metadata.officeWork.completed[letter.id].history.length, 1);

// Once fewer minutes remain than a task requires, submitting must not consume
// the last minutes of the shift or discard a pending draft.
const lastTask = pack.TASK_BY_ID["office-mon-memo-proof"];
assert.ok(engine.advanceTime(1078 - engine.getState().minute).ok);
const endMinute = engine.getState().minute;
assert.ok(pack.saveDraft(lastTask.id, { text: "Unfinished memo" }).ok);
assert.equal(pack.completeTask(lastTask, 0, { text: "Unfinished memo" }).ok, false);
assert.equal(engine.getState().minute, endMinute);
assert.equal(pack.draftFor(lastTask.id).submission.text, "Unfinished memo");
assert.equal(pack.officeState(engine.getState()).completed[lastTask.id], undefined);

const sheetField = { dataset: { sheetCell: "C6" }, value: "" };
pack.restoreSubmission({ querySelectorAll() { return [sheetField]; } },
  { type: "sheet" }, { values: { C6: "=SUM(C2:C5)" } });
assert.equal(sheetField.value, "=SUM(C2:C5)");

let documentEvent = null;
const documentField = { value: "", dispatchEvent(event) { documentEvent = event.type; } };
pack.restoreSubmission({ querySelector() { return documentField; } },
  { type: "document" }, { text: "Restored draft" });
assert.equal(documentField.value, "Restored draft");
assert.equal(documentEvent, "input", "Word count must update when a saved draft is restored");

const templateField = { dataset: { templateField: "recipient" }, value: "" };
pack.restoreSubmission({ querySelectorAll() { return [templateField]; } },
  { type: "template" }, { fields: { recipient: "Accounting" } });
assert.equal(templateField.value, "Accounting");

const select = { dataset: { fileAssignment: "invoice-7814" }, value: "" };
pack.restoreSubmission({ querySelectorAll() { return [select]; } },
  { type: "organize" }, { assignments: { "invoice-7814": "Accounting" } });
assert.equal(select.value, "Accounting");

const checkbox = { checked: false };
let selection = false;
const row = {
  dataset: { auditRow: "duplicate" },
  querySelector() { return checkbox; },
  classList: { toggle(name, value) { selection = value; } }
};
pack.restoreSubmission({ querySelectorAll() { return [row]; } },
  { type: "audit" }, { selected: ["duplicate"] });
assert.equal(checkbox.checked, true);
assert.equal(selection, true);

let restoredOrder = null;
const reader = () => ({ order: [] });
reader.restore = (order) => { restoredOrder = [...order]; };
pack.restoreSubmission({}, { type: "sort" }, { order: ["b", "a"] }, reader);
assert.equal(restoredOrder.join(","), "b,a", "Reordered priorities must survive reopening");

console.log("Monday autosaves, idempotence, time cost, revision separation and cleanup passed.");
