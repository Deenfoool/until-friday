"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const source = read("src/friday-ending-reopen.js");
assert.doesNotThrow(() => new Function(source), "Friday ending reopen helper must contain valid JavaScript");
assert.match(source, /until-friday-ending-snapshot-v1/, "enhanced ending must be cached for the current session");
assert.match(source, /restoreBasicEnding/, "basic ending must be replaceable after reopening");
assert.match(source, /stopImmediatePropagation/, "cancelled restart must not erase Friday scene data early");
assert.match(source, /data-journal/, "journal navigation must preserve the enhanced ending");

const html = read("index.html");
assert.match(html, /src\/friday-ending-reopen\.js/, "ending reopen helper must be connected");
assert.ok(
  html.indexOf("src/friday-finale.js") < html.indexOf("src/friday-ending-reopen.js") &&
  html.indexOf("src/friday-ending-reopen.js") < html.indexOf("src/bootstrap.js"),
  "ending reopen helper must load after the finale and before bootstrap"
);

console.log("Friday ending reopen validation passed.");
