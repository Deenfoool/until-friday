"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const moduleSource = read("src/work-minigames.js");
const appSource = read("src/app-v2.js");
const styleSource = read("work-minigames.css");

assert.doesNotThrow(() => new Function(moduleSource), "Monday desktop workflow must parse");
assert.match(appSource, /UntilFridayDesktop = Object\.freeze\(\{ openApp, performAction \}\)/,
  "Monday must use the native desktop action dispatcher");
assert.match(appSource, /UntilFridayWorkMinigames\?\.documents\(gameState\)/,
  "Explorer must obtain the same report and invoice documents as Mail");
assert.doesNotMatch(moduleSource, /new\s+MutationObserver/, "The workflow must be event-driven");
assert.doesNotMatch(moduleSource, /window\.setInterval/, "The workflow must not poll for UI changes");
assert.match(styleSource, /monday-invoice-editor/, "Invoice editor styles are required");

let state = { dayIndex: 0, minute: 540, metadata: {}, completedActions: {} };
let saves = 0;
const context = {
  console,
  document: { addEventListener() {}, querySelectorAll() { return []; } },
  requestAnimationFrame(callback) { callback(); },
  addEventListener() {},
  UntilFridayRuntimeEngine: {
    getEngine: () => ({
      getState: () => JSON.parse(JSON.stringify(state)),
      updateState(updater) {
        const draft = JSON.parse(JSON.stringify(state));
        updater(draft);
        state = draft;
        saves += 1;
        return { ok: true, state: JSON.parse(JSON.stringify(state)) };
      }
    })
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(moduleSource, context, { filename: "work-minigames.js" });

const Monday = context.UntilFridayWorkMinigames;
assert.ok(Monday, "Monday API must be exported");
assert.equal(Monday.parseAmount("84 200 ₽"), 84200);
assert.equal(Monday.parseAmount("84200"), 84200);
assert.equal(Monday.parseAmount("84 200,00"), 84200);
assert.equal(Monday.parseAmount("invalid 84200"), null);
assert.equal(Monday.parseAmount("-100"), null);
assert.equal(Monday.parseAmount(""), null);

const initialFiles = Monday.documents();
assert.equal(initialFiles.length, 4, "Explorer should show three report versions and an invoice");
assert.equal(new Set(initialFiles.map((file) => file.id)).size, 4, "File IDs must be distinct");
assert.ok(initialFiles.every((file) => !file.actionId), "Opening Explorer documents must not instantly resolve story actions");
const final = initialFiles.find((file) => file.id === "report-final");
const draft = initialFiles.find((file) => file.id === "report-old");
const autosave = initialFiles.find((file) => file.id === "report-autosave");
assert.ok(final.content.includes("Закрыто: 392"));
assert.ok(draft.content.includes("Закрыто: 374"));
assert.ok(autosave.content.includes("Автосохранение"));
assert.equal(Monday.invoiceTotal(state), 842000);
assert.ok(initialFiles.find((file) => file.id === "invoice").content.includes("842"));

const saved = Monday.saveInvoice(84200);
assert.equal(saved.ok, true);
assert.equal(saves, 1);
assert.equal(state.metadata.mondayInvoice.total, 84200);
assert.equal(state.metadata.mondayInvoice.saved, true);
assert.equal(state.metadata.mondayInvoice.updatedMinute, 540);
assert.equal(Monday.invoiceTotal(state), 84200, "The saved edit must be read from main engine state");
assert.ok(Monday.documents().find((file) => file.id === "invoice").content.includes("изменён пользователем"));

state.completedActions["mon-invoice-fix"] = { minute: 560 };
assert.equal(Monday.invoiceDone(state), true);
assert.equal(Monday.saveInvoice(100).ok, false, "Completed invoices must not be mutable");
assert.equal(saves, 1, "Rejected edit must not alter the save");

state.completedActions["mon-report-final"] = { minute: 570 };
assert.equal(Monday.reportDone(state), true);
state.dayIndex = 1;
assert.equal(Monday.documents(state).length, 0, "Monday documents must not leak into following days");

console.log("Monday shared Explorer/Mail documents and persisted invoice validation passed.");
