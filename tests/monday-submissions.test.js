"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src/office-work-pack.js"), "utf8");
let savedState = {
  dayIndex: 0, minute: 700, dayStarted: true, ended: false,
  metadata: {}, stats: { work: 0, anxiety: 0 }, completedActions: {}, journal: []
};
let notifications = [];
const clone = (value) => JSON.parse(JSON.stringify(value));
let writes = 0;
const engine = {
  getState: () => clone(savedState),
  advanceTime(minutes) {
    savedState.minute += minutes;
    return { ok: true, advancedMinutes: minutes, state: clone(savedState) };
  },
  updateState(updater) {
    const draft = clone(savedState);
    updater(draft);
    savedState = draft;
    writes += 1;
    return { ok: true, state: clone(savedState) };
  },
  replaceState(before) {
    savedState = clone(before);
    return { ok: true };
  }
};
const context = {
  console,
  addEventListener() {},
  setTimeout(callback) { callback(); return 1; },
  document: { querySelector() { return null; }, querySelectorAll() { return []; } },
  UntilFridayRuntimeEngine: {
    getEngine: () => engine,
    persist() { return { ok: true }; },
    notify(title, message) { notifications.push({ title, message }); }
  }
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "office-work-pack.js" });
const pack = context.UntilFridayOfficeWorkPack;
assert.ok(pack);

const first = pack.TASK_BY_ID["office-mon-requests-sum"];
const supplier = pack.TASK_BY_ID["office-mon-supplier-letter"];
const memo = pack.TASK_BY_ID["office-mon-memo-proof"];
const redact = pack.TASK_BY_ID["office-mon-redact-contacts"];
const standard = pack.TASK_BY_ID["office-tue-format-dates"];

assert.equal(pack.assessSubmission(first, { values: { C6: "247" } }).accepted, true);
assert.equal(pack.assessSubmission(first, { values: { C6: "246" } }).status, "needs-review");
assert.equal(pack.assessSubmission(supplier, { text: "Подтвердите приём 24 бухт кабеля КС-18 до 12:00. Документы доставил курьер." }).accepted, true,
  "Equivalent supplier information must not require character-perfect copying");
assert.equal(pack.assessSubmission(memo, { text: "Из-за переезда просим два дополнительных стола и четыре кресла до пятницы." }).accepted, true);
assert.equal(pack.assessSubmission(redact, { text: "Сотруднику требуется пропуск на второй этаж." }).accepted, true);
assert.equal(pack.assessSubmission(redact, { text: "Сотруднику требуется пропуск на второй этаж. Паспорт 45 08 123456" }).accepted, false);
assert.equal(pack.assessSubmission(standard, standard.answer).accepted, true, "Later day validation is unchanged");

const correct = pack.completeTask(first, 0, { values: { C6: "247" } });
assert.equal(correct.ok, true);
assert.equal(savedState.metadata.officeWork.completed[first.id].quality, "accepted");
assert.equal(savedState.stats.work, 1);
assert.equal(savedState.minute, 712);

const mistaken = pack.completeTask(supplier, 0, { text: "Неполный текст письма без номера и количества" });
assert.equal(mistaken.ok, true, "Flawed Monday work must be deliverable, without an answer-loop");
assert.equal(savedState.metadata.officeWork.completed[supplier.id].quality, "needs-review");
assert.equal(savedState.metadata.officeWork.completed[supplier.id].submission.text.includes("Неполный"), true);
assert.equal(savedState.stats.work, 0, "Incorrect work should reduce the overall work score");
assert.equal(savedState.stats.anxiety, 1);
assert.ok(savedState.journal.some((entry) => /с расхождениями/.test(entry.text)));
assert.ok(notifications.some((entry) => /возможны ошибки/.test(entry.message)));

const repeat = pack.completeTask(supplier, 0, supplier.answer);
assert.equal(repeat.ok, false, "Already sent work must not be completed twice");

savedState.completedActions["mon-invoice-report"] = { minute: 740 };
assert.equal(pack.syncMondayInvoice(savedState), true, "Story invoice should complete the corresponding office task");
const bridge = savedState.metadata.officeWork.completed["office-mon-invoice-fix"];
assert.equal(bridge.quality, "escalated");
assert.equal(bridge.score, 0, "Linked invoice must not award work score twice");
assert.equal(pack.syncMondayInvoice(savedState), false, "Linked invoice must be idempotent");
assert.equal(writes, 3);
assert.equal(pack.completedForDay(savedState).length, 3);
assert.equal(pack.availableTasks({ ...savedState, minute: 900 }).some((task) => task.id === "office-mon-invoice-fix"), false);

console.log("Monday submissions, imperfect-work consequences, and shared invoice bridge passed.");
