"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/min-messenger-p2p.js");

assert.doesNotThrow(() => new Function(source), "MIN P2P module must contain valid JavaScript");
assert.doesNotMatch(source, /UntilFridayRuntimeEngine|advanceTime|metadata\.personalBrowser/, "P2P network must not depend on game state");

for (const phrase of [
  "UntilFridayMinMessenger",
  "until-friday-min-peer-id-v1",
  "new PeerCtor",
  "peer.connect",
  "peer.call",
  "peer.on(\"connection\"",
  "peer.on(\"call\"",
  "connection.send",
  "message-sync",
  "reaction-patch",
  "typing",
  "serializeAttachments",
  "receiveAttachments",
  "getUserMedia",
  "WebRTC",
  "MIN-ID",
  "data-min-p2p-connect",
  "data-min-p2p-call",
  "MutationObserver"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `P2P module must contain: ${phrase}`);
}

assert.match(source, /connection\.on\("open"/);
assert.match(source, /connection\.on\("data"/);
assert.match(source, /currentCall\.on\("stream"/);
assert.match(source, /call\.answer\(localStream\)/);
assert.match(source, /record\?\.blob/);
assert.match(source, /item\.blob instanceof Blob/);
assert.match(source, /setInterval\(syncOutgoing, 700\)/);
assert.match(source, /stopImmediatePropagation\(\)/, "P2P calls must suppress the local-only call preview for connected chats");

const css = read("min-messenger-p2p.css");
for (const phrase of [
  ".min-p2p-settings",
  ".min-p2p-status",
  ".min-p2p-connect",
  ".min-p2p-contact-button",
  ".min-p2p-call-overlay",
  "[data-min-p2p-local-video]",
  "@media(max-width:720px)"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `P2P stylesheet must contain: ${phrase}`);
}

const html = read("index.html");
assert.match(html, /min-messenger-p2p\.css\?v=20260804-10/);
assert.match(html, /https:\/\/unpkg\.com\/peerjs@1\.5\.5\/dist\/peerjs\.min\.js/);
assert.match(html, /src\/min-messenger-p2p\.js\?v=20260804-10/);
assert.ok(
  html.indexOf("src/min-messenger.js") < html.indexOf("peerjs@1.5.5") &&
  html.indexOf("peerjs@1.5.5") < html.indexOf("src/min-messenger-p2p.js") &&
  html.indexOf("src/min-messenger-p2p.js") < html.indexOf("src/personal-browser-ui-v4.js"),
  "MIN, PeerJS, P2P plugin and browser UI must load in dependency order"
);

console.log("MIN peer-to-peer network contract validation passed.");
