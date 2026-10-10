"use strict";

// Regression smoke test: translated office input must not affect the game engine,
// save format, or day-to-day story progression.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const scripts = [
  "src/i18n-en.js",
  "src/i18n-office-en.js",
  "src/i18n-interface-en.js",
  "src/i18n-documents-en.js",
  "src/i18n.js",
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
const saved = new Map();
const listeners = new Map();
const document = {
  title: "До пятницы",
  documentElement: { lang: "ru" },
  body: { nodeType: 1, hasAttribute: () => false, querySelectorAll: () => [] },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  createTreeWalker: () => ({ nextNode: () => null })
};
const context = {
  console,
  document,
  NodeFilter: { SHOW_TEXT: 4 },
  location: { href: "https://test.invalid/" },
  localStorage: {
    getItem: (key) => saved.get(key) || null,
    setItem: (key, value) => saved.set(key, String(value)),
    removeItem: (key) => saved.delete(key)
  },
  CustomEvent: class {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  },
  requestAnimationFrame() {},
  setTimeout: () => 1,
  clearTimeout() {},
  addEventListener(type, listener) {
    const handlers = listeners.get(type) || [];
    handlers.push(listener);
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
for (const script of scripts) {
  vm.runInContext(fs.readFileSync(path.join(rootDir, script), "utf8"), context, { filename: script });
}
const i18n = context.UntilFridayI18n;
const tasks = context.UntilFridayOfficeWorkPack;

for (const locale of ["ru", "en"]) {
  assert.equal(i18n.setLanguage(locale), locale);
  const engine = context.UntilFridayEngine.createEngine(context.UNTIL_FRIDAY_STORY, null, {
    seed: "localization-smoke-" + locale,
    truthId: "player"
  });
  const mondayLetter = tasks.TASK_BY_ID["office-mon-supplier-letter"];
  const tuesdayLetter = tasks.TASK_BY_ID["office-tue-client-letter"];

  for (let day = 0; day < 5; day += 1) {
    const current = engine.getState();
    assert.equal(current.dayIndex, day, locale + ": incorrect day before progression");
    if (!current.dayStarted) assert.equal(engine.startDay().ok, true);

    if (day === 0) {
      assert.equal(engine.advanceTime(55).ok, true);
      const text = locale === "en"
        ? "Please confirm receipt of 24 reels of KS-18 cable by 12:00. The courier has the documents."
        : "Просим подтвердить получение 24 бухт кабеля КС-18 до 12:00. Документы переданы курьеру.";
      assert.equal(tasks.completeTask(mondayLetter, 0, { text }).ok, true);
      assert.equal(engine.getState().metadata.officeWork.completed[mondayLetter.id].quality, "accepted");
    }
    if (day === 1) {
      assert.equal(engine.advanceTime(55).ok, true);
      const text = i18n.translate(tuesdayLetter.config.expectedText, locale);
      assert.equal(tasks.completeTask(tuesdayLetter, 1, { text }).ok, true);
      assert.equal(engine.getState().metadata.officeWork.completed[tuesdayLetter.id].quality, "accepted");
    }

    assert.equal(engine.endDay().ok, true, locale + ": cannot complete day " + day);
    const nextDay = engine.getState().dayIndex;
    assert.equal(nextDay, Math.min(4, day + 1));
    const mainSave = JSON.parse(saved.get("until-friday-save-v2"));
    assert.equal(mainSave.dayIndex, nextDay);
    assert.equal(mainSave.metadata.officeWork.completed[mondayLetter.id].quality, "accepted");
    assert.equal(mainSave.metadata.officeWork.completed[mondayLetter.id].submission.text.startsWith(
      locale === "en" ? "Please" : "Просим"), true,
      "Source-language submissions are preserved without rewriting save data");
  }
}
console.log("RU and EN five-day engine and office submission smoke tests passed.");
