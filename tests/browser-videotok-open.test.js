"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const videotokSource = read("src/videotok.js");
const uiSource = read("src/personal-browser-ui-v4.js");

const state = { dayIndex: 0, minute: 540, metadata: { personalBrowser: {} } };
const personal = { bookmarks: ["market", "videotok", "min"], settings: {}, history: [], downloads: [], videotok: {} };
const page = {
  innerHTML: "",
  scrollTop: 0,
  scrollLeft: 0,
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
const content = {
  html: "",
  set innerHTML(value) { this.html = String(value); page.innerHTML = ""; },
  get innerHTML() { return this.html; },
  querySelector(selector) { return selector === ".rb-page" ? page : null; },
  querySelectorAll() { return []; }
};
const title = { textContent: "" };
const status = { textContent: "" };
const windowElement = {
  dataset: {},
  classList: { contains: () => false },
  querySelector(selector) {
    if (selector === ".window-content") return content;
    if (selector === ".window-title") return title;
    if (selector === ".window-status") return status;
    if (selector === ".rb-page") return page;
    return null;
  }
};
const browser = {
  PRODUCTS: [],
  personalState: () => personal,
  visibleHistory: () => [],
  performActivity: () => ({ ok: true })
};
const runtime = {
  getEngine: () => ({ getState: () => state, updateState(updater) { updater(state); return { ok: true, state }; } })
};
const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: runtime,
  UntilFridayMinMessenger: { unreadCount: () => 0, search: () => ({ chats: [], messages: [], users: [] }), mount() {}, chatById: () => null },
  document: { querySelector(selector) { return selector === ".personal-browser-window" ? windowElement : null; }, addEventListener() {} },
  addEventListener() {},
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  URL,
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(videotokSource, context, { filename: "videotok.js" });
vm.runInNewContext(uiSource, context, { filename: "personal-browser-ui-v4.js" });

const ui = context.UntilFridayPersonalBrowserUIV4;
assert.ok(ui);
assert.equal(ui.render(), true, "browser home must render");
assert.match(page.innerHTML, /rb-newtab/);

ui.navigate("videotok");
assert.equal(title.textContent, "Видеоток — KONTUR Web");
assert.equal(status.textContent, "Защищённое соединение");
assert.equal(windowElement.dataset.browserV4, "true");
assert.match(page.innerHTML, /class="vtk-app/);
assert.match(page.innerHTML, /Видеоток/);
assert.match(page.innerHTML, /Короткое замыкание/);
assert.doesNotMatch(page.innerHTML, /ВидеоЛента/);

ui.navigateAddress("https://videotok.local/watch/vt-001");
assert.match(page.innerHTML, /class="vtk-watch/);
assert.match(page.innerHTML, /Ноутбук шумит, хотя ничего не запущено/);

console.log("Browser UI v4 opens Videotok directly.");
