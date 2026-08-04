"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/videotok.js");

assert.doesNotThrow(() => new Function(source), "Videotok module must parse");
assert.doesNotMatch(source, /ВидеоЛента|video\.local|UntilFridayVideoPlatform|document\.addEventListener/, "Videotok must be independent from the deleted VideoLenta stack and global click listeners");
assert.doesNotMatch(source, /<button class="vtk-channel-link"/, "video cards must not contain a channel button nested inside a video button");
assert.match(source, /event\.stopPropagation\(\)/, "channel and Watch Later clicks must not also open the video card");

const browser = { performActivity: () => ({ ok: true }) };
const context = { UntilFridayPersonalBrowser: browser, URL, console };
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "videotok.js" });

const api = context.UntilFridayVideotok;
assert.ok(api, "Videotok API must be exported");
assert.equal(api.CHANNELS.length, 12, "Videotok must contain twelve channels");
assert.equal(api.VIDEOS.length, 72, "Videotok must contain seventy-two videos");
assert.equal(new Set(api.VIDEOS.map((item) => item.id)).size, 72);
assert.ok(api.CHANNELS.every((channel) => channel.videos.length === 6));
assert.equal(api.VIDEOS[0].thumbnail, "assets/videotok/thumbs/video-001.webp");
assert.equal(api.VIDEOS.at(-1).thumbnail, "assets/videotok/thumbs/video-072.webp");
assert.equal(api.ROUTES.home, "https://videotok.local/");
assert.equal(api.parse("https://videotok.local/watch/vt-001").view, "watch");
assert.equal(api.parse("https://videotok.local/channel/garage-talk").view, "channel");
assert.equal(api.parse("https://videotok.local/watch-later").view, "later");

const empty = api.normalize({});
assert.deepEqual(JSON.parse(JSON.stringify(empty)), { subscriptions: [], later: [], liked: [], history: [], watched: [] });
const migrated = api.normalize({ videotok: { subscriptions: ["a", "a"], later: ["vt-001"], liked: ["vt-002"] } });
assert.deepEqual(JSON.parse(JSON.stringify(migrated.subscriptions)), ["a"]);

const container = {
  innerHTML: "",
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
const renderContext = {
  url: "https://videotok.local/",
  personal: {},
  selectedCategory: "all",
  navigate() {},
  setCategory() {},
  updatePersonal() {}
};
assert.equal(api.render(container, renderContext), true);
assert.match(container.innerHTML, /class="vtk-app/);
assert.match(container.innerHTML, /Видеоток/);
assert.match(container.innerHTML, /Подписки/);
assert.match(container.innerHTML, /Смотреть позже/);
assert.match(container.innerHTML, /Понравившиеся/);
assert.match(container.innerHTML, /Короткое замыкание/);

renderContext.url = "https://videotok.local/watch/vt-001";
assert.equal(api.render(container, renderContext), true);
assert.match(container.innerHTML, /class="vtk-watch/);
assert.match(container.innerHTML, /Ноутбук шумит, хотя ничего не запущено/);
assert.match(container.innerHTML, /Комментарии/);
assert.match(container.innerHTML, /Следующие видео/);

const css = read("videotok.css");
for (const phrase of [".vtk-top", ".vtk-sidebar", ".vtk-grid", ".vtk-watch", ".vtk-channel", "@media(max-width:620px)"]) assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

const html = read("index.html");
assert.match(html, /videotok\.css\?v=20260804-9/);
assert.match(html, /src\/videotok\.js\?v=20260804-9/);
assert.match(html, /src\/personal-browser-ui-v4\.js\?v=20260804-9/);
assert.doesNotMatch(html, /video-platform|video-content-pack|video-route-hardener|browser-direct-site-navigation|ВидеоЛента|video\.local|personal-browser-ui-v3\.js/);

console.log("Clean Videotok hosting validation passed with browser UI v4.");
