"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/runtime-engine.js"), "utf8");
assert.doesNotThrow(() => new Function(source));
assert.match(source, /lastNoticeKey/, "runtime must deduplicate by message identity");

let now = 1000;
const notifications = [];
function element() {
  return {
    type: "",
    className: "",
    textContent: "",
    children: [],
    append(...items) { this.children.push(...items); },
    addEventListener() {},
    remove() {}
  };
}

const container = { appendChild(item) { notifications.push(item); } };
const engineApi = { createEngine() { return {}; } };
const context = {
  UntilFridayEngine: engineApi,
  UNTIL_FRIDAY_STORY: {},
  UntilFridayRules: {},
  UntilFridayIntegrityFixes: {},
  UntilFridayTimeBoundaryGuard: {},
  UntilFridayMigration: { ENGINE_SAVE_KEY: "until-friday-save-v2" },
  Date: class FakeDate extends Date { static now() { return now; } },
  document: {
    querySelector(selector) { return selector === "#notifications" ? container : null; },
    createElement: element
  },
  localStorage: { setItem() {} },
  setTimeout() {},
  dispatchEvent() {},
  CustomEvent: class CustomEvent {},
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "runtime-engine.js" });

const runtime = context.UntilFridayRuntimeEngine;
assert.ok(runtime);
runtime.notify("Почта", "Первое письмо");
runtime.notify("Связь", "Второе сообщение");
runtime.notify("Связь", "Второе сообщение");
assert.equal(notifications.length, 2, "different simultaneous messages must both remain visible while exact duplicates collapse");

now += 801;
runtime.notify("Связь", "Второе сообщение");
assert.equal(notifications.length, 3, "the same message may be shown again after the duplicate window expires");

console.log("Runtime notification deduplication validation passed.");
