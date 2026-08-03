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
  "src/state-migration.js"
];

for (const file of scripts) {
  const source = read(file);
  assert.doesNotThrow(() => new Function(source), `${file} must contain valid JavaScript`);
}

const html = read("index.html");
assert.match(html, /styles-v2\.css/, "v2 styles must be connected");
assert.match(html, /src\/bootstrap\.js/, "v2 bootstrap must be connected");
assert.doesNotMatch(html, /<script src="src\/app\.js"><\/script>/, "legacy app must not boot in parallel");

const enginePosition = html.indexOf("src/engine.js");
const storyPosition = html.indexOf("src/story-v2.js");
const rulesPosition = html.indexOf("src/rules-extension.js");
const migrationPosition = html.indexOf("src/state-migration.js");
const bootstrapPosition = html.indexOf("src/bootstrap.js");
assert.ok(enginePosition < storyPosition, "engine must load before story");
assert.ok(storyPosition < rulesPosition, "story must load before rule extensions");
assert.ok(rulesPosition < migrationPosition, "rules must load before save migration and UI creation");
assert.ok(migrationPosition < bootstrapPosition, "migration must load before bootstrap");

const app = read("src/app-v2.js");
for (const requiredApp of ["explorer", "mail", "chat", "tasks", "terminal", "journal", "trash"]) {
  assert.match(app, new RegExp(`id: \\"${requiredApp}\\"`), `${requiredApp} app must be registered`);
}
assert.match(app, /engine\.endDay\(\)/, "UI must support day transitions");
assert.match(app, /engine\.applyAction\(actionId\)/, "UI must route choices through the engine");
assert.match(app, /showEnding\(/, "UI must render an ending");

console.log("UI contract validation passed.");
