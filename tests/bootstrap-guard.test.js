"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../src/bootstrap.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "bootstrap must contain valid JavaScript");
assert.doesNotMatch(source, /window\.addEventListener\("error"/, "unrelated page errors must not trigger the legacy interface");
assert.match(source, /if \(fallbackStarted\) return;/, "v2 load completion must stop after legacy fallback starts");
assert.match(source, /v2-did-not-signal-ready/, "fallback must still start when app-v2 fails to initialize");
assert.match(source, /v2-script-load-error/, "fallback must still start when app-v2 cannot be loaded");
assert.match(source, /!v2LoadFinished && !fallbackStarted/, "onboarding completion must not start the game twice");

console.log("Bootstrap exclusivity validation passed.");
