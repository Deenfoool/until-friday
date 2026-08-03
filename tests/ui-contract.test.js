"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const syntaxFiles = [
  "src/app-v2.js",
  "src/bootstrap.js",
  "src/engine.js",
  "src/story-v2.js",
  "src/rules-extension.js",
  "src/state-migration.js",
  "src/integrity-fixes.js",
  "src/time-boundary-guard.js",
  "src/runtime-engine.js",
  "src/ui-observer-hub.js",
  "src/passive-clock.js",
  "src/day-transition-guard.js",
  "src/day-end-control.js",
  "src/asset-registry.js",
  "src/sprite-atlas.js",
  "src/asset-ui.js",
  "src/workflow-extension.js",
  "src/workflow-reset.js",
  "src/loading-indicator.js",
  "src/onboarding.js",
  "src/return-from-vacation.js",
  "src/terminal-sync.js",
  "src/work-minigames.js",
  "src/tuesday-minigames.js",
  "src/wednesday-minigames.js",
  "src/thursday-minigames.js",
  "src/friday-finale.js"
];

for (const file of syntaxFiles) {
  assert.doesNotThrow(() => new Function(read(file)), `${file} must contain valid JavaScript`);
}

const html = read("index.html");
for (const stylesheet of [
  "styles-v2.css",
  "asset-ui.css",
  "workflow.css",
  "onboarding.css",
  "work-minigames.css",
  "tuesday-minigames.css",
  "wednesday-minigames.css",
  "thursday-minigames.css",
  "friday-finale.css",
  "day-end-control.css"
]) {
  assert.ok(html.includes(stylesheet), `${stylesheet} must be connected`);
}

for (const script of [
  "runtime-engine",
  "ui-observer-hub",
  "passive-clock",
  "day-transition-guard",
  "day-end-control",
  "bootstrap",
  "asset-registry",
  "sprite-atlas",
  "asset-ui",
  "workflow-extension",
  "workflow-reset",
  "loading-indicator",
  "onboarding",
  "return-from-vacation",
  "terminal-sync",
  "work-minigames",
  "tuesday-minigames",
  "wednesday-minigames",
  "thursday-minigames",
  "friday-finale"
]) {
  assert.match(html, new RegExp(`src\\/${script}\\.js`), `${script} must be connected`);
}

assert.doesNotMatch(html, /<script src="src\/app\.js"><\/script>/, "legacy app must not boot in parallel");
assert.doesNotMatch(html, /persistent-engine-guard\.js/, "deleted runtime facade must not be loaded");

const position = (name) => html.indexOf(`src/${name}.js`);
assert.ok(position("engine") < position("story-v2"), "engine must load before story");
assert.ok(position("story-v2") < position("rules-extension"), "story must load before rules");
assert.ok(position("rules-extension") < position("state-migration"), "rules must load before migration");
assert.ok(position("state-migration") < position("integrity-fixes"), "migration definitions must load before integrity repairs");
assert.ok(position("integrity-fixes") < position("time-boundary-guard"), "repaired state must precede time rules");
assert.ok(position("time-boundary-guard") < position("runtime-engine"), "pure helpers must load before the runtime");
assert.ok(position("runtime-engine") < position("ui-observer-hub"), "runtime must exist before UI subscriptions");
assert.ok(position("ui-observer-hub") < position("passive-clock"), "observer hub must intercept observers before UI consumers");
assert.ok(position("passive-clock") < position("day-transition-guard"), "clock must exist before transition UI resets it");
assert.ok(position("day-transition-guard") < position("day-end-control"), "transition recovery must load before the day-end dialog");
assert.ok(position("day-end-control") < position("asset-registry"), "runtime controls must be ready before app extensions");
assert.ok(position("asset-registry") < position("sprite-atlas"), "asset paths must load before sprite atlas");
assert.ok(position("sprite-atlas") < position("asset-ui"), "sprite atlas must load before asset UI");
assert.ok(position("workflow-extension") < position("workflow-reset"), "workflow must load before reset guard");
assert.ok(position("loading-indicator") < position("onboarding"), "loader must exist before login flow");
assert.ok(position("onboarding") < position("return-from-vacation"), "profile must exist before welcome flow");
assert.ok(position("return-from-vacation") < position("terminal-sync"), "profile bridge must load before terminal identity");
assert.ok(position("friday-finale") < position("bootstrap"), "all story extensions must load before app bootstrap");

const runtime = read("src/runtime-engine.js");
assert.equal((runtime.match(/Engine\.createEngine\s*=/g) || []).length, 1, "only the unified runtime may replace the engine factory");
for (const phrase of [
  "until-friday-state-change",
  "Действие не сохранено",
  "Время не сохранено",
  "Переход не сохранён",
  "rolledBack: true"
]) {
  assert.match(runtime, new RegExp(phrase), `runtime must contain: ${phrase}`);
}

const app = read("src/app-v2.js");
for (const requiredApp of ["explorer", "mail", "chat", "tasks", "terminal", "journal", "trash"]) {
  assert.match(app, new RegExp(`id: \\"${requiredApp}\\"`), `${requiredApp} app must be registered`);
}
assert.match(app, /engine\.endDay\(\)/, "UI must support day transitions");
assert.match(app, /engine\.applyAction\(actionId\)/, "UI must route choices through the engine");
assert.match(app, /showEnding\(/, "UI must render an ending");

const bootstrap = read("src/bootstrap.js");
assert.match(bootstrap, /Onboarding\?\.run/, "main menu must run before the desktop");
assert.match(bootstrap, /until-friday-app-ready/, "extensions must receive the app-ready event");

const onboarding = read("src/onboarding.js");
const onboardingStyles = read("onboarding.css");
assert.match(onboardingStyles, /image-empty-workplace\.png/, "menu must use the empty workplace background");
for (const text of [
  "Новая игра",
  "Настройки",
  "Имя сотрудника:",
  "Он пока ничего не знает?",
  "Пусть пока продолжает работать как обычно"
]) {
  assert.match(onboarding, new RegExp(text.replace(/[?]/g, "\\?")), `onboarding must contain: ${text}`);
}
assert.doesNotMatch(onboarding, /Первый вход после длительного отсутствия/, "rejected login caption must never appear");
assert.match(onboarding, /validName/, "employee names must be validated");

const reset = read("src/workflow-reset.js");
assert.match(reset, /clearGameData/, "reset must clear all game data in one operation");
assert.match(reset, /stopImmediatePropagation/, "reset guard must replace the old asynchronous handler");
assert.match(reset, /root\.confirm/, "reset must wait for explicit confirmation");
assert.match(reset, /until-friday-save-v2/, "reset must clear the engine save");
assert.match(reset, /until-friday-workflow-files-v1/, "reset must clear saved documents");
assert.match(reset, /until-friday-notification-history-v1/, "reset must clear notification history");
assert.doesNotMatch(reset, /beforeunload|resetRequested/, "reset must not depend on unload timing");

const vacation = read("src/return-from-vacation.js");
for (const text of [
  "с возвращением",
  "Напомни, где что находится",
  "Я сам разберусь",
  "Что именно поменялось",
  "returnGuideSignature",
  "terminalLogin"
]) {
  assert.match(vacation, new RegExp(text), `vacation bridge must contain: ${text}`);
}

const monday = read("src/work-minigames.js");
assert.match(monday, /Подготовить отчёт за июль/, "report selection must be interactive");
assert.match(monday, /Отчёт_июль_финал_копия\.xlsx/, "report task must include ambiguous versions");
assert.match(monday, /Проверить счёт №7814/, "invoice verification must be interactive");
assert.match(monday, /842 000 ₽/, "invoice task must include the suspicious amount");

const loader = read("src/loading-indicator.js");
assert.match(loader, /const SEGMENT_COUNT = 12;/, "loader must build twelve segments programmatically");
assert.doesNotMatch(loader, /loading\.png/, "loader must not depend on an image sprite");
assert.match(read("styles-v2.css"), /until-friday-spinner-pulse/, "loader animation must exist in CSS");

const assetRegistry = read("src/asset-registry.js");
assert.doesNotMatch(assetRegistry, /assets\/sprites\/loading\.png/, "asset registry must not request a loading sprite");
assert.match(assetRegistry, /assets\/assets-file-icons\.png/, "file icon sheet must be registered");
assert.match(assetRegistry, /assets\/avatar-director\.png/, "department chief avatar must be registered");
assert.match(assetRegistry, /assets\/avatar-hr-men\.png/, "HR avatar must be registered");

const atlas = read("src/sprite-atlas.js");
for (const group of ["attachments", "statuses", "folders", "files", "system"]) {
  assert.match(atlas, new RegExp(`${group}: \\{`), `${group} sprite group must exist`);
}
assert.match(atlas, /function createIcon\(/, "sprite atlas must expose icon creation");

const workflow = read("src/workflow-extension.js");
assert.match(workflow, /Сохранить в Документы/, "mail attachments must be saveable");
assert.match(workflow, /data-workflow-delete/, "saved files must be deletable");
assert.match(workflow, /function restoreFile\(/, "files must be restorable");
assert.match(workflow, /workflowSignature/, "workflow rendering must avoid observer loops");

const manifest = JSON.parse(read("assets/manifest.json"));
assert.equal(manifest.assets.length, 40, "all forty prompts must remain documented");
assert.equal(new Set(manifest.assets.map((item) => item.prompt)).size, 40, "prompt numbers must be unique");
assert.equal(new Set(manifest.assets.map((item) => item.path)).size, 40, "asset paths must be unique");
const generatedLoading = manifest.assets.find((item) => item.prompt === 37);
assert.equal(generatedLoading.generated, true, "prompt 37 must be marked as generated");
assert.equal(generatedLoading.source, "src/loading-indicator.js", "prompt 37 must point to its source");

console.log("UI contract validation passed.");
