"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/min-messenger-ui-fixes.js");

assert.doesNotThrow(() => new Function(source), "MIN UI fixes module must parse");
for (const phrase of [
  "data-min-folder-add",
  "data-min-custom-folder",
  "chatIds",
  "createFolder",
  "reorderFolders",
  "pointerdown",
  "pointermove",
  "pointerup",
  "420",
  "img.icons8.com/fluency",
  "data-min-reaction",
  "MutationObserver"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `UI fixes must contain: ${phrase}`);
}

const storage = new Map();
const initialState = {
  version: 1,
  profile: { id: "self", name: "Денис", username: "denis", avatarColor: "#5b7fca" },
  users: [],
  chats: [
    { id: "chat-a", type: "private", title: "Лена", archived: false, color: "#d65d86" },
    { id: "chat-b", type: "group", title: "Работа", archived: false, color: "#7555a6" },
    { id: "chat-c", type: "channel", title: "Новости", archived: true, color: "#555f68" }
  ],
  messages: [],
  contacts: [],
  drafts: {},
  folders: [
    { id: "all", title: "Все", types: [] },
    { id: "unread", title: "Непрочитанные", unreadOnly: true },
    { id: "personal", title: "Личные", types: ["private"] },
    { id: "groups", title: "Группы", types: ["group"] },
    { id: "channels", title: "Каналы", types: ["channel"] }
  ],
  settings: {},
  calls: []
};
storage.set("until-friday-min-messenger-v1", JSON.stringify(initialState));

const classList = { add() {}, remove() {} };
const document = {
  documentElement: {},
  body: { classList },
  addEventListener() {},
  querySelectorAll() { return []; },
  querySelector() { return null; },
  elementFromPoint() { return null; },
  createElement() { return { className: "", dataset: {}, innerHTML: "", appendChild() {} }; }
};
const localStorage = {
  getItem(key) { return storage.get(key) || null; },
  setItem(key, value) { storage.set(key, String(value)); }
};
const min = {
  STORAGE_KEY: "until-friday-min-messenger-v1",
  normalize(value) { return JSON.parse(JSON.stringify(value)); },
  getState() { return JSON.parse(storage.get(this.STORAGE_KEY)); }
};
const context = {
  UntilFridayMinMessenger: min,
  document,
  localStorage,
  location: { href: "https://example.test/" },
  crypto: { randomUUID: (() => { let index = 0; return () => `uuid-${++index}`; })() },
  MutationObserver: class MutationObserver { constructor(callback) { this.callback = callback; } observe() {} },
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  Event: class Event { constructor(type) { this.type = type; } },
  StorageEvent: undefined,
  addEventListener() {},
  dispatchEvent() {},
  requestAnimationFrame(callback) { callback(); },
  setTimeout,
  clearTimeout,
  Date,
  Math,
  JSON,
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "min-messenger-ui-fixes.js" });

const api = context.UntilFridayMinUIFixes;
assert.ok(api, "MIN UI fixes API must be exported");
assert.equal(api.REACTIONS.length, 6);

let result = api.createFolder("", ["chat-a"]);
assert.equal(result.ok, false);
assert.equal(result.reason, "empty-title");
result = api.createFolder("Работа", []);
assert.equal(result.ok, false);
assert.equal(result.reason, "empty-folder");
result = api.createFolder("Работа", ["chat-a", "chat-b", "chat-a", "chat-c"]);
assert.equal(result.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(result.folder.chatIds)), ["chat-a", "chat-b"], "archived and duplicate chats must be removed");
assert.equal(result.folder.custom, true);

const second = api.createFolder("Новости", ["chat-b"]);
assert.equal(second.ok, true);
const order = api.reorderFolders([second.folder.id, result.folder.id]);
assert.deepEqual(JSON.parse(JSON.stringify(order)), [second.folder.id, result.folder.id]);
const persisted = JSON.parse(storage.get(min.STORAGE_KEY));
assert.deepEqual(
  persisted.folders.slice(-2).map((folder) => folder.id),
  [second.folder.id, result.folder.id],
  "custom folder order must persist after long-press drag"
);
assert.equal(persisted.folders[0].id, "all", "system folders must stay fixed before custom folders");

const css = read("min-messenger-ui-fixes.css");
for (const phrase of [
  ".min-reactions{position:static!important",
  ".min-contact-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important",
  ".min-services{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))!important",
  ".min-folder-add",
  ".min-folder-modal-backdrop",
  ".min-folders [data-min-custom-folder].dragging",
  ".min-chat-items [hidden]"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `UI fixes stylesheet must contain: ${phrase}`);
}

const html = read("index.html");
assert.match(html, /min-messenger-ui-fixes\.css\?v=20260804-11/);
assert.match(html, /src\/min-messenger-ui-fixes\.js\?v=20260804-11/);
assert.ok(
  html.indexOf("src/min-messenger.js") < html.indexOf("src/min-messenger-ui-fixes.js") &&
  html.indexOf("src/min-messenger-ui-fixes.js") < html.indexOf("src/min-desktop-integration.js"),
  "MIN UI fixes must load after the messenger and before desktop integration"
);

console.log("MIN reactions, responsive cards and custom folder validation passed.");
