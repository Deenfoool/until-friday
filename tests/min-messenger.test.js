"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/min-messenger.js");

assert.doesNotThrow(() => new Function(source), "MIN messenger must contain valid JavaScript");
assert.doesNotMatch(source, /UntilFridayRuntimeEngine|advanceTime|metadata\.personalBrowser/, "MIN must not depend on game state or game time");
assert.match(source, /localStorage/);
assert.match(source, /BroadcastChannel/);
assert.match(source, /indexedDB/);
assert.match(source, /MediaRecorder/);

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const sessionStorage = { getItem() { return null; }, setItem() {} };
const context = {
  localStorage,
  sessionStorage,
  addEventListener() {},
  BroadcastChannel: undefined,
  crypto: { randomUUID: (() => { let n = 0; return () => `uuid-${++n}`; })() },
  Blob,
  URL,
  Date,
  Intl,
  console,
  setTimeout,
  clearTimeout
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "min-messenger.js" });

const api = context.UntilFridayMinMessenger;
assert.ok(api, "MIN API must be exported");
assert.equal(api.VERSION, 1);
assert.equal(api.STORAGE_KEY, "until-friday-min-messenger-v1");

const initial = api.getState();
assert.equal(initial.chats.length, 8);
assert.ok(initial.messages.length >= 19);
assert.equal(initial.profile.name, "Денис");
assert.ok(api.unreadCount() > 0);
assert.equal(api.parseUrl("https://min.local/chat/chat-lena").view, "chat");
assert.equal(api.parseUrl("https://min.local/settings").view, "settings");

const created = api.createChat({ type: "group", title: "Тестовая группа", memberIds: ["leha", "sysadmin"] });
assert.equal(created.type, "group");
assert.ok(created.memberIds.includes("self"));
assert.equal(api.chatById(created.id).title, "Тестовая группа");

const sent = api.sendMessage(created.id, "Обычное произвольное сообщение");
assert.ok(sent);
assert.equal(api.chatMessages(created.id).at(-1).text, "Обычное произвольное сообщение");
assert.equal(api.editMessage(sent.id, "Сообщение изменено"), true);
assert.equal(api.chatMessages(created.id).at(-1).editedAt !== null, true);
assert.equal(api.toggleReaction(sent.id, "👍"), true);
assert.deepEqual(JSON.parse(JSON.stringify(api.chatMessages(created.id).at(-1).reactions["👍"])), ["self"]);
assert.equal(api.togglePinMessage(sent.id), true);
assert.equal(api.chatMessages(created.id).at(-1).pinned, true);

const forwarded = api.forwardMessage(sent.id, "saved");
assert.ok(forwarded);
assert.equal(forwarded.forwardedFrom.messageId, sent.id);
assert.equal(api.chatMessages("saved").at(-1).text, "Сообщение изменено");

api.setDraft(created.id, "Черновик сохраняется");
assert.equal(JSON.parse(storage.get(api.STORAGE_KEY)).drafts[created.id], "Черновик сохраняется");
const results = api.search("изменено");
assert.ok(results.messages.some((message) => message.id === sent.id));

assert.equal(api.updateChat(created.id, { muted: true }), true);
assert.equal(api.chatById(created.id).muted, true);
assert.equal(api.deleteMessage(sent.id, true), true);
assert.equal(api.chatMessages(created.id).some((message) => message.id === sent.id), false);

api.updateProfile({ name: "Новый пользователь", username: "new_user" });
assert.equal(api.getState().profile.name, "Новый пользователь");
assert.equal(api.userById("self").username, "new_user");

const container = {
  innerHTML: "",
  dataset: {},
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
assert.equal(api.render(container, { url: "https://min.local/", navigate() {} }), true);
assert.match(container.innerHTML, /class="min-app/);
assert.match(container.innerHTML, /МИН/);
assert.match(container.innerHTML, /Чаты/);
assert.match(container.innerHTML, /Контакты/);
assert.match(container.innerHTML, /Звонки/);
assert.match(container.innerHTML, /Сервисы/);
assert.match(container.innerHTML, /Тестовая группа/);

assert.equal(api.render(container, { url: `https://min.local/chat/${created.id}`, navigate() {} }), true);
assert.match(container.innerHTML, /class="min-conversation/);
assert.match(container.innerHTML, /data-min-composer/);
assert.match(container.innerHTML, /data-min-voice/);
assert.match(container.innerHTML, /data-min-attach/);

const css = read("min-messenger.css");
for (const phrase of [".min-app", ".min-nav", ".min-chat-list", ".min-conversation", ".min-message", ".min-composer", ".min-info", ".min-modal", ".min-call-overlay", "@media(max-width:620px)"]) {
  assert.match(css, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const html = read("index.html");
assert.match(html, /min-messenger\.css\?v=20260804-9/);
assert.match(html, /src\/min-messenger\.js\?v=20260804-9/);
assert.ok(html.indexOf("src/min-messenger.js") < html.indexOf("src/personal-browser-ui-v4.js"));
assert.doesNotMatch(html, /src\/personal-browser-ui-v3\.js/);

console.log("Functional MIN messenger validation passed.");
