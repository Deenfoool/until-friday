"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/passive-clock.js"), "utf8");
assert.doesNotThrow(() => new Function(source), "passive clock module must contain valid JavaScript");
assert.doesNotMatch(source, /Engine\.createEngine\s*=/, "passive clock must not wrap the engine factory");

let now = 100000;
let modalOpen = false;
let dayEndOpen = false;
const notifications = [];
const clockTime = { textContent: "" };
const clockDate = { textContent: "" };

const state = {
  dayIndex: 0,
  minute: 527,
  dayStarted: true,
  ended: false
};

const engineInstance = {
  getState: () => JSON.parse(JSON.stringify(state)),
  replaceState(next) { Object.assign(state, JSON.parse(JSON.stringify(next))); },
  advanceTime(minutes) {
    const before = state.minute;
    state.minute += minutes;
    const events = before < 530 && state.minute >= 530
      ? [{ id: "test-event", source: "Система", title: "Проверка", text: "Событие доставлено" }]
      : [];
    return { ok: true, events, state: JSON.parse(JSON.stringify(state)) };
  }
};

const storage = new Map();
const documentStub = {
  hidden: false,
  querySelector(selector) {
    if (selector === "#desktop:not(.hidden)") return {};
    if (selector === ".modal-overlay") return modalOpen ? {} : null;
    if (selector === ".day-end-control-overlay") return dayEndOpen ? {} : null;
    if (selector === "#clock-time") return clockTime;
    if (selector === "#clock-date") return clockDate;
    return null;
  },
  querySelectorAll: () => [],
  addEventListener() {}
};

const runtime = {
  getEngine: () => engineInstance,
  persist(nextState) {
    storage.set("until-friday-save-v2", JSON.stringify(nextState));
    return { ok: true };
  },
  notify(title, text) { notifications.push({ title, text }); }
};

const context = {
  UntilFridayRuntimeEngine: runtime,
  Date: class FakeDate extends Date { static now() { return now; } },
  document: documentStub,
  window: {
    addEventListener() {},
    setInterval: () => 1,
    clearInterval() {},
    setTimeout() {}
  },
  MouseEvent: class MouseEvent {},
  CSS: { escape: (value) => value },
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "passive-clock.js" });

const api = context.UntilFridayPassiveClock;
assert.ok(api, "passive clock API must be exported");
assert.equal(api.getEngine(), engineInstance, "passive clock must obtain the shared runtime instance");
assert.equal(api.REAL_MS_PER_GAME_MINUTE, 3000, "one game minute must equal three real seconds");
assert.equal(api.WORKDAY_END_MINUTE, 1080, "passive clock must stop at 18:00");

now += 30000;
let result = api.tick(now);
assert.equal(result.advanced, 10, "thirty real seconds must advance ten game minutes");
assert.equal(state.minute, 537);
assert.equal(clockTime.textContent, "08:57");
assert.equal(notifications.length, 1, "events crossed by passive time must produce a notification");
assert.ok(storage.has("until-friday-save-v2"), "passive time must persist the updated state");

modalOpen = true;
now += 30000;
result = api.tick(now);
assert.equal(result.advanced, 0, "time must pause while a modal day transition is open");
assert.equal(state.minute, 537);
modalOpen = false;

dayEndOpen = true;
now += 30000;
result = api.tick(now);
assert.equal(result.advanced, 0, "time must pause while the reliable day-end dialog is open");
assert.equal(state.minute, 537);
dayEndOpen = false;

documentStub.hidden = true;
now += 600000;
result = api.tick(now);
assert.equal(result.advanced, 0, "a hidden browser tab must not consume the entire workday");
assert.equal(state.minute, 537);
documentStub.hidden = false;
result = api.tick(now);
assert.equal(result.advanced, 0, "returning to the tab must resume from the current moment without catch-up");
assert.equal(state.minute, 537);

state.dayIndex = 1;
state.minute = 535;
now += 30000;
result = api.tick(now);
assert.equal(result.dayChanged, true, "a new day must reset passive timing instead of catching up old elapsed time");
assert.equal(state.minute, 535);

state.minute = 1075;
now += 30000;
result = api.tick(now);
assert.equal(result.advanced, 5, "passive time must advance only to the end of the workday");
assert.equal(state.minute, 1080);

now += 30000;
result = api.tick(now);
assert.equal(result.advanced, 0, "time must remain stopped after 18:00");
assert.equal(state.minute, 1080);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /src\/passive-clock\.js/, "passive clock script must be connected");
assert.ok(
  html.indexOf("src/runtime-engine.js") < html.indexOf("src/passive-clock.js") &&
  html.indexOf("src/passive-clock.js") < html.indexOf("src/bootstrap.js"),
  "passive clock must subscribe after the unified runtime and before app bootstrap"
);

console.log("Passive clock runtime validation passed.");
