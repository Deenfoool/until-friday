"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/workflow-reset.js");
assert.doesNotThrow(() => new Function(source), "reset guard must contain valid JavaScript");
assert.doesNotMatch(source, /beforeunload/, "reset must not rely on uncertain unload timing");
assert.doesNotMatch(source, /setTimeout/, "reset intent must not expire before confirmation");

const local = new Map();
const session = new Map();
const gameKeys = [
  "until-friday-save-v2",
  "until-friday-save-v1",
  "until-friday-intro-v2",
  "until-friday-workflow-files-v1",
  "until-friday-profile-v1",
  "until-friday-return-welcome-v1",
  "until-friday-friday-scene-v1",
  "until-friday-notification-history-v1"
];
const sessionKeys = ["until-friday-ending-snapshot-v1", "until-friday-auto-continue-v1"];
for (const key of gameKeys) local.set(key, "game-data");
for (const key of sessionKeys) session.set(key, "session-data");
local.set("until-friday-settings-v1", "keep-settings");

let clickHandler = null;
let confirmResult = false;
let reloads = 0;
const context = {
  document: {
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    }
  },
  localStorage: {
    getItem: (key) => local.get(key) || null,
    setItem: (key, value) => local.set(key, String(value)),
    removeItem: (key) => local.delete(key)
  },
  sessionStorage: {
    getItem: (key) => session.get(key) || null,
    setItem: (key, value) => session.set(key, String(value)),
    removeItem: (key) => session.delete(key)
  },
  confirm: () => confirmResult,
  location: { reload: () => { reloads += 1; } },
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "workflow-reset.js" });
assert.ok(context.UntilFridayResetGuard, "reset API must be exported");
assert.equal(typeof clickHandler, "function");

function resetClick() {
  let prevented = false;
  let stopped = false;
  clickHandler({
    target: { closest: (selector) => selector === "#reset-button" ? {} : null },
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
    stopImmediatePropagation: () => { stopped = true; }
  });
  return { prevented, stopped };
}

confirmResult = false;
const cancelled = resetClick();
assert.equal(cancelled.prevented, true);
assert.equal(cancelled.stopped, true);
assert.equal(reloads, 0);
for (const key of gameKeys) assert.equal(local.get(key), "game-data", `cancelled reset must preserve ${key}`);

confirmResult = true;
resetClick();
assert.equal(reloads, 1, "confirmed reset must reload exactly once");
for (const key of gameKeys) assert.equal(local.has(key), false, `confirmed reset must remove ${key}`);
for (const key of sessionKeys) assert.equal(session.has(key), false, `confirmed reset must remove ${key}`);
assert.equal(local.get("until-friday-settings-v1"), "keep-settings", "display and text settings must survive a new game");

const fridaySource = read("src/friday-reset.js");
assert.doesNotThrow(() => new Function(fridaySource));
assert.doesNotMatch(fridaySource, /beforeunload/);
assert.match(fridaySource, /until-friday-notification-history-v1/);
assert.match(fridaySource, /until-friday-auto-continue-v1/);
assert.match(fridaySource, /data-new-game/);

const html = read("index.html");
assert.ok(
  html.indexOf("src/workflow-reset.js") < html.indexOf("src/friday-reset.js") &&
  html.indexOf("src/friday-reset.js") < html.indexOf("src/bootstrap.js"),
  "reset guards must load before the application"
);

console.log("Deterministic reset validation passed.");
