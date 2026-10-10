"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const base = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(base, file), "utf8");
const dictFiles = [
  "src/i18n-en.js",
  "src/i18n-office-en.js",
  "src/i18n-interface-en.js",
  "src/i18n-documents-en.js",
  "src/i18n-finale-en.js",
  "src/i18n-tickets-en.js",
  "src/i18n-thursday-en.js",
  "src/i18n-npc-en.js",
  "src/i18n-marketplace-en.js",
  "src/i18n-browser-en.js",
  "src/i18n-live-early-en.js",
  "src/i18n-live-late-en.js",
  "src/i18n-director-early-en.js",
  "src/i18n-director-late-en.js",
  "src/i18n-system-en.js",
  "src/i18n-office-data-en.js",
  "src/i18n-qa-en.js"
];
const storage = new Map();
const shown = { nodeValue: "Новая игра", parentElement: { closest() { return null; } } };
const parent = {
  nodeType: 1,
  hasAttribute() { return false; },
  querySelectorAll() { return []; }
};
const context = {
  console,
  JSON, Map, WeakMap, Object,
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  NodeFilter: { SHOW_TEXT: 4 },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  document: {
    title: "До пятницы",
    documentElement: { lang: "ru" },
    body: parent,
    addEventListener() {},
    createTreeWalker() {
      let consumed = false;
      return { nextNode() { if (consumed) return null; consumed = true; return shown; } };
    }
  },
  addEventListener() {},
  dispatchEvent() {},
  requestAnimationFrame() {},
  setTimeout() {}
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of [...dictFiles, "src/i18n.js"]) {
  assert.doesNotThrow(() => vm.runInContext(read(file), context, { filename: file }));
}
const api = context.UntilFridayI18n;
assert.ok(api);
assert.equal(api.currentLanguage(), "ru", "Russian must be the default");
assert.equal(api.translate("Пятница"), "Пятница");
assert.equal(api.translate("Пятница", "en"), "Friday");
assert.equal(api.translate("Новая игра", "en"), "New Game");
assert.equal(api.translate("Свести обращения за утро", "en"), "Summarize morning support requests");
assert.equal(api.translate("До пятницы", "en"), "Until Friday");
assert.equal(api.translate("Решение касалось вашей должности", "en"), "The decision concerned your position",
  "The Friday director meeting must be translated");
assert.equal(api.translate("Платье «Созвон отменили»", "en"), "“Meeting Canceled” Dress",
  "Marketplace product names must be translated");
assert.equal(api.translate("Документ передан на проверку", "en"), "Document Sent for Review",
  "Office states must be translated");
assert.equal(api.translate("Неделя уже завершена.", "en"), "The week has already ended.",
  "System messages must be translated");
assert.equal(api.translate("ПН, 3 АВГ", "en"), "MON, Aug 3");
assert.equal(api.translate("Завершить Понедельник?", "en"), "End Monday?");
assert.equal(api.translate("Пользователь: Илья Воронов", "en"), "User: Ilya Voronov");
assert.match(api.translate("help              список команд", "en"), /list commands/);
assert.equal(api.matchesLabel("Запрос пояснений", "Запрос пояснений"), true);
assert.equal(api.matchesLabel("Explanation requested", "Запрос пояснений"), true);
assert.equal(api.matchesLabel("Other assignment", "Запрос пояснений"), false);
for (const file of [
  "src/tuesday-minigames.js",
  "src/wednesday-minigames.js",
  "src/thursday-minigames.js",
  "src/friday-finale.js"
]) {
  assert.ok(read(file).includes("UntilFridayI18n?.matchesLabel"),
    file + " must resolve existing UI actions under both languages");
}
assert.ok(read("src/app-v2.js").includes("UntilFridayI18n?.apply?.(output)"),
  "Terminal outputs must be translated immediately on Enter");

assert.equal(api.translate(""), "");
assert.equal(api.setLanguage("en"), "en");
assert.equal(context.document.documentElement.lang, "en");
assert.equal(context.document.title, "Until Friday");
assert.equal(shown.nodeValue, "New Game");
assert.equal(JSON.parse(storage.get("until-friday-settings-v1")).language, "en");
assert.equal(api.setLanguage("ru"), "ru");
assert.equal(shown.nodeValue, "Новая игра", "Switching back must restore original Russian");
assert.equal(api.setLanguage("bad"), "ru", "Unsupported locales must fall back to Russian");
assert.equal(api.translate("ПН, 3 АВГ", "en"), "MON, Aug 3");


assert.equal(api.translate("Завершить понедельник?", "en"), "End Monday?");
assert.equal(api.translate("Завершить вторник?", "en"), "End Tuesday?");
assert.equal(api.translate("Завершить среду?", "en"), "End Wednesday?");
assert.equal(api.translate("Завершить четверг?", "en"), "End Thursday?");

const dynamicAttrs = new Map([["placeholder", "Новая игра"], ["title", "Сохранить"]]);
const reusedControl = {
  nodeType: 1,
  closest() { return null; },
  hasAttribute(name) { return dynamicAttrs.has(name); },
  getAttribute(name) { return dynamicAttrs.get(name) ?? null; },
  setAttribute(name, value) { dynamicAttrs.set(name, String(value)); },
  querySelectorAll() { return []; }
};
const treeWalker = context.document.createTreeWalker;
context.document.createTreeWalker = () => ({ nextNode: () => null });
api.setLanguage("en");
api.apply(reusedControl);
assert.equal(dynamicAttrs.get("placeholder"), "New Game");
assert.equal(dynamicAttrs.get("title"), "Save");
// Reusing a DOM control must not bring back its previous caption.
dynamicAttrs.set("placeholder", "Настройки");
dynamicAttrs.set("title", "Продолжить");
api.apply(reusedControl);
assert.equal(dynamicAttrs.get("placeholder"), "Settings");
assert.equal(dynamicAttrs.get("title"), "Continue");
api.setLanguage("ru");
api.apply(reusedControl);
assert.equal(dynamicAttrs.get("placeholder"), "Настройки");
assert.equal(dynamicAttrs.get("title"), "Продолжить");
context.document.createTreeWalker = treeWalker;

const story = read("src/story-v2.js");
const phrases = [...new Set([...story.matchAll(/"([^"\n]*[А-Яа-яЁё][^"\n]*)"/g)].map((match) => match[1]))];
const ignored = new Set(["Приказ_кадры_черновик.doc", "Автоматизация_отчётов.zip"]);
const missing = phrases.filter((phrase) => !ignored.has(phrase) && !context.UntilFridayEnglish[phrase]);
assert.deepEqual(missing, [], "Core story dialogue and endings must have English entries");

const onboarding = read("src/onboarding.js");
assert.match(onboarding, /data-menu-language/, "Language chooser must be directly in main menu");
assert.match(onboarding, /data-settings-language/, "Language chooser must also appear in Settings");
assert.match(onboarding, /I18n\?\.setLanguage/, "The selector must save and apply language");
assert.match(onboarding, /language: stage\.querySelector\("\[data-settings-language\]"\)\.value/,
  "Settings should persist language alongside other preferences");
const index = read("index.html");
assert.ok(index.indexOf("src/i18n.js") < index.indexOf("src/engine.js"),
  "Localization must load before the story and UI modules");
assert.ok(index.includes("src/i18n-documents-en.js"));
for (const dictionary of dictFiles) {
  assert.ok(index.includes(dictionary), dictionary + " must be loaded");
  assert.ok(index.indexOf(dictionary) < index.indexOf("src/i18n.js"),
    dictionary + " must load before the localization runtime");
}

const officeRoot = {
  UntilFridayI18n: api,
  UntilFridayRuntimeEngine: { getEngine: () => null },
  document: { querySelector() { return null; } },
  addEventListener() {}
};
officeRoot.globalThis = officeRoot;
vm.createContext(officeRoot);
vm.runInContext(read("src/office-work-pack.js"), officeRoot);
const pack = officeRoot.UntilFridayOfficeWorkPack;
for (const task of pack.TASKS) {
  if (task.type === "document") {
    assert.notEqual(api.translate(task.config.sourceText, "en"), task.config.sourceText,
      task.id + ": source document must have an English translation");
    assert.notEqual(api.translate(task.config.expectedText, "en"), task.config.expectedText,
      task.id + ": reference content must have an English translation");
  } else if (task.type === "template") {
    assert.notEqual(api.translate(task.config.sourceText, "en"), task.config.sourceText,
      task.id + ": template instructions must be available in English");
  }
}
const sourceTask = pack.TASK_BY_ID["office-tue-client-letter"];
assert.equal(pack.validateTask(sourceTask, { text: sourceTask.config.expectedText }), true);
assert.equal(pack.validateTask(sourceTask, { text: api.translate(sourceTask.config.expectedText, "en") }), true);
assert.equal(pack.validateTask(sourceTask, { text: "" }), false);
const template = pack.TASK_BY_ID["office-tue-service-act"];
const fields = Object.fromEntries(template.config.fields.map((field) => [field.id, api.translate(field.expected, "en")]));
assert.equal(pack.validateTask(template, { fields }), true);
assert.equal(pack.validateTask(template, { fields: {} }), false);
assert.equal(pack.assessSubmission("office-mon-supplier-letter", {
  text: "Please confirm 24 reels of KS-18 cable by 12:00. The courier has the documents."
}).accepted, true);

console.log("RU/EN locale switching, story coverage, office answer validation and menu selectors passed.");
