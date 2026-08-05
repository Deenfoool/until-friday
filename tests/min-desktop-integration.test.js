"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/min-desktop-integration.js");

assert.doesNotThrow(() => new Function(source), "desktop MIN integration must contain valid JavaScript");
assert.doesNotMatch(source, /advanceTime\(/, "ordinary MIN use must not spend game time");

for (const phrase of [
  "UntilFridayMinMessenger",
  "UntilFridayRuntimeEngine",
  "UNTIL_FRIDAY_STORY",
  "APP_ID = \"chat\"",
  "APP_TITLE = \"МИН\"",
  "work-chat-dima",
  "work-chat-oleg",
  "work-chat-roman",
  "work-chat-marina",
  "work-chat-andrey",
  "syncStoryMessages",
  "deliveredEvents",
  "completedActions",
  "listActions?.(\"chat\")",
  "applyAction(actionId)",
  "data-min-story-actions",
  "minDesktopLauncher",
  "data-min-desktop-badge",
  "data-rb-page=\"min\"",
  "data-rb-address-value*=\"min.local\"",
  "until-friday-open-app",
  "UntilFridayWindowLayout",
  "Min.mount"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `desktop integration must contain: ${phrase}`);
}

assert.match(source, /button\.replaceWith\(clone\)/, "old Connection launchers must be cloned without their old listeners");
assert.match(source, /\.app-window\[data-window-id=/, "stale Connection window must be removed");
assert.match(source, /action\?\.contactKey \? knownContactByKey\(action\.contactKey\)/, "story actions must prefer explicit contactKey routing");
assert.match(source, /action\.messageText \|\| action\.label/, "sent story messages must use the full authored player line");
assert.match(source, /action\.optionLabel \|\| action\.label/, "story choice buttons must use a short option label when available");
assert.match(source, /storyMessage: true/, "story messages must be marked inside MIN storage");
assert.match(source, /P2P доступен в настройках/, "desktop status must preserve real messenger networking");
assert.match(source, /pinned: Boolean\(chat\?\.pinned\)/, "story synchronization must preserve the user's chat pin state");
assert.match(source, /archived: Boolean\(chat\?\.archived\)/, "story synchronization must preserve archived work chats");
assert.match(source, /muted: Boolean\(chat\?\.muted\)/, "story synchronization must preserve muted work chats");
assert.doesNotMatch(
  source.match(/function ensureChat[\s\S]*?function upsertStoryMessage/)?.[0] || "",
  /pinned: true/,
  "work chat synchronization must never temporarily repin chats"
);

const css = read("min-desktop-integration.css");
for (const phrase of [
  ".min-desktop-icon-image",
  ".min-desktop-badge",
  ".min-desktop-window .window-content",
  ".min-desktop-story-actions",
  "[data-rb-page=\"min\"]",
  "[data-rb-address-value*=\"min.local\"]"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `desktop stylesheet must contain: ${phrase}`);
}

const html = read("index.html");
assert.match(html, /min-desktop-integration\.css\?v=20260804-1/);
assert.match(html, /src\/min-desktop-integration\.js\?v=20260805-3/);
assert.ok(
  html.indexOf("src/min-messenger.js") < html.indexOf("src/min-desktop-integration.js") &&
  html.indexOf("src/min-messenger-p2p.js") < html.indexOf("src/min-desktop-integration.js") &&
  html.indexOf("src/min-desktop-integration.js") < html.indexOf("src/personal-browser-ui-v4.js") &&
  html.indexOf("src/min-desktop-integration.js") < html.indexOf("src/bootstrap.js"),
  "desktop integration must load after MIN networking and before browser UI and game bootstrap"
);

const app = read("src/app-v2.js");
assert.match(app, /\{ id: \"chat\", name: \"Связь\"/, "technical chat ID remains for story compatibility and is replaced at runtime");

console.log("Standalone desktop MIN replacement validation passed.");
