"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "min-messenger-responsive.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(css, /container-name:\s*min-messenger/, "MIN must expose its own responsive container");
assert.match(css, /container-type:\s*inline-size/, "MIN responsiveness must follow app width rather than viewport width");
assert.match(css, /@container\s+min-messenger\s*\(max-width:\s*720px\)/, "medium MIN windows must use container rules");
assert.match(css, /@container\s+min-messenger\s*\(max-width:\s*480px\)/, "narrow MIN windows must use compact container rules");
assert.match(css, /@container\s+min-messenger\s*\(max-width:\s*340px\)/, "very narrow MIN windows must stack controls");
assert.match(css, /\.min-p2p-settings\s*>\s*label\s*\{[\s\S]*?display:\s*grid/, "P2P rows must stack instead of overflowing");
assert.match(css, /\.min-p2p-connect\s*\{[\s\S]*?display:\s*grid/, "P2P connect controls must stack in the narrowest layout");
assert.match(css, /\.min-contact-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/, "contacts must collapse to one column");
assert.match(css, /\.min-page\s*>\s*header\s*\{[\s\S]*?flex-wrap:\s*wrap/, "page header actions must wrap instead of causing horizontal scrolling");
assert.match(css, /\.min-page\s*\{\s*overflow-x:\s*hidden/, "MIN pages must not expose horizontal overflow");

assert.match(html, /min-messenger-responsive\.css\?v=20260805-1/, "responsive stylesheet must be loaded by the game");
assert.ok(
  html.indexOf("min-messenger-p2p.css") < html.indexOf("min-messenger-responsive.css") &&
  html.indexOf("min-messenger.css") < html.indexOf("min-messenger-responsive.css"),
  "responsive overrides must load after the base messenger and P2P styles"
);

console.log("MIN responsive settings and contacts layout validation passed.");
