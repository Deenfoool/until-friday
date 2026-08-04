(function (root) {
  "use strict";

  if (root.UntilFridayMinMessenger) return;

  const STORAGE_KEY = "until-friday-min-messenger-v1";
  const ACTIVE_CHAT_KEY = "until-friday-min-active-chat-v1";
  const CHANNEL_NAME = "until-friday-min-sync-v1";
  const MEDIA_DB = "until-friday-min-media-v1";
  const VERSION = 1;
  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const iconUrl = (name, size = 24) => `${ICON_ROOT}/${size}/${name}.png`;
  const instances = new Set();
  const objectUrls = new Set();
  const channel = typeof root.BroadcastChannel === "function" ? new root.BroadcastChannel(CHANNEL_NAME) : null;

  const FIXED_NOW = Date.UTC(2026, 7, 4, 12, 0, 0);
  const USERS = [
    ["self", "Денис", "denis", "Д", "#5b7fca", "в сети"],
    ["lena", "Лена", "lena_home", "Л", "#d65d86", "была недавно"],
    ["leha", "Лёха", "leha_online", "Л", "#4e9a72", "в сети"],
    ["mama", "Мама", "mama", "М", "#b07b4f", "была в 15:42"],
    ["master", "Сергей, ремонт", "master_sergey", "С", "#8c6ec1", "был недавно"],
    ["sysadmin", "Антон Сисадмин", "anton_admin", "А", "#4f8ca8", "в сети"],
    ["min-support", "Поддержка МИН", "min_support", "М", "#226fd1", "служебный аккаунт"],
    ["garage-news", "Гаражный вестник", "garage_news", "Г", "#555f68", "канал"],
    ["district-news", "Район говорит", "district_news", "Р", "#c75b47", "канал"]
  ].map(([id, name, username, letter, color, status]) => ({ id, name, username, letter, color, status }));

  function uid(prefix = "id") {
    const cryptoId = root.crypto?.randomUUID?.();
    return cryptoId ? `${prefix}-${cryptoId}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function iso(offsetMinutes = 0) {
    return new Date(FIXED_NOW + offsetMinutes * 60000).toISOString();
  }

  function seedState() {
    const chats = [
      { id: "saved", type: "saved", title: "Избранное", memberIds: ["self"], createdAt: iso(-900), pinned: true, archived: false, muted: false, unread: 0, color: "#4277c5" },
      { id: "chat-lena", type: "private", title: "Лена", memberIds: ["self", "lena"], createdAt: iso(-850), pinned: true, archived: false, muted: false, unread: 2, color: "#d65d86" },
      { id: "chat-leha", type: "private", title: "Лёха", memberIds: ["self", "leha"], createdAt: iso(-820), pinned: false, archived: false, muted: false, unread: 0, color: "#4e9a72" },
      { id: "group-mods", type: "group", title: "Сборка на 180 модов", memberIds: ["self", "leha", "sysadmin"], createdAt: iso(-780), pinned: true, archived: false, muted: false, unread: 6, color: "#7555a6", description: "Обсуждение сборки, серверов и внезапных крашей." },
      { id: "group-family", type: "group", title: "Семья", memberIds: ["self", "lena", "mama"], createdAt: iso(-740), pinned: false, archived: false, muted: true, unread: 1, color: "#b87849", description: "Планы, покупки и сообщения, которые нельзя забыть." },
      { id: "channel-garage", type: "channel", title: "Гаражный вестник", memberIds: ["self", "garage-news"], createdAt: iso(-700), pinned: false, archived: false, muted: false, unread: 3, color: "#555f68", subscribers: 18420, description: "Автомобили, инструмент и гаражные советы без прелюдий." },
      { id: "channel-district", type: "channel", title: "Район говорит", memberIds: ["self", "district-news"], createdAt: iso(-650), pinned: false, archived: false, muted: false, unread: 8, color: "#c75b47", subscribers: 57103, description: "Новости района, объявления и фотографии чужой парковки." },
      { id: "chat-support", type: "bot", title: "Поддержка МИН", memberIds: ["self", "min-support"], createdAt: iso(-600), pinned: false, archived: false, muted: false, unread: 0, color: "#226fd1" }
    ];

    const messages = [
      ["saved-1", "saved", "self", "Сюда можно отправлять заметки, файлы и сообщения из других чатов.", -520, {}],
      ["lena-1", "chat-lena", "lena", "Ты хлеб и молоко не забудешь?", -125, {}],
      ["lena-2", "chat-lena", "self", "Не забуду. Я уже записал.", -121, { status: "read" }],
      ["lena-3", "chat-lena", "lena", "Ты так в прошлый раз тоже говорил.", -118, { reactions: { "😁": ["self"] } }],
      ["lena-4", "chat-lena", "lena", "И ещё посмотри лампу на стол, только не за десять тысяч.", -14, {}],
      ["leha-1", "chat-leha", "leha", "Вечером зайдёшь? Новую карту начинаем.", -300, {}],
      ["leha-2", "chat-leha", "self", "После девяти смогу.", -295, { status: "read" }],
      ["mods-1", "group-mods", "sysadmin", "Сервер снова стартует семь минут. Кто добавил ещё двадцать модов?", -190, {}],
      ["mods-2", "group-mods", "leha", "Они маленькие.", -188, { replyTo: "mods-1" }],
      ["mods-3", "group-mods", "self", "Маленькие по отдельности, а вместе уже отдельная операционная система.", -186, { reactions: { "👍": ["leha", "sysadmin"], "😁": ["leha"] } }],
      ["mods-4", "group-mods", "sysadmin", "Лог киньте, посмотрю вечером.", -10, {}],
      ["family-1", "group-family", "mama", "В воскресенье приедете?", -92, {}],
      ["family-2", "group-family", "lena", "Пока планируем, напишем вечером.", -88, {}],
      ["garage-1", "channel-garage", "garage-news", "Почему аккумулятор умирает летом, хотя все винят мороз.", -160, { views: 12440, reactions: { "👍": ["self"], "🔥": ["self"] } }],
      ["garage-2", "channel-garage", "garage-news", "Пять вещей, которые стоит держать в багажнике. Огнетушитель всё ещё на первом месте.", -35, { views: 8931 }],
      ["district-1", "channel-district", "district-news", "На улице Заводской до пятницы перекрыли одну полосу.", -75, { views: 30144 }],
      ["district-2", "channel-district", "district-news", "В центре снова ищут хозяина серого кота. Кот хозяина не ищет.", -8, { views: 18520, reactions: { "❤️": ["self"] } }],
      ["support-1", "chat-support", "min-support", "Добро пожаловать в МИН — мессенджер с минимально необходимым количеством обещаний.", -500, {}],
      ["support-2", "chat-support", "min-support", "Здесь работают произвольные сообщения, группы, каналы, реакции, ответы, пересылка, файлы, голосовые, поиск и синхронизация между вкладками.", -498, {}]
    ].map(([id, chatId, senderId, text, offset, extra]) => ({ id, chatId, senderId, text, createdAt: iso(offset), editedAt: null, deleted: false, pinned: false, attachments: [], status: senderId === "self" ? "read" : "delivered", ...extra }));

    return {
      version: VERSION,
      profile: { id: "self", name: "Денис", username: "denis", bio: "Пользователь МИН", phone: "", avatarColor: "#5b7fca" },
      users: USERS,
      chats,
      messages,
      contacts: ["lena", "leha", "mama", "master", "sysadmin"],
      drafts: {},
      folders: [
        { id: "all", title: "Все", types: [] },
        { id: "unread", title: "Непрочитанные", unreadOnly: true },
        { id: "personal", title: "Личные", types: ["private", "saved", "bot"] },
        { id: "groups", title: "Группы", types: ["group"] },
        { id: "channels", title: "Каналы", types: ["channel"] }
      ],
      settings: {
        theme: "light",
        compact: false,
        enterToSend: true,
        showOnline: true,
        sound: true,
        readReceipts: true,
        apiUrl: "",
        apiToken: ""
      },
      calls: [],
      updatedAt: new Date(FIXED_NOW).toISOString()
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(raw) {
    const seed = seedState();
    const source = raw && typeof raw === "object" ? raw : {};
    const state = {
      ...seed,
      ...source,
      profile: { ...seed.profile, ...(source.profile || {}) },
      settings: { ...seed.settings, ...(source.settings || {}) },
      users: Array.isArray(source.users) ? source.users : seed.users,
      chats: Array.isArray(source.chats) ? source.chats : seed.chats,
      messages: Array.isArray(source.messages) ? source.messages : seed.messages,
      contacts: Array.isArray(source.contacts) ? [...new Set(source.contacts)] : seed.contacts,
      drafts: source.drafts && typeof source.drafts === "object" ? { ...source.drafts } : {},
      folders: Array.isArray(source.folders) ? source.folders : seed.folders,
      calls: Array.isArray(source.calls) ? source.calls : []
    };
    state.users = state.users.filter((user) => user && user.id);
    if (!state.users.some((user) => user.id === "self")) state.users.unshift({ id: "self", name: state.profile.name, username: state.profile.username, letter: state.profile.name.slice(0, 1), color: state.profile.avatarColor, status: "в сети" });
    state.chats = state.chats.filter((chat) => chat && chat.id && chat.type);
    state.messages = state.messages.filter((message) => message && message.id && message.chatId).slice(-5000);
    return state;
  }

  function load() {
    try {
      const value = root.localStorage?.getItem(STORAGE_KEY);
      return normalize(value ? JSON.parse(value) : null);
    } catch (error) {
      console.warn("MIN storage read failed", error);
      return seedState();
    }
  }

  let state = load();

  function save(reason = "update") {
    state.updatedAt = new Date().toISOString();
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
      channel?.postMessage({ type: "state", reason, updatedAt: state.updatedAt });
    } catch (error) {
      console.warn("MIN storage write failed", error);
    }
    refreshAll();
    return state;
  }

  function reset() {
    state = seedState();
    save("reset");
  }

  function userById(id) {
    return state.users.find((user) => user.id === id) || { id, name: "Неизвестный", username: "unknown", letter: "?", color: "#7a8790", status: "" };
  }

  function chatById(id) {
    return state.chats.find((chat) => chat.id === id) || null;
  }

  function chatMessages(chatId) {
    return state.messages.filter((message) => message.chatId === chatId && !message.deleted).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  function lastMessage(chatId) {
    return chatMessages(chatId).at(-1) || null;
  }

  function unreadCount() {
    return state.chats.reduce((sum, chat) => sum + Number(chat.unread || 0), 0);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function formatListTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return formatTime(value);
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function markdown(value) {
    return esc(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<u>$1</u>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  function avatar(entity, small = false) {
    const name = entity?.name || entity?.title || "?";
    const letter = entity?.letter || name.slice(0, 1).toUpperCase();
    const color = entity?.color || entity?.avatarColor || "#527fa8";
    return `<span class="min-avatar ${small ? "small" : ""}" style="--avatar:${esc(color)}">${esc(letter)}</span>`;
  }

  function updateProfile(patch) {
    state.profile = { ...state.profile, ...patch };
    const self = state.users.find((user) => user.id === "self");
    if (self) {
      self.name = state.profile.name;
      self.username = state.profile.username;
      self.letter = state.profile.name.slice(0, 1).toUpperCase();
      self.color = state.profile.avatarColor;
    }
    save("profile");
  }

  function createChat(options = {}) {
    const type = ["private", "group", "channel"].includes(options.type) ? options.type : "private";
    const id = uid(type);
    const memberIds = [...new Set(["self", ...(options.memberIds || [])])];
    const chat = {
      id,
      type,
      title: String(options.title || (type === "channel" ? "Новый канал" : type === "group" ? "Новая группа" : "Новый чат")).trim(),
      memberIds,
      createdAt: new Date().toISOString(),
      pinned: false,
      archived: false,
      muted: false,
      unread: 0,
      color: options.color || ["#4b82b8", "#6f64b8", "#b36c54", "#528a73"][state.chats.length % 4],
      description: String(options.description || "").trim(),
      subscribers: type === "channel" ? 1 : undefined
    };
    state.chats.unshift(chat);
    save("create-chat");
    return chat;
  }

  function sendMessage(chatId, text, options = {}) {
    const chat = chatById(chatId);
    const clean = String(text || "").trim();
    const attachments = Array.isArray(options.attachments) ? options.attachments : [];
    if (!chat || (!clean && !attachments.length)) return null;
    const message = {
      id: uid("msg"),
      chatId,
      senderId: options.senderId || "self",
      text: clean,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      pinned: false,
      attachments,
      replyTo: options.replyTo || null,
      forwardedFrom: options.forwardedFrom || null,
      reactions: {},
      status: "sent"
    };
    state.messages.push(message);
    state.drafts[chatId] = "";
    chat.unread = 0;
    save("send-message");
    return message;
  }

  function editMessage(messageId, text) {
    const message = state.messages.find((item) => item.id === messageId && item.senderId === "self");
    const clean = String(text || "").trim();
    if (!message || !clean) return false;
    message.text = clean;
    message.editedAt = new Date().toISOString();
    save("edit-message");
    return true;
  }

  function deleteMessage(messageId, forEveryone = true) {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message || message.senderId !== "self") return false;
    if (forEveryone) {
      message.deleted = true;
      message.text = "";
      message.attachments = [];
    } else {
      state.messages = state.messages.filter((item) => item.id !== messageId);
    }
    save("delete-message");
    return true;
  }

  function forwardMessage(messageId, targetChatId) {
    const source = state.messages.find((item) => item.id === messageId && !item.deleted);
    if (!source || !chatById(targetChatId)) return null;
    return sendMessage(targetChatId, source.text, {
      attachments: clone(source.attachments || []),
      forwardedFrom: { messageId: source.id, chatId: source.chatId, senderName: userById(source.senderId).name }
    });
  }

  function toggleReaction(messageId, emoji) {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message) return false;
    message.reactions ||= {};
    const users = new Set(message.reactions[emoji] || []);
    users.has("self") ? users.delete("self") : users.add("self");
    if (users.size) message.reactions[emoji] = [...users];
    else delete message.reactions[emoji];
    save("reaction");
    return true;
  }

  function togglePinMessage(messageId) {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message) return false;
    state.messages.filter((item) => item.chatId === message.chatId).forEach((item) => { item.pinned = false; });
    message.pinned = !message.pinned;
    save("pin-message");
    return true;
  }

  function updateChat(chatId, patch, reason = "chat-update") {
    const chat = chatById(chatId);
    if (!chat) return false;
    Object.assign(chat, patch);
    save(reason);
    return true;
  }

  function markRead(chatId) {
    const chat = chatById(chatId);
    if (!chat || !chat.unread) return;
    chat.unread = 0;
    save("read");
  }

  function setDraft(chatId, value) {
    state.drafts[chatId] = String(value || "");
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function search(query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return { chats: [], messages: [], users: [] };
    return {
      chats: state.chats.filter((chat) => `${chat.title} ${chat.description || ""}`.toLowerCase().includes(needle)).slice(0, 20),
      messages: state.messages.filter((message) => !message.deleted && message.text.toLowerCase().includes(needle)).slice(-50).reverse(),
      users: state.users.filter((user) => `${user.name} ${user.username}`.toLowerCase().includes(needle)).slice(0, 20)
    };
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `min-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = normalize(JSON.parse(String(reader.result || "{}")));
        save("import");
      } catch {
        alert("МИН не смог прочитать резервную копию.");
      }
    };
    reader.readAsText(file);
  }

  function openMediaDb() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error("IndexedDB unavailable"));
      const request = root.indexedDB.open(MEDIA_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeMedia(blob, name) {
    const id = uid("media");
    const db = await openMediaDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({ id, blob, name: name || "файл", type: blob.type || "application/octet-stream", size: blob.size, createdAt: new Date().toISOString() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { id, name: name || "файл", type: blob.type || "application/octet-stream", size: blob.size };
  }

  async function readMedia(id) {
    const db = await openMediaDb();
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction("files", "readonly").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record;
  }

  async function hydrateMedia(container) {
    const elements = [...container.querySelectorAll("[data-min-media]")];
    for (const element of elements) {
      if (element.dataset.hydrated) continue;
      element.dataset.hydrated = "true";
      try {
        const record = await readMedia(element.dataset.minMedia);
        if (!record) continue;
        const url = URL.createObjectURL(record.blob);
        objectUrls.add(url);
        if (element.matches("img,video,audio")) element.src = url;
        const download = element.closest(".min-attachment")?.querySelector("[data-min-download]");
        if (download) {
          download.href = url;
          download.download = record.name;
        }
      } catch {}
    }
  }

  function parseUrl(url) {
    const value = String(url || "https://min.local/");
    if (value.includes("/chat/")) return { view: "chat", id: value.split("/chat/")[1].split(/[?#]/)[0] };
    if (value.includes("/contacts")) return { view: "contacts" };
    if (value.includes("/calls")) return { view: "calls" };
    if (value.includes("/services")) return { view: "services" };
    if (value.includes("/settings")) return { view: "settings" };
    return { view: "chats" };
  }

  const ui = {
    filter: "all",
    query: "",
    contextMessageId: null,
    replyTo: null,
    editing: null,
    forwardMessageId: null,
    infoOpen: false,
    createOpen: false,
    emojiOpen: false,
    profileOpen: false,
    searchOpen: false,
    callOpen: false,
    recording: false,
    recorder: null,
    chunks: []
  };

  function chatSubtitle(chat) {
    if (chat.type === "channel") return `${Number(chat.subscribers || 0).toLocaleString("ru-RU")} подписчиков`;
    if (chat.type === "group") return `${chat.memberIds.length} участника`;
    if (chat.type === "saved") return "личное облако";
    if (chat.type === "bot") return "бот";
    const other = userById(chat.memberIds.find((id) => id !== "self"));
    return other.status || "личный чат";
  }

  function filteredChats() {
    const folder = state.folders.find((item) => item.id === ui.filter) || state.folders[0];
    const needle = ui.query.trim().toLowerCase();
    return state.chats
      .filter((chat) => !chat.archived)
      .filter((chat) => !folder.unreadOnly || chat.unread > 0)
      .filter((chat) => !folder.types?.length || folder.types.includes(chat.type))
      .filter((chat) => !needle || `${chat.title} ${lastMessage(chat.id)?.text || ""}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(lastMessage(b.id)?.createdAt || b.createdAt) - new Date(lastMessage(a.id)?.createdAt || a.createdAt));
  }

  function sideNav(route) {
    const item = (view, label, iconName, badge = "") => `<button data-min-route="${view}" class="${route.view === view || (view === "chats" && route.view === "chat") ? "active" : ""}"><img src="${iconUrl(iconName)}" alt=""><span>${label}</span>${badge ? `<i>${badge}</i>` : ""}</button>`;
    return `<aside class="min-nav"><button class="min-logo" data-min-route="chats"><b>МИН</b><small>не MAX</small></button><nav>${item("chats", "Чаты", "chat", unreadCount() || "")}${item("contacts", "Контакты", "contacts")}${item("calls", "Звонки", "phone")}${item("services", "Сервисы", "apps")}</nav><footer>${item("settings", "Настройки", "settings")}<button data-min-profile>${avatar(state.profile, true)}<span>${esc(state.profile.name)}</span></button></footer></aside>`;
  }

  function chatList(activeChatId) {
    const chats = filteredChats();
    return `<section class="min-chat-list"><header><div><h1>Чаты</h1><button data-min-new title="Новый чат"><img src="${iconUrl("plus-math")}" alt=""></button></div><label><img src="${iconUrl("search")}" alt=""><input data-min-chat-search value="${esc(ui.query)}" placeholder="Поиск"></label></header><div class="min-folders">${state.folders.map((folder) => `<button data-min-folder="${folder.id}" class="${ui.filter === folder.id ? "active" : ""}">${esc(folder.title)}</button>`).join("")}</div><div class="min-chat-items">${chats.map((chat) => {
      const last = lastMessage(chat.id);
      const sender = last ? userById(last.senderId) : null;
      const preview = state.drafts[chat.id] ? `<em>Черновик: ${esc(state.drafts[chat.id])}</em>` : last ? `${chat.type === "group" && last.senderId !== "self" ? `${esc(sender.name)}: ` : ""}${esc(last.text || (last.attachments?.length ? "Вложение" : "Сообщение"))}` : "Нет сообщений";
      return `<button class="min-chat-row ${activeChatId === chat.id ? "active" : ""}" data-min-chat="${chat.id}">${avatar({ title: chat.title, color: chat.color })}<div><header><b>${esc(chat.title)}</b><time>${formatListTime(last?.createdAt || chat.createdAt)}</time></header><p>${chat.muted ? `<img src="${iconUrl("mute", 13)}" alt="">` : ""}${preview}</p></div><aside>${chat.pinned ? `<img src="${iconUrl("pin", 13)}" alt="">` : ""}${chat.unread ? `<i>${chat.unread > 99 ? "99+" : chat.unread}</i>` : ""}</aside></button>`;
    }).join("") || `<div class="min-empty"><p>Чаты не найдены.</p></div>`}</div><button class="min-archive" data-min-show-archive><img src="${iconUrl("archive")}" alt="">Архив <span>${state.chats.filter((chat) => chat.archived).length}</span></button></section>`;
  }

  function messageReference(messageId) {
    const source = state.messages.find((item) => item.id === messageId);
    if (!source) return "";
    return `<button class="min-message-reference" data-min-jump="${source.id}"><b>${esc(userById(source.senderId).name)}</b><span>${esc(source.text || "Вложение")}</span></button>`;
  }

  function attachmentHtml(attachment) {
    const type = String(attachment.type || "");
    const size = `${Math.max(1, Math.round(Number(attachment.size || 0) / 1024))} КБ`;
    if (type.startsWith("image/")) return `<figure class="min-attachment image"><img data-min-media="${attachment.id}" alt="${esc(attachment.name)}"><figcaption>${esc(attachment.name)}</figcaption><a data-min-download>Скачать</a></figure>`;
    if (type.startsWith("audio/")) return `<div class="min-attachment audio"><audio controls data-min-media="${attachment.id}"></audio><span>${esc(attachment.name)}</span><a data-min-download>Скачать</a></div>`;
    if (type.startsWith("video/")) return `<div class="min-attachment video"><video controls data-min-media="${attachment.id}"></video><span>${esc(attachment.name)}</span><a data-min-download>Скачать</a></div>`;
    return `<div class="min-attachment file"><img src="${iconUrl("document")}" alt=""><div><b>${esc(attachment.name)}</b><small>${size}</small></div><a data-min-download><img src="${iconUrl("download")}" alt=""></a></div>`;
  }

  function messageHtml(message, chat) {
    const own = message.senderId === "self";
    const sender = userById(message.senderId);
    const reactions = Object.entries(message.reactions || {}).filter(([, users]) => users.length);
    return `<article class="min-message ${own ? "own" : "incoming"} ${message.pinned ? "pinned" : ""}" data-min-message="${message.id}">${chat.type === "group" || chat.type === "channel" ? avatar(sender, true) : ""}<div class="min-bubble">${message.forwardedFrom ? `<div class="min-forwarded"><img src="${iconUrl("forward-arrow", 14)}" alt="">Переслано от ${esc(message.forwardedFrom.senderName || "пользователя")}</div>` : ""}${message.replyTo ? messageReference(message.replyTo) : ""}${chat.type === "group" && !own ? `<b class="min-sender">${esc(sender.name)}</b>` : ""}${message.attachments?.map(attachmentHtml).join("") || ""}${message.text ? `<p>${markdown(message.text)}</p>` : ""}<footer><time>${formatTime(message.createdAt)}</time>${message.editedAt ? `<span>изменено</span>` : ""}${own ? `<img src="${iconUrl(message.status === "read" ? "double-tick" : "checkmark", 14)}" alt="">` : ""}${message.views ? `<span>${Number(message.views).toLocaleString("ru-RU")} просмотров</span>` : ""}</footer>${reactions.length ? `<div class="min-reactions">${reactions.map(([emoji, users]) => `<button data-min-reaction="${emoji}" data-message-id="${message.id}" class="${users.includes("self") ? "active" : ""}">${emoji}<span>${users.length}</span></button>`).join("")}</div>` : ""}</div><button class="min-message-menu" data-min-message-menu="${message.id}"><img src="${iconUrl("menu-2", 17)}" alt=""></button></article>`;
  }

  function conversation(chat) {
    const messages = chatMessages(chat.id);
    const pinned = messages.find((message) => message.pinned);
    const draft = state.drafts[chat.id] || "";
    const other = userById(chat.memberIds.find((id) => id !== "self"));
    return `<section class="min-conversation" data-chat-id="${chat.id}"><header>${avatar({ title: chat.title, color: chat.color })}<button class="min-chat-title" data-min-info><b>${esc(chat.title)}</b><small>${esc(chatSubtitle(chat))}</small></button><div><button data-min-search-chat title="Поиск"><img src="${iconUrl("search")}" alt=""></button>${chat.type !== "channel" ? `<button data-min-call="audio" title="Аудиозвонок"><img src="${iconUrl("phone")}" alt=""></button><button data-min-call="video" title="Видеозвонок"><img src="${iconUrl("video-call")}" alt=""></button>` : ""}<button data-min-info title="Информация"><img src="${iconUrl("info")}" alt=""></button></div></header>${pinned ? `<button class="min-pinned-bar" data-min-jump="${pinned.id}"><img src="${iconUrl("pin")}" alt=""><div><b>Закреплённое сообщение</b><span>${esc(pinned.text || "Вложение")}</span></div></button>` : ""}<main class="min-message-scroll">${messages.map((message) => messageHtml(message, chat)).join("") || `<div class="min-empty-chat"><h2>Начало переписки</h2><p>Напишите первое сообщение.</p></div>`}</main>${ui.replyTo ? `<div class="min-compose-reference"><div>${messageReference(ui.replyTo)}</div><button data-min-cancel-compose><img src="${iconUrl("delete-sign")}" alt=""></button></div>` : ""}${ui.editing ? `<div class="min-compose-reference editing"><div><b>Редактирование</b><span>${esc(state.messages.find((item) => item.id === ui.editing)?.text || "")}</span></div><button data-min-cancel-compose><img src="${iconUrl("delete-sign")}" alt=""></button></div>` : ""}<form class="min-composer" data-min-composer><button type="button" data-min-attach title="Прикрепить"><img src="${iconUrl("attach")}" alt=""></button><textarea data-min-text rows="1" placeholder="Сообщение">${esc(ui.editing ? state.messages.find((item) => item.id === ui.editing)?.text || "" : draft)}</textarea><button type="button" data-min-emoji title="Эмодзи"><img src="${iconUrl("happy")}" alt=""></button><button type="button" data-min-voice title="Голосовое сообщение"><img src="${iconUrl(ui.recording ? "stop" : "microphone")}" alt=""></button><button class="min-send" title="Отправить"><img src="${iconUrl("sent")}" alt=""></button><input type="file" data-min-file multiple hidden></form>${ui.emojiOpen ? emojiPicker() : ""}</section>`;
  }

  function emptyConversation() {
    return `<section class="min-welcome"><div class="min-welcome-logo">МИН</div><h1>Минимум лишнего</h1><p>Выберите чат или создайте новый. Все сообщения сохраняются отдельно от игры.</p><button data-min-new>Новое сообщение</button></section>`;
  }

  function contactsView() {
    const contacts = state.contacts.map(userById);
    return `<section class="min-page"><header><div><h1>Контакты</h1><p>${contacts.length} сохранённых контактов</p></div><button data-min-add-contact><img src="${iconUrl("add-user-male")}" alt="">Добавить</button></header><label class="min-page-search"><img src="${iconUrl("search")}" alt=""><input data-min-contact-search placeholder="Поиск контактов"></label><div class="min-contact-grid">${contacts.map((user) => `<button data-min-open-user="${user.id}">${avatar(user)}<div><b>${esc(user.name)}</b><span>@${esc(user.username)}</span><small>${esc(user.status)}</small></div><img src="${iconUrl("chat")}" alt=""></button>`).join("")}</div></section>`;
  }

  function callsView() {
    return `<section class="min-page"><header><div><h1>Звонки</h1><p>История аудио- и видеозвонков</p></div><button data-min-call-new><img src="${iconUrl("phone")}" alt="">Позвонить</button></header>${state.calls.length ? `<div class="min-call-list">${state.calls.slice().reverse().map((call) => `<article>${avatar(userById(call.userId))}<div><b>${esc(userById(call.userId).name)}</b><span>${call.direction === "out" ? "Исходящий" : "Входящий"} · ${formatListTime(call.createdAt)}</span></div><img src="${iconUrl(call.type === "video" ? "video-call" : "phone")}" alt=""></article>`).join("")}</div>` : `<div class="min-empty-page"><img src="${iconUrl("phone", 64)}" alt=""><h2>Звонков пока нет</h2><p>Локальная камера и микрофон работают. Для звонков между разными устройствами потребуется сетевой сервер.</p></div>`}</section>`;
  }

  function servicesView() {
    const services = [
      ["ГосУслужливость", "Подтверждение всего, что и так известно", "passport"],
      ["Оплата взглядом", "Посмотреть на счёт и передумать", "bank-card-back-side"],
      ["МИН Такси", "Минимальная вероятность найти машину", "taxi"],
      ["Документы", "Копии документов внутри мессенджера", "document"],
      ["Боты", "Каталог полезных и не очень помощников", "bot"],
      ["Мини-приложения", "Приложения внутри приложения внутри браузера", "apps"]
    ];
    return `<section class="min-page"><header><div><h1>Сервисы</h1><p>Минимально необходимая экосистема</p></div></header><div class="min-services">${services.map(([title, text, iconName]) => `<button><span><img src="${iconUrl(iconName, 30)}" alt=""></span><div><b>${title}</b><p>${text}</p></div></button>`).join("")}</div></section>`;
  }

  function settingsView() {
    const toggle = (key, title, text) => `<label><div><b>${title}</b><small>${text}</small></div><input type="checkbox" data-min-setting="${key}" ${state.settings[key] ? "checked" : ""}></label>`;
    return `<section class="min-page min-settings"><header><div><h1>Настройки</h1><p>МИН знает о вас ровно столько, сколько хранит этот браузер</p></div></header><section><h2>Профиль</h2><button class="min-profile-row" data-min-profile>${avatar(state.profile)}<div><b>${esc(state.profile.name)}</b><span>@${esc(state.profile.username)}</span><small>${esc(state.profile.bio)}</small></div><img src="${iconUrl("forward")}" alt=""></button></section><section><h2>Чаты</h2>${toggle("enterToSend", "Отправка по Enter", "Shift+Enter создаёт новую строку.")}${toggle("readReceipts", "Отчёты о прочтении", "Показывать двойную галочку.")}${toggle("sound", "Звуки", "Звуковые уведомления о новых сообщениях.")}${toggle("compact", "Компактный режим", "Уменьшить отступы в списке чатов.")}</section><section><h2>Сеть</h2><label><div><b>Адрес сервера</b><small>Пустое поле означает локальный режим.</small></div><input type="url" data-min-setting-text="apiUrl" value="${esc(state.settings.apiUrl)}" placeholder="https://min-api.example.com"></label><p class="min-network-note">GitHub Pages не является сервером сообщений. Этот клиент полностью работает локально и между вкладками; адрес внешнего сервера используется для будущей межустройственной синхронизации.</p></section><section><h2>Данные</h2><div class="min-settings-actions"><button data-min-export><img src="${iconUrl("export")}" alt="">Экспортировать</button><button data-min-import><img src="${iconUrl("import")}" alt="">Импортировать</button><button data-min-reset class="danger"><img src="${iconUrl("trash")}" alt="">Сбросить МИН</button><input type="file" data-min-import-file accept="application/json" hidden></div></section></section>`;
  }

  function infoDrawer(chat) {
    if (!chat || !ui.infoOpen) return "";
    const members = chat.memberIds.map(userById);
    return `<aside class="min-info"><header><h2>Информация</h2><button data-min-info><img src="${iconUrl("delete-sign")}" alt=""></button></header><div class="min-info-profile">${avatar({ title: chat.title, color: chat.color })}<h3>${esc(chat.title)}</h3><p>${esc(chatSubtitle(chat))}</p><small>${esc(chat.description || "Описание не добавлено")}</small></div><nav><button data-min-chat-action="pin"><img src="${iconUrl("pin")}" alt="">${chat.pinned ? "Открепить чат" : "Закрепить чат"}</button><button data-min-chat-action="mute"><img src="${iconUrl("mute")}" alt="">${chat.muted ? "Включить уведомления" : "Отключить уведомления"}</button><button data-min-chat-action="archive"><img src="${iconUrl("archive")}" alt="">Переместить в архив</button><button data-min-search-chat><img src="${iconUrl("search")}" alt="">Поиск в чате</button></nav>${chat.type === "group" ? `<section><h4>Участники</h4>${members.map((user) => `<button data-min-open-user="${user.id}">${avatar(user, true)}<span>${esc(user.name)}</span><small>${esc(user.status)}</small></button>`).join("")}</section>` : ""}<footer><button class="danger" data-min-delete-chat><img src="${iconUrl("trash")}" alt="">Удалить чат</button></footer></aside>`;
  }

  function emojiPicker() {
    return `<div class="min-emoji-picker">${["😀", "😁", "😂", "😍", "👍", "👎", "❤️", "🔥", "🎉", "🤔", "😡", "😢", "🙏", "👌", "💩", "🫡"].map((emoji) => `<button data-min-insert-emoji="${emoji}">${emoji}</button>`).join("")}</div>`;
  }

  function createModal() {
    if (!ui.createOpen) return "";
    const users = state.users.filter((user) => !["self", "garage-news", "district-news"].includes(user.id));
    return `<div class="min-modal-backdrop"><form class="min-modal" data-min-create-form><header><h2>Новый диалог</h2><button type="button" data-min-close-modal><img src="${iconUrl("delete-sign")}" alt=""></button></header><label>Тип<select name="type"><option value="private">Личный чат</option><option value="group">Группа</option><option value="channel">Канал</option></select></label><label>Название<input name="title" required maxlength="64" placeholder="Название"></label><label>Описание<textarea name="description" maxlength="200" placeholder="Необязательно"></textarea></label><fieldset><legend>Участники</legend>${users.map((user) => `<label><input type="checkbox" name="member" value="${user.id}">${avatar(user, true)}<span>${esc(user.name)}</span></label>`).join("")}</fieldset><footer><button type="button" data-min-close-modal>Отмена</button><button class="primary">Создать</button></footer></form></div>`;
  }

  function profileModal() {
    if (!ui.profileOpen) return "";
    return `<div class="min-modal-backdrop"><form class="min-modal" data-min-profile-form><header><h2>Профиль МИН</h2><button type="button" data-min-close-profile><img src="${iconUrl("delete-sign")}" alt=""></button></header><div class="min-profile-editor">${avatar(state.profile)}<label>Цвет<input type="color" name="avatarColor" value="${esc(state.profile.avatarColor)}"></label></div><label>Имя<input name="name" required maxlength="48" value="${esc(state.profile.name)}"></label><label>Имя пользователя<input name="username" required maxlength="32" value="${esc(state.profile.username)}"></label><label>О себе<textarea name="bio" maxlength="120">${esc(state.profile.bio)}</textarea></label><label>Телефон<input name="phone" value="${esc(state.profile.phone)}" placeholder="Необязательно"></label><footer><button type="button" data-min-close-profile>Отмена</button><button class="primary">Сохранить</button></footer></form></div>`;
  }

  function contextMenu() {
    const message = state.messages.find((item) => item.id === ui.contextMessageId);
    if (!message) return "";
    const own = message.senderId === "self";
    return `<div class="min-context-menu"><button data-min-context="reply"><img src="${iconUrl("reply-arrow")}" alt="">Ответить</button><button data-min-context="forward"><img src="${iconUrl("forward-arrow")}" alt="">Переслать</button><button data-min-context="react"><img src="${iconUrl("happy")}" alt="">Реакция</button><button data-min-context="pin"><img src="${iconUrl("pin")}" alt="">${message.pinned ? "Открепить" : "Закрепить"}</button><button data-min-context="copy"><img src="${iconUrl("copy")}" alt="">Копировать</button>${own ? `<button data-min-context="edit"><img src="${iconUrl("edit")}" alt="">Изменить</button><button data-min-context="delete" class="danger"><img src="${iconUrl("trash")}" alt="">Удалить</button>` : ""}</div>`;
  }

  function forwardModal() {
    if (!ui.forwardMessageId) return "";
    return `<div class="min-modal-backdrop"><section class="min-modal min-forward-modal"><header><h2>Переслать сообщение</h2><button data-min-cancel-forward><img src="${iconUrl("delete-sign")}" alt=""></button></header><div>${state.chats.filter((chat) => !chat.archived).map((chat) => `<button data-min-forward-target="${chat.id}">${avatar({ title: chat.title, color: chat.color }, true)}<span>${esc(chat.title)}</span></button>`).join("")}</div></section></div>`;
  }

  function callOverlay(chat) {
    if (!ui.callOpen || !chat) return "";
    return `<div class="min-call-overlay"><div class="min-call-card">${avatar({ title: chat.title, color: chat.color })}<h2>${esc(chat.title)}</h2><p data-min-call-status>Подготовка локального звонка…</p><video data-min-call-preview autoplay muted playsinline></video><div><button data-min-call-mute><img src="${iconUrl("microphone")}" alt=""></button><button data-min-call-camera><img src="${iconUrl("video-call")}" alt=""></button><button class="hangup" data-min-hangup><img src="${iconUrl("end-call")}" alt=""></button></div><small>Между разными устройствами звонок заработает после подключения сигнального сервера.</small></div></div>`;
  }

  function render(container, context = {}) {
    if (!container) return false;
    const route = parseUrl(context.url);
    const activeChatId = route.view === "chat" ? route.id : root.sessionStorage?.getItem(ACTIVE_CHAT_KEY) || "chat-lena";
    const activeChat = chatById(activeChatId);
    const oldList = container.querySelector(".min-chat-items");
    const oldMessages = container.querySelector(".min-message-scroll");
    const listScroll = oldList?.scrollTop || 0;
    const messageScroll = oldMessages?.scrollTop || 0;
    const sameChat = container.dataset.minChatId === activeChatId;

    const main = route.view === "contacts" ? contactsView() : route.view === "calls" ? callsView() : route.view === "services" ? servicesView() : route.view === "settings" ? settingsView() : activeChat ? conversation(activeChat) : emptyConversation();
    container.dataset.minChatId = activeChatId || "";
    container.innerHTML = `<section class="min-app ${state.settings.theme === "dark" ? "dark" : ""} ${state.settings.compact ? "compact" : ""}">${sideNav(route)}${route.view === "chats" || route.view === "chat" ? chatList(activeChatId) : ""}<main class="min-main">${main}</main>${infoDrawer(activeChat)}${createModal()}${profileModal()}${contextMenu()}${forwardModal()}${callOverlay(activeChat)}</section>`;
    bind(container, context, activeChat);
    const newList = container.querySelector(".min-chat-items");
    const newMessages = container.querySelector(".min-message-scroll");
    if (newList) newList.scrollTop = listScroll;
    if (newMessages) newMessages.scrollTop = sameChat ? messageScroll : newMessages.scrollHeight;
    hydrateMedia(container);
    return true;
  }

  function navigate(context, view, data = {}) {
    const urls = {
      chats: "https://min.local/",
      contacts: "https://min.local/contacts",
      calls: "https://min.local/calls",
      services: "https://min.local/services",
      settings: "https://min.local/settings"
    };
    const url = data.chatId ? `https://min.local/chat/${data.chatId}` : urls[view] || urls.chats;
    context.navigate?.(url, view === "chats" ? "МИН" : `${view === "contacts" ? "Контакты" : view === "calls" ? "Звонки" : view === "services" ? "Сервисы" : "Настройки"} — МИН`);
  }

  async function attachFiles(chatId, files) {
    const attachments = [];
    for (const file of [...files].slice(0, 10)) {
      try { attachments.push(await storeMedia(file, file.name)); }
      catch { alert(`Не удалось сохранить файл «${file.name}».`); }
    }
    if (attachments.length) sendMessage(chatId, "", { attachments });
  }

  async function toggleVoice(chatId, button) {
    if (ui.recording) {
      ui.recorder?.stop();
      ui.recording = false;
      button?.classList.remove("recording");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ui.chunks = [];
      ui.recorder = new MediaRecorder(stream);
      ui.recorder.ondataavailable = (event) => { if (event.data.size) ui.chunks.push(event.data); };
      ui.recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(ui.chunks, { type: ui.recorder.mimeType || "audio/webm" });
        const attachment = await storeMedia(blob, `Голосовое ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.webm`);
        sendMessage(chatId, "", { attachments: [attachment] });
        ui.recorder = null;
        ui.chunks = [];
      };
      ui.recorder.start();
      ui.recording = true;
      button?.classList.add("recording");
    } catch {
      alert("МИН не получил доступ к микрофону.");
    }
  }

  let callStream = null;
  async function startCall(container, chat, type) {
    ui.callOpen = true;
    state.calls.push({ id: uid("call"), userId: chat.memberIds.find((id) => id !== "self") || "self", type, direction: "out", createdAt: new Date().toISOString() });
    save("call");
    render(container, instancesFor(container)?.context || {});
    try {
      callStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      const preview = container.querySelector("[data-min-call-preview]");
      const status = container.querySelector("[data-min-call-status]");
      if (preview) preview.srcObject = callStream;
      if (status) status.textContent = type === "video" ? "Локальная камера подключена" : "Локальный микрофон подключён";
    } catch {
      const status = container.querySelector("[data-min-call-status]");
      if (status) status.textContent = "Нет доступа к камере или микрофону";
    }
  }

  function endCall() {
    callStream?.getTracks?.().forEach((track) => track.stop());
    callStream = null;
    ui.callOpen = false;
    refreshAll();
  }

  function instancesFor(container) {
    return [...instances].find((item) => item.container === container) || null;
  }

  function bind(container, context, activeChat) {
    container.querySelectorAll("[data-min-route]").forEach((button) => button.addEventListener("click", () => navigate(context, button.dataset.minRoute)));
    container.querySelectorAll("[data-min-chat]").forEach((button) => button.addEventListener("click", () => {
      root.sessionStorage?.setItem(ACTIVE_CHAT_KEY, button.dataset.minChat);
      markRead(button.dataset.minChat);
      navigate(context, "chats", { chatId: button.dataset.minChat });
    }));
    container.querySelectorAll("[data-min-folder]").forEach((button) => button.addEventListener("click", () => { ui.filter = button.dataset.minFolder; refreshAll(); }));
    container.querySelector("[data-min-chat-search]")?.addEventListener("input", (event) => { ui.query = event.target.value; refreshAll(); });
    container.querySelectorAll("[data-min-new]").forEach((button) => button.addEventListener("click", () => { ui.createOpen = true; refreshAll(); }));
    container.querySelectorAll("[data-min-close-modal]").forEach((button) => button.addEventListener("click", () => { ui.createOpen = false; refreshAll(); }));
    container.querySelector("[data-min-create-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const chat = createChat({ type: data.get("type"), title: data.get("title"), description: data.get("description"), memberIds: data.getAll("member") });
      ui.createOpen = false;
      navigate(context, "chats", { chatId: chat.id });
    });
    container.querySelectorAll("[data-min-profile]").forEach((button) => button.addEventListener("click", () => { ui.profileOpen = true; refreshAll(); }));
    container.querySelectorAll("[data-min-close-profile]").forEach((button) => button.addEventListener("click", () => { ui.profileOpen = false; refreshAll(); }));
    container.querySelector("[data-min-profile-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      updateProfile({ name: data.get("name"), username: data.get("username"), bio: data.get("bio"), phone: data.get("phone"), avatarColor: data.get("avatarColor") });
      ui.profileOpen = false;
      refreshAll();
    });
    container.querySelector("[data-min-composer]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!activeChat) return;
      const textarea = event.currentTarget.querySelector("[data-min-text]");
      if (ui.editing) editMessage(ui.editing, textarea.value);
      else sendMessage(activeChat.id, textarea.value, { replyTo: ui.replyTo });
      ui.replyTo = null;
      ui.editing = null;
    });
    const textarea = container.querySelector("[data-min-text]");
    textarea?.addEventListener("input", (event) => { if (activeChat && !ui.editing) setDraft(activeChat.id, event.target.value); event.target.style.height = "auto"; event.target.style.height = `${Math.min(150, event.target.scrollHeight)}px`; });
    textarea?.addEventListener("keydown", (event) => { if (state.settings.enterToSend && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.closest("form")?.requestSubmit(); } });
    container.querySelector("[data-min-attach]")?.addEventListener("click", () => container.querySelector("[data-min-file]")?.click());
    container.querySelector("[data-min-file]")?.addEventListener("change", (event) => activeChat && attachFiles(activeChat.id, event.target.files));
    container.querySelector("[data-min-emoji]")?.addEventListener("click", () => { ui.emojiOpen = !ui.emojiOpen; refreshAll(); });
    container.querySelectorAll("[data-min-insert-emoji]").forEach((button) => button.addEventListener("click", () => { const input = container.querySelector("[data-min-text]"); if (input) { input.value += button.dataset.minInsertEmoji; input.focus(); if (activeChat) setDraft(activeChat.id, input.value); } ui.emojiOpen = false; }));
    container.querySelector("[data-min-voice]")?.addEventListener("click", (event) => activeChat && toggleVoice(activeChat.id, event.currentTarget));
    container.querySelectorAll("[data-min-message-menu]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); ui.contextMessageId = button.dataset.minMessageMenu; refreshAll(); }));
    container.querySelectorAll("[data-min-context]").forEach((button) => button.addEventListener("click", async () => {
      const action = button.dataset.minContext;
      const id = ui.contextMessageId;
      const message = state.messages.find((item) => item.id === id);
      if (action === "reply") ui.replyTo = id;
      if (action === "forward") ui.forwardMessageId = id;
      if (action === "react") toggleReaction(id, "👍");
      if (action === "pin") togglePinMessage(id);
      if (action === "copy") await navigator.clipboard?.writeText(message?.text || "");
      if (action === "edit") ui.editing = id;
      if (action === "delete" && confirm("Удалить сообщение для всех?")) deleteMessage(id, true);
      ui.contextMessageId = null;
      refreshAll();
    }));
    container.querySelectorAll("[data-min-reaction]").forEach((button) => button.addEventListener("click", () => toggleReaction(button.dataset.messageId, button.dataset.minReaction)));
    container.querySelectorAll("[data-min-cancel-compose]").forEach((button) => button.addEventListener("click", () => { ui.replyTo = null; ui.editing = null; refreshAll(); }));
    container.querySelectorAll("[data-min-forward-target]").forEach((button) => button.addEventListener("click", () => { forwardMessage(ui.forwardMessageId, button.dataset.minForwardTarget); ui.forwardMessageId = null; refreshAll(); }));
    container.querySelector("[data-min-cancel-forward]")?.addEventListener("click", () => { ui.forwardMessageId = null; refreshAll(); });
    container.querySelectorAll("[data-min-info]").forEach((button) => button.addEventListener("click", () => { ui.infoOpen = !ui.infoOpen; refreshAll(); }));
    container.querySelectorAll("[data-min-chat-action]").forEach((button) => button.addEventListener("click", () => {
      if (!activeChat) return;
      const action = button.dataset.minChatAction;
      if (action === "pin") updateChat(activeChat.id, { pinned: !activeChat.pinned }, "pin-chat");
      if (action === "mute") updateChat(activeChat.id, { muted: !activeChat.muted }, "mute-chat");
      if (action === "archive") { updateChat(activeChat.id, { archived: true }, "archive-chat"); navigate(context, "chats"); }
    }));
    container.querySelector("[data-min-delete-chat]")?.addEventListener("click", () => { if (activeChat && confirm(`Удалить чат «${activeChat.title}»?`)) { state.chats = state.chats.filter((chat) => chat.id !== activeChat.id); state.messages = state.messages.filter((message) => message.chatId !== activeChat.id); save("delete-chat"); navigate(context, "chats"); } });
    container.querySelectorAll("[data-min-open-user]").forEach((button) => button.addEventListener("click", () => {
      const userId = button.dataset.minOpenUser;
      let chat = state.chats.find((item) => item.type === "private" && item.memberIds.includes(userId));
      if (!chat) chat = createChat({ type: "private", title: userById(userId).name, memberIds: [userId] });
      navigate(context, "chats", { chatId: chat.id });
    }));
    container.querySelectorAll("[data-min-setting]").forEach((input) => input.addEventListener("change", () => { state.settings[input.dataset.minSetting] = input.checked; save("setting"); }));
    container.querySelectorAll("[data-min-setting-text]").forEach((input) => input.addEventListener("change", () => { state.settings[input.dataset.minSettingText] = input.value.trim(); save("setting"); }));
    container.querySelector("[data-min-export]")?.addEventListener("click", exportData);
    container.querySelector("[data-min-import]")?.addEventListener("click", () => container.querySelector("[data-min-import-file]")?.click());
    container.querySelector("[data-min-import-file]")?.addEventListener("change", (event) => event.target.files[0] && importData(event.target.files[0]));
    container.querySelector("[data-min-reset]")?.addEventListener("click", () => { if (confirm("Удалить все локальные чаты МИН?")) reset(); });
    container.querySelectorAll("[data-min-call]").forEach((button) => button.addEventListener("click", () => activeChat && startCall(container, activeChat, button.dataset.minCall)));
    container.querySelector("[data-min-hangup]")?.addEventListener("click", endCall);
    container.querySelectorAll("[data-min-jump]").forEach((button) => button.addEventListener("click", () => container.querySelector(`[data-min-message="${button.dataset.minJump}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })));
  }

  function mount(container, context = {}) {
    const existing = instancesFor(container);
    if (existing) existing.context = context;
    else instances.add({ container, context });
    render(container, context);
    return () => instances.delete(instancesFor(container));
  }

  function refreshAll() {
    for (const instance of [...instances]) {
      if (!instance.container?.isConnected && typeof instance.container?.isConnected === "boolean") instances.delete(instance);
      else render(instance.container, instance.context);
    }
  }

  channel?.addEventListener("message", (event) => {
    if (event.data?.type !== "state") return;
    const incoming = load();
    if (incoming.updatedAt !== state.updatedAt) {
      state = incoming;
      refreshAll();
    }
  });

  root.addEventListener?.("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = load();
    refreshAll();
  });

  root.addEventListener?.("beforeunload", () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  });

  root.UntilFridayMinMessenger = {
    STORAGE_KEY,
    VERSION,
    getState: () => clone(state),
    normalize,
    reset,
    userById,
    chatById,
    chatMessages,
    lastMessage,
    unreadCount,
    createChat,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    toggleReaction,
    togglePinMessage,
    updateChat,
    markRead,
    setDraft,
    search,
    updateProfile,
    storeMedia,
    readMedia,
    parseUrl,
    render,
    mount,
    refreshAll
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
