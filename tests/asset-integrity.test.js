"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/manifest.json"), "utf8"));
assert.equal(manifest.version, 2);
assert.equal(manifest.assets.length, 40, "asset manifest must retain all forty prompts");

const manifestPaths = new Set();
for (const asset of manifest.assets) {
  if (asset.generated) {
    assert.equal(asset.path, "programmatic://loading-indicator");
    assert.ok(fs.existsSync(path.join(root, asset.source)), `missing generated asset source: ${asset.source}`);
    continue;
  }

  assert.ok(asset.path.startsWith("assets/"), `invalid manifest path: ${asset.path}`);
  assert.ok(!manifestPaths.has(asset.path), `duplicate manifest path: ${asset.path}`);
  manifestPaths.add(asset.path);
  const absolute = path.join(root, asset.path);
  assert.ok(fs.existsSync(absolute), `missing asset: ${asset.path}`);
  assert.ok(fs.statSync(absolute).size > 32, `empty or truncated asset: ${asset.path}`);
}

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute));
    else result.push(absolute);
  }
  return result;
}

const runtimeFiles = [
  path.join(root, "index.html"),
  ...fs.readdirSync(root)
    .filter((name) => name.endsWith(".css"))
    .map((name) => path.join(root, name)),
  ...walk(path.join(root, "src")).filter((file) => file.endsWith(".js"))
];

const referenced = new Map();
const assetPattern = /assets\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp)/gi;
for (const file of runtimeFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(assetPattern)) {
    const assetPath = match[0];
    const users = referenced.get(assetPath) || [];
    users.push(path.relative(root, file));
    referenced.set(assetPath, users);
  }
}

for (const [assetPath, users] of referenced) {
  const absolute = path.join(root, assetPath);
  assert.ok(fs.existsSync(absolute), `broken runtime asset reference ${assetPath} in ${users.join(", ")}`);
  assert.ok(fs.statSync(absolute).size > 32, `runtime asset is empty: ${assetPath}`);
}

const registry = fs.readFileSync(path.join(root, "src/asset-registry.js"), "utf8");
for (const asset of manifest.assets.filter((item) => !item.generated)) {
  assert.match(
    registry,
    new RegExp(asset.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `asset registry does not expose manifest file: ${asset.path}`
  );
}

assert.ok(referenced.size >= 10, "runtime asset scan unexpectedly found too few references");
console.log(`Asset integrity validated: ${manifestPaths.size} files, ${referenced.size} runtime references.`);
