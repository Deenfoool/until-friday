"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const gateSource = read("src/browser-site-listener-gate.js");
const closeSource = read("src/browser-site-listener-gate-close.js");
const routerSource = read("src/browser-site-router.js");
const notifySource = read("src/personal-browser-notification-guard.js");

for (const [name, source] of [
  ["site listener gate", gateSource],
  ["site listener gate close", closeSource],
  ["site router", routerSource],
  ["notification guard", notifySource]
]) {
  assert.doesNotThrow(() => new Function(source), `${name} must contain valid JavaScript`);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, `${name} must not add a MutationObserver`);
}

assert.doesNotMatch(routerSource, /preventDefault\s*\(|stopImmediatePropagation/, "site router must never block normal browser navigation");
assert.match(routerSource, /NAVIGATION_SELECTOR/, "site router must react only to browser navigation controls");
assert.doesNotMatch(routerSource, /closest\?\.\(\"\.personal-browser-window\"\)/, "site router must not rerender after arbitrary clicks inside the browser");

const forwarded = [];
function originalAdd(type, listener, options) {
  forwarded.push({ type, listener, options });
}
const gateDocument = { addEventListener: originalAdd };
const gateContext = { document: gateDocument, console };
gateContext.window = gateContext;
gateContext.globalThis = gateContext;
vm.runInNewContext(gateSource, gateContext, { filename: "browser-site-listener-gate.js" });

gateDocument.addEventListener("click", () => {}, true);
gateDocument.addEventListener("submit", () => {}, { capture: true });
gateDocument.addEventListener("click", () => {}, false);
gateDocument.addEventListener("error", () => {}, true);
assert.equal(gateContext.UntilFridayBrowserSiteListenerGate.blocked.length, 2, "broad capture click and submit listeners must be blocked");
assert.deepEqual(forwarded.map((entry) => entry.type), ["click", "error"], "normal and unrelated listeners must remain available");
vm.runInNewContext(closeSource, gateContext, { filename: "browser-site-listener-gate-close.js" });
assert.equal(gateDocument.addEventListener, originalAdd, "document listener registration must be restored after site modules load");

let address = "kontur://newtab";
let marketRenders = 0;
let videoRenders = 0;
let videoFixes = 0;
let baseNavigations = 0;
let baseRenders = 0;
const documentListeners = new Map();
const rootListeners = new Map();
const browserWindow = {
  dataset: {},
  querySelector(selector) {
    if (selector === ".rb-address input") return { value: address };
    return null;
  }
};
const browserUI = {
  navigate(page, data = {}) {
    baseNavigations += 1;
    address = data.url || (page === "market" ? "https://kupitut.local/" : page === "video" ? "https://video.local/" : "kontur://newtab");
  },
  render() { baseRenders += 1; }
};
const context = {
  UntilFridayPersonalBrowserUIV2: browserUI,
  UntilFridayMarketplaceParody: { renderMarketplace() { marketRenders += 1; } },
  UntilFridayVideoPlatformParody: { render() { videoRenders += 1; } },
  UntilFridayVideoPlatformRuntimeFixes: { schedule() { videoFixes += 1; } },
  document: {
    querySelector(selector) { return selector === ".personal-browser-window" ? browserWindow : null; },
    addEventListener(type, listener) { documentListeners.set(type, listener); }
  },
  addEventListener(type, listener) { rootListeners.set(type, listener); },
  queueMicrotask(callback) { callback(); },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  Promise,
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(routerSource, context, { filename: "browser-site-router.js" });
const router = context.UntilFridayBrowserSiteRouter;
assert.ok(router, "site router API must be exported");

browserUI.navigate("market", { url: "https://kupitut.local/" });
assert.equal(baseNavigations, 1, "normal browser navigation must run first");
assert.equal(marketRenders, 1, "Kupitut address must synchronously render the full marketplace");
assert.equal(videoRenders, 0);

browserUI.navigate("video", { url: "https://video.local/" });
assert.equal(baseNavigations, 2);
assert.equal(videoRenders, 1, "VideoLenta address must synchronously render the full video platform");
assert.equal(videoFixes, 1, "VideoLenta runtime card fixes must run with the platform");

address = "kontur://newtab";
router.renderCurrentSite();
assert.equal(marketRenders, 1, "base browser pages must not invoke the marketplace renderer");
assert.equal(videoRenders, 1, "base browser pages must not invoke the video renderer");

const clickListener = documentListeners.get("click");
assert.ok(clickListener, "router must register one targeted click listener");
clickListener({ target: { closest: () => null } });
assert.equal(marketRenders, 1, "blank background clicks must not render Kupitut");
assert.equal(videoRenders, 1, "blank background clicks must not render VideoLenta");

const index = read("index.html");
for (const file of [
  "src/browser-site-listener-gate.js",
  "src/browser-site-listener-gate-close.js",
  "src/personal-browser-notification-guard.js",
  "src/browser-site-router.js"
]) {
  assert.match(index, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} must be connected`);
}
for (const obsolete of [
  "src/marketplace-listener-gate.js",
  "src/marketplace-listener-gate-close.js",
  "src/personal-browser-diegetic-guard.js",
  "src/video-route-hardener.js"
]) {
  assert.doesNotMatch(index, new RegExp(obsolete.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${obsolete} must stay disconnected`);
}
assert.ok(
  index.indexOf("src/personal-browser-ui-v2.js") < index.indexOf("src/browser-site-listener-gate.js") &&
  index.indexOf("src/browser-site-listener-gate.js") < index.indexOf("src/marketplace-parody.js") &&
  index.indexOf("src/marketplace-parody.js") < index.indexOf("src/video-platform-parody.js") &&
  index.indexOf("src/video-platform-runtime-fixes.js") < index.indexOf("src/browser-site-listener-gate-close.js") &&
  index.indexOf("src/browser-site-listener-gate-close.js") < index.indexOf("src/browser-site-router.js"),
  "site listener gate and router must wrap the site modules in one deterministic order"
);

console.log("Direct Kupitut and VideoLenta routing validation passed.");
