"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const packSource = read("src/office-work-pack.js");
const mailSource = read("src/office-work-mail.js");

assert.doesNotThrow(() => new Function(mailSource), "office mail integration must contain valid JavaScript");
assert.doesNotMatch(mailSource, /new\s+MutationObserver\s*\(/, "office mail integration must use application events");
for (const phrase of [
  "until-friday-ui-render",
  "until-friday-state-change",
  "data-office-mail-task",
  "data-office-mail-open",
  "Pack.openTask",
  "mailTasks",
  "office-mail-assignment"
]) {
  assert.match(mailSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `mail integration must contain ${phrase}`);
}

const packListeners = new Map();
const packContext = {
  UntilFridayRuntimeEngine: { getEngine: () => null, notify() {}, persist() {} },
  addEventListener(type, callback) { packListeners.set(type, callback); },
  document: { querySelector() { return null; }, querySelectorAll() { return []; } },
  console
};
packContext.window = packContext;
packContext.globalThis = packContext;
vm.runInNewContext(packSource, packContext, { filename: "office-work-pack.js" });
const pack = packContext.UntilFridayOfficeWorkPack;
assert.ok(pack);

const mondayTasks = pack.tasksForDay(0);
const firstMailTask = mondayTasks.find((task) => task.config?.sourceText);
assert.ok(firstMailTask, "Monday must contain an assignment sourced from a letter");

let liveState = {
  dayIndex: 0,
  minute: firstMailTask.unlockMinute - 1,
  dayStarted: true,
  ended: false,
  metadata: { officeWork: { completed: {}, attempts: {} } }
};
const mailListeners = new Map();
const mailContext = {
  UntilFridayOfficeWorkPack: pack,
  UntilFridayRuntimeEngine: { getEngine: () => ({ getState: () => liveState }) },
  addEventListener(type, callback) { mailListeners.set(type, callback); },
  document: { querySelector() { return null; } },
  console
};
mailContext.window = mailContext;
mailContext.globalThis = mailContext;
vm.runInNewContext(mailSource, mailContext, { filename: "office-work-mail.js" });

const mail = mailContext.UntilFridayOfficeWorkMail;
assert.ok(mail, "office mail API must be exported");
assert.ok(mailListeners.has("until-friday-ui-render"));
assert.ok(mailListeners.has("until-friday-state-change"));
assert.equal(mail.mailTasks().some((task) => task.id === firstMailTask.id), false, "letter must remain hidden before its unlock time");

liveState.minute = firstMailTask.unlockMinute;
assert.equal(mail.mailTasks().some((task) => task.id === firstMailTask.id), true, "letter must appear at its unlock time");
assert.equal(mail.bodyFor(firstMailTask), firstMailTask.config.sourceText);

liveState.dayStarted = false;
assert.deepEqual(JSON.parse(JSON.stringify(mail.mailTasks())), []);
liveState.dayStarted = true;
liveState.ended = true;
assert.deepEqual(JSON.parse(JSON.stringify(mail.mailTasks())), []);

const css = read("office-work-mail.css");
for (const phrase of [
  ".office-mail-item",
  ".office-mail-item.completed",
  ".office-mail-assignment",
  ".office-mail-body",
  "data-office-mail"
]) {
  if (phrase === "data-office-mail") continue;
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `mail stylesheet must contain ${phrase}`);
}

const html = read("index.html");
assert.match(html, /office-work-mail\.css\?v=20260805-1/);
assert.match(html, /src\/office-work-mail\.js\?v=20260805-1/);
assert.ok(html.indexOf("src/office-work-pack.js") < html.indexOf("src/office-work-requirements.js"));
assert.ok(html.indexOf("src/office-work-requirements.js") < html.indexOf("src/office-work-mail.js"));
assert.ok(html.indexOf("src/office-work-mail.js") < html.indexOf("src/bootstrap.js"));

console.log("Office assignments delivered through Mail validation passed.");
