"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(rootDir, "src/min-workspace.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "MIN workspace extension must contain valid JavaScript");

const storage = new Map();
const listeners = new Map();
const initialState = {
  version: 1,
  profile: { id: "self", name: "Аркадий", username: "arkady" },
  users: [
    { id: "self", name: "Аркадий" },
    { id: "work-dima", name: "Дима Орлов", workContact: true },
    { id: "work-oleg", name: "Олег Казанцев", workContact: true },
    { id: "work-roman", name: "Роман Белов", workContact: true },
    { id: "work-andrey", name: "Андрей Соколов", workContact: true }
  ],
  chats: [
    { id: "saved", type: "saved", title: "Избранное", pinned: false, archived: false },
    { id: "chat-lena", type: "private", title: "Лена", pinned: false, archived: false },
    { id: "group-mods", type: "group", title: "Сборка", pinned: true, archived: false },
    { id: "work-chat-dima", type: "private", title: "Дима Орлов", pinned: true, archived: false, workChat: true },
    { id: "work-chat-oleg", type: "private", title: "Олег Казанцев", pinned: true, archived: false, workChat: true },
    { id: "work-chat-roman", type: "private", title: "Роман Белов", pinned: true, archived: false, workChat: true },
    { id: "work-chat-andrey", type: "private", title: "Андрей Соколов", pinned: true, archived: false, workChat: true }
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

function readStoredState() {
  return JSON.parse(storage.get("until-friday-min-messenger-v1"));
}

const documentStub = {
  head: { appendChild() {} },
  documentElement: null,
  addEventListener(type, callback) { listeners.set(`document:${type}`, callback); },
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement(tagName) {
    return {
      tagName: String(tagName).toUpperCase(),
      id: "",
      className: "",
      dataset: {},
      style: {},
      classList: { add() {}, toggle() {} },
      setAttribute() {},
      appendChild() {},
      prepend() {},
      textContent: "",
      innerHTML: ""
    };
  }
};

class EventStub {
  constructor(type) { this.type = type; }
}
class StorageEventStub extends EventStub {
  constructor(type, options = {}) {
    super(type);
    Object.assign(this, options);
  }
}
class CustomEventStub extends EventStub {
  constructor(type, options = {}) {
    super(type);
    this.detail = options.detail;
  }
}

const context = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  UntilFridayMinMessenger: {
    STORAGE_KEY: "until-friday-min-messenger-v1",
    getState: () => readStoredState(),
    normalize: (value) => JSON.parse(JSON.stringify(value))
  },
  document: documentStub,
  Event: EventStub,
  StorageEvent: StorageEventStub,
  CustomEvent: CustomEventStub,
  addEventListener(type, callback) { listeners.set(type, callback); },
  dispatchEvent(event) {
    listeners.get(event.type)?.(event);
    return true;
  },
  requestAnimationFrame: (callback) => callback(),
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout() {},
  location: { href: "https://example.test/" },
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(source, context, { filename: "min-workspace.js" });
const api = context.UntilFridayMinWorkspace;
assert.ok(api, "MIN workspace API must be exported");

let state = readStoredState();
const workFolder = state.folders.find((folder) => folder.id === "work");
assert.ok(workFolder, "Работа folder must be created automatically");
assert.equal(workFolder.title, "Работа");
assert.equal(workFolder.custom, true);
assert.deepEqual(workFolder.chatIds, [
  "work-chat-dima",
  "work-chat-oleg",
  "work-chat-roman",
  "work-chat-andrey"
]);
assert.equal(state.folders[2].id, "work", "Работа folder must be placed after unread chats");

const pins = Object.fromEntries(state.chats.map((chat) => [chat.id, Boolean(chat.pinned)]));
assert.equal(pins.saved, true, "Избранное must remain pinned");
assert.equal(pins["chat-lena"], true, "Лена must remain pinned");
assert.equal(pins["group-mods"], false, "other personal chats must be unpinned");
assert.equal(pins["work-chat-dima"], false, "work chats must start unpinned");
assert.equal(pins["work-chat-andrey"], false, "all work chats must start unpinned");

assert.equal(state.users.find((user) => user.id === "work-dima").avatar, "assets/avatar-friend.png");
assert.equal(state.users.find((user) => user.id === "work-oleg").avatar, "assets/avatar-tattler.png");
assert.equal(state.users.find((user) => user.id === "work-roman").avatar, "assets/avatar-sysadmin.png");
assert.equal(state.users.find((user) => user.id === "work-andrey").avatar, "assets/avatar-director.png");

api.setChatPinned("work-chat-dima", true);
state = readStoredState();
assert.equal(state.chats.find((chat) => chat.id === "work-chat-dima").pinned, true, "a work chat must be pinnable");

api.setChatPinned("work-chat-dima", false);
state = readStoredState();
state.chats.find((chat) => chat.id === "work-chat-dima").pinned = true;
storage.set("until-friday-min-messenger-v1", JSON.stringify(state));
api.syncWorkspace({ reason: "test-desktop-story-sync" });
state = readStoredState();
assert.equal(state.chats.find((chat) => chat.id === "work-chat-dima").pinned, false, "desktop story synchronization must not repin a user-unpinned chat");

state.users.push({ id: "work-newcomer", name: "Новый сотрудник", workContact: true });
state.chats.push({ id: "work-chat-newcomer", type: "private", title: "Новый сотрудник", pinned: true, workChat: true });
storage.set("until-friday-min-messenger-v1", JSON.stringify(state));
api.syncWorkspace({ reason: "test-new-work-contact" });
state = readStoredState();
assert.ok(state.folders.find((folder) => folder.id === "work").chatIds.includes("work-chat-newcomer"), "future work chats must enter the Работа folder");
assert.equal(state.chats.find((chat) => chat.id === "work-chat-newcomer").pinned, false, "future work chats must not be pinned automatically");
assert.equal(state.users.find((user) => user.id === "work-newcomer").avatar, "assets/avatar-default-user.png", "unknown employees must use the default game avatar");

const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
assert.match(html, /src\/min-workspace\.js/, "MIN workspace extension must be connected");
assert.ok(
  html.indexOf("src/min-desktop-integration.js") < html.indexOf("src/min-workspace.js"),
  "MIN workspace must initialize after work chats are integrated"
);

for (const asset of [
  "assets/avatar-friend.png",
  "assets/avatar-tattler.png",
  "assets/avatar-sysadmin.png",
  "assets/avatar-director.png",
  "assets/avatar-default-user.png"
]) {
  assert.ok(fs.existsSync(path.join(rootDir, asset)), `employee avatar asset must exist: ${asset}`);
}

console.log("MIN work folder, pin controls and employee avatar validation passed.");
