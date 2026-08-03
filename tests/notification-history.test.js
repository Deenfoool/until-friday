"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/notification-history-guard.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "notification history guard must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, "notification history must use state and startup lifecycle events");
assert.match(source, /until-friday-state-change/, "new inbox events must trigger duplicate inspection");
assert.match(source, /until-friday-app-ready/, "restored inbox notifications must be inspected after startup");
assert.match(source, /until-friday-ui-render/, "notification inspection must follow completed UI rendering");

const storage = new Map();
storage.set("until-friday-save-v2", JSON.stringify({
  seed: "week-a",
  inbox: [{ id: "mail-a", source: "Дима Орлов", text: "Сообщение уже показано." }]
}));

const notifications = [];
const listeners = new Map();
const documentStub = {
  documentElement: {},
  addEventListener() {},
  querySelectorAll() { return notifications.filter((item) => !item.removed); }
};
const context = {
  UntilFridayMigration: { ENGINE_SAVE_KEY: "until-friday-save-v2" },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  document: documentStub,
  queueMicrotask: (callback) => callback(),
  addEventListener(type, callback) { listeners.set(type, callback); },
  console,
  Promise
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "notification-history-guard.js" });

const api = context.UntilFridayNotificationHistoryGuard;
assert.ok(api, "notification history API must be exported");
assert.ok(listeners.has("until-friday-state-change"), "state lifecycle listener must be registered");
assert.ok(listeners.has("until-friday-app-ready"), "startup lifecycle listener must be registered");

function notification(sourceText, bodyText) {
  return {
    dataset: {},
    removed: false,
    matches: (selector) => selector === ".notification",
    querySelector(selector) {
      if (selector === "strong") return { textContent: sourceText };
      if (selector === "span") return { textContent: bodyText };
      return null;
    },
    remove() { this.removed = true; }
  };
}

const first = notification("Дима Орлов", "Сообщение уже показано.");
api.inspectNotification(first);
assert.equal(first.removed, false, "a newly delivered message must remain visible");
let history = JSON.parse(storage.get("until-friday-notification-history-v1"));
assert.deepEqual(history.ids, ["mail-a"]);

const repeated = notification("Дима Орлов", "Сообщение уже показано.");
api.inspectNotification(repeated);
assert.equal(repeated.removed, true, "the same inbox message must be suppressed after reload");

storage.set("until-friday-save-v2", JSON.stringify({
  seed: "week-b",
  inbox: [{ id: "mail-a", source: "Дима Орлов", text: "Сообщение уже показано." }]
}));
const newWeek = notification("Дима Орлов", "Сообщение уже показано.");
api.inspectNotification(newWeek);
assert.equal(newWeek.removed, false, "a new game seed must start a clean notification history");
history = JSON.parse(storage.get("until-friday-notification-history-v1"));
assert.equal(history.seed, "week-b");

const unrelated = notification("Система", "Прогресс сохранён.");
api.inspectNotification(unrelated);
assert.equal(unrelated.removed, false, "ordinary system toasts must not be mistaken for inbox events");

const queued = notification("Дима Орлов", "Сообщение уже показано.");
notifications.push(queued);
listeners.get("until-friday-state-change")();
assert.equal(queued.removed, true, "state lifecycle inspection must suppress an already seen inbox toast");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /src\/notification-history-guard\.js/);
assert.ok(
  html.indexOf("src/storage-error-guard.js") < html.indexOf("src/notification-history-guard.js") &&
  html.indexOf("src/notification-history-guard.js") < html.indexOf("src/bootstrap.js"),
  "notification history must subscribe before application startup"
);

console.log("Notification history validation passed.");
