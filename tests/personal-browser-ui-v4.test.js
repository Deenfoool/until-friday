"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/personal-browser-ui-v4.js");

assert.doesNotThrow(() => new Function(source), "browser UI v4 must parse");
assert.doesNotMatch(source, /Browser\.MESSAGES|msg\.local|messagesPage\(|conversation\(|data-rb-reply/, "old scripted Messages page must be absent");
assert.doesNotMatch(source, /document\.addEventListener\("click"/, "browser v4 must not rerender from global clicks");
assert.match(source, /event\.detail\?\.reason === "time"/, "passive game minutes must not rerender browser sites");

for (const phrase of [
  "min.local",
  "UntilFridayMinMessenger",
  "UntilFridayMarketplaceParody",
  "UntilFridayVideotok",
  "data-rb-page=\"min\"",
  "data-browser-v4-shell",
  "pageFromAddress",
  "personal-browser-bookmark"
]) assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

const state = { dayIndex: 0, minute: 540, metadata: { personalBrowser: {} } };
const personal = { bookmarks: ["market", "videotok", "messages"], settings: {}, history: [], downloads: [] };
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
let minMounts = 0;
let minContext = null;
const min = {
  unreadCount: () => 7,
  search: () => ({ chats: [], messages: [], users: [] }),
  chatById: () => null,
  mount(container, context) {
    minMounts += 1;
    minContext = context;
    container.innerHTML = `<section class="min-app">МИН работает</section>`;
  }
};
const runtime = {
  getEngine: () => ({
    getState: () => state,
    updateState(updater) { updater(state); return { ok: true, state }; }
  })
};
const listeners = new Map();
const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: runtime,
  UntilFridayMinMessenger: min,
  UntilFridayVideotok: { VIDEOS: [], ROUTES: { watch: "https://videotok.local/watch/" } },
  document: {
    querySelector(selector) { return selector === ".personal-browser-window" ? windowElement : null; },
    addEventListener() {}
  },
  addEventListener(type, callback) { listeners.set(type, callback); },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "personal-browser-ui-v4.js" });

const api = context.UntilFridayPersonalBrowserUIV4;
assert.ok(api);
assert.equal(api.ROUTES.min.url, "https://min.local/");
assert.equal(api.pageFromAddress("https://min.local/chat/chat-lena"), "min");
assert.equal(api.pageFromAddress("МИН"), "min");
assert.equal(api.pageFromAddress("https://msg.local/"), null);

assert.equal(api.render(), true);
assert.match(page.innerHTML, /rb-newtab/);
assert.match(page.innerHTML, /7 непрочитанных/);

api.navigate("min");
assert.equal(title.textContent, "МИН — KONTUR Web");
assert.equal(status.textContent, "Защищённое соединение");
assert.equal(windowElement.dataset.browserV4, "true");
assert.equal(minMounts, 1);
assert.match(page.innerHTML, /class="min-app/);

minContext.navigate("https://min.local/chat/group-mods", "Сборка на 180 модов — МИН");
assert.equal(minMounts, 2);
assert.equal(minContext.url, "https://min.local/chat/group-mods");
assert.equal(title.textContent, "Сборка на 180 модов — МИН — KONTUR Web");

const minuteHandler = listeners.get("until-friday-state-change");
assert.ok(minuteHandler);
const beforeMinutes = minMounts;
minuteHandler({ detail: { reason: "time" } });
assert.equal(minMounts, beforeMinutes, "passive minute must not remount MIN");

const html = read("index.html");
assert.match(html, /src\/personal-browser-ui-v4\.js\?v=20260804-10/);
assert.match(html, /personal-browser-ui-v4\.css\?v=20260804-10/);
assert.match(html, /src\/min-messenger-p2p\.js\?v=20260804-10/);
assert.doesNotMatch(html, /personal-browser-ui-v3\.js|personal-browser-ui-v3\.css/);
assert.ok(html.indexOf("src/min-messenger.js") < html.indexOf("src/min-messenger-p2p.js") && html.indexOf("src/min-messenger-p2p.js") < html.indexOf("src/personal-browser-ui-v4.js"));

console.log("Browser UI v4 direct MIN route validation passed.");
