"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/marketplace-parody.js");

assert.doesNotThrow(() => new Function(source), "marketplace parody must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, "marketplace must use browser lifecycle events");
assert.doesNotMatch(source, /Баланс:/, "marketplace home page must not display the personal balance");

const products = [];
const listeners = new Map();
const browser = {
  PRODUCTS: products,
  personalState: () => ({ favorites: [], cart: [] }),
  performActivity: () => ({ ok: true })
};
const context = {
  UntilFridayPersonalBrowser: browser,
  UntilFridayRuntimeEngine: {
    getEngine: () => ({ getState: () => null }),
    notify() {}
  },
  document: {
    querySelector: () => null,
    addEventListener(type, callback) { listeners.set(type, callback); }
  },
  addEventListener(type, callback) { listeners.set(type, callback); },
  requestAnimationFrame: () => {},
  setTimeout: () => {},
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(source, context, { filename: "marketplace-parody.js" });
const api = context.UntilFridayMarketplaceParody;
assert.ok(api, "marketplace API must be exported");
assert.equal(api.CATEGORIES.length, 12, "marketplace must contain twelve complete categories");
assert.equal(api.PRODUCTS.length, 60, "marketplace must contain sixty products");
assert.equal(browser.PRODUCTS.length, 60, "expanded catalog must replace the small original product list");
assert.equal(new Set(api.PRODUCTS.map((item) => item.id)).size, 60, "all product IDs must be unique");

for (const category of api.CATEGORIES) {
  const items = api.PRODUCTS.filter((item) => item.category === category.id);
  assert.equal(items.length, 5, `category ${category.id} must contain five products`);
  assert.ok(items.every((item) => item.day === 0), `category ${category.id} must be available from Monday`);
  assert.ok(items.every((item) => item.image.startsWith("https://img.icons8.com/")), `category ${category.id} must use online product icons`);
}

for (const phrase of [
  "data-kp-search",
  "data-kp-category",
  "data-kp-sort",
  "data-kp-more",
  "data-kp-favorite",
  "data-kp-cart-item",
  "data-kp-quick",
  "data-kp-catalog",
  "data-kp-checkout",
  "ягодно выгодно",
  "РАСПРОДАЖА ДО ПЯТНИЦЫ",
  "Иконки интерфейса и товаров предоставлены Icons8"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `marketplace must contain: ${phrase}`);
}

const css = read("marketplace-parody.css");
for (const phrase of [
  "img.icons8.com",
  ".kp-header",
  ".kp-category-bar",
  ".kp-hero",
  ".kp-grid",
  ".kp-card",
  ".kp-catalog",
  ".kp-drawer",
  ".kp-modal",
  "data-rb-nav=\"back\"",
  "@media(max-width:720px)"
]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `marketplace stylesheet must contain: ${phrase}`);
}

const html = read("index.html");
assert.match(html, /marketplace-parody\.css/, "marketplace stylesheet must be connected");
assert.match(html, /src\/marketplace-parody\.js/, "marketplace module must be connected");
assert.match(html, /src\/browser-direct-site-navigation\.js/, "direct site navigation must be connected");
assert.doesNotMatch(html, /src\/browser-site-router\.js/, "obsolete address-guessing router must stay disconnected");
assert.ok(
  html.indexOf("src/browser-site-listener-gate.js") < html.indexOf("src/marketplace-parody.js") &&
  html.indexOf("src/marketplace-parody.js") < html.indexOf("src/browser-site-listener-gate-close.js") &&
  html.indexOf("src/browser-site-listener-gate-close.js") < html.indexOf("src/browser-direct-site-navigation.js"),
  "marketplace must load inside the listener gate and before direct page navigation"
);

console.log("Kupitut marketplace parody validation passed.");
