"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/min-game-profile-sync.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "MIN game profile sync must contain valid JavaScript");

const PROFILE_KEY = "until-friday-profile-v1";
const MIN_STORAGE_KEY = "until-friday-min-messenger-v1";
const storage = new Map([
  [PROFILE_KEY, JSON.stringify({ name: "Аркадий", createdAt: 1 })]
]);
const documentListeners = new Map();
const rootListeners = new Map();
let updateCount = 0;
let state = {
  profile: { id: "self", name: "Денис", username: "denis", avatarColor: "#5b7fca" },
  users: [{ id: "self", name: "Денис", username: "denis", letter: "Д", color: "#5b7fca" }]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const context = {
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  UntilFridayOnboarding: {
    PROFILE_KEY,
    normalizeName(value) {
      return String(value || "").replace(/\s+/g, " ").trim().slice(0, 24);
    },
    validName(value) {
      const name = String(value || "");
      return name.length >= 2 && /^[A-Za-zА-Яа-яЁё0-9 -]+$/.test(name);
    }
  },
  UntilFridayMinMessenger: {
    STORAGE_KEY: MIN_STORAGE_KEY,
    getState: () => clone(state),
    updateProfile(patch) {
      updateCount += 1;
      state.profile = { ...state.profile, ...patch };
      const self = state.users.find((user) => user.id === "self");
      self.name = state.profile.name;
      self.letter = state.profile.name.slice(0, 1).toUpperCase();
    }
  },
  document: {
    addEventListener(type, callback) {
      documentListeners.set(type, callback);
    }
  },
  addEventListener(type, callback) {
    rootListeners.set(type, callback);
  },
  queueMicrotask: (callback) => callback(),
  setTimeout: (callback) => callback(),
  Promise,
  console
};
context.globalThis = context;
context.window = context;

vm.runInNewContext(source, context, { filename: "min-game-profile-sync.js" });

const api = context.UntilFridayMinGameProfileSync;
assert.ok(api, "profile sync API must be exported");
assert.equal(state.profile.name, "Аркадий", "MIN profile must use the protagonist name on startup");
assert.equal(state.users[0].name, "Аркадий", "MIN self user must use the protagonist name on startup");
assert.equal(state.users[0].letter, "А", "MIN avatar letter must follow the protagonist name");
assert.equal(updateCount, 1, "startup migration must update MIN only once");

api.sync("already-synced");
assert.equal(updateCount, 1, "an already synchronized profile must not be saved again");

state.profile.name = "Денис";
state.users[0].name = "Денис";
documentListeners.get("submit")({
  target: { matches: (selector) => selector === "[data-min-profile-form]" }
});
assert.equal(state.profile.name, "Аркадий", "editing the MIN profile must not replace the protagonist name");
assert.equal(state.users[0].name, "Аркадий");

state.profile.name = "Денис";
state.users[0].name = "Денис";
documentListeners.get("click")({
  target: { closest: (selector) => selector === "[data-min-reset]" ? {} : null }
});
assert.equal(state.profile.name, "Аркадий", "resetting MIN must restore the protagonist name");
assert.equal(state.users[0].name, "Аркадий");

storage.set(PROFILE_KEY, JSON.stringify({ name: "Мария", createdAt: 2 }));
rootListeners.get("storage")({ key: PROFILE_KEY });
assert.equal(state.profile.name, "Мария", "a changed game profile must update MIN");
assert.equal(state.users[0].name, "Мария");
assert.equal(state.users[0].letter, "М");

storage.set(PROFILE_KEY, JSON.stringify({ name: "!", createdAt: 3 }));
assert.equal(api.gameProfileName(), "", "invalid game profile names must not be copied into MIN");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /src\/min-game-profile-sync\.js/, "profile sync module must be connected");
assert.ok(
  html.indexOf("src/min-messenger.js") < html.indexOf("src/min-game-profile-sync.js") &&
  html.indexOf("src/min-game-profile-sync.js") < html.indexOf("src/min-desktop-integration.js"),
  "profile sync must load after MIN core and before desktop integration"
);

console.log("MIN protagonist profile synchronization passed.");
