"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/marketplace-parody.js");

assert.doesNotThrow(() => new Function(source), "marketplace parody must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/);
assert.doesNotMatch(source, /Баланс:/, "marketplace home page must not display the personal balance");

const products = [];
const browser = { PRODUCTS: products, personalState: () => ({ favorites: [], cart: [] }), performActivity: () => ({ ok: true }) };
const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: { getEngine: () => ({ getState: () => null }), notify() {} },
  document: { querySelector: () => null, addEventListener() {} },
  addEventListener() {},
  requestAnimationFrame() {},
  setTimeout() {},
  console
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "marketplace-parody.js" });

const api = context.UntilFridayMarketplaceParody;
assert.ok(api);
assert.equal(api.CATEGORIES.length, 12);
assert.equal(api.PRODUCTS.length, 60);
assert.equal(browser.PRODUCTS.length, 60);
assert.equal(new Set(api.PRODUCTS.map((item) => item.id)).size, 60);
for (const category of api.CATEGORIES) {
  const items = api.PRODUCTS.filter((item) => item.category === category.id);
  assert.equal(items.length, 5);
  assert.ok(items.every((item) => item.day === 0));
  assert.ok(items.every((item) => item.image.startsWith("https://img.icons8.com/")));
}

for (const phrase of ["data-kp-search", "data-kp-category", "data-kp-sort", "data-kp-more", "data-kp-favorite", "data-kp-cart-item", "data-kp-quick", "data-kp-catalog", "data-kp-checkout", "ягодно выгодно", "РАСПРОДАЖА ДО ПЯТНИЦЫ"]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const css = read("marketplace-parody.css");
for (const phrase of [".kp-header", ".kp-category-bar", ".kp-hero", ".kp-grid", ".kp-card", ".kp-catalog", ".kp-drawer", ".kp-modal", "@media(max-width:720px)"]) assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

const html = read("index.html");
assert.match(html, /marketplace-parody\.css\?v=20260804-9/);
assert.match(html, /src\/marketplace-parody\.js\?v=20260804-9/);
assert.match(html, /src\/personal-browser-ui-v4\.js\?v=20260804-9/);
assert.doesNotMatch(html, /browser-direct-site-navigation|browser-site-router|personal-browser-ui-v3\.js/);
assert.ok(
  html.indexOf("src/browser-site-listener-gate.js") < html.indexOf("src/marketplace-parody.js") &&
  html.indexOf("src/marketplace-parody.js") < html.indexOf("src/browser-site-listener-gate-close.js") &&
  html.indexOf("src/browser-site-listener-gate-close.js") < html.indexOf("src/personal-browser-ui-v4.js")
);

console.log("Kupitut marketplace parody validation passed with browser UI v4.");
