"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/min-desktop-integration.js"), "utf8");
const storage = new Map();
const listeners = new Map();
const frames = [];
const key = "until-friday-min-messenger-v1";
let writes = 0;
let mounts = 0;
let game = { seed: "week-a", dayIndex: 0, minute: 527, completedActions: {}, deliveredEvents: ["hello"] };
const clone = (value) => JSON.parse(JSON.stringify(value));
const classes = () => ({ add() {}, remove() {}, contains() { return false; } });
const content = { querySelector() { return null; } };
const windowElement = {
  dataset: {}, style: {}, classList: classes(), isConnected: false,
  querySelector(selector) { return selector === ".window-content" ? content : { textContent: "" }; },
  addEventListener() {}, remove() { this.isConnected = false; }
};
const document = {
  addEventListener() {},
  querySelectorAll() { return []; },
  querySelector(selector) {
    if (selector === "#window-template") return { content: { firstElementChild: { cloneNode: () => windowElement } } };
    if (selector === "#windows-layer") return { appendChild(element) { element.isConnected = true; } };
    if (selector === "#task-buttons") return { appendChild() {} };
    return null;
  },
  createElement() { return { dataset: {}, classList: classes(), addEventListener() {}, remove() {} }; }
};
const Min = {
  STORAGE_KEY: key,
  normalize(raw) { return { users: [], chats: [], messages: [], contacts: [], drafts: {}, ...clone(raw) }; },
  getState() { return JSON.parse(storage.get(key) || "{}"); },
  unreadCount() { return 0; },
  mount() { mounts += 1; return () => {}; }
};
const context = {
  document, console, UntilFridayMinMessenger: Min,
  UntilFridayRuntimeEngine: { getEngine: () => ({ getState: () => clone(game), listActions: () => [] }) },
  UNTIL_FRIDAY_STORY: { actions: {}, events: { hello: { id: "hello", type: "chat", source: "Дима Орлов", text: "Доброе утро", minute: 527 } } },
  localStorage: {
    getItem: (name) => storage.get(name) || null,
    setItem(name, value) { writes += 1; storage.set(name, value); }
  },
  sessionStorage: { getItem() { return null; }, setItem() {} },
  requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
  setTimeout(callback) { frames.push(callback); },
  addEventListener(type, handler) { const list = listeners.get(type) || []; list.push(handler); listeners.set(type, list); },
  dispatchEvent(event) { for (const handler of listeners.get(event.type) || []) handler(event); },
  StorageEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
};
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.UntilFridayMinDesktopIntegration;
const flush = () => { while (frames.length) frames.shift()(); };
api.openMin();
flush();
assert.equal(mounts, 1);
const initialWrites = writes;
for (let i = 0; i < 20; i += 1) {
  game.minute += 1;
  context.dispatchEvent(new context.CustomEvent("until-friday-state-change", { detail: { reason: "time", state: clone(game) } }));
  flush();
}
assert.equal(mounts, 1, "twenty clock ticks must not rebuild an open messenger");
assert.equal(writes, initialWrites, "clock ticks must not rewrite unchanged message storage");
api.openMin();
flush();
assert.equal(mounts, 1, "focusing an existing messenger must not rebuild its form");

const minState = Min.getState();
minState.messages.push({ id: "personal", chatId: "personal-chat", text: "Личное сообщение" });
minState.drafts["work-chat-dima"] = "Недописанный ответ";
storage.set(key, JSON.stringify(minState));
game = { ...game, seed: "week-b", deliveredEvents: [] };
api.syncStoryMessages();
assert.equal(Min.getState().messages.some((message) => message.storySourceId === "hello"), false, "a new week must not leak previous story messages");
assert.equal(Min.getState().messages.some((message) => message.id === "personal"), true, "new game must preserve unrelated real conversations");
assert.equal(Min.getState().drafts["work-chat-dima"], undefined, "work drafts must belong to one week");
storage.set(key, JSON.stringify(Min.normalize({})));
api.syncStoryMessages();
assert.ok(Min.getState().chats.some((chat) => chat.id === "work-chat-dima"), "resetting MIN must restore the current week's work contacts");
console.log("MIN clock, focus and new-week performance regressions passed.");
