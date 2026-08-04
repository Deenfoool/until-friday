"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const gateSource = read("src/marketplace-listener-gate.js");
const closeSource = read("src/marketplace-listener-gate-close.js");
const scrollSource = read("src/marketplace-scroll-preserver.js");
const guardSource = read("src/personal-browser-diegetic-guard.js");

for (const [name, source] of [
  ["marketplace listener gate", gateSource],
  ["marketplace listener gate close", closeSource],
  ["marketplace scroll preserver", scrollSource],
  ["browser diegetic guard", guardSource]
]) {
  assert.doesNotThrow(() => new Function(source), `${name} must contain valid JavaScript`);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, `${name} must not add a DOM observer`);
}

const forwarded = [];
function originalDocumentAdd(type, listener, options) {
  forwarded.push({ type, listener, options });
}
const documentForGate = { addEventListener: originalDocumentAdd };
const gateContext = { document: documentForGate, console };
gateContext.window = gateContext;
gateContext.globalThis = gateContext;
vm.runInNewContext(gateSource, gateContext, { filename: "marketplace-listener-gate.js" });

const noop = () => {};
documentForGate.addEventListener("click", noop, true);
documentForGate.addEventListener("submit", noop, { capture: true });
documentForGate.addEventListener("click", noop, false);
documentForGate.addEventListener("pointerdown", noop, true);

assert.equal(gateContext.UntilFridayMarketplaceListenerGate.blocked.length, 2, "marketplace gate must block its two redundant global refresh listeners");
assert.deepEqual(forwarded.map((entry) => entry.type), ["click", "pointerdown"], "normal bubble and unrelated listeners must still register");
vm.runInNewContext(closeSource, gateContext, { filename: "marketplace-listener-gate-close.js" });
assert.equal(documentForGate.addEventListener, originalDocumentAdd, "document listener registration must be restored immediately after marketplace setup");

assert.match(guardSource, /\[data-personal-browser-launcher\]/, "browser guard may refresh after opening the browser");
assert.doesNotMatch(guardSource, /event\.target\.closest\?\.\(\"\.personal-browser-window/, "browser guard must not refresh on arbitrary clicks inside the browser window");

const page = { scrollTop: 420, scrollLeft: 17 };
const addressInput = { value: "https://kupitut.local/" };
const windowElement = {
  querySelector(selector) {
    if (selector === ".rb-address input") return addressInput;
    if (selector === ".rb-page") return page;
    return null;
  }
};
const registered = new Map();
const pending = [];
const documentForScroll = {
  querySelector(selector) {
    return selector === ".personal-browser-window[data-marketplace-active='true']" ? windowElement : null;
  },
  addEventListener(type, listener) { registered.set(type, listener); }
};
const scrollContext = {
  document: documentForScroll,
  setTimeout(callback) { pending.push(callback); },
  requestAnimationFrame(callback) { pending.push(callback); },
  console
};
scrollContext.window = scrollContext;
scrollContext.globalThis = scrollContext;
vm.runInNewContext(scrollSource, scrollContext, { filename: "marketplace-scroll-preserver.js" });

const target = { closest: () => windowElement };
registered.get("pointerdown")({ target });
page.scrollTop = 0;
page.scrollLeft = 0;
while (pending.length) pending.shift()();
assert.equal(page.scrollTop, 420, "real marketplace updates must restore vertical scroll position");
assert.equal(page.scrollLeft, 17, "real marketplace updates must restore horizontal scroll position");

const index = read("index.html");
for (const file of [
  "src/marketplace-listener-gate.js",
  "src/marketplace-listener-gate-close.js",
  "src/marketplace-scroll-preserver.js"
]) {
  assert.match(index, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} must be connected`);
}
assert.ok(
  index.indexOf("src/marketplace-listener-gate.js") < index.indexOf("src/marketplace-parody.js") &&
  index.indexOf("src/marketplace-parody.js") < index.indexOf("src/marketplace-listener-gate-close.js") &&
  index.indexOf("src/marketplace-listener-gate-close.js") < index.indexOf("src/marketplace-scroll-preserver.js") &&
  index.indexOf("src/marketplace-scroll-preserver.js") < index.indexOf("src/video-content-pack.js"),
  "marketplace gate must wrap only marketplace registration and scroll preservation must load afterward"
);

console.log("Stable Kupitut click and scroll validation passed.");
