"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

for (const file of ["src/thursday-live-story.js", "src/thursday-office-director.js"]) {
  assert.doesNotThrow(() => new Function(read(file)), `${file} must contain valid JavaScript`);
}

const story = {
  metadata: {},
  events: {},
  actions: {
    "thu-finish-project": { effects: {} },
    "thu-build-case": { effects: {} },
    "thu-resign": { effects: {} },
    "thu-frame-chief": { effects: {} }
  }
};

const context = { UNTIL_FRIDAY_STORY: story, console, requestAnimationFrame: (callback) => callback() };
context.globalThis = context;
vm.runInNewContext(read("src/thursday-live-story.js"), context, { filename: "thursday-live-story.js" });

assert.ok(context.UntilFridayThursdayLiveStory, "Thursday live story API must be exported");
for (const id of [
  "thu-live-morning-andrey",
  "thu-live-marina-question",
  "thu-live-roman-access",
  "thu-live-dima-afternoon",
  "thu-live-project-reaction",
  "thu-live-case-reaction",
  "thu-live-resignation-reaction",
  "thu-live-complaint-reaction",
  "thu-live-evening-pressure"
]) assert.ok(story.events[id], `Thursday live event is missing: ${id}`);

for (const [actionId, eventId] of [
  ["thu-finish-project", "thu-live-project-reaction"],
  ["thu-build-case", "thu-live-case-reaction"],
  ["thu-resign", "thu-live-resignation-reaction"],
  ["thu-frame-chief", "thu-live-complaint-reaction"]
]) {
  assert.ok(
    story.actions[actionId].effects.schedule.some((item) => item.eventId === eventId),
    `${actionId} must schedule ${eventId}`
  );
}

assert.equal(story.events["thu-live-project-reaction"].requires.actionDone, "thu-finish-project");
assert.equal(story.events["thu-live-resignation-reaction"].requires.actionDone, "thu-resign");
assert.equal(story.events["thu-live-complaint-reaction"].requires.actionDone, "thu-frame-chief");
assert.equal(story.metadata.thursdayLiveStoryVersion, 1);

const directorSource = read("src/thursday-office-director.js");
const directorContext = {
  UntilFridayOfficeDayDirector: {
    createDirector: (config) => ({ ...config, dueBeats: () => [], claimBeat: () => true, insertMessage: () => true, repairMessages: () => true, evaluate: () => [] })
  },
  console
};
directorContext.globalThis = directorContext;
vm.runInNewContext(directorSource, directorContext, { filename: "thursday-office-director.js" });
assert.ok(directorContext.UntilFridayThursdayOfficeDirector, "Thursday office director API must be exported");
assert.equal(directorContext.UntilFridayThursdayOfficeDirector.DAY_INDEX, 3);
assert.equal(directorContext.UntilFridayThursdayOfficeDirector.CONTACTS.security.userId, "work-security");
assert.ok(directorContext.UntilFridayThursdayOfficeDirector.BEATS.some((beat) => beat.id === "late-summary"));
assert.ok(directorContext.UntilFridayThursdayOfficeDirector.BEATS.some((beat) => beat.id === "dima-evening"));

const html = read("index.html");
assert.match(html, /src\/thursday-live-story\.js/);
assert.match(html, /src\/thursday-office-director\.js/);
assert.ok(html.indexOf("src/thursday-live-story.js") < html.indexOf("src/bootstrap.js"));
assert.ok(html.indexOf("src/thursday-office-director.js") < html.indexOf("src/bootstrap.js"));

console.log("Thursday live story validation passed.");
