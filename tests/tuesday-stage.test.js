"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const source = read("src/tuesday-minigames.js");
assert.doesNotThrow(() => new Function(source), "Tuesday minigame module must contain valid JavaScript");

const story = {
  actions: {
    "tue-client-confirm": { effects: {} },
    "tue-client-delay": { effects: {} },
    "tue-help-accountant": { effects: {} }
  },
  events: {}
};

const context = {
  UNTIL_FRIDAY_STORY: story,
  MutationObserver: class MutationObserver { observe() {} },
  document: {
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    setTimeout: () => {}
  },
  requestAnimationFrame: (callback) => callback(),
  console
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "tuesday-minigames.js" });

assert.ok(context.UntilFridayTuesdayMinigames, "Tuesday minigame API must be exported");
assert.ok(story.events["tue-client-thanks"], "successful client response must schedule feedback");
assert.ok(story.events["tue-client-escalation"], "delayed client response must schedule escalation");
assert.ok(story.events["tue-accountant-thanks"], "accountant task must schedule a follow-up message");
assert.equal(
  story.actions["tue-client-confirm"].effects.schedule[0].eventId,
  "tue-client-thanks",
  "client confirmation must connect to the thank-you event"
);
assert.match(story.actions["tue-help-accountant"].result, /устаревшие реквизиты/, "accountant result must describe all discrepancies");

for (const requiredText of [
  "Обработать обращение «Северный узел»",
  "Проверено документов: 0 из 3",
  "Сверить три дополнительных счёта",
  "Сверка_счетов_04-08.xlsx",
  "UntilFridayWorkflow?.saveAttachment"
]) {
  assert.match(source, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Tuesday module must contain: ${requiredText}`);
}

const css = read("tuesday-minigames.css");
assert.match(css, /tuesday-minigame-window/, "Tuesday windows must have dedicated styling");
assert.match(css, /accountant-audit-layout/, "accountant comparison layout must be styled");
assert.match(css, /@media \(max-width: 720px\)/, "Tuesday tasks must adapt to small screens");

const html = read("index.html");
assert.match(html, /tuesday-minigames\.css/, "Tuesday task stylesheet must be connected");
assert.match(html, /src\/tuesday-minigames\.js/, "Tuesday task script must be connected");
assert.ok(
  html.indexOf("src/tuesday-minigames.js") < html.indexOf("src/bootstrap.js"),
  "Tuesday story events must be registered before the game engine is created"
);

const rules = read("src/rules-extension.js");
assert.match(rules, /AUDIT_EVENT_ID = "wed-security-audit"/, "Wednesday audit must be tied to its event");
assert.match(rules, /requireAuditEvent/, "audit actions must be hidden before the event");
assert.match(rules, /skippedRequirement: "wednesday-audit"/, "untriggered audit requirement must be skipped");
assert.match(rules, /storedEnding/, "resolved endings must not be appended repeatedly");

console.log("Tuesday gameplay stage validation passed.");
