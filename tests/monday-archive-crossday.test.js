"use strict";

// Regresses the Tuesday-Friday Explorer archive: a Monday correction must stay
// available after the active day changes, not only while Monday is on screen.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src/work-minigames.js"), "utf8");
const id = "office-mon-requests-sum";
const archiveSelector = ".app-window[data-window-id^='doc-office-output-']";
const events = new Map();
const queried = [];
const opened = [];

let state = {
  dayIndex: 1,
  dayStarted: true,
  ended: false,
  minute: 600,
  metadata: {
    officeWork: {
      completed: {
        [id]: {
          dayIndex: 0,
          minute: 580,
          quality: "needs-review",
          submission: { values: { C6: "246" } }
        }
      }
    }
  }
};

function element(tag) {
  return {
    tag,
    dataset: {},
    children: [],
    listeners: {},
    textContent: "",
    disabled: false,
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    setAttribute() {},
    addEventListener(event, listener) { this.listeners[event] = listener; },
    querySelector(selector) {
      if (selector === "[data-office-revision]") {
        return this.children.find((child) => child.dataset.officeRevision) || null;
      }
      if (selector === "[data-open-office-revision]") {
        return this.children.find((child) => child.dataset.openOfficeRevision) || null;
      }
      return null;
    }
  };
}

const paper = { textContent: "" };
const container = element("section");
const archive = {
  dataset: { windowId: "doc-office-output-" + id },
  querySelector(selector) {
    if (selector === ".document-paper") return paper;
    if (selector === ".document-view") return container;
    return null;
  }
};

const context = {
  console,
  document: {
    addEventListener() {},
    createElement: element,
    querySelectorAll(selector) {
      queried.push(selector);
      return selector === archiveSelector ? [archive] : [];
    }
  },
  requestAnimationFrame(callback) { callback(); },
  addEventListener(type, callback) {
    const listeners = events.get(type) || [];
    listeners.push(callback);
    events.set(type, listeners);
  },
  UntilFridayRuntimeEngine: {
    getEngine: () => ({ getState: () => state })
  },
  UntilFridayOfficeWorkPack: {
    TASK_BY_ID: {
      [id]: {
        id,
        title: "Свести обращения за утро",
        source: "Служба поддержки",
        type: "sheet",
        config: { rows: [["Продажи", "64"], ["Закупки", "183"]] }
      }
    },
    openRevision(taskId) {
      opened.push(taskId);
      return true;
    }
  }
};
context.window = context;
vm.runInNewContext(source, context, { filename: "work-minigames.js" });

function render() {
  for (const handler of events.get("until-friday-state-change") || []) {
    handler({ detail: { state } });
  }
}

render();
assert.ok(queried.includes(archiveSelector), "Explorer archive must update on Tuesday");
assert.match(paper.textContent, /C6 = 246/, "Tuesday archive must display the submitted Monday result");
const panel = container.querySelector("[data-office-revision]");
assert.ok(panel, "Opening the document on Tuesday must create the correction panel");
const button = panel.querySelector("[data-open-office-revision]");
assert.ok(button, "Correction button must be present in the archive");
assert.equal(button.disabled, false, "Previously rejected work must remain correctable on Tuesday");
button.listeners.click();
assert.deepEqual(opened, [id], "The correction must open the original editor");

state.metadata.officeWork.completed[id].quality = "accepted";
state.metadata.officeWork.completed[id].submission.values.C6 = "247";
render();
assert.match(paper.textContent, /C6 = 247/, "Archive content must follow the corrected submission");
assert.equal(button.disabled, true, "A corrected document must not be revised again");
assert.equal(button.textContent, "Исправление принято");

state.metadata.officeWork.completed[id].quality = "needs-review";
state.dayStarted = false;
render();
assert.equal(button.disabled, true, "Corrections are disabled between working days");

state.dayStarted = true;
state.dayIndex = 4;
render();
assert.equal(button.disabled, false, "The archived document remains correctable on Friday");

state.ended = true;
render();
assert.equal(button.disabled, true, "Corrections are disabled after the game is over");

queried.length = 0;
state.ended = false;
state.dayIndex = 0;
render();
assert.ok(queried.includes(".app-window[data-window-id='tasks']"),
  "Ordinary Monday decorators must still run during Monday");

console.log("Monday Explorer archive and cross-day revision UI passed.");
