"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const gateSource = read("src/browser-state-render-gate.js");
const closeSource = read("src/browser-state-render-gate-close.js");
const directSource = read("src/browser-direct-site-navigation.js");

for (const [name, source] of [
  ["browser state gate", gateSource],
  ["browser state gate close", closeSource],
  ["direct browser site navigation", directSource]
]) {
  assert.doesNotThrow(() => new Function(source), `${name} must contain valid JavaScript`);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, `${name} must not add a DOM observer`);
}

const registered = new Map();
function originalAddEventListener(type, listener) {
  if (!registered.has(type)) registered.set(type, []);
  registered.get(type).push(listener);
}
const gateContext = {
  addEventListener: originalAddEventListener,
  console
};
gateContext.window = gateContext;
gateContext.globalThis = gateContext;
vm.runInNewContext(gateSource, gateContext, { filename: "browser-state-render-gate.js" });

let stateCalls = 0;
gateContext.addEventListener("until-friday-state-change", () => { stateCalls += 1; });
assert.notEqual(gateContext.addEventListener, originalAddEventListener, "gate must temporarily wrap browser listener registration");
const gatedListener = registered.get("until-friday-state-change")[0];
gatedListener({ detail: { reason: "time", events: [] } });
assert.equal(stateCalls, 0, "plain passive clock tick must not rerender browser modules");
gatedListener({ detail: { reason: "time", events: [{ id: "mail-arrived" }] } });
assert.equal(stateCalls, 0, "clock delivery events must not replace an open browser page");
gatedListener({ detail: { reason: "personal-browser-activity" } });
assert.equal(stateCalls, 1, "real browser state changes must still refresh site modules");

vm.runInNewContext(closeSource, gateContext, { filename: "browser-state-render-gate-close.js" });
assert.equal(gateContext.addEventListener, originalAddEventListener, "global listener registration must be restored after browser modules load");

assert.match(directSource, /\[data-rb-page=\"market\"\]/, "direct navigation must own Kupitut buttons");
assert.match(directSource, /\[data-rb-page=\"video\"\]/, "direct navigation must own VideoLenta buttons");
assert.match(directSource, /pageFromAddress/, "history and address bar routes must resolve deterministically");
assert.match(directSource, /stopImmediatePropagation/, "old local market and video renderers must be bypassed for those two buttons");
assert.doesNotMatch(directSource, /closest\?\.\(\"\.personal-browser-window\"\)/, "blank clicks inside the browser must not schedule a site render");

const index = read("index.html");
for (const file of [
  "src/browser-state-render-gate.js",
  "src/browser-direct-site-navigation.js",
  "src/browser-state-render-gate-close.js"
]) {
  assert.match(index, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} must be connected`);
}
for (const obsolete of [
  "src/browser-site-router.js",
  "src/video-route-hardener.js",
  "src/personal-browser-diegetic-guard.js"
]) {
  assert.doesNotMatch(index, new RegExp(obsolete.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${obsolete} must stay disconnected`);
}
assert.ok(
  index.indexOf("src/window-layout.js") < index.indexOf("src/browser-state-render-gate.js") &&
  index.indexOf("src/browser-state-render-gate.js") < index.indexOf("src/personal-browser.js") &&
  index.indexOf("src/video-platform-runtime-fixes.js") < index.indexOf("src/browser-direct-site-navigation.js") &&
  index.indexOf("src/browser-direct-site-navigation.js") < index.indexOf("src/browser-state-render-gate-close.js") &&
  index.indexOf("src/browser-state-render-gate-close.js") < index.indexOf("src/ui-runtime-guards.js"),
  "passive-time gate must wrap browser modules and close only after direct site navigation is installed"
);

console.log("Browser passive-clock stability and direct site routing validation passed.");
