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
  "src/loading-indicator.js"
];

for (const file of scripts) {
  const source = read(file);
  assert.doesNotThrow(() => new Function(source), `${file} must contain valid JavaScript`);
}

const html = read("index.html");
assert.match(html, /styles-v2\.css/, "v2 styles must be connected");
assert.match(html, /src\/bootstrap\.js/, "v2 bootstrap must be connected");
assert.match(html, /src\/asset-registry\.js/, "asset registry must be connected");
assert.match(html, /src\/loading-indicator\.js/, "programmatic loading indicator must be connected");
assert.doesNotMatch(html, /<script src="src\/app\.js"><\/script>/, "legacy app must not boot in parallel");

const enginePosition = html.indexOf("src/engine.js");
const storyPosition = html.indexOf("src/story-v2.js");
const rulesPosition = html.indexOf("src/rules-extension.js");
const migrationPosition = html.indexOf("src/state-migration.js");
const assetsPosition = html.indexOf("src/asset-registry.js");
const loadingPosition = html.indexOf("src/loading-indicator.js");
const bootstrapPosition = html.indexOf("src/bootstrap.js");
assert.ok(enginePosition < storyPosition, "engine must load before story");
assert.ok(storyPosition < rulesPosition, "story must load before rule extensions");
assert.ok(rulesPosition < migrationPosition, "rules must load before save migration and UI creation");
assert.ok(migrationPosition < assetsPosition, "migration must load before asset decoration");
assert.ok(assetsPosition < loadingPosition, "asset registry must load before the loader");
assert.ok(loadingPosition < bootstrapPosition, "loader must exist before application bootstrap");

const app = read("src/app-v2.js");
for (const requiredApp of ["explorer", "mail", "chat", "tasks", "terminal", "journal", "trash"]) {
  assert.match(app, new RegExp(`id: \\"${requiredApp}\\"`), `${requiredApp} app must be registered`);
}
assert.match(app, /engine\.endDay\(\)/, "UI must support day transitions");
assert.match(app, /engine\.applyAction\(actionId\)/, "UI must route choices through the engine");
assert.match(app, /showEnding\(/, "UI must render an ending");

const loader = read("src/loading-indicator.js");
assert.match(loader, /const SEGMENT_COUNT = 12;/, "loader must build twelve segments programmatically");
assert.match(loader, /createElement\("span"\)/, "loader segments must be created through JavaScript");
assert.doesNotMatch(loader, /loading\.png/, "loader must not depend on an image sprite");

const loaderStyles = read("styles-v2.css");
assert.match(loaderStyles, /until-friday-spinner-pulse/, "loader animation must be defined in CSS");
assert.match(loaderStyles, /programmatic-spinner__segment/, "loader segment styling must exist");

const assetRegistry = read("src/asset-registry.js");
assert.doesNotMatch(assetRegistry, /assets\/sprites\/loading\.png/, "asset registry must not request a loading sprite");

const manifest = JSON.parse(read("assets/manifest.json"));
assert.equal(manifest.assets.length, 40, "all forty prompts must remain documented");
assert.equal(new Set(manifest.assets.map((item) => item.prompt)).size, 40, "prompt numbers must be unique");
assert.equal(new Set(manifest.assets.map((item) => item.path)).size, 40, "asset paths must be unique");
const generatedLoading = manifest.assets.find((item) => item.prompt === 37);
assert.equal(generatedLoading.generated, true, "prompt 37 must be marked as generated");
assert.equal(generatedLoading.source, "src/loading-indicator.js", "prompt 37 must point to its programmatic source");
assert.doesNotMatch(generatedLoading.path, /\.png$/i, "prompt 37 must not require a PNG file");

console.log("UI contract validation passed.");
