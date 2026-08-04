"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const gateSource = read("src/browser-state-render-gate.js");
const closeSource = read("src/browser-state-render-gate-close.js");
const guardSource = read("src/personal-browser-diegetic-guard.js");
const routeSource = read("src/video-route-hardener.js");

for (const [name, source] of [
  ["browser state gate", gateSource],
  ["browser state gate close", closeSource],
  ["diegetic guard", guardSource],
  ["VideoLenta route hardener", routeSource]
]) {
  assert.doesNotThrow(() => new Function(source), `${name} must contain valid JavaScript`);
  assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, `${name} must not add a DOM observer`);
}

const registered = new Map();
function originalAddEventListener(type, listener) {
  if (!registered.has(type)) registered.set(type, []);
  registered.get(type).push(listener);
}
const gateContext = {
  addEventListener: originalAddEventListener,
  console
};
gateContext.window = gateContext;
gateContext.globalThis = gateContext;
vm.runInNewContext(gateSource, gateContext, { filename: "browser-state-render-gate.js" });

let stateCalls = 0;
gateContext.addEventListener("until-friday-state-change", () => { stateCalls += 1; });
assert.notEqual(gateContext.addEventListener, originalAddEventListener, "gate must temporarily wrap browser listener registration");
const gatedListener = registered.get("until-friday-state-change")[0];
gatedListener({ detail: { reason: "time", events: [] } });
assert.equal(stateCalls, 0, "plain passive clock tick must not rerender browser modules");
gatedListener({ detail: { reason: "time", events: [{ id: "mail-arrived" }] } });
assert.equal(stateCalls, 1, "clock events with delivered content must still refresh browser modules");
gatedListener({ detail: { reason: "personal-browser-activity" } });
assert.equal(stateCalls, 2, "browser state changes must still refresh browser modules");

vm.runInNewContext(closeSource, gateContext, { filename: "browser-state-render-gate-close.js" });
assert.equal(gateContext.addEventListener, originalAddEventListener, "global listener registration must be restored after browser modules load");

const browserWindow = {
  dataset: { browserV2: "true" },
  querySelector(selector) {
    if (selector === ".rb-address input") return { value: this.address || "" };
    return null;
  },
  address: "https://video.local/"
};
let baseRefreshes = 0;
let videoRefreshes = 0;
let shortRefreshes = 0;
let marketRefreshes = 0;
const guardContext = {
  UntilFridayRuntimeEngine: { notify() {} },
  UntilFridayPersonalBrowserUIV2: { schedule() { baseRefreshes += 1; } },
  UntilFridayVideoPlatformParody: { schedule() { videoRefreshes += 1; } },
  UntilFridayVideoPlatformRuntimeFixes: { schedule() { shortRefreshes += 1; } },
  UntilFridayMarketplaceParody: { schedule() { marketRefreshes += 1; } },
  document: {
    querySelector(selector) { return selector === ".personal-browser-window" ? browserWindow : null; },
    addEventListener() {}
  },
  addEventListener() {},
  setTimeout(callback) { callback(); },
  console
};
guardContext.window = guardContext;
guardContext.globalThis = guardContext;
vm.runInNewContext(guardSource, guardContext, { filename: "personal-browser-diegetic-guard.js" });
const guard = guardContext.UntilFridayPersonalBrowserDiegeticGuard;
guard.hideLegacyFrame();
assert.equal(browserWindow.dataset.browserV2, "true", "already rendered browser must not be hidden again");
guard.refreshBrowser();
assert.equal(videoRefreshes, 1, "video.local must refresh the full VideoLenta platform");
assert.equal(shortRefreshes, 1, "VideoLenta short cards must refresh with the platform");
assert.equal(baseRefreshes, 0, "video.local must not schedule the obsolete base video page");

browserWindow.address = "https://kupitut.local/";
guard.refreshBrowser();
assert.equal(marketRefreshes, 1, "Kupitut must refresh through its dedicated renderer");
assert.equal(baseRefreshes, 0);

browserWindow.address = "kontur://settings";
guard.refreshBrowser();
assert.equal(baseRefreshes, 1, "ordinary browser pages must still use the base renderer");

let navigated = null;
let directVideoRenders = 0;
let repairedShorts = 0;
browserWindow.address = "https://video.local/";
const routeContext = {
  UntilFridayPersonalBrowserUIV2: {
    navigate(page, data) { navigated = { page, data }; browserWindow.address = data.url; }
  },
  UntilFridayVideoPlatformParody: { render() { directVideoRenders += 1; } },
  UntilFridayVideoPlatformRuntimeFixes: { schedule() { repairedShorts += 1; } },
  document: {
    querySelector(selector) { return selector === ".personal-browser-window" ? browserWindow : null; },
    addEventListener() {}
  },
  addEventListener() {},
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  console
};
routeContext.window = routeContext;
routeContext.globalThis = routeContext;
vm.runInNewContext(routeSource, routeContext, { filename: "video-route-hardener.js" });
const hardener = routeContext.UntilFridayVideoRouteHardener;
hardener.openVideoAddress("https://video.local/watch/vl-017", "Тестовый ролик");
assert.deepEqual(JSON.parse(JSON.stringify(navigated)), {
  page: "video",
  data: { url: "https://video.local/watch/vl-017", title: "Тестовый ролик" }
});
assert.ok(directVideoRenders >= 1, "video route must finish with the full VideoLenta renderer");
assert.ok(repairedShorts >= 1, "video route must also schedule runtime card fixes");
assert.equal(hardener.isVideoAddress("https://video.local/feed/history"), true);
assert.equal(hardener.isVideoAddress("https://kupitut.local/"), false);

const index = read("index.html");
for (const file of [
  "src/browser-state-render-gate.js",
  "src/video-route-hardener.js",
  "src/browser-state-render-gate-close.js"
]) {
  assert.match(index, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} must be connected`);
}
assert.ok(
  index.indexOf("src/window-layout.js") < index.indexOf("src/browser-state-render-gate.js") &&
  index.indexOf("src/browser-state-render-gate.js") < index.indexOf("src/personal-browser.js") &&
  index.indexOf("src/personal-browser.js") < index.indexOf("src/personal-browser-ui-v2.js") &&
  index.indexOf("src/personal-browser-diegetic-guard.js") < index.indexOf("src/video-route-hardener.js") &&
  index.indexOf("src/video-route-hardener.js") < index.indexOf("src/browser-state-render-gate-close.js") &&
  index.indexOf("src/browser-state-render-gate-close.js") < index.indexOf("src/ui-runtime-guards.js"),
  "browser render gate must wrap legacy and modern browser module registration only"
);

console.log("Browser passive-clock stability and VideoLenta routing validation passed.");
