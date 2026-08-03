"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const ui = read("src/ui-runtime-guards.js");
assert.doesNotThrow(() => new Function(ui), "runtime UI guards must contain valid JavaScript");
for (const text of [
  "wed-audit-explain",
  "Запрос пояснений",
  "mon-tell-friend",
  "Дима Орлов",
  "tue-answer-admin-honest",
  "Роман Белов",
  "data-workflow-file-id",
  "choice-locked",
  "focus-exhausted",
  "workday-ended",
  "pointerType !== \"touch\"",
  "friday-ending-overlay"
]) {
  assert.match(ui, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `UI guard must cover: ${text}`);
}

const terminal = read("src/terminal-sync.js");
assert.doesNotThrow(() => new Function(terminal), "terminal synchronization must contain valid JavaScript");
for (const command of ["status", "day", "tasks", "actions", "logs"]) {
  assert.match(terminal, new RegExp(`\\"${command}\\"`), `terminal synchronization must intercept ${command}`);
}
assert.match(terminal, /getEngine/, "terminal must read the live engine");
assert.match(terminal, /event\.stopImmediatePropagation\(\)/, "old stale command handler must be bypassed");
assert.match(terminal, /UntilFridayProfile/, "terminal output must use the current player profile");

const auto = read("src/auto-continue.js");
assert.doesNotThrow(() => new Function(auto), "automatic day continuation must contain valid JavaScript");
assert.match(auto, /until-friday-auto-continue-v1/);
assert.match(auto, /data-start-next/);
assert.match(auto, /data-recovered-start/);
assert.match(auto, /continue-after-transition/);
assert.match(auto, /sessionStorage\.removeItem/, "one-time continuation marker must be consumed");

const html = read("index.html");
for (const file of ["src/auto-continue.js", "src/terminal-sync.js", "src/ui-runtime-guards.js"]) {
  assert.ok(html.includes(file), `${file} must be connected`);
}
assert.ok(
  html.indexOf("src/onboarding.js") < html.indexOf("src/auto-continue.js") &&
  html.indexOf("src/auto-continue.js") < html.indexOf("src/bootstrap.js"),
  "automatic continuation must wrap onboarding before bootstrap"
);
assert.ok(
  html.indexOf("src/return-from-vacation.js") < html.indexOf("src/terminal-sync.js") &&
  html.indexOf("src/terminal-sync.js") < html.indexOf("src/bootstrap.js"),
  "terminal synchronization must load after profile support and before the app"
);
assert.ok(
  html.indexOf("src/friday-ending-reopen.js") < html.indexOf("src/ui-runtime-guards.js") &&
  html.indexOf("src/ui-runtime-guards.js") < html.indexOf("src/bootstrap.js"),
  "UI guards must observe the fully extended interface before app startup"
);

console.log("Runtime UI guard validation passed.");
