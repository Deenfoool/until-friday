"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/personal-browser-ui-v3.js");

assert.doesNotThrow(() => new Function(source), "browser UI v3 must parse");
assert.doesNotMatch(source, /ВидеоЛента|video\.local|UntilFridayVideoPlatform|browser-direct-site-navigation/);
assert.doesNotMatch(source, /document\.addEventListener\("click"/, "browser v3 must not use a global click rerender listener");

for (const phrase of [
  "videotok.local",
  "UntilFridayVideotok",
  "UntilFridayMarketplaceParody",
  "data-rb-page=\"videotok\"",
  "data-browser-v3-shell",
  "pageFromAddress",
  "personal-browser-bookmark",
  "Ctrl+T"
]) assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

const browser = {
  PRODUCTS: [],
  MESSAGES: [],
  personalState: () => ({ bookmarks: ["market", "video", "messages"], settings: {}, history: [], replies: {}, downloads: [] }),
  visibleHistory: () => [],
  unreadMessageCount: () => 0,
  performActivity: () => ({ ok: true })
};
const runtime = { getEngine: () => ({ getState: () => ({ dayIndex: 0, minute: 540, metadata: {} }), updateState: () => ({ ok: true }) }) };
const listeners = new Map();
const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: runtime,
  document: { addEventListener() {}, querySelector: () => null },
  addEventListener(type, callback) { listeners.set(type, callback); },
  requestAnimationFrame() {},
  setTimeout() {},
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "personal-browser-ui-v3.js" });

const api = context.UntilFridayPersonalBrowserUIV3;
assert.ok(api);
assert.equal(api.ROUTES.market.url, "https://kupitut.local/");
assert.equal(api.ROUTES.videotok.url, "https://videotok.local/");
assert.equal(api.pageFromAddress("https://kupitut.local/catalog"), "market");
assert.equal(api.pageFromAddress("https://videotok.local/watch/vt-001"), "videotok");
assert.equal(api.pageFromAddress("https://video.local/"), null, "deleted video.local route must not resolve");
assert.doesNotThrow(() => api.navigateAddress("https://videotok.local/"));

const html = read("index.html");
assert.match(html, /src\/personal-browser-ui-v3\.js\?v=20260804-7/);
assert.match(html, /personal-browser-ui-v3\.css\?v=20260804-7/);
assert.doesNotMatch(html, /personal-browser-ui-v2\.js/);
assert.ok(
  html.indexOf("src/videotok.js") < html.indexOf("src/personal-browser-ui-v3.js") &&
  html.indexOf("src/marketplace-parody.js") < html.indexOf("src/personal-browser-ui-v3.js") &&
  html.indexOf("src/personal-browser-ui-v3.js") < html.indexOf("src/browser-state-render-gate-close.js")
);

console.log("Single-source personal browser UI v3 validation passed.");
