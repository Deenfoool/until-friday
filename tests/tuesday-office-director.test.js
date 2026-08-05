"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const coreSource = fs.readFileSync(path.join(__dirname, "..", "src", "office-day-director.js"), "utf8");
const tuesdaySource = fs.readFileSync(path.join(__dirname, "..", "src", "tuesday-office-director.js"), "utf8");
const storage = new Map();
const listeners = new Map();
let activeState = null;
let badgeUpdates = 0;

function normalizeMin(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    users: Array.isArray(source.users) ? source.users : [],
    contacts: Array.isArray(source.contacts) ? source.contacts : [],
    chats: Array.isArray(source.chats) ? source.chats : [],
    messages: Array.isArray(source.messages) ? source.messages : [],
    drafts: source.drafts && typeof source.drafts === "object" ? source.drafts : {},
    folders: Array.isArray(source.folders) ? source.folders : [],
    settings: source.settings && typeof source.settings === "object" ? source.settings : {},
    profile: source.profile && typeof source.profile === "object" ? source.profile : {},
    updatedAt: source.updatedAt || ""
  };
}

const tuesdayTasks = ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) => ({ id, dayIndex: 1 }));
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
  removeEventListener() {},
  dispatchEvent() {},
  UntilFridayMinMessenger: {
    STORAGE_KEY: "until-friday-min-messenger-v1",
    normalize: normalizeMin,
    refreshAll() {}
  },
  UntilFridayMinDesktopIntegration: {
    updateBadge() { badgeUpdates += 1; }
  },
  UntilFridayOfficeWorkPack: {
    DAILY_QUOTA: 5,
    tasksForDay(dayIndex) { return Number(dayIndex) === 1 ? tuesdayTasks : []; }
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
vm.runInContext(tuesdaySource, context, { filename: "tuesday-office-director.js" });

const Director = context.UntilFridayTuesdayOfficeDirector;
assert.ok(context.UntilFridayOfficeDayDirector, "Reusable office director core must be exported");
assert.ok(Director, "Tuesday director API must be exported");
assert.equal(Director.BEATS.length, 7);
assert.equal(Director.CONTACTS.marina.chatId, "work-chat-marina");
assert.match(coreSource, /pending\.has\(beatId\)/, "Message recovery must respect an active typing delay");

function state(overrides = {}) {
  return {
    dayIndex: 1,
    minute: 535,
    dayStarted: true,
    ended: false,
    flags: {},
    completedActions: {},
    deliveredEvents: [],
    metadata: { officeWork: { completed: {} }, tuesdayDirector: { delivered: {} } },
    ...overrides
  };
}

let current = state({ minute: 547 });
assert.deepEqual(Array.from(Director.dueBeats(current), (beat) => beat.id), []);

current = state({ minute: 548, flags: { reportWrong: true } });
assert.deepEqual(Array.from(Director.dueBeats(current), (beat) => beat.id), ["morning-carryover"]);
assert.match(Director.morningCarryoverText(current), /возвращать июльский отчёт/i);

current = state({
  minute: 700,
  metadata: {
    officeWork: { completed: { t1: {}, t2: {}, t3: {} } },
    tuesdayDirector: { delivered: { "morning-carryover": {} } }
  }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "steady-three"));
assert.equal(Director.completedOfficeCount(current), 3);

current = state({
  minute: 635,
  metadata: { officeWork: { completed: {} }, tuesdayDirector: { delivered: { "morning-carryover": {} } } }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "client-overdue"));
current.completedActions["tue-client-confirm"] = {};
assert.equal(Director.dueBeats(current).some((beat) => beat.id === "client-overdue"), false);

current = state({
  minute: 720,
  deliveredEvents: ["tue-admin-question"],
  metadata: { officeWork: { completed: {} }, tuesdayDirector: { delivered: { "morning-carryover": {}, "client-overdue": {} } } }
});
assert.ok(Director.dueBeats(current).some((beat) => beat.id === "roman-unanswered"));
current.completedActions["tue-answer-admin-honest"] = {};
assert.equal(Director.dueBeats(current).some((beat) => beat.id === "roman-unanswered"), false);

assert.match(Director.lateSummaryText(state({ minute: 1005 })), /ответ клиенту/i);
assert.match(
  Director.lateSummaryText(state({
    minute: 1005,
    completedActions: { "tue-client-confirm": {}, "tue-help-accountant": {}, "tue-answer-admin-honest": {} },
    deliveredEvents: ["tue-accountant-request", "tue-admin-question"]
  })),
  /Основные вопросы вторника закрыты/i
);
assert.match(Director.dimaEveningText(state({ flags: { askedFriendToCover: true } })), /видел сам/i);
assert.match(Director.dimaEveningText(state({ flags: { stoppedFriendInvestigation: true } })), /Больше никого не расспрашивал/i);

activeState = state({ minute: 548, flags: { reportCorrect: true } });
const morningBeat = Director.BEATS.find((beat) => beat.id === "morning-carryover");
const claimed = Director.claimBeat(morningBeat, activeState);
const record = claimed.metadata.tuesdayDirector.delivered["morning-carryover"];
assert.ok(record);
assert.equal(record.dayIndex, 1);
assert.equal(record.contact, "andrey");
assert.equal(record.minute, 548);
assert.equal(record.text, Director.morningCarryoverText(activeState));

assert.equal(Director.insertMessage(morningBeat, claimed), true);
let minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
let message = minState.messages.find((item) => item.id === "tuesday-director-morning-carryover");
assert.ok(message);
assert.equal(message.senderId, "work-andrey");
assert.equal(message.text, record.text);
assert.equal(minState.chats.find((chat) => chat.id === "work-chat-andrey").unread, 1);
assert.ok(badgeUpdates > 0);

Director.insertMessage(morningBeat, claimed);
minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
assert.equal(minState.messages.filter((item) => item.id === "tuesday-director-morning-carryover").length, 1);

storage.delete("until-friday-min-messenger-v1");
assert.equal(Director.repairMessages(claimed), 1);
minState = JSON.parse(storage.get("until-friday-min-messenger-v1"));
message = minState.messages.find((item) => item.id === "tuesday-director-morning-carryover");
assert.equal(message.text, record.text);
assert.equal(Director.repairMessages(claimed), 0);

console.log("Reusable Tuesday office director validation passed.");
