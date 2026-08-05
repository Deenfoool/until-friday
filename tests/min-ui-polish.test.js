"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/min-ui-polish.js"), "utf8");
const css = fs.readFileSync(path.join(root, "min-messenger-polish.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const STORAGE_KEY = "until-friday-min-messenger-v1";
const storage = new Map();
const connected = [];
let counter = 0;

const context = {
  console,
  Date,
  JSON,
  Math,
  setTimeout,
  clearTimeout,
  location: { href: "https://example.test/game" },
  crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}` },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  dispatchEvent() {},
  Event: class Event {
    constructor(type) { this.type = type; }
  },
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  },
  UntilFridayMinMessenger: {
    STORAGE_KEY,
    normalize(raw) {
      return {
        users: [],
        contacts: [],
        chats: [],
        messages: [],
        folders: [],
        settings: {},
        ...(raw || {})
      };
    },
    refreshAll() {}
  },
  UntilFridayMinP2P: {
    peerId: "min-self",
    connections: new Map(),
    connect(id) {
      connected.push(id);
      return true;
    }
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "min-ui-polish.js" });

const Polish = context.UntilFridayMinPolish;
assert.ok(Polish, "MIN polish API must be exported");
assert.equal(Polish.safeUsername("Алексей Иванов"), "aleksey_ivanov", "Cyrillic contact names must produce safe usernames");

const first = Polish.addContact({ name: "Алексей Иванов", username: "aleksey_home" });
let state = JSON.parse(storage.get(STORAGE_KEY));
assert.equal(first.user.name, "Алексей Иванов");
assert.equal(state.users.length, 1, "Add contact must create a real MIN user");
assert.deepEqual(state.contacts, [first.user.id], "Add contact must put the user into Contacts");
assert.equal(state.chats.length, 1, "Add contact must create a private chat");
assert.deepEqual(state.chats[0].memberIds, ["self", first.user.id]);
assert.equal(state.chats[0].pinned, false, "New contacts must not become pinned automatically");

Polish.addContact({ name: "Алексей", username: "aleksey_home" });
state = JSON.parse(storage.get(STORAGE_KEY));
assert.equal(state.users.length, 1, "Repeated username must update rather than duplicate a contact");
assert.equal(state.chats.length, 1, "Repeated username must not duplicate its private chat");

assert.equal(Polish.connectPeerId(" min-real-user "), "min-real-user");
assert.deepEqual(connected, ["min-real-user"], "P2P dialog must call the real P2P connect function");
assert.throws(() => Polish.connectPeerId("min-self"), /собственному MIN-ID/);
assert.throws(() => Polish.connectPeerId(""), /Введите MIN-ID/);

assert.match(source, /\[data-min-add-contact\]/, "Add button must have a functional delegated handler");
assert.match(source, /data\.minPolishP2pOpen/, "P2P button must be converted to the polished dialog handler");
assert.match(source, /className = "min-page-actions"/, "Header buttons must be grouped separately from heading text");
assert.match(source, /MutationObserver\(decorateAll\)/, "Polish must survive MIN rerenders");

assert.match(css, /\.min-app:not\(:has\(\.min-chat-list\)\)\s*\{[\s\S]*?grid-template-columns:\s*78px\s+minmax\(0,\s*1fr\)/, "Non-chat pages must use the full content width");
assert.match(css, /\.min-page-actions\s*\{[\s\S]*?flex-wrap:\s*wrap/, "Header actions must wrap without colliding with text");
assert.match(css, /@container\s+min-messenger\s*\(max-width:\s*640px\)/, "MIN must have a container-based single-pane mode");
assert.match(css, /@container\s+min-messenger\s*\(max-width:\s*440px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/, "Very narrow action rows must stack buttons");
assert.match(css, /transition:[\s\S]*?transform/, "Interactive controls must use smooth transitions");
assert.match(css, /@keyframes\s+minModalEnter/, "Modals must have an entrance animation");
assert.match(css, /@keyframes\s+minToastEnter/, "Feedback toasts must be animated");
assert.match(css, /prefers-reduced-motion:\s*reduce/, "Animations must respect reduced-motion preferences");

assert.match(html, /min-messenger-polish\.css\?v=20260805-1/, "Polish stylesheet must be loaded");
assert.match(html, /src\/min-ui-polish\.js\?v=20260805-1/, "Polish behavior must be loaded");
assert.ok(
  html.indexOf("min-messenger-responsive.css") < html.indexOf("min-messenger-polish.css"),
  "Polish CSS must override the existing responsive layer"
);
assert.ok(
  html.indexOf("src/min-messenger-p2p.js") < html.indexOf("src/min-ui-polish.js"),
  "Polish behavior must load after the real P2P API"
);

console.log("MIN responsive polish, Add contact and P2P controls validation passed.");
