"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "monday-office-director.js"), "utf8");
const storage = new Map();
let activeState = null;
let badgeUpdates = 0;

function normalizeMin(raw) {
  const sourceState = raw && typeof raw === "object" ? raw : {};
  return {
    users: Array.isArray(sourceState.users) ? sourceState.users : [],
    contacts: Array.isArray(sourceState.contacts) ? sourceState.contacts : [],
    chats: Array.isArray(sourceState.chats) ? sourceState.chats : [],
    messages: Array.isArray(sourceState.messages) ? sourceState.messages : [],
    drafts: sourceState.drafts && typeof sourceState.drafts === "object" ? sourceState.drafts : {},
    folders: Array.isArray(sourceState.folders) ? sourceState.folders : [],
    settings: sourceState.settings && typeof sourceState.settings === "object" ? sourceState.settings : {},
    profile: sourceState.profile && typeof sourceState.profile === "object" ? sourceState.profile : {},
    updatedAt: sourceState.updatedAt || ""
  };
}

const listeners = new Map();
const context = {
  console,
  Date,
  JSON,
  Math,
  Object,
  Set,
  Map,
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  },
  Event: class Event {
    constructor(type) { this.type = type; }
  },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  location: { href: "https://example.test/" },
  setTimeout() { return 1; },
  clearTimeout() {},
  addEventListener(type, handler) { listeners.set(type, handler); },
  dispatchEvent() {},
  UntilFridayMinMessenger: {
    STORAGE_KEY: "until-friday-min-messenger-v1",
    normalize: normalizeMin,
    refreshAll() {}
  },
  UntilFridayMinDesktopIntegration: {
    updateBadge() { badgeUpdates += 1; }
  },
  UntilFridayOfficeWorkPack: { DAILY_QUOTA: 5 },
  UntilFridayRuntimeEngine: {
    getEngine() {
      return {
        getState: () => JSON.parse(JSON.stringify(activeState)),
        updateState(updater) {
          const draft = JSON.parse(JSON.stringify(activeState));
          updater(draft);
          activeState = draft;
          return { ok: true, state: JSON.parse(JSON.stringify(activeState)) };
        }
      };
    }
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "monday-office-director.js" });

const Director = context.UntilFridayMondayOfficeDirector;
assert.ok(Director, "Monday office director API must be exported");
assert.equal(Director.BEATS.length, 7, "Monday director must have seven reactive beats");
assert.match(source, /if \(pending\.has\(beatId\)\) return;/, "MIN recovery must not bypass an active typing delay");

function state(overrides = {}) {
  return {
    dayIndex: 0,
    minute: 527,
    dayStarted: true,
    ended: false,
    flags: {},
    completedActions: {},
    metadata: { officeWork: { completed: {} }, mondayDirector: { delivered: {} } },
    ...overrides
  };
}

let current = state({ minute: 599 });
assert.deepEqual(Array.from(Director.dueBeats(current), (beat) => beat.id), [], "No reactive beat must fire before its threshold");

current = state({ minute: 600 });
assert.deepEqual(Array.from(Director.dueBeats(current), (beat) => beat.id), ["morning-stalled"], "Chief must notice a completely stalled morning");

current = state({
  minute: 700,
  metadata: {
    officeWork: { completed: { a: {}, b: {}, c: {} } },
    mondayDirector: { delivered: {} }
  }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "steady-three"), "Chief must notice three completed office tasks");
assert.equal(Director.officeCompletedCount(current), 3);

current = state({
  minute: 810,
  metadata: {
    officeWork: { completed: { "office-mon-invoice-fix": {} } },
    mondayDirector: { delivered: {} }
  }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "invoice-bridge"), "Corrected spreadsheet must lead back to the story invoice decision");
current.completedActions["mon-invoice-fix"] = {};
assert.equal(Director.dueBeats(current).some((beat) => beat.id === "invoice-bridge"), false, "Invoice reminder must disappear after the story decision");

current = state({
  minute: 900,
  metadata: {
    officeWork: { completed: { a: {}, b: {}, c: {}, d: {}, e: {} } },
    mondayDirector: { delivered: {} }
  }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "daily-quota"), "Chief must react to the completed daily quota");

assert.match(Director.lateWorkText(state({ minute: 1005 })), /отчёт.*счёт|счёт.*отчёт/i);
assert.match(
  Director.lateWorkText(state({ minute: 1005, completedActions: { "mon-report-final": {}, "mon-invoice-fix": {} } })),
  /Основные вопросы/i,
  "Late reminder must acknowledge completed core work"
);
assert.match(Director.dimaEveningText(state({ flags: { toldFriend: true } })), /ничего точного/i);
assert.match(Director.dimaEveningText(state({ flags: { hidConcernFromFriend: true } })), /дёрган/i);

activeState = state({ minute: 600 });
const morningBeat = Director.BEATS.find((beat) => beat.id === "morning-stalled");
const claimed = Director.claimBeat(morningBeat, activeState);
const record = claimed.metadata.mondayDirector.delivered["morning-stalled"];
assert.ok(record, "Claimed beat must be persisted in engine metadata");
assert.equal(record.minute, 600, "The exact in-game delivery minute must be saved");
assert.equal(record.contact, "andrey");
assert.equal(record.text, morningBeat.text(activeState), "The exact message text must be saved for later MIN recovery");
assert.equal(Director.dueBeats(claimed).some((beat) => beat.id === "morning-stalled"), false, "Persisted beat must not repeat after reload");

assert.equal(Director.insertMessage(morningBeat, claimed), true, "Director must insert the reaction into MIN");
let minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
let message = minState.messages.find((item) => item.id === "monday-director-morning-stalled");
assert.ok(message);
assert.equal(message.senderId, "work-andrey");
assert.equal(message.text, record.text);
assert.equal(message.createdAt, new Date(Date.UTC(2026, 7, 3, 0, 0, 0) + 600 * 60000).toISOString());
assert.equal(minState.chats.find((chat) => chat.id === "work-chat-andrey").unread, 1);
assert.ok(badgeUpdates > 0, "New director messages must update the MIN unread badge");

Director.insertMessage(morningBeat, claimed);
minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
assert.equal(minState.messages.filter((item) => item.id === "monday-director-morning-stalled").length, 1, "Stable message IDs must prevent duplicate MIN messages");

storage.delete("until-friday-min-messenger-v1");
assert.equal(Director.repairMessages(claimed), 1, "Cleared MIN data must be repaired from the main game save");
minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
message = minState.messages.find((item) => item.id === "monday-director-morning-stalled");
assert.equal(message.text, record.text, "Recovered MIN message must keep its original text");
assert.equal(message.createdAt, new Date(Date.UTC(2026, 7, 3, 0, 0, 0) + 600 * 60000).toISOString(), "Recovered MIN message must keep its original game time");
assert.equal(Director.repairMessages(claimed), 0, "A second recovery pass must not duplicate the message");

console.log("Reactive Monday office director validation passed.");
