"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/personal-browser-immersion.js");

assert.doesNotThrow(() => new Function(source), "immersive browser module must contain valid JavaScript");
assert.doesNotMatch(source, /new\s+MutationObserver\s*\(/, "immersive browser must use lifecycle events");

for (const phrase of [
  "stripGameTiming",
  "Личное время",
  "KONTUR Web",
  "OFFICE-LAN · подключение установлено",
  "Быстрый доступ к часто посещаемым страницам",
  "until-friday-ui-render",
  "until-friday-state-change"
]) {
  assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `immersive browser must contain: ${phrase}`);
}

const notices = [];
const listeners = new Map();
const runtime = {
  notify(title, text) { notices.push({ title, text }); }
};
const context = {
  UntilFridayRuntimeEngine: runtime,
  document: {
    querySelector: () => null,
    addEventListener(type, callback) { listeners.set(type, callback); }
  },
  addEventListener(type, callback) { listeners.set(type, callback); },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  console
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(source, context, { filename: "personal-browser-immersion.js" });
const api = context.UntilFridayPersonalBrowserImmersion;
assert.ok(api, "immersive browser API must be exported");
assert.equal(api.stripGameTiming("Купить · 8 мин."), "Купить");
assert.equal(api.stripGameTiming("Просмотр займёт 12 игровых минут."), "");
assert.equal(api.stripGameTiming("Ответить · 3 мин."), "Ответить");

runtime.notify("Личное время", "Просмотрено видео · 10 мин.");
assert.equal(notices.length, 0, "personal activity timing toast must be hidden");
runtime.notify("Почта", "Новое письмо · 3 мин.");
assert.deepEqual(notices, [{ title: "Почта", text: "Новое письмо" }]);

const html = read("index.html");
assert.match(html, /personal-browser-immersion\.css/, "immersive browser stylesheet must be connected");
assert.match(html, /src\/personal-browser-immersion\.js/, "immersive browser script must be connected");
assert.ok(
  html.indexOf("src/personal-browser.js") < html.indexOf("src/personal-browser-immersion.js") &&
  html.indexOf("src/personal-browser-immersion.js") < html.indexOf("src/bootstrap.js"),
  "immersive patch must load after browser mechanics and before startup"
);

const css = read("personal-browser-immersion.css");
assert.match(css, /browser-time-card[\s\S]*display:\s*none/, "visible personal-time card must be hidden");

console.log("Diegetic personal browser presentation validation passed.");
