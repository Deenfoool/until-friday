"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/friday-scene-guard.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "Friday scene guard must contain valid JavaScript");

const storage = new Map();
storage.set("until-friday-save-v2", JSON.stringify({
  dayIndex: 4,
  ended: false,
  truthId: "contractor",
  completedActions: {
    "fri-meeting-blackmail": { dayIndex: 4, minute: 1020 }
  }
}));

const context = {
  UntilFridayMigration: { ENGINE_SAVE_KEY: "until-friday-save-v2" },
  UntilFridayFridayFinale: {
    truth: {
      player: { title: "Игрок", fact: "Игрок" },
      contractor: { title: "Подрядчик", fact: "Разговор относился к подрядчику." }
    }
  },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  MutationObserver: class MutationObserver { observe() {} },
  requestAnimationFrame: (callback) => callback(),
  document: {
    documentElement: {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; }
  },
  window: { addEventListener() {}, setTimeout() {} },
  console,
  Date
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "friday-scene-guard.js" });

const api = context.UntilFridayFridaySceneGuard;
assert.ok(api, "Friday scene guard API must be exported");
let committed = api.committedContext();
assert.equal(committed.route, "blackmail", "guard must infer the committed meeting route from the save");
assert.equal(committed.title, "Предъявить собранные материалы");

storage.set("until-friday-friday-scene-v1", JSON.stringify({ completed: true }));
assert.equal(api.committedContext(), null, "completed meetings must not create a recovery card");

for (const requiredText of [
  "Вернуться в переговорную №1",
  "Продолжить встречу",
  "event.stopImmediatePropagation()",
  "data-close",
  "Закрыть рабочую неделю",
  "recovered: true"
]) {
  assert.match(source, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Friday recovery must contain: ${requiredText}`);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /src\/friday-scene-guard\.js/, "Friday scene guard must be connected");
assert.ok(
  html.indexOf("src/friday-finale.js") < html.indexOf("src/friday-scene-guard.js") &&
  html.indexOf("src/friday-scene-guard.js") < html.indexOf("src/friday-ending-reopen.js"),
  "Friday scene guard must load after the finale and before ending restoration"
);

console.log("Friday scene interruption recovery validation passed.");
