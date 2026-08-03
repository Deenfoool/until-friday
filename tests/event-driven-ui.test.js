"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const eventDrivenModules = [
  "src/return-from-vacation.js",
  "src/day-end-control.js",
  "src/ui-runtime-guards.js",
  "src/friday-scene-guard.js",
  "src/friday-ending-reopen.js",
  "src/notification-history-guard.js",
  "src/tuesday-minigames.js"
];

for (const file of eventDrivenModules) {
  const source = read(file);
  assert.doesNotThrow(() => new Function(source), `${file} must contain valid JavaScript`);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, `${file} must not watch the whole DOM`);
  assert.match(source, /until-friday-ui-render/, `${file} must react to completed application rendering`);
  assert.match(source, /until-friday-state-change/, `${file} must react to confirmed state changes`);
}

const html = read("index.html");
assert.doesNotMatch(html, /Илья\s+Воронов|>ИВ</, "static HTML must not expose the former fixed employee identity");
assert.match(html, /data-profile-name>Сотрудник</, "static profile name must be neutral");
assert.match(html, /data-profile-avatar>С</, "static profile avatar must be neutral");

const profile = read("src/return-from-vacation.js");
assert.doesNotMatch(profile, /Илья\s+Воронов|Илью/, "profile bridge must not contain a literal fixed employee name");
assert.match(profile, /return Onboarding\.readProfile\(\)\?\.name \|\| "Сотрудник"/, "missing profiles must use a neutral label");
assert.match(profile, /function initials\(/, "profile bridge must generate avatar initials");
assert.match(profile, /LEGACY_FULL_NAME/, "legacy story identity must be converted after rendering");
assert.match(profile, /friday-ending-overlay/, "final screens must receive player identity personalization");
assert.match(profile, /terminalLogin/, "profile bridge must keep the terminal login personalized");

const autoContinue = read("src/auto-continue.js");
assert.doesNotMatch(autoContinue, /Илья\s+Воронов|Илью|Ильи/, "legacy continuation must not recreate the former fixed identity");
assert.match(autoContinue, /name: "Сотрудник"/, "missing legacy profiles must use a neutral employee name");

const dayEnd = read("src/day-end-control.js");
assert.match(dayEnd, /removeTaskCards/, "day-end UI must remove stale task cards");
assert.match(dayEnd, /event\.detail\?\.appId === "tasks"/, "day-end UI must react specifically to the Tasks render lifecycle");

const guards = read("src/ui-runtime-guards.js");
assert.match(guards, /queueAfterInteraction/, "UI guards must refresh after explicit interactions");
assert.match(guards, /until-friday-ui-render/, "UI guards must use the render lifecycle");

const friday = read("src/friday-scene-guard.js");
assert.match(friday, /queueAfterInteraction/, "Friday meeting lock must run after the scene-opening click");
assert.match(friday, /event\.detail\?\.appId === "tasks"/, "Friday recovery cards must react to the Tasks lifecycle");

const ending = read("src/friday-ending-reopen.js");
assert.match(ending, /queueAfterLifecycle/, "ending restoration must perform a delayed lifecycle inspection");
assert.match(ending, /inspectEnding/, "ending restoration must handle enhanced and basic overlays");

const history = read("src/notification-history-guard.js");
assert.match(history, /until-friday-app-ready/, "restored inbox toasts must be inspected after application startup");
assert.match(history, /queueMicrotask/, "notification inspection must occur after the current state-change stack finishes");

const tuesday = read("src/tuesday-minigames.js");
assert.match(tuesday, /event\.detail\?\.appId === "tasks"/, "Tuesday cards must be scoped to the Tasks render lifecycle");
assert.match(tuesday, /queueDecorate/, "Tuesday lifecycle refresh must stay batched");

console.log("Event-driven UI and neutral identity validation passed.");
