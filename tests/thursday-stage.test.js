"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const source = read("src/thursday-minigames.js");
assert.doesNotThrow(() => new Function(source), "Thursday minigame module must contain valid JavaScript");

const story = {
  days: [{}, {}, {}, {}, { focusLimit: 1 }],
  actions: {
    "thu-finish-project": { channel: "tasks", effects: {} },
    "thu-build-case": { channel: "explorer", effects: {} },
    "thu-resign": { channel: "mail", effects: {} },
    "thu-frame-chief": { channel: "terminal", effects: {} },
    "fri-meeting-calm": { channel: "meeting", effects: {} },
    "fri-meeting-work": { channel: "meeting", requires: { statGte: ["work", 4] }, effects: {} },
    "fri-meeting-blackmail": { channel: "meeting", requires: { statGte: ["evidence", 4] }, effects: {} },
    "fri-send-resignation": { channel: "meeting", requires: { flag: "resignationPrepared" }, effects: {} }
  },
  events: {
    "thu-director-calendar": { text: "old" }
  }
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
  localStorage: { getItem: () => null },
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "thursday-minigames.js" });

assert.ok(context.UntilFridayThursdayMinigames, "Thursday gameplay API must be exported");
assert.equal(story.actions["thu-build-case"].channel, "tasks", "case preparation must be an interactive task");
assert.equal(story.actions["thu-resign"].channel, "tasks", "resignation draft must be an interactive task");
assert.equal(story.actions["thu-frame-chief"].channel, "tasks", "complaint route must be an interactive task");
assert.equal(story.actions["thu-frame-chief"].label, "Подготовить жалобу на начальника");

for (const eventId of [
  "thu-restricted-session",
  "thu-project-reviewed",
  "thu-case-archive-traced",
  "thu-resignation-draft-saved",
  "thu-complaint-registered",
  "thu-evening-reminder"
]) {
  assert.ok(story.events[eventId], `Thursday follow-up event is missing: ${eventId}`);
}

assert.equal(story.events["thu-project-reviewed"].requires.actionDone, "thu-finish-project");
assert.equal(story.events["thu-complaint-registered"].requires.actionDone, "thu-frame-chief");
assert.ok(story.actions["fri-wait-meeting"], "Friday wait action must be added");
assert.equal(story.actions["fri-wait-meeting"].minutes, 475, "Friday work must advance time to 17:00");
assert.equal(story.days[4].focusLimit, 2, "Friday must allow waiting plus one meeting choice");
assert.equal(story.actions["fri-meeting-calm"].requires.eventDelivered, "fri-meeting");
assert.equal(story.actions["fri-meeting-work"].requires.all[0].eventDelivered, "fri-meeting");

for (const requiredText of [
  "Автоматизация_отчётов_готово.zip",
  "Материалы_к_пятнице.enc",
  "Заявление_по_собственному_черновик.txt",
  "Жалоба_на_Андрея_Соколова.txt",
  "Работать до встречи в 17:00",
  "ACCOUNTING-SVC",
  "3 из 3 успешно"
]) {
  assert.match(source, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Thursday module must contain: ${requiredText}`);
}

const css = read("thursday-minigames.css");
assert.match(css, /thursday-minigame-window/, "Thursday windows must have dedicated styling");
assert.match(css, /project-builder-grid/, "project builder must be styled");
assert.match(css, /case-builder-layout/, "case builder must be styled");
assert.match(css, /resignation-paper/, "resignation document must be styled");
assert.match(css, /complaint-record-table/, "complaint record must be styled");
assert.match(css, /@media \(max-width: 760px\)/, "Thursday tasks must adapt to smaller screens");

const html = read("index.html");
assert.match(html, /thursday-minigames\.css/, "Thursday stylesheet must be connected");
assert.match(html, /src\/thursday-minigames\.js/, "Thursday script must be connected");
assert.ok(
  html.indexOf("src/thursday-minigames.js") < html.indexOf("src/bootstrap.js"),
  "Thursday events and Friday gates must be registered before engine creation"
);

console.log("Thursday gameplay stage validation passed.");
