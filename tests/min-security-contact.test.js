"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/min-security-contact.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let syncCalls = 0;
let workspaceCalls = 0;

const context = {
  console,
  document: {
    documentElement: {},
    createElement(tagName) {
      return { tagName: tagName.toUpperCase(), src: "", alt: "" };
    },
    querySelectorAll() { return []; }
  },
  MutationObserver: class MutationObserver { observe() {} },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  addEventListener() {},
  UntilFridayMinDesktopIntegration: {
    WORK_CONTACTS: [
      { key: "dima" },
      { key: "oleg" },
      { key: "roman" },
      { key: "marina" },
      { key: "andrey" }
    ],
    syncStoryMessages() { syncCalls += 1; }
  },
  UntilFridayMinWorkspace: {
    syncWorkspace() { workspaceCalls += 1; }
  }
};
context.globalThis = context;
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "min-security-contact.js" });

const api = context.UntilFridayMinSecurityContact;
assert.ok(api, "Security contact API must be exported");
assert.equal(api.CONTACT.key, "security");
assert.equal(api.CONTACT.userId, "work-security");
assert.equal(api.CONTACT.chatId, "work-chat-security");
assert.equal(api.CONTACT.name, "Виктор Сергеев");
assert.equal(api.AVATAR, "assets/avatar-hr-men.png");

const contacts = context.UntilFridayMinDesktopIntegration.WORK_CONTACTS;
assert.equal(contacts.filter((item) => item.key === "security").length, 1, "Security contact must be inserted once");
assert.ok(contacts.findIndex((item) => item.key === "security") < contacts.findIndex((item) => item.key === "andrey"));
api.ensureContact();
assert.equal(contacts.filter((item) => item.key === "security").length, 1, "Repeated sync must not duplicate the contact");
assert.ok(syncCalls >= 1, "Security contact must trigger story synchronization");
assert.ok(workspaceCalls >= 1, "Security contact must trigger work-folder synchronization");
assert.ok(fs.existsSync(path.join(root, api.AVATAR)), "Security avatar asset must exist");

assert.match(html, /src\/min-security-contact\.js\?v=20260805-1/);
assert.ok(
  html.indexOf("src/min-desktop-integration.js") < html.indexOf("src/min-security-contact.js") &&
  html.indexOf("src/min-workspace.js") < html.indexOf("src/min-security-contact.js") &&
  html.indexOf("src/min-security-contact.js") < html.indexOf("src/wednesday-office-director.js"),
  "Security contact must load after MIN work integration and before Wednesday reactions"
);

console.log("MIN security officer contact validation passed.");
