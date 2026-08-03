"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

for (const file of [
  "src/rules-extension.js",
  "src/integrity-fixes.js",
  "src/time-boundary-guard.js",
  "src/passive-clock.js",
  "src/day-transition-guard.js",
  "src/persistent-engine-guard.js"
]) {
  const source = read(file);
  assert.doesNotThrow(() => new Function(source), `${file} must contain valid JavaScript`);
  assert.doesNotMatch(source, /Engine\.createEngine\s*=/, `${file} must not replace the engine factory`);
}

const runtimeSource = read("src/runtime-engine.js");
assert.doesNotThrow(() => new Function(runtimeSource));
assert.equal(
  (runtimeSource.match(/Engine\.createEngine\s*=/g) || []).length,
  1,
  "the unified runtime must replace the engine factory exactly once"
);
assert.match(runtimeSource, /until-friday-state-change/, "runtime must publish one state-change channel");
assert.match(runtimeSource, /replaceState/, "runtime must support explicit rollback without replacing wrappers");

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelector: () => null, createElement: () => null };
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => {};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) { this.type = type; this.detail = options?.detail; }
};

globalThis.UntilFridayEngine = require("../src/engine.js");
globalThis.UNTIL_FRIDAY_STORY = require("../src/story-v2.js");
globalThis.UntilFridayMigration = { ENGINE_SAVE_KEY: "until-friday-save-v2" };
const Engine = globalThis.UntilFridayEngine;
const baseFactory = Engine.createEngine;

require("../src/rules-extension.js");
require("../src/integrity-fixes.js");
require("../src/time-boundary-guard.js");
assert.equal(Engine.createEngine, baseFactory, "pure rule modules must leave the base factory untouched");

require("../src/runtime-engine.js");
const runtimeFactory = Engine.createEngine;
assert.notEqual(runtimeFactory, baseFactory, "the unified runtime must install the only replacement factory");
require("../src/persistent-engine-guard.js");
assert.equal(Engine.createEngine, runtimeFactory, "compatibility facades must not replace the runtime factory");

const engine = Engine.createEngine(globalThis.UNTIL_FRIDAY_STORY, null, {
  seed: "runtime-architecture",
  truthId: "player"
});
assert.equal(globalThis.UntilFridayRuntimeEngine.getEngine(), engine);
assert.equal(globalThis.UntilFridayPersistentEngineGuard.getEngine(), engine);
assert.equal(engine.startDay().ok, true);
assert.equal(engine.applyAction("mon-report-final").ok, true);
assert.equal(engine.canApplyAction("mon-report-old").reason, "choice-locked");

const hubSource = read("src/ui-observer-hub.js");
assert.doesNotThrow(() => new Function(hubSource));
let nativeCount = 0;
let nativeCallback = null;
const target = {
  contains(node) { return node === this || node?.parent === this; }
};
class FakeNativeObserver {
  constructor(callback) {
    nativeCount += 1;
    nativeCallback = callback;
  }
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}
const observerContext = {
  MutationObserver: FakeNativeObserver,
  document: { documentElement: target, addEventListener() {} },
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback) => callback(),
  console
};
observerContext.globalThis = observerContext;
vm.runInNewContext(hubSource, observerContext, { filename: "ui-observer-hub.js" });

let firstCalls = 0;
let secondCalls = 0;
const first = new observerContext.MutationObserver(() => { firstCalls += 1; });
const second = new observerContext.MutationObserver(() => { secondCalls += 1; });
first.observe(target, { childList: true, subtree: true });
second.observe(target, { childList: true, subtree: true });
assert.equal(nativeCount, 1, "all virtual observers must share one native observer");

nativeCallback([{ type: "childList", target }]);
assert.equal(firstCalls, 1);
assert.equal(secondCalls, 1);
second.disconnect();
nativeCallback([{ type: "childList", target }]);
assert.equal(firstCalls, 2);
assert.equal(secondCalls, 1, "disconnected subscribers must stop receiving records");
assert.equal(observerContext.UntilFridayUiObserverHub.stats().nativeObservers, 1);

const html = read("index.html");
assert.ok(
  html.indexOf("src/time-boundary-guard.js") < html.indexOf("src/runtime-engine.js") &&
  html.indexOf("src/runtime-engine.js") < html.indexOf("src/ui-observer-hub.js") &&
  html.indexOf("src/ui-observer-hub.js") < html.indexOf("src/passive-clock.js"),
  "helpers, runtime, observer hub and consumers must load in a fixed order"
);

console.log("Unified runtime architecture validation passed.");
