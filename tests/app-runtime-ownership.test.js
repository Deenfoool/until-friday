"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/app-v2.js");

assert.doesNotThrow(() => new Function(source), "app-v2 must contain valid JavaScript");
assert.match(source, /const RuntimeEngine = window\.UntilFridayRuntimeEngine;/, "the app must depend on the unified runtime");
assert.doesNotMatch(source, /localStorage\.setItem\(SAVE_KEY/, "the app must never write the engine save directly");
assert.match(source, /RuntimeEngine\.persist\(gameState\)/, "manual save must delegate to the runtime");
assert.match(source, /engine\.updateState\([\s\S]*introCompleted = true/, "intro completion must use an atomic runtime state update");
assert.match(source, /const result = engine\.startDay\(\);/, "day start must use the atomic runtime command");
assert.match(source, /const result = engine\.applyAction\(actionId\);/, "story actions must use the atomic runtime command");
assert.match(source, /const result = engine\.advanceTime\(minutes\);/, "interactive time must use the atomic runtime command");
assert.match(source, /const result = engine\.endDay\(\);/, "day transitions must use the atomic runtime command");
assert.match(source, /until-friday-ui-render/, "the app must publish an explicit render lifecycle event");
assert.match(source, /until-friday-state-change/, "the app must synchronize its view model from confirmed runtime state");

const performAction = source.slice(source.indexOf("function performAction"), source.indexOf("function actionErrorText"));
assert.doesNotMatch(performAction, /localStorage|persist\(/, "successful actions must not be saved twice by the app");
const advanceTime = source.slice(source.indexOf("function advanceTime"), source.indexOf("function deliverEvents"));
assert.doesNotMatch(advanceTime, /localStorage|persist\(/, "interactive time must not be saved twice by the app");
const finishDay = source.slice(source.indexOf("function finishDay"), source.indexOf("function showEnding"));
assert.doesNotMatch(finishDay, /localStorage|persist\(/, "day transitions must not be saved twice by the app");
const ensureDayStarted = source.slice(source.indexOf("function ensureDayStarted"), source.indexOf("function bindGlobalControls"));
assert.doesNotMatch(ensureDayStarted, /localStorage|persist\(/, "day start must not be saved twice by the app");

for (const reason of [
  "choice-locked",
  "focus-exhausted",
  "workday-ended",
  "not-enough-time",
  "save-failed",
  "action-exception",
  "time-exception",
  "transition-exception"
]) {
  assert.match(source, new RegExp(`\\"${reason}\\"`), `the app must explain runtime failure: ${reason}`);
}

const runtime = read("src/runtime-engine.js");
assert.match(runtime, /function updateState\(/, "the runtime must expose atomic metadata updates");
assert.match(runtime, /Рабочий день не сохранён/, "day start save failures must be visible");
assert.match(runtime, /state-update-exception/, "metadata updater exceptions must be contained");
assert.match(runtime, /updateState,/, "atomic metadata updates must be part of the engine API");

console.log("Application runtime ownership validation passed.");
