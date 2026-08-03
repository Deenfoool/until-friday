"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const ui = read("src/ui-runtime-guards.js");
assert.doesNotThrow(() => new Function(ui), "runtime UI guards must contain valid JavaScript");
assert.match(ui, /UntilFridayRuntimeEngine/, "UI guards must obtain the shared runtime directly");
assert.doesNotMatch(ui, /UntilFridayDayTransitionGuard\?\.getEngine|UntilFridayPassiveClock\?\.getEngine/, "UI guards must not use fallback engine access");
assert.doesNotMatch(ui, /new\s+MutationObserver\s*\(/, "UI guards must use explicit lifecycle events instead of watching the entire DOM");
for (const text of [
  "wed-audit-explain",
  "Запрос пояснений",
  "mon-tell-friend",
  "Дима Орлов",
  "tue-answer-admin-honest",
  "Роман Белов",
  "data-workflow-file-id",
  "repairDocumentActionButtons",
  "repairEndingNarrative",
  "repairWindowPositions",
  "choice-locked",
  "focus-exhausted",
  "workday-ended",
  "not-enough-time",
  "until-friday-state-change",
  "until-friday-ui-render",
  "queueAfterInteraction",
  "pointerType !== \"touch\"",
  "friday-ending-overlay",
  "setText"
]) {
  assert.match(ui, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `UI guard must cover: ${text}`);
}

const terminal = read("src/terminal-sync.js");
assert.doesNotThrow(() => new Function(terminal), "terminal synchronization must contain valid JavaScript");
for (const command of ["status", "day", "tasks", "actions", "logs", "run", "endday"]) {
  assert.match(terminal, new RegExp(`\\"${command}\\"`), `terminal synchronization must intercept ${command}`);
}
assert.match(terminal, /UntilFridayRuntimeEngine/, "terminal must read the shared runtime");
assert.match(terminal, /UntilFridayDayEndControl/, "terminal endday must use the reliable transition controller");
assert.match(terminal, /action\.channel !== "terminal"/, "terminal run must reject actions from other applications");
assert.doesNotMatch(terminal, /storageWritable|localStorage\.setItem|\.persist\(/, "terminal must not own storage or repeat runtime persistence");
assert.match(terminal, /event\.stopImmediatePropagation\(\)/, "old stale command handler must be bypassed");
assert.match(terminal, /UntilFridayProfile/, "terminal output must use the current player profile");
assert.match(terminal, /result\?\.ok/, "terminal time commands must respect atomic runtime failures");

const auto = read("src/auto-continue.js");
assert.doesNotThrow(() => new Function(auto), "automatic day continuation must contain valid JavaScript");
assert.match(auto, /until-friday-auto-continue-v1/);
assert.match(auto, /data-start-next/);
assert.match(auto, /data-recovered-start/);
assert.match(auto, /continue-after-transition/);
assert.match(auto, /window\.setTimeout\(clear, 5000\)/, "unused continuation markers must expire");
assert.match(auto, /sessionStorage\.removeItem/, "one-time continuation marker must be consumed");

const css = read("styles-v2.css");
assert.match(css, /@media \(max-width: 760px\)/, "window layout must contain a narrow-screen breakpoint");
assert.match(css, /width: calc\(100vw - 12px\) !important/, "application windows must fit narrow viewports");
assert.match(css, /height: calc\(100vh - var\(--taskbar-height\) - 12px\) !important/, "application windows must remain above the taskbar");
assert.match(css, /@media \(max-width: 430px\)/, "very narrow screens must receive an additional layout adjustment");

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
  "UI guards must subscribe after the extended interface and before app startup"
);

console.log("Runtime UI guard validation passed.");
