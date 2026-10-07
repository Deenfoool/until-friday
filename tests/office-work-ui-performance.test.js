"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
let created = 0;
const doc = { activeElement: null, querySelector: () => null, createElement: () => { created++; return new Element(); } };
class Element {
  constructor() { this.children = []; this.dataset = {}; this.listeners = {}; this.scrollTop = 0; this.className = ""; this._html = "";
    this.classList = { add: (c) => { if (!this.className.split(" ").includes(c)) this.className += ` ${c}`; }, remove: (c) => { this.className = this.className.split(" ").filter((v) => v !== c).join(" "); } };
  }
  set innerHTML(value) { this._html = value; this.children = [];
    if (value.includes("data-office-cards")) { const cards = new Element(); cards.cards = true; this.appendChild(cards); }
    for (const match of value.matchAll(/data-office-open="([^"]+)"/g)) { const b = new Element(); b.dataset.officeOpen = match[1]; this.appendChild(b); }
    if (value.includes("data-office-mail-open")) { const b = new Element(); b.mailOpen = true; this.appendChild(b); }
  }
  get innerHTML() { return this._html; }
  appendChild(child) { child.parent = this; this.children.push(child); }
  prepend(child) { child.parent = this; this.children.unshift(child); }
  remove() { this.parent.children = this.parent.children.filter((c) => c !== this); }
  addEventListener(type, handler, capture) { (this.listeners[type] ||= []).push({ handler, capture }); }
  focus() { doc.activeElement = this; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  matches(selector) {
    if (selector === "[data-office-mail-task]") return Boolean(this.dataset.officeMailTask);
    if (selector === "[data-office-open]") return Boolean(this.dataset.officeOpen);
    if (selector === "[data-office-cards]") return this.cards;
    if (selector === "[data-office-mail-open]") return this.mailOpen;
    return selector.startsWith(".") && this.className.split(" ").includes(selector.slice(1));
  }
  querySelectorAll(selector) { return this.children.flatMap((c) => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  click() { const ancestors = []; for (let p = this.parent; p; p = p.parent) ancestors.unshift(p);
    for (const p of [...ancestors, this]) for (const l of p.listeners.click || []) if (l.capture) l.handler({ target: this });
    for (const l of this.listeners.click || []) if (!l.capture) l.handler({ target: this });
  }
}
const state = { dayIndex: 0, minute: 540, dayStarted: true, ended: false, metadata: { officeWork: { completed: {}, attempts: {} } } };
const context = { document: doc, UntilFridayRuntimeEngine: { getEngine: () => ({ getState: () => state }), notify() {}, persist() {} }, addEventListener() {}, console };
context.globalThis = context;
for (const file of ["office-work-pack.js", "office-work-mail.js"]) vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src", file), "utf8"), context);
const pack = context.UntilFridayOfficeWorkPack;
const mail = context.UntilFridayOfficeWorkMail;
const taskWindow = new Element(); const taskList = new Element(); taskList.className = "task-list"; taskWindow.appendChild(taskList);
pack.decorateTaskApp(taskWindow);
const section = taskList.querySelector(".office-work-pack");
const taskButton = section.querySelector("[data-office-open]"); taskButton.focus(); taskList.scrollTop = 123;
let count = created;
for (let i = 0; i < 10; i++) { state.minute++; pack.decorateTaskApp(taskWindow); }
assert.equal(created, count, "clock ticks must not rebuild task cards");
assert.equal(taskList.querySelector(".office-work-pack"), section);
assert.equal(doc.activeElement, taskButton);
assert.equal(taskList.scrollTop, 123);
state.minute = pack.tasksForDay(0)[1].unlockMinute;
pack.decorateTaskApp(taskWindow);
assert.notEqual(taskList.querySelector(".office-work-pack"), section, "new assignments must appear");
assert.equal(doc.activeElement.dataset.officeOpen, taskButton.dataset.officeOpen);
const mailWindow = new Element();
function newMailList() { const list = new Element(); list.className = "mail-list"; const base = new Element(); base.className = "mail-item selected"; list.appendChild(base); return list; }
let list = newMailList(); const view = new Element(); view.className = "mail-view"; mailWindow.appendChild(list); mailWindow.appendChild(view);
state.minute = 1000;
mail.decorateMail(mailWindow);
const letter = list.querySelector("[data-office-mail-task]"); assert.ok(letter);
letter.click(); letter.focus(); list.scrollTop = 77; view.scrollTop = 99;
const body = view.innerHTML; count = created;
for (let i = 0; i < 20; i++) { state.minute++; mail.decorateMail(mailWindow); }
assert.equal(created, count, "twenty clock ticks must leave mail nodes intact");
assert.equal(list.querySelector("[data-office-mail-task]"), letter);
assert.equal(doc.activeElement, letter); assert.equal(view.innerHTML, body);
state.metadata.officeWork.completed[letter.dataset.officeMailTask] = true;
mail.decorateMail(mailWindow);
assert.match(view.innerHTML, /Поручение выполнено/);
assert.equal(view.scrollTop, 99); assert.equal(list.scrollTop, 77);
assert.equal(doc.activeElement.dataset.officeMailTask, letter.dataset.officeMailTask);
list.remove(); list = newMailList(); mailWindow.appendChild(list); view.innerHTML = "base mail";
mail.decorateMail(mailWindow);
assert.match(view.innerHTML, /Поручение выполнено/, "refresh must restore the selected office letter");
list.children[0].click();
assert.equal(mailWindow.dataset.officeMailSelection, undefined, "opening base mail must release the office selection");
console.log("office work UI performance: ok");
