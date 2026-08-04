"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const packSource = read("src/video-content-pack.js");
const platformSource = read("src/video-platform-parody.js");
const fixesSource = read("src/video-platform-runtime-fixes.js");

assert.doesNotThrow(() => new Function(packSource), "video content pack must contain valid JavaScript");
assert.doesNotThrow(() => new Function(platformSource), "video platform must contain valid JavaScript");
assert.doesNotThrow(() => new Function(fixesSource), "video runtime fixes must contain valid JavaScript");
assert.doesNotMatch(platformSource, /new\s+MutationObserver\s*\(/, "video platform must use browser lifecycle events");
assert.doesNotMatch(fixesSource, /new\s+MutationObserver\s*\(/, "video fixes must use lifecycle events");

const listeners = new Map();
const browser = {
  VIDEOS: [],
  personalState: (value) => ({
    watched: [],
    subscriptions: [],
    watchLater: [],
    likedVideos: [],
    videoHistory: [],
    ...(value?.metadata?.personalBrowser || {})
  }),
  performActivity: () => ({ ok: true })
};
const state = { dayIndex: 0, minute: 540, metadata: { personalBrowser: {} } };
const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: {
    getEngine: () => ({
      getState: () => state,
      updateState: () => ({ ok: true, state })
    })
  },
  UntilFridayPersonalBrowserUIV2: {
    navigate() {}
  },
  document: {
    querySelector: () => null,
    addEventListener(type, callback) { listeners.set(type, callback); }
  },
  addEventListener(type, callback) { listeners.set(type, callback); },
  requestAnimationFrame: () => {},
  setTimeout: () => {},
  URL,
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(packSource, context, { filename: "video-content-pack.js" });
const pack = context.UntilFridayVideoContentPack;
assert.ok(pack, "video content pack API must be exported");
assert.equal(pack.CHANNELS.length, 16, "content pack must contain sixteen channels");
assert.equal(pack.VIDEOS.length, 80, "content pack must contain eighty videos");
assert.equal(new Set(pack.VIDEOS.map((video) => video.id)).size, 80, "all video IDs must be unique");
assert.equal(new Set(pack.CHANNELS.map((channel) => channel.id)).size, 16, "all channel IDs must be unique");
assert.ok(pack.CHANNELS.every((channel) => channel.videos.length === 5), "each channel must contain five videos");
assert.ok(pack.VIDEOS.every((video) => video.day === 0), "the complete feed must be available from Monday");
assert.equal(pack.VIDEOS[0].thumbnail, "assets/video/thumbs/video-thumb-001.webp");
assert.equal(pack.VIDEOS.at(-1).thumbnail, "assets/video/thumbs/video-thumb-080.webp");
assert.equal(pack.CHANNELS[0].avatar, "assets/video/channels/channel-avatar-001.webp");
assert.equal(pack.CHANNELS.at(-1).banner, "assets/video/channels/channel-banner-016.webp");
assert.deepEqual(JSON.parse(JSON.stringify(pack.THUMBNAIL_SIZE)), { width: 1280, height: 720, ratio: "16:9" });
assert.deepEqual(JSON.parse(JSON.stringify(pack.CHANNEL_AVATAR_SIZE)), { width: 800, height: 800, ratio: "1:1" });
assert.equal(pack.CHANNEL_BANNER_SIZE.width, 2048);
assert.equal(pack.CHANNEL_BANNER_SIZE.height, 1152);

vm.runInNewContext(platformSource, context, { filename: "video-platform-parody.js" });
const api = context.UntilFridayVideoPlatformParody;
assert.ok(api, "video platform API must be exported");
assert.equal(browser.VIDEOS.length, 80, "full content pack must replace the old six-video feed");
assert.equal(api.ROUTES.subscriptions, "https://video.local/feed/subscriptions");
assert.equal(api.ROUTES.watchLater, "https://video.local/playlist/watch-later");
assert.equal(api.ROUTES.history, "https://video.local/feed/history");
assert.equal(api.ROUTES.liked, "https://video.local/playlist/liked");

const user = {
  watched: [],
  subscriptions: ["garage-36"],
  watchLater: ["vl-001"],
  likedVideos: ["vl-002"],
  videoHistory: [{ videoId: "vl-001", dayIndex: 0, minute: 550 }]
};
assert.equal(api.recommendationFeed(user, "all").length, 80, "home recommendations must include the complete catalog");
assert.equal(api.recommendationFeed(user, "auto").length, 5, "category filters must isolate channel content");
assert.equal(api.relatedVideos(pack.VIDEOS[0], user).length, 79, "watch page must provide recommendations for every other video");
const normalized = api.videoState({ metadata: { personalBrowser: user } });
assert.deepEqual(JSON.parse(JSON.stringify(normalized.subscriptions)), ["garage-36"]);
assert.deepEqual(JSON.parse(JSON.stringify(normalized.watchLater)), ["vl-001"]);
assert.deepEqual(JSON.parse(JSON.stringify(normalized.likedVideos)), ["vl-002"]);

for (const phrase of [
  "routeButton(\"subscriptions\"",
  "routeButton(\"watchLater\"",
  "routeButton(\"history\"",
  "routeButton(\"liked\"",
  "data-vl-search",
  "data-vl-play",
  "data-vl-subscribe",
  "data-vl-later",
  "data-vl-like",
  "data-vl-autoplay",
  "vl-related",
  "vl-comments",
  "Короткие",
  "Смотреть позже",
  "Понравившиеся"
]) {
  assert.match(platformSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `video platform must contain: ${phrase}`);
}

const css = read("video-platform-parody.css");
for (const phrase of [
  ".vl-topbar",
  ".vl-sidebar",
  ".vl-feed-grid",
  ".vl-shorts",
  ".vl-watch-page",
  ".vl-player",
  ".vl-related",
  ".vl-comments",
  ".vl-channel-banner",
  ".vl-search-video",
  "@media(max-width:760px)"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `video platform stylesheet must contain: ${phrase}`);
}

const assetReadme = read("assets/video/README.md");
assert.match(assetReadme, /1280×720/);
assert.match(assetReadme, /800×800/);
assert.match(assetReadme, /2048×1152/);
assert.match(assetReadme, /video-thumb-001\.webp/);
assert.match(assetReadme, /video-thumb-080\.webp/);

const html = read("index.html");
for (const file of [
  "video-platform-parody.css",
  "src/video-content-pack.js",
  "src/video-platform-parody.js",
  "src/video-platform-runtime-fixes.js"
]) assert.match(html, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} must be connected`);
assert.ok(
  html.indexOf("src/browser-site-listener-gate.js") < html.indexOf("src/video-content-pack.js") &&
  html.indexOf("src/video-content-pack.js") < html.indexOf("src/video-platform-parody.js") &&
  html.indexOf("src/video-platform-parody.js") < html.indexOf("src/video-platform-runtime-fixes.js") &&
  html.indexOf("src/video-platform-runtime-fixes.js") < html.indexOf("src/browser-site-listener-gate-close.js") &&
  html.indexOf("src/browser-site-listener-gate-close.js") < html.indexOf("src/browser-site-router.js"),
  "video modules must load inside the shared listener gate and before the unified router"
);

console.log("Full VideoLenta parody platform validation passed.");
