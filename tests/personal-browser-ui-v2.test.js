"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/personal-browser-ui-v2.js");
const guardSource = read("src/personal-browser-diegetic-guard.js");

assert.doesNotThrow(() => new Function(source), "rebuilt browser UI must contain valid JavaScript");
assert.doesNotThrow(() => new Function(guardSource), "browser diegetic guard must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, "browser UI must use lifecycle events");

for (const phrase of [
  "rb-tabstrip",
  "rb-address",
  "data-rb-nav",
  "data-rb-new-tab",
  "data-rb-menu-action",
  "kontur://settings",
  "kontur://downloads",
  "showBookmarksBar",
  "compactMode",
  "safeSearch",
  "Ctrl+T",
  "Ctrl+L",
  "KONTUR Web 12.4"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `rebuilt browser must contain: ${phrase}`);
}

const browser = {
  PRODUCTS: [],
  VIDEOS: [],
  MESSAGES: [],
  personalState: () => ({ history: [], bookmarks: [], settings: {} }),
  visibleHistory: () => [],
  unreadMessageCount: () => 0,
  performActivity: () => ({ ok: true })
};
const listeners = new Map();
const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: {
    getEngine: () => ({
      getState: () => ({ dayIndex: 0, minute: 540, metadata: {} }),
      updateState: () => ({ ok: true })
    })
  },
  document: {
    querySelector: () => null,
    addEventListener(type, callback) { listeners.set(type, callback); }
  },
  addEventListener(type, callback) { listeners.set(type, callback); },
  requestAnimationFrame: () => {},
  setTimeout: () => {},
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "personal-browser-ui-v2.js" });

const api = context.UntilFridayPersonalBrowserUIV2;
assert.ok(api, "rebuilt browser UI API must be exported");
assert.equal(api.ROUTES.home.url, "kontur://newtab");
assert.equal(api.ROUTES.settings.url, "kontur://settings");
assert.equal(api.DEFAULT_SETTINGS.showBookmarksBar, true);
assert.equal(api.DEFAULT_SETTINGS.compactMode, false);
assert.doesNotThrow(() => api.navigateAddress("https://kupitut.local/"));
assert.doesNotThrow(() => api.newTab());

const notices = [];
const guardContext = {
  UntilFridayRuntimeEngine: {
    notify(title, text) { notices.push({ title, text }); }
  },
  UntilFridayPersonalBrowserUIV2: { schedule() {} },
  document: {
    querySelector: () => null,
    addEventListener() {}
  },
  addEventListener() {},
  setTimeout(callback) { callback(); },
  console
};
guardContext.window = guardContext;
guardContext.globalThis = guardContext;
vm.runInNewContext(guardSource, guardContext, { filename: "personal-browser-diegetic-guard.js" });
guardContext.UntilFridayRuntimeEngine.notify("Личное время", "Просмотрено видео · 10 мин.");
assert.equal(notices.length, 0, "browser timing meta notification must remain hidden");
guardContext.UntilFridayRuntimeEngine.notify("Почта", "Новое письмо");
assert.deepEqual(notices, [{ title: "Почта", text: "Новое письмо" }]);

const css = read("personal-browser-ui-v2.css");
for (const phrase of [
  ".rb-tabstrip",
  ".rb-toolbar",
  ".rb-address",
  ".rb-menu",
  ".rb-newtab",
  ".rb-products",
  ".rb-videos",
  ".rb-messages",
  ".rb-settings",
  "@media(max-width:720px)"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `rebuilt browser stylesheet must contain: ${phrase}`);
}

const html = read("index.html");
assert.match(html, /personal-browser-ui-v2\.css/, "rebuilt browser stylesheet must be connected");
assert.match(html, /src\/personal-browser-ui-v2\.js/, "rebuilt browser UI must be connected");
assert.match(html, /src\/personal-browser-diegetic-guard\.js/, "browser diegetic guard must be connected");
assert.doesNotMatch(html, /personal-browser-immersion/, "obsolete immersion patch must stay removed");
assert.ok(
  html.indexOf("src/personal-browser.js") < html.indexOf("src/personal-browser-ui-v2.js") &&
  html.indexOf("src/personal-browser-ui-v2.js") < html.indexOf("src/personal-browser-diegetic-guard.js") &&
  html.indexOf("src/personal-browser-diegetic-guard.js") < html.indexOf("src/bootstrap.js"),
  "browser modules must load in mechanics, UI, guard order"
);

console.log("Rebuilt personal browser UI validation passed.");
