"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/notification-history-guard.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "notification history guard must contain valid JavaScript");
assert.match(source, /MutationObserver/, "notification history must inspect toasts added after state events");
assert.match(source, /until-friday-state-change/, "new inbox events must trigger duplicate inspection");
assert.match(source, /until-friday-app-ready/, "restored inbox notifications must be inspected after startup");
assert.match(source, /until-friday-ui-render/, "notification inspection must follow completed UI rendering");
assert.match(source, /belongsInsideApp/, "app-owned messages must be filtered from desktop notifications");

const storage = new Map();
storage.set("until-friday-save-v2", JSON.stringify({
  seed: "week-a",
  inbox: [{ id: "mail-a", type: "mail", source: "Дима Орлов", text: "Сообщение уже показано." }]
}));

const notifications = [];
const listeners = new Map();
const notificationsContainer = {};
let observerCallback = null;
let observedTarget = null;
let observedOptions = null;

const documentStub = {
  documentElement: {},
  addEventListener() {},
  querySelector(selector) {
    return selector === "#notifications" ? notificationsContainer : null;
  },
  querySelectorAll() {
    return notifications.filter((item) => !item.removed);
  }
};

class MutationObserverStub {
  constructor(callback) {
    observerCallback = callback;
  }

  observe(target, options) {
    observedTarget = target;
    observedOptions = options;
  }

  disconnect() {}
}

const context = {
  UntilFridayMigration: { ENGINE_SAVE_KEY: "until-friday-save-v2" },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  document: documentStub,
  MutationObserver: MutationObserverStub,
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
assert.equal(observedTarget, notificationsContainer, "desktop notification container must be observed");
assert.deepEqual(observedOptions, { childList: true, subtree: true });
assert.equal(api.belongsInsideApp({ type: "chat" }), true, "chat messages belong inside MIN");
assert.equal(api.belongsInsideApp({ type: "mail" }), false, "mail messages may use desktop notifications");

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
    querySelectorAll() { return []; },
    remove() { this.removed = true; }
  };
}

const first = notification("Дима Орлов", "Сообщение уже показано.");
api.inspectNotification(first);
assert.equal(first.removed, false, "a newly delivered non-chat message must remain visible");
let history = JSON.parse(storage.get("until-friday-notification-history-v1"));
assert.deepEqual(history.ids, ["mail-a"]);

const repeated = notification("Дима Орлов", "Сообщение уже показано.");
api.inspectNotification(repeated);
assert.equal(repeated.removed, true, "the same inbox message must be suppressed after reload");

const chatText = "Я и не собирался рассказывать. Но если начнут спрашивать напрямую, врать за тебя не буду.";
storage.set("until-friday-save-v2", JSON.stringify({
  seed: "week-chat",
  inbox: [{
    id: "mon-friend-reply-silence",
    type: "chat",
    source: "Дима Орлов",
    text: chatText
  }]
}));
const chatToast = notification("Дима Орлов", chatText);
observerCallback([{ addedNodes: [chatToast] }]);
assert.equal(chatToast.removed, true, "a MIN chat toast must be removed immediately after DOM insertion");

storage.set("until-friday-save-v2", JSON.stringify({
  seed: "week-system",
  inbox: []
}));
const systemToast = notification("Система", "Прогресс сохранён.");
observerCallback([{ addedNodes: [systemToast] }]);
assert.equal(systemToast.removed, false, "ordinary system toasts must remain visible");

storage.set("until-friday-save-v2", JSON.stringify({
  seed: "week-b",
  inbox: [{ id: "mail-a", type: "mail", source: "Дима Орлов", text: "Сообщение уже показано." }]
}));
const newWeek = notification("Дима Орлов", "Сообщение уже показано.");
api.inspectNotification(newWeek);
assert.equal(newWeek.removed, false, "a new game seed must start a clean notification history");
history = JSON.parse(storage.get("until-friday-notification-history-v1"));
assert.equal(history.seed, "week-b");

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
