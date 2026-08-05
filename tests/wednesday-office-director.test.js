"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const coreSource = fs.readFileSync(path.join(__dirname, "..", "src", "office-day-director.js"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "src", "wednesday-office-director.js"), "utf8");
const storage = new Map();
let activeState = null;

function normalizeMin(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    users: Array.isArray(value.users) ? value.users : [],
    contacts: Array.isArray(value.contacts) ? value.contacts : [],
    chats: Array.isArray(value.chats) ? value.chats : [],
    messages: Array.isArray(value.messages) ? value.messages : [],
    folders: Array.isArray(value.folders) ? value.folders : [],
    settings: value.settings || {},
    profile: value.profile || {}
  };
}

const tasks = ["w1", "w2", "w3", "w4", "w5", "w6"].map((id) => ({ id, dayIndex: 2 }));
const context = {
  console,
  Date,
  JSON,
  Math,
  Object,
  Set,
  Map,
  CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  Event: class Event { constructor(type) { this.type = type; } },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  location: { href: "https://example.test/" },
  setTimeout() { return 1; },
  clearTimeout() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  UntilFridayMinMessenger: {
    STORAGE_KEY: "until-friday-min-messenger-v1",
    normalize: normalizeMin,
    refreshAll() {}
  },
  UntilFridayMinDesktopIntegration: { updateBadge() {} },
  UntilFridayOfficeWorkPack: {
    DAILY_QUOTA: 5,
    tasksForDay(dayIndex) { return Number(dayIndex) === 2 ? tasks : []; }
  },
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
context.window = context;
vm.createContext(context);
vm.runInContext(coreSource, context, { filename: "office-day-director.js" });
vm.runInContext(source, context, { filename: "wednesday-office-director.js" });

const Director = context.UntilFridayWednesdayOfficeDirector;
assert.ok(Director);
assert.equal(Director.DAY_INDEX, 2);
assert.equal(Director.BEATS.length, 8);
assert.equal(Director.CONTACTS.security.chatId, "work-chat-security");

function state(overrides = {}) {
  return {
    dayIndex: 2,
    minute: 530,
    dayStarted: true,
    ended: false,
    flags: {},
    completedActions: {},
    deliveredEvents: [],
    metadata: { officeWork: { completed: {} }, wednesdayDirector: { delivered: {} } },
    ...overrides
  };
}

let current = state({ minute: 544 });
assert.deepEqual(Array.from(Director.dueBeats(current), (beat) => beat.id), []);
current = state({ minute: 545, flags: { clientDelayed: true } });
assert.deepEqual(Array.from(Director.dueBeats(current), (beat) => beat.id), ["morning-carryover"]);
assert.match(Director.morningCarryoverText(current), /клиентский вопрос/i);

current = state({
  minute: 750,
  deliveredEvents: ["wed-security-audit"],
  metadata: { officeWork: { completed: {} }, wednesdayDirector: { delivered: { "morning-carryover": {} } } }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "audit-unanswered"));
current.completedActions["wed-audit-explain"] = {};
assert.equal(Director.dueBeats(current).some((beat) => beat.id === "audit-unanswered"), false);

current = state({
  minute: 770,
  flags: { auditServerCopyFound: true },
  metadata: { officeWork: { completed: {} }, wednesdayDirector: { delivered: { "morning-carryover": {} } } }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "roman-tamper-warning"));

current = state({
  minute: 900,
  deliveredEvents: ["wed-live-security-honest-followup"],
  metadata: { officeWork: { completed: {} }, wednesdayDirector: { delivered: { "morning-carryover": {} } } }
});
assert.equal(Director.followupPending(current), true);
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "security-followup-reminder"));
current.completedActions["wed-security-request-formal"] = {};
assert.equal(Director.followupPending(current), false);

assert.match(Director.lateSummaryText(state({
  minute: 1005,
  deliveredEvents: ["wed-security-audit", "wed-live-security-honest-followup"]
})), /службе безопасности/i);
assert.match(Director.dimaEveningText(state({ flags: { confirmedFriendBlame: true } })), /спасаться за мой счёт/i);
assert.match(Director.dimaEveningText(state({ flags: { retractedFriendBlame: true } })), /отозвал слова/i);
assert.match(Director.dimaEveningText(state({ flags: { securityAcceptedFearExplanation: true } })), /сказал им про разговор/i);

activeState = state({ minute: 545, flags: { clientHandled: true, adminConfession: true } });
const beat = Director.BEATS.find((item) => item.id === "morning-carryover");
const claimed = Director.claimBeat(beat, activeState);
assert.ok(claimed.metadata.wednesdayDirector.delivered["morning-carryover"]);
assert.equal(Director.insertMessage(beat, claimed), true);
let minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
let message = minState.messages.find((item) => item.id === "wednesday-director-morning-carryover");
assert.ok(message);
assert.equal(message.senderId, "work-andrey");

Director.insertMessage(beat, claimed);
minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
assert.equal(minState.messages.filter((item) => item.id === "wednesday-director-morning-carryover").length, 1);

storage.delete("until-friday-min-messenger-v1");
assert.equal(Director.repairMessages(claimed), 1);
minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
message = minState.messages.find((item) => item.id === "wednesday-director-morning-carryover");
assert.equal(message.text, Director.morningCarryoverText(activeState));

console.log("Reactive Wednesday office director validation passed.");
