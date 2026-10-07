"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const handlers = new Map();
let input, markup = "", writes = 0;
const button = (dataset) => ({ dataset, addEventListener(type, callback) { handlers.set(`${Object.values(dataset)[0]}:${type}`, callback); }, focus() {} });
const category = button({ kpCategory: "electronics" });
const quick = button({ kpQuick: "e-headphones" });
const page = {
  scrollTop: 420, scrollLeft: 12,
  get innerHTML() { return markup; },
  set innerHTML(value) {
    markup = value; writes++;
    input = { value: /<input value="([^"]*)"/.exec(value)?.[1] || "", selectionStart: 0, selectionEnd: 0,
      focus() { context.document.activeElement = this; },
      setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
  },
  querySelector(selector) {
    if (selector === ".kp-app") return markup.includes("kp-app") ? {} : null;
    if (selector === "[data-kp-search] input") return input;
    if (selector === "[data-kp-search]") return { addEventListener() {} };
    return null;
  },
  querySelectorAll(selector) {
    if (selector === "[data-kp-category]") return [category];
    if (selector === "[data-kp-quick]") return [quick];
    return [];
  }
};
const win = { dataset: {}, querySelector(selector) { return selector === ".rb-page" ? page : { textContent: "" }; } };
const listeners = new Map();
const context = {
  document: { activeElement: null, querySelector(selector) {
    if (selector === ".personal-browser-window .rb-address input") return { value: "https://kupitut.local/" };
    if (selector === ".personal-browser-window .rb-page") return page;
    return win;
  } },
  UntilFridayPersonalBrowser: { PRODUCTS: [], personalState: () => ({ cart: [], favorites: [] }) },
  UntilFridayRuntimeEngine: { getEngine: () => ({ getState: () => ({}) }) },
  addEventListener(type, callback) { listeners.set(type, callback); },
  requestAnimationFrame(callback) { callback(); }
};
vm.runInNewContext(fs.readFileSync("src/marketplace-parody.js", "utf8"), context);
const api = context.UntilFridayMarketplaceParody;
api.renderMarketplace();
input.value = "ещё не отправленный запрос";
input.selectionStart = 4; input.selectionEnd = 10;
context.document.activeElement = input;
const before = writes;
api.renderMarketplace();
assert.equal(writes, before + 1);
assert.equal(input.value, "ещё не отправленный запрос", "runtime refresh must preserve search draft");
assert.equal(context.document.activeElement, input, "focus must move to the replacement input");
assert.equal(input.selectionStart, 4);
assert.equal(input.selectionEnd, 10);
assert.equal(page.scrollTop, 420);
assert.equal(page.scrollLeft, 12);
const oldControl = { getAttribute(name) { return name === "data-kp-cart-item" ? "e-headphones" : null; } };
const newControl = { focus() { context.document.activeElement = this; } };
const controlPage = { scrollTop: 42, scrollLeft: 0,
  querySelector(selector) { return selector === ".kp-app" ? {} : null; },
  querySelectorAll() { return [oldControl]; } };
context.document.activeElement = oldControl;
const controlView = api.captureView(controlPage);
controlPage.querySelectorAll = () => [newControl];
api.restoreView(controlPage, controlView);
assert.equal(context.document.activeElement, newControl, "cart button focus must survive runtime refresh");
handlers.get("electronics:click")();
assert.equal(input.value, "", "explicit category switch must clear draft");
assert.match(markup, /5 товаров/);
assert.match(markup, /class="kp-quick"[^>]*aria-label="Открыть:/);
handlers.get("e-headphones:click")();
assert.match(markup, /class="kp-modal"/);
let stopped = false;
page.onkeydown({ key: "Escape", preventDefault() {}, stopPropagation() { stopped = true; } });
assert.equal(stopped, true);
assert.doesNotMatch(markup, /class="kp-modal"/);
for (const category of api.CATEGORIES) assert.ok(fs.existsSync(api.icon(category.icon)));
for (const match of fs.readFileSync("src/marketplace-parody.js", "utf8").matchAll(/icon\("([^\"]+)"/g)) assert.ok(fs.existsSync(api.icon(match[1])), match[1]);
assert.doesNotMatch(fs.readFileSync("marketplace-parody.css", "utf8"), /img\.icons8\.com/);
console.log("Marketplace draft, selection, scroll, keyboard and local icon checks passed.");
