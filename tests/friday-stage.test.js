"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const source = read("src/friday-finale.js");
assert.doesNotThrow(() => new Function(source), "Friday finale module must contain valid JavaScript");

const story = {
  actions: {
    "fri-meeting-calm": { label: "Спокойно выслушать директора" },
    "fri-meeting-work": { label: "Сразу показать результаты недели" },
    "fri-meeting-blackmail": { label: "Предъявить компромат" },
    "fri-send-resignation": { label: "Подать заявление первым" }
  },
  endings: [
    { id: "wrong-person", title: "Увольняли не тебя", text: "old" }
  ],
  fallbackEnding: { id: "ordinary-friday", title: "Пятница", text: "old" }
};

const storage = new Map();
const context = {
  UNTIL_FRIDAY_STORY: story,
  UntilFridayMigration: { ENGINE_SAVE_KEY: "until-friday-save-v2" },
  UntilFridayProfile: { playerName: () => "Денис" },
  UntilFridayWorkflow: { getState: () => ({ files: [] }), saveAttachment: () => {} },
  MutationObserver: class MutationObserver { observe() {} },
  document: {
    documentElement: {},
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    setTimeout: () => {}
  },
  requestAnimationFrame: (callback) => callback(),
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  console,
  Date,
  MouseEvent: class MouseEvent {}
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "friday-finale.js" });

const api = context.UntilFridayFridayFinale;
assert.ok(api, "Friday finale API must be exported");
for (const truthId of ["player", "newcomer", "department", "contractor"]) {
  assert.ok(api.truth[truthId], `Friday truth branch is missing: ${truthId}`);
}

const timeline = api.buildTimeline({
  completedActions: {
    "fri-meeting-calm": { dayIndex: 4, minute: 1020, result: "Встреча началась." }
  }
});
assert.equal(timeline.length, 1, "timeline must include completed Friday actions");
assert.equal(timeline[0].day, "Пятница");
assert.equal(timeline[0].time, "17:00");

const consequences = api.buildConsequences({
  stats: { work: 9, suspicion: 1, collateral: 0 },
  flags: { auditClosedHonestly: true },
  trust: { friend: 2, chief: 2 }
});
assert.ok(consequences.some((item) => item.title === "Работа" && /сильными/.test(item.text)));
assert.ok(consequences.some((item) => item.title === "Служба безопасности" && /закрыт/.test(item.text)));

for (const requiredText of [
  "Встреча в переговорной №1",
  "Что означал разговор",
  "Позиция на встрече",
  "Итог_рабочей_недели.txt",
  "Хронология",
  "Последствия",
  "Все компании, системы, документы и персонажи вымышлены",
  "fri-meeting-blackmail",
  "department",
  "contractor"
]) {
  assert.match(source, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Friday module must contain: ${requiredText}`);
}

const css = read("friday-finale.css");
assert.match(css, /friday-scene-overlay/, "meeting overlay must be styled");
assert.match(css, /friday-ending-tabs/, "ending tabs must be styled");
assert.match(css, /friday-timeline/, "timeline must be styled");
assert.match(css, /@media \(max-width: 760px\)/, "Friday scene must adapt to smaller screens");

const html = read("index.html");
assert.match(html, /friday-finale\.css/, "Friday stylesheet must be connected");
assert.match(html, /src\/friday-finale\.js/, "Friday script must be connected");
assert.ok(
  html.indexOf("src/friday-finale.js") < html.indexOf("src/bootstrap.js"),
  "Friday scene must be registered before engine creation"
);

const reset = read("src/friday-reset.js");
assert.match(reset, /until-friday-friday-scene-v1/, "new game and manual reset must clear Friday scene data");
assert.match(reset, /data-new-game/, "Friday reset must observe new game creation");
assert.match(reset, /#reset-button/, "Friday reset must observe manual restart");
assert.match(html, /src\/friday-reset\.js/, "Friday reset script must be connected");

console.log("Friday finale stage validation passed.");
