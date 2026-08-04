"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const gateSource = read("src/browser-site-listener-gate.js");
const closeSource = read("src/browser-site-listener-gate-close.js");
const navigationSource = read("src/browser-direct-site-navigation.js");
const baseUiSource = read("src/personal-browser-ui-v2.js");

for (const [name, source] of [
  ["site listener gate", gateSource],
  ["site listener gate close", closeSource],
  ["direct site navigation", navigationSource]
]) {
  assert.doesNotThrow(() => new Function(source), `${name} must contain valid JavaScript`);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, `${name} must not add a MutationObserver`);
}

assert.match(navigationSource, /DIRECT_PAGE_SELECTOR/, "direct navigation must target marketplace and video buttons explicitly");
assert.match(navigationSource, /stopImmediatePropagation/, "direct site buttons must bypass the obsolete local page renderer");
assert.match(navigationSource, /originalNavigate/, "direct site navigation must run the real browser navigation exactly once");
assert.match(baseUiSource, /\.personal-browser-window, \[data-personal-browser-launcher\]/, "base UI broad click listener must remain gated during module load");

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
assert.equal(gateDocument.addEventListener, originalAdd, "document listener registration must be restored after browser modules load");

let address = "kontur://newtab";
let baseNavigations = 0;
let marketRenders = 0;
let videoRenders = 0;
let videoFixes = 0;
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
    address = data.url || (page === "market"
      ? "https://kupitut.local/"
      : page === "video"
        ? "https://video.local/"
        : "kontur://newtab");
  }
};

function addListener(store, type, listener, options) {
  if (!store.has(type)) store.set(type, []);
  store.get(type).push({ listener, capture: options === true || Boolean(options?.capture) });
}

const context = {
  UntilFridayPersonalBrowserUIV2: browserUI,
  UntilFridayMarketplaceParody: {
    renderMarketplace() {
      marketRenders += 1;
      browserWindow.dataset.marketplaceActive = "true";
    }
  },
  UntilFridayVideoPlatformParody: {
    render() {
      videoRenders += 1;
      browserWindow.dataset.videoPlatformActive = "true";
    }
  },
  UntilFridayVideoPlatformRuntimeFixes: {
    schedule() { videoFixes += 1; }
  },
  document: {
    querySelector(selector) {
      return selector === ".personal-browser-window" ? browserWindow : null;
    },
    addEventListener(type, listener, options) {
      addListener(documentListeners, type, listener, options);
    }
  },
  addEventListener(type, listener, options) {
    addListener(rootListeners, type, listener, options);
  },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(navigationSource, context, { filename: "browser-direct-site-navigation.js" });

const api = context.UntilFridayBrowserDirectSiteNavigation;
assert.ok(api, "direct site navigation API must be exported");
assert.equal(api.pageFromAddress("https://kupitut.local/"), "market");
assert.equal(api.pageFromAddress("https://video.local/watch/vl-001"), "video");
assert.equal(api.pageFromAddress("kontur://newtab"), null);

function dispatch(type, target) {
  const event = {
    target,
    defaultPrevented: false,
    immediateStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.immediateStopped = true; }
  };
  const rows = documentListeners.get(type) || [];
  for (const phase of [true, false]) {
    for (const row of rows.filter((item) => item.capture === phase)) {
      row.listener(event);
      if (event.immediateStopped) return event;
    }
  }
  return event;
}

function pageButton(page) {
  const button = { dataset: { rbPage: page } };
  return {
    closest(selector) {
      return selector.includes(`[data-rb-page="${page}"]`) ? button : null;
    }
  };
}

const marketClick = dispatch("click", pageButton("market"));
assert.equal(marketClick.defaultPrevented, true, "market button must be handled directly");
assert.equal(baseNavigations, 1, "market click must perform one browser navigation");
assert.equal(address, "https://kupitut.local/");
assert.equal(marketRenders, 1, "market click must render only the full WB parody");
assert.equal(videoRenders, 0);
assert.equal(browserWindow.dataset.marketplaceActive, "true");

const videoClick = dispatch("click", pageButton("video"));
assert.equal(videoClick.defaultPrevented, true, "video button must be handled directly");
assert.equal(baseNavigations, 2, "video click must perform one additional browser navigation");
assert.equal(address, "https://video.local/");
assert.equal(marketRenders, 1, "video click must not rerender Kupitut");
assert.equal(videoRenders, 1, "video click must render the full VideoLenta platform");
assert.equal(videoFixes, 1);
assert.equal(browserWindow.dataset.videoPlatformActive, "true");
assert.equal(browserWindow.dataset.marketplaceActive, undefined, "opening VideoLenta must clear the marketplace flag");

const blankTarget = { closest() { return null; } };
dispatch("click", blankTarget);
assert.equal(marketRenders, 1, "blank background click must not render Kupitut");
assert.equal(videoRenders, 1, "blank background click must not render VideoLenta");

const historyButton = { dataset: { rbAddressValue: "https://kupitut.local/catalog/home" } };
dispatch("click", {
  closest(selector) {
    if (selector === "[data-rb-address-value]") return historyButton;
    return null;
  }
});
assert.equal(address, "https://kupitut.local/catalog/home");
assert.equal(marketRenders, 2, "market history entry must open the full marketplace");
assert.equal(videoRenders, 1);

const addressForm = {
  querySelector(selector) {
    return selector === "input" ? { value: "https://video.local/" } : null;
  }
};
dispatch("submit", {
  closest(selector) {
    return selector === "[data-rb-address]" ? addressForm : null;
  }
});
assert.equal(address, "https://video.local/");
assert.equal(videoRenders, 2, "address bar must open the full VideoLenta platform");
assert.equal(marketRenders, 2);

const index = read("index.html");
for (const file of [
  "src/browser-site-listener-gate.js",
  "src/browser-site-listener-gate-close.js",
  "src/browser-direct-site-navigation.js"
]) {
  assert.match(index, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} must be connected`);
}
for (const obsolete of [
  "src/browser-site-router.js",
  "src/marketplace-listener-gate.js",
  "src/marketplace-listener-gate-close.js",
  "src/personal-browser-diegetic-guard.js",
  "src/video-route-hardener.js"
]) {
  assert.doesNotMatch(index, new RegExp(obsolete.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${obsolete} must stay disconnected`);
}
assert.ok(
  index.indexOf("src/personal-browser.js") < index.indexOf("src/browser-site-listener-gate.js") &&
  index.indexOf("src/browser-site-listener-gate.js") < index.indexOf("src/personal-browser-ui-v2.js") &&
  index.indexOf("src/personal-browser-ui-v2.js") < index.indexOf("src/marketplace-parody.js") &&
  index.indexOf("src/marketplace-parody.js") < index.indexOf("src/video-platform-parody.js") &&
  index.indexOf("src/video-platform-runtime-fixes.js") < index.indexOf("src/browser-site-listener-gate-close.js") &&
  index.indexOf("src/browser-site-listener-gate-close.js") < index.indexOf("src/browser-direct-site-navigation.js"),
  "direct navigation must load after the complete site modules and after listener registration is restored"
);

console.log("Direct Kupitut and VideoLenta click routing validation passed.");
