"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const source = read("src/wednesday-minigames.js");
assert.doesNotThrow(() => new Function(source), "Wednesday minigame module must contain valid JavaScript");

const story = {
  actions: {
    "wed-audit-explain": { channel: "mail", effects: {} },
    "wed-audit-delete": { channel: "terminal", effects: {} },
    "wed-audit-blame": { channel: "mail", effects: {} },
    "wed-finish-backlog": { channel: "tasks", effects: {} },
    "wed-copy-hr-draft": { channel: "explorer", effects: {} }
  },
  events: {}
};

const context = {
  UNTIL_FRIDAY_STORY: story,
  MutationObserver: class MutationObserver { observe() {} },
  document: {
    documentElement: {},
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    setTimeout: () => {}
  },
  requestAnimationFrame: (callback) => callback(),
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "wednesday-minigames.js" });

assert.ok(context.UntilFridayWednesdayMinigames, "Wednesday gameplay API must be exported");
assert.equal(story.actions["wed-audit-delete"].channel, "mail", "all audit choices must be available in the security letter");
assert.equal(story.actions["wed-copy-hr-draft"].channel, "tasks", "HR draft must be exposed as an interactive task");

for (const eventId of [
  "wed-security-honest-reply",
  "wed-security-server-copy",
  "wed-dima-blame-reaction",
  "wed-chief-backlog-reply",
  "wed-hr-copy-warning",
  "wed-access-tightened"
]) {
  assert.ok(story.events[eventId], `Wednesday follow-up event is missing: ${eventId}`);
}

assert.equal(
  story.events["wed-security-server-copy"].requires.actionDone,
  "wed-audit-delete",
  "server-copy warning must only appear after log tampering"
);
assert.equal(
  story.events["wed-security-honest-reply"].requires.actionDone,
  "wed-audit-explain",
  "honest security reply must only appear after a truthful explanation"
);
assert.ok(
  story.actions["wed-finish-backlog"].effects.schedule.some((item) => item.eventId === "wed-chief-backlog-reply"),
  "backlog task must schedule the chief response"
);
assert.ok(
  story.actions["wed-copy-hr-draft"].effects.schedule.some((item) => item.eventId === "wed-hr-copy-warning"),
  "HR copy must schedule a document-system warning"
);

for (const requiredText of [
  "Найдите нетипичные действия",
  "Разобрать очередь обращений",
  "Изучить черновик кадрового приказа",
  "Приказ_HR-17-08_черновик.txt",
  "Очередь_обращений_приоритеты.txt",
  "Журнал_доступа_локальная_копия.log",
  "Права доступа обновлены"
]) {
  assert.match(source, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Wednesday module must contain: ${requiredText}`);
}

const css = read("wednesday-minigames.css");
assert.match(css, /wednesday-minigame-window/, "Wednesday windows must have dedicated styling");
assert.match(css, /audit-log-table/, "audit log must be styled");
assert.match(css, /backlog-ticket-list/, "backlog sorter must be styled");
assert.match(css, /hr-draft-layout/, "HR composite document must be styled");
assert.match(css, /@media \(max-width: 760px\)/, "Wednesday tasks must adapt to smaller screens");

const html = read("index.html");
assert.match(html, /wednesday-minigames\.css/, "Wednesday stylesheet must be connected");
assert.match(html, /src\/wednesday-minigames\.js/, "Wednesday script must be connected");
assert.ok(
  html.indexOf("src/wednesday-minigames.js") < html.indexOf("src/bootstrap.js"),
  "Wednesday events and channel changes must be registered before engine creation"
);

console.log("Wednesday gameplay stage validation passed.");
