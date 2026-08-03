"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles-v2.css"), "utf8");

const glyphRule = css.match(/\.desktop-icon \.desktop-icon__glyph\s*\{([^}]+)\}/);
assert.ok(glyphRule, "desktop glyph override must exist");
assert.match(glyphRule[1], /width:\s*60px/, "desktop glyph holder must fit the enlarged artwork");
assert.match(glyphRule[1], /height:\s*60px/, "desktop glyph holder must fit the enlarged artwork");
assert.match(glyphRule[1], /background:\s*transparent/, "desktop icon tile must be transparent");
assert.match(glyphRule[1], /border:\s*0/, "desktop icon tile border must be removed");
assert.match(glyphRule[1], /box-shadow:\s*none/, "desktop icon tile shadow must be removed");

const imageRule = css.match(/\.desktop-icon \.asset-app-icon\s*\{([^}]+)\}/);
assert.ok(imageRule, "desktop image size override must exist");
assert.match(imageRule[1], /width:\s*57px/, "desktop PNG width must be increased by 50 percent from 38px");
assert.match(imageRule[1], /height:\s*57px/, "desktop PNG height must be increased by 50 percent from 38px");

const startMenuRule = css.match(/\.start-app \.asset-app-icon\s*\{([^}]+)\}/);
assert.ok(startMenuRule, "Start menu icon rule must remain separate");
assert.match(startMenuRule[1], /width:\s*26px/, "Start menu icons must remain compact");

console.log("Desktop icon presentation validation passed.");
