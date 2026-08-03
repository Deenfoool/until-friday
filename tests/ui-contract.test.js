"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const scripts = [
  "src/app-v2.js",
  "src/bootstrap.js",
  "src/app.js",
  "src/engine.js",
  "src/story-v2.js",
  "src/rules-extension.js",
  "src/state-migration.js",
  "src/asset-registry.js",
  "src/sprite-atlas.js",
  "src/asset-ui.js",
  "src/workflow-extension.js",
  "src/workflow-reset.js",
  "src/loading-indicator.js",
  "src/onboarding.js",
  "src/return-from-vacation.js",
  "src/work-minigames.js"
];

for (const file of scripts) {
  const source = read(file);
  assert.doesNotThrow(() => new Function(source), `${file} must contain valid JavaScript`);
}

const html = read("index.html");
for (const stylesheet of ["styles-v2.css", "asset-ui.css", "workflow.css", "onboarding.css", "work-minigames.css"]) {
  assert.match(html, new RegExp(stylesheet.replace(".", "\\.")), `${stylesheet} must be connected`);
}
for (const script of [
  "bootstrap", "asset-registry", "sprite-atlas", "asset-ui", "workflow-extension", "workflow-reset",
  "loading-indicator", "onboarding", "return-from-vacation", "work-minigames"
]) {
  assert.match(html, new RegExp(`src\\/${script}\\.js`), `${script} must be connected`);
}
assert.doesNotMatch(html, /<script src="src\/app\.js"><\/script>/, "legacy app must not boot in parallel");

const position = (name) => html.indexOf(`src/${name}.js`);
assert.ok(position("engine") < position("story-v2"), "engine must load before story");
assert.ok(position("story-v2") < position("rules-extension"), "story must load before rule extensions");
assert.ok(position("rules-extension") < position("state-migration"), "rules must load before migration");
assert.ok(position("state-migration") < position("asset-registry"), "migration must load before assets");
assert.ok(position("asset-registry") < position("sprite-atlas"), "asset paths must load before sprite atlas");
assert.ok(position("sprite-atlas") < position("asset-ui"), "sprite atlas must load before asset UI");
assert.ok(position("asset-ui") < position("workflow-extension"), "asset viewer must load before workflow");
assert.ok(position("workflow-extension") < position("workflow-reset"), "workflow must load before reset guard");
assert.ok(position("workflow-reset") < position("loading-indicator"), "reset guard must load before startup");
assert.ok(position("loading-indicator") < position("onboarding"), "loader must exist before login flow");
assert.ok(position("onboarding") < position("return-from-vacation"), "profile must exist before welcome flow");
assert.ok(position("return-from-vacation") < position("work-minigames"), "profile bridge must load before tasks");
assert.ok(position("work-minigames") < position("bootstrap"), "extensions must observe before app bootstrap");

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
assert.match(onboarding, /Новая игра/, "menu must offer a new game");
assert.match(onboarding, /Настройки/, "menu must offer settings");
assert.match(onboarding, /Имя сотрудника:/, "login must request an employee name");
assert.match(onboarding, /Он пока ничего не знает\?/, "canonical dialogue must be present");
assert.match(onboarding, /Пусть пока продолжает работать как обычно/, "canonical final dialogue line must be present");
assert.doesNotMatch(onboarding, /Первый вход после длительного отсутствия/, "rejected login caption must never appear in the game");
assert.match(onboarding, /validName/, "employee names must be validated");
assert.match(onboarding, /until-friday-return-welcome-v1/, "new game must schedule the friend welcome");

const openingDoc = read("OPENING_FLOW.md");
assert.match(openingDoc, /считается закреплённым началом/, "canonical opening must be documented");
assert.match(openingDoc, /На экране нет фразы/, "rejected caption must be explicitly excluded from the specification");

const vacation = read("src/return-from-vacation.js");
assert.match(vacation, /с возвращением/, "friend must welcome the player back from vacation");
assert.match(vacation, /Напомни, где что находится/, "tutorial must be optional through dialogue");
assert.match(vacation, /Я сам разберусь/, "tutorial must be skippable without punishment");
assert.match(vacation, /Что именно поменялось/, "player must be able to ask about changes");
assert.match(vacation, /returnGuideSignature/, "welcome rendering must be protected from observer loops");
assert.match(vacation, /terminalLogin/, "custom names must propagate to the terminal identity");

const minigames = read("src/work-minigames.js");
assert.match(minigames, /Подготовить отчёт за июль/, "report selection must be an interactive task");
assert.match(minigames, /Отчёт_июль_финал_копия\.xlsx/, "report task must include ambiguous versions");
assert.match(minigames, /Проверить счёт №7814/, "invoice verification must be an interactive task");
assert.match(minigames, /842 000 ₽/, "invoice task must include the suspicious amount");
assert.match(minigames, /actions\.correct/, "correct report choice must route to the engine");
assert.match(minigames, /actions\.wrong/, "wrong report choice must retain consequences");
assert.match(minigames, /actions\.fix/, "invoice correction must route to the engine");
assert.match(minigames, /actions\.report/, "invoice escalation must route to the engine");

const loader = read("src/loading-indicator.js");
assert.match(loader, /const SEGMENT_COUNT = 12;/, "loader must build twelve segments programmatically");
assert.match(loader, /createElement\("span"\)/, "loader segments must be created through JavaScript");
assert.doesNotMatch(loader, /loading\.png/, "loader must not depend on an image sprite");

const loaderStyles = read("styles-v2.css");
assert.match(loaderStyles, /until-friday-spinner-pulse/, "loader animation must be defined in CSS");

const assetRegistry = read("src/asset-registry.js");
assert.doesNotMatch(assetRegistry, /assets\/sprites\/loading\.png/, "asset registry must not request a loading sprite");
assert.match(assetRegistry, /assets\/assets-file-icons\.png/, "uploaded file icon sheet must be registered");
assert.match(assetRegistry, /assets\/avatar-director\.png/, "confirmed department chief avatar must be registered");
assert.match(assetRegistry, /assets\/avatar-hr-men\.png/, "confirmed HR avatar must be registered");

const atlas = read("src/sprite-atlas.js");
for (const group of ["attachments", "statuses", "folders", "files", "system"]) {
  assert.match(atlas, new RegExp(`${group}: \\{`), `${group} sprite group must exist`);
}
assert.match(atlas, /function createIcon\(/, "sprite atlas must expose programmatic icon creation");

const assetUi = read("src/asset-ui.js");
assert.match(assetUi, /storyAssets/, "asset UI must expose story files");
assert.match(assetUi, /decorateFileRows/, "file rows must use generated icons");
assert.match(assetUi, /decorateContacts/, "employee statuses must be integrated");
assert.match(assetUi, /decorateNotifications/, "system notification icons must be integrated");
assert.match(assetUi, /openAssetViewer/, "story images and scans must open in a viewer");

const workflow = read("src/workflow-extension.js");
assert.match(workflow, /Сохранить в Документы/, "mail attachments must be saveable");
assert.match(workflow, /data-workflow-delete/, "saved files must be deletable from Explorer");
assert.match(workflow, /function restoreFile\(/, "files must be restorable from Trash");
assert.match(workflow, /workflowSignature/, "workflow rendering must be guarded against observer loops");

const workflowReset = read("src/workflow-reset.js");
assert.match(workflowReset, /beforeunload/, "reset must wait for a confirmed reload");
assert.match(workflowReset, /until-friday-profile-v1/, "new week must clear the employee profile");
assert.match(workflowReset, /until-friday-return-welcome-v1/, "new week must clear the welcome dialogue");

const manifest = JSON.parse(read("assets/manifest.json"));
assert.equal(manifest.assets.length, 40, "all forty prompts must remain documented");
assert.equal(new Set(manifest.assets.map((item) => item.prompt)).size, 40, "prompt numbers must be unique");
assert.equal(new Set(manifest.assets.map((item) => item.path)).size, 40, "asset paths must be unique");
const generatedLoading = manifest.assets.find((item) => item.prompt === 37);
assert.equal(generatedLoading.generated, true, "prompt 37 must be marked as generated");
assert.equal(generatedLoading.source, "src/loading-indicator.js", "prompt 37 must point to its source");
const chief = manifest.assets.find((item) => item.prompt === 18);
const hr = manifest.assets.find((item) => item.prompt === 21);
assert.equal(chief.role, "Андрей Соколов, начальник отдела", "prompt 18 role must be confirmed");
assert.equal(hr.role, "Сотрудник отдела кадров", "prompt 21 role must be confirmed");

console.log("UI contract validation passed.");
