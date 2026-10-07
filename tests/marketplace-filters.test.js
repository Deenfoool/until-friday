"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = { UntilFridayPersonalBrowser: { PRODUCTS: [] }, UntilFridayRuntimeEngine: {}, document: { querySelector: () => null } };
vm.runInNewContext(fs.readFileSync("src/marketplace-parody.js", "utf8"), context);
const api = context.UntilFridayMarketplaceParody;
const defaults = { category: "all", query: "", sort: "popular", favoritesOnly: false, minPrice: 0, maxPrice: null, minRating: 0 };
const choose = (changes = {}, user = {}) => api.selectProducts(api.PRODUCTS, { ...defaults, ...changes }, user);
const ids = (items) => Array.from(items, (item) => item.id);
const original = ids(api.PRODUCTS);
assert.equal(choose().length, 60);
assert.deepEqual(ids(choose({ category: "electronics", minPrice: 1000, maxPrice: 2000, sort: "cheap" })), ["e-mouse", "e-powerbank"]);
assert.deepEqual(ids(choose({ category: "electronics", minPrice: 1000, maxPrice: 2000, minRating: 4.9 })), ["e-powerbank"]);
assert.deepEqual(ids(choose({ minPrice: 1990, maxPrice: 1990, query: "пауэрбанк" })), ["e-powerbank"], "price boundaries must be inclusive");
assert.equal(choose({ maxPrice: 0 }).length, 0, "zero maximum must not be treated as unlimited");
assert.deepEqual(ids(choose({ favoritesOnly: true, maxPrice: 2000 }, { favorites: ["e-headphones", "e-powerbank"] })), ["e-powerbank"]);
assert.equal(choose({ category: "electronics", query: "Volna", maxPrice: 2000 }).length, 0);
assert.deepEqual(ids(choose({ category: "electronics", query: "VOLNA", minRating: 4.8 })), ["e-headphones"]);
const withYo = api.PRODUCTS.find((product) => product.title.includes("ё"));
assert.ok(choose({ query: withYo.title.replaceAll("ё", "е") }).some((product) => product.id === withYo.id), "search must treat е and ё equivalently");
for (const mode of ["cheap", "expensive", "rating"]) {
 const items = choose({ sort: mode, minPrice: 500, maxPrice: 2500 });
 for (let i = 1; i < items.length; i++) assert.ok(mode === "cheap" ? items[i-1].price <= items[i].price : mode === "expensive" ? items[i-1].price >= items[i].price : items[i-1].rating >= items[i].rating);
}
assert.deepEqual(ids(api.PRODUCTS), original, "filtering and sorting must not mutate the catalog");
console.log("Combined marketplace price, rating, category, query and favorites checks passed.");
