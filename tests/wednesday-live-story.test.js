"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const story = require("../src/story-v2.js");
require("../src/min-npc-dialogues.js");
require("../src/min-npc-dialogue-schedules.js");
require("../src/monday-live-story.js");
require("../src/tuesday-live-story.js");

const context = {
  UNTIL_FRIDAY_STORY: story,
  MutationObserver: class MutationObserver { observe() {} },
  document: {
    documentElement: {},
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  window: { addEventListener() {}, setTimeout() {} },
  requestAnimationFrame: (callback) => callback(),
  console
};
context.globalThis = context;
vm.runInNewContext(read("src/wednesday-minigames.js"), context, { filename: "wednesday-minigames.js" });
const Live = require("../src/wednesday-live-story.js");

assert.ok(Live, "Wednesday live story API must be exported");
assert.equal(Live.HONEST_ACTION_IDS.length, 3);
assert.equal(Live.TAMPER_ACTION_IDS.length, 2);
assert.equal(Live.BLAME_ACTION_IDS.length, 2);
assert.equal(Live.FIXED_EVENT_IDS.length, 4);
assert.equal(Live.CONDITIONAL_EVENT_IDS.length, 10);

for (const id of [...Live.HONEST_ACTION_IDS, ...Live.TAMPER_ACTION_IDS, ...Live.BLAME_ACTION_IDS]) {
  const action = story.actions[id];
  assert.ok(action, `Wednesday security action must exist: ${id}`);
  assert.equal(action.dayIndex, 2);
  assert.equal(action.channel, "chat");
  assert.equal(action.contactKey, "security");
  assert.ok(action.optionLabel, `${id} must have a short option label`);
  assert.equal(action.messageText, action.label, `${id} must send the full authored line`);
  assert.ok(Array.isArray(action.effects?.schedule) && action.effects.schedule.length === 1, `${id} must schedule one reply`);
  const scheduled = action.effects.schedule[0];
  assert.equal(scheduled.dayIndex, 2);
  const reply = story.events[scheduled.eventId];
  assert.ok(reply, `${id} must schedule an existing event`);
  assert.equal(reply.requires.actionDone, id, `${scheduled.eventId} must require its source action`);
}

assert.equal(new Set(Live.HONEST_ACTION_IDS.map((id) => story.actions[id].choiceGroup)).size, 1);
assert.equal(new Set(Live.TAMPER_ACTION_IDS.map((id) => story.actions[id].choiceGroup)).size, 1);
assert.equal(new Set(Live.BLAME_ACTION_IDS.map((id) => story.actions[id].choiceGroup)).size, 1);

for (const id of [...Live.FIXED_EVENT_IDS, ...Live.CONDITIONAL_EVENT_IDS]) {
  const event = story.events[id];
  assert.ok(event, `Wednesday live event must exist: ${id}`);
  assert.equal(event.dayIndex, 2);
  assert.ok(Number(event.minute) >= 530 && Number(event.minute) <= 1020);
}

assert.equal(story.events["wed-live-security-intro"].contactKey, "security");
assert.equal(story.events["wed-live-security-intro"].requires.eventDelivered, "wed-security-audit");
assert.equal(story.events["wed-live-clean-roman"].requires.eventDelivered, "wed-normal-morning");
assert.equal(story.events["wed-live-security-honest-followup"].requires.flag, "auditClosedHonestly");
assert.equal(story.events["wed-live-security-tamper-followup"].requires.flag, "auditServerCopyFound");
assert.equal(story.events["wed-live-security-blame-followup"].requires.flag, "dimaConfrontedPlayer");

assert.equal(story.actions["wed-security-admit-fear"].effects.setFlags.securityAdmittedFear, true);
assert.equal(story.actions["wed-security-deny-tampering"].effects.setFlags.securityDeniedTampering, true);
assert.equal(story.actions["wed-security-retract-blame"].effects.setFlags.retractedFriendBlame, true);
assert.equal(story.actions["wed-security-confirm-blame"].effects.setFlags.confirmedFriendBlame, true);
assert.equal(story.events["wed-live-security-reply-confirm"].effects.setFlags.friendAuditOpened, true);

const html = read("index.html");
assert.match(html, /src\/wednesday-live-story\.js\?v=20260805-1/);
assert.ok(
  html.indexOf("src/wednesday-minigames.js") < html.indexOf("src/wednesday-live-story.js") &&
  html.indexOf("src/wednesday-live-story.js") < html.indexOf("src/bootstrap.js"),
  "Wednesday live story must load after base Wednesday events and before engine bootstrap"
);

console.log("Live Wednesday security story validation passed.");
