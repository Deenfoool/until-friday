"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const packSource = read("src/video-content-pack.js");
const platformSource = read("src/video-platform-parody.js");

assert.doesNotThrow(() => new Function(packSource), "video content pack must parse");
assert.doesNotThrow(() => new Function(platformSource), "stable VideoLenta renderer must parse");
assert.doesNotMatch(platformSource, /document\.addEventListener\s*\(/, "VideoLenta renderer must not install global click refresh listeners");
assert.match(platformSource, /renderFailure/, "VideoLenta must expose visible render failures instead of failing silently");

let currentAddress = "https://video.local/";
const state = {
  dayIndex: 0,
  minute: 540,
  dayStarted: true,
  ended: false,
  metadata: { personalBrowser: {} },
  stats: {},
  flags: {}
};

const page = {
  innerHTML: "",
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
const title = { textContent: "" };
const status = { textContent: "" };
const addressInput = {};
Object.defineProperty(addressInput, "value", {
  get() { return currentAddress; },
  set(value) { currentAddress = String(value); }
});

const windowElement = {
  dataset: {},
  querySelector(selector) {
    if (selector === ".rb-address input") return addressInput;
    if (selector === ".rb-page") return page;
    if (selector === ".window-title") return title;
    if (selector === ".window-status") return status;
    return null;
  }
};

const browser = {
  VIDEOS: [],
  personalState(value) {
    return {
      watched: [],
      subscriptions: [],
      watchLater: [],
      likedVideos: [],
      videoHistory: [],
      autoplay: true,
      ...(value?.metadata?.personalBrowser || {})
    };
  },
  performActivity() { return { ok: true }; }
};

const runtime = {
  getEngine() {
    return {
      getState() { return state; },
      updateState(updater) {
        updater(state);
        return { ok: true, state };
      }
    };
  }
};

const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: runtime,
  UntilFridayPersonalBrowserUIV2: {
    navigate(pageId, data = {}) {
      currentAddress = data.url || (pageId === "video" ? "https://video.local/" : "kontur://newtab");
    }
  },
  document: {
    querySelector(selector) {
      if (selector === ".personal-browser-window") return windowElement;
      return null;
    }
  },
  URL,
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(packSource, context, { filename: "video-content-pack.js" });
vm.runInNewContext(platformSource, context, { filename: "video-platform-parody.js" });

const api = context.UntilFridayVideoPlatformParody;
assert.ok(api, "VideoLenta API must initialize");
assert.equal(browser.VIDEOS.length, 80, "stable renderer must install the complete 80-video catalog");

assert.equal(api.render(), true, "video.local home page must render successfully");
assert.equal(windowElement.dataset.videoPlatformActive, "true");
assert.match(page.innerHTML, /class="vl-app/);
assert.match(page.innerHTML, /class="vl-topbar/);
assert.match(page.innerHTML, /class="vl-sidebar/);
assert.match(page.innerHTML, /class="vl-feed-grid/);
assert.match(page.innerHTML, /Короткие/);
assert.match(page.innerHTML, /Подписки/);
assert.match(page.innerHTML, /Смотреть позже/);
assert.match(page.innerHTML, /Понравившиеся/);
assert.doesNotMatch(page.innerHTML, /ВидеоЛента не смогла загрузиться/);
assert.equal(title.textContent, "ВидеоЛента — KONTUR Web");
assert.equal(status.textContent, "Защищённое соединение · video.local");

currentAddress = "https://video.local/watch/vl-001";
assert.equal(api.render(), true, "watch page must render successfully");
assert.match(page.innerHTML, /class="vl-watch-page/);
assert.match(page.innerHTML, /Почему ноутбук греется даже без игр/);
assert.match(page.innerHTML, /class="vl-related/);
assert.match(page.innerHTML, /class="vl-comments/);
assert.doesNotMatch(page.innerHTML, /ВидеоЛента не смогла загрузиться/);

currentAddress = "https://video.local/feed/subscriptions";
assert.equal(api.render(), true, "subscriptions page must render successfully even when empty");
assert.match(page.innerHTML, /Подписки/);
assert.match(page.innerHTML, /Перейти на главную/);

console.log("VideoLenta real render smoke test passed.");
