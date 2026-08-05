(function (root) {
  "use strict";

  if (root.UntilFridayMinWorkspace) return;

  const Min = root.UntilFridayMinMessenger;
  if (!Min) return;

  const STORAGE_KEY = Min.STORAGE_KEY;
  const WORK_FOLDER_ID = "work";
  const PIN_PREFERENCES_KEY = "until-friday-min-pin-preferences-v1";
  const PIN_MIGRATION_KEY = "until-friday-min-pin-layout-v1";
  const STYLE_ID = "until-friday-min-workspace-style";
  const DEFAULT_PINNED = new Set(["saved", "chat-lena"]);
  const PIN_ICON = "https://img.icons8.com/fluency-systems-regular/18/pin.png";

  const WORK_AVATARS_BY_USER = Object.freeze({
    "work-dima": "assets/avatar-friend.png",
    "work-oleg": "assets/avatar-tattler.png",
    "work-roman": "assets/avatar-sysadmin.png",
    "work-andrey": "assets/avatar-director.png"
  });

  const WORK_AVATARS_BY_CHAT = Object.freeze({
    "work-chat-dima": WORK_AVATARS_BY_USER["work-dima"],
    "work-chat-oleg": WORK_AVATARS_BY_USER["work-oleg"],
    "work-chat-roman": WORK_AVATARS_BY_USER["work-roman"],
    "work-chat-andrey": WORK_AVATARS_BY_USER["work-andrey"]
  });

  const DEFAULT_WORK_AVATAR = "assets/avatar-default-user.png";
  let scheduled = false;
  let writing = false;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(root.localStorage?.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function readState() {
    try {
      const raw = readJson(STORAGE_KEY, Min.getState?.() || {});
      return Min.normalize(raw);
    } catch {
      return Min.normalize(Min.getState?.() || {});
    }
  }

  function dispatchState(json, reason) {
    try {
      const event = typeof root.StorageEvent === "function"
        ? new root.StorageEvent("storage", {
            key: STORAGE_KEY,
            oldValue: null,
            newValue: json,
            storageArea: root.localStorage,
            url: root.location?.href || ""
          })
        : new root.Event("storage");
      if (!("key" in event)) Object.defineProperty(event, "key", { value: STORAGE_KEY });
      if (!("newValue" in event)) Object.defineProperty(event, "newValue", { value: json });
      root.dispatchEvent?.(event);
    } catch {}

    try {
      root.dispatchEvent?.(new root.CustomEvent("until-friday-min-state-change", {
        detail: { reason }
      }));
    } catch {}
  }

  function writeState(state, reason) {
    state.updatedAt = new Date().toISOString();
    const json = JSON.stringify(state);
    writing = true;
    try {
      root.localStorage?.setItem(STORAGE_KEY, json);
      dispatchState(json, reason);
    } finally {
      writing = false;
    }
    return state;
  }

  function isWorkChat(chat) {
    return Boolean(chat && (chat.workChat === true || String(chat.id || "").startsWith("work-chat-")));
  }

  function workChatIds(state) {
    return state.chats.filter(isWorkChat).map((chat) => chat.id);
  }

  function sameIds(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  }

  function ensureWorkFolder(state) {
    const chatIds = workChatIds(state);
    if (!chatIds.length) return false;

    let folder = state.folders.find((item) => item.id === WORK_FOLDER_ID);
    if (!folder) {
      folder = {
        id: WORK_FOLDER_ID,
        title: "Работа",
        custom: true,
        chatIds,
        createdAt: new Date().toISOString()
      };
      const unreadIndex = state.folders.findIndex((item) => item.id === "unread");
      state.folders.splice(unreadIndex >= 0 ? unreadIndex + 1 : state.folders.length, 0, folder);
      return true;
    }

    let changed = false;
    if (folder.title !== "Работа") {
      folder.title = "Работа";
      changed = true;
    }
    if (folder.custom !== true) {
      folder.custom = true;
      changed = true;
    }
    if (!sameIds(folder.chatIds || [], chatIds)) {
      folder.chatIds = chatIds;
      changed = true;
    }
    return changed;
  }

  function avatarForUser(userId) {
    if (WORK_AVATARS_BY_USER[userId]) return WORK_AVATARS_BY_USER[userId];
    return String(userId || "").startsWith("work-") ? DEFAULT_WORK_AVATAR : "";
  }

  function avatarForChat(chatId, state = readState()) {
    if (WORK_AVATARS_BY_CHAT[chatId]) return WORK_AVATARS_BY_CHAT[chatId];
    const chat = state.chats.find((item) => item.id === chatId);
    return isWorkChat(chat) ? DEFAULT_WORK_AVATAR : "";
  }

  function ensureWorkAvatarMetadata(state) {
    let changed = false;
    state.users.forEach((user) => {
      const avatar = avatarForUser(user.id);
      if (avatar && user.avatar !== avatar) {
        user.avatar = avatar;
        changed = true;
      }
    });
    state.chats.forEach((chat) => {
      const avatar = avatarForChat(chat.id, state);
      if (avatar && chat.avatar !== avatar) {
        chat.avatar = avatar;
        changed = true;
      }
    });
    return changed;
  }

  function readPinPreferences() {
    return readJson(PIN_PREFERENCES_KEY, {});
  }

  function writePinPreferences(preferences) {
    root.localStorage?.setItem(PIN_PREFERENCES_KEY, JSON.stringify(preferences));
  }

  function applyInitialPins(state, force = false) {
    const migrated = root.localStorage?.getItem(PIN_MIGRATION_KEY) === "1";
    if (migrated && !force) return false;

    let changed = false;
    const preferences = {};
    state.chats.forEach((chat) => {
      const pinned = DEFAULT_PINNED.has(chat.id);
      preferences[chat.id] = pinned;
      if (Boolean(chat.pinned) !== pinned) {
        chat.pinned = pinned;
        changed = true;
      }
    });
    writePinPreferences(preferences);
    root.localStorage?.setItem(PIN_MIGRATION_KEY, "1");
    return changed;
  }

  function applyPinPreferences(state) {
    const preferences = readPinPreferences();
    let changed = false;
    let preferencesChanged = false;

    state.chats.forEach((chat) => {
      let desired;
      if (Object.prototype.hasOwnProperty.call(preferences, chat.id)) {
        desired = Boolean(preferences[chat.id]);
      } else if (DEFAULT_PINNED.has(chat.id)) {
        desired = true;
      } else if (isWorkChat(chat)) {
        desired = false;
      }

      if (desired === undefined) return;
      if (!Object.prototype.hasOwnProperty.call(preferences, chat.id)) {
        preferences[chat.id] = desired;
        preferencesChanged = true;
      }
      if (Boolean(chat.pinned) !== desired) {
        chat.pinned = desired;
        changed = true;
      }
    });

    if (preferencesChanged) writePinPreferences(preferences);
    return changed;
  }

  function syncWorkspace(options = {}) {
    const state = readState();
    let changed = false;
    changed = ensureWorkFolder(state) || changed;
    changed = ensureWorkAvatarMetadata(state) || changed;
    changed = applyInitialPins(state, Boolean(options.forcePins)) || changed;
    changed = applyPinPreferences(state) || changed;
    if (changed) writeState(state, options.reason || "min-workspace-sync");
    scheduleDecorate();
    return state;
  }

  function setChatPinned(chatId, pinned) {
    const state = readState();
    const chat = state.chats.find((item) => item.id === chatId);
    if (!chat) return false;

    const desired = Boolean(pinned);
    const preferences = readPinPreferences();
    preferences[chatId] = desired;
    writePinPreferences(preferences);

    if (Boolean(chat.pinned) !== desired) {
      chat.pinned = desired;
      writeState(state, desired ? "pin-chat" : "unpin-chat");
    } else {
      scheduleDecorate();
    }
    return true;
  }

  function rememberCurrentPin(chatId) {
    const state = readState();
    const chat = state.chats.find((item) => item.id === chatId);
    if (!chat) return false;
    const preferences = readPinPreferences();
    preferences[chatId] = Boolean(chat.pinned);
    writePinPreferences(preferences);
    return true;
  }

  function ensureStyles() {
    if (document.getElementById?.(STYLE_ID) || !document.createElement) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .min-avatar.min-avatar-image { overflow: hidden; padding: 0; background: #dbe3e8 !important; }
      .min-avatar.min-avatar-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .min-chat-row { position: relative; }
      .min-chat-pin-toggle { display: inline-grid; place-items: center; width: 25px; height: 25px; border-radius: 50%; opacity: .22; cursor: pointer; transition: opacity .15s ease, background .15s ease; }
      .min-chat-pin-toggle:hover, .min-chat-pin-toggle:focus-visible, .min-chat-pin-toggle.active { opacity: 1; background: rgba(65, 111, 166, .12); }
      .min-chat-pin-toggle img { width: 15px; height: 15px; }
      .min-conversation [data-min-work-pin] { display: inline-grid; place-items: center; }
      .min-conversation [data-min-work-pin].active { background: rgba(65, 111, 166, .14); }
    `;
    (document.head || document.documentElement)?.appendChild?.(style);
  }

  function applyAvatar(element, src, label) {
    if (!element || !src) return;
    if (element.dataset.minAvatarSrc === src) return;
    element.dataset.minAvatarSrc = src;
    element.classList.add("min-avatar-image");
    element.textContent = "";
    const image = document.createElement("img");
    image.src = src;
    image.alt = label || "";
    element.appendChild(image);
  }

  function decorateAvatars(app, state) {
    app.querySelectorAll(".min-chat-row[data-min-chat]").forEach((row) => {
      const chatId = row.dataset.minChat;
      const chat = state.chats.find((item) => item.id === chatId);
      applyAvatar(row.querySelector(".min-avatar"), avatarForChat(chatId, state), chat?.title || "");
    });

    app.querySelectorAll("[data-min-open-user]").forEach((button) => {
      const userId = button.dataset.minOpenUser;
      const user = state.users.find((item) => item.id === userId);
      applyAvatar(button.querySelector(".min-avatar"), avatarForUser(userId), user?.name || "");
    });

    const conversation = app.querySelector(".min-conversation[data-chat-id]");
    if (conversation) {
      const chatId = conversation.dataset.chatId;
      const chat = state.chats.find((item) => item.id === chatId);
      applyAvatar(conversation.querySelector("header .min-avatar"), avatarForChat(chatId, state), chat?.title || "");
      applyAvatar(app.querySelector(".min-info-profile .min-avatar"), avatarForChat(chatId, state), chat?.title || "");
    }
  }

  function createPinControl(chat) {
    const control = document.createElement("span");
    control.className = "min-chat-pin-toggle";
    control.dataset.minWorkPin = chat.id;
    control.setAttribute("role", "button");
    control.setAttribute("tabindex", "0");
    control.title = chat.pinned ? "Открепить диалог" : "Закрепить диалог";
    control.setAttribute("aria-label", control.title);
    control.innerHTML = `<img src="${PIN_ICON}" alt="">`;
    control.classList.toggle("active", Boolean(chat.pinned));
    return control;
  }

  function decoratePinControls(app, state) {
    app.querySelectorAll(".min-chat-row[data-min-chat]").forEach((row) => {
      const chat = state.chats.find((item) => item.id === row.dataset.minChat);
      if (!chat) return;
      let control = row.querySelector("[data-min-work-pin]");
      if (!control) {
        control = createPinControl(chat);
        const aside = row.querySelector("aside") || row;
        aside.prepend(control);
      }
      control.classList.toggle("active", Boolean(chat.pinned));
      control.title = chat.pinned ? "Открепить диалог" : "Закрепить диалог";
      control.setAttribute("aria-label", control.title);
    });

    const conversation = app.querySelector(".min-conversation[data-chat-id]");
    if (!conversation) return;
    const chat = state.chats.find((item) => item.id === conversation.dataset.chatId);
    const actions = conversation.querySelector("header > div:last-child");
    if (!chat || !actions) return;

    let button = actions.querySelector("button[data-min-work-pin]");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.minWorkPin = chat.id;
      button.innerHTML = `<img src="${PIN_ICON}" alt="">`;
      actions.prepend(button);
    }
    button.dataset.minWorkPin = chat.id;
    button.classList.toggle("active", Boolean(chat.pinned));
    button.title = chat.pinned ? "Открепить диалог" : "Закрепить диалог";
    button.setAttribute("aria-label", button.title);
  }

  function decorateAll() {
    scheduled = false;
    ensureStyles();
    const state = readState();
    document.querySelectorAll?.(".min-app").forEach((app) => {
      decorateAvatars(app, state);
      decoratePinControls(app, state);
    });
  }

  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    const schedule = typeof root.requestAnimationFrame === "function"
      ? root.requestAnimationFrame.bind(root)
      : (callback) => root.setTimeout?.(callback, 0);
    schedule(decorateAll);
  }

  function activeChatId(target) {
    const app = target?.closest?.(".min-app") || document.querySelector?.(".min-app");
    return app?.querySelector?.(".min-conversation[data-chat-id]")?.dataset?.chatId || "";
  }

  function handleClick(event) {
    const direct = event.target.closest?.("[data-min-work-pin]");
    if (direct) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const state = readState();
      const chat = state.chats.find((item) => item.id === direct.dataset.minWorkPin);
      if (chat) setChatPinned(chat.id, !chat.pinned);
      return;
    }

    const nativePin = event.target.closest?.('[data-min-chat-action="pin"]');
    if (nativePin) {
      const chatId = activeChatId(nativePin);
      root.setTimeout?.(() => rememberCurrentPin(chatId), 0);
      return;
    }

    const reset = event.target.closest?.("[data-min-reset]");
    if (reset) {
      const before = root.localStorage?.getItem(STORAGE_KEY) || "";
      root.setTimeout?.(() => {
        const after = root.localStorage?.getItem(STORAGE_KEY) || "";
        if (after === before) return;
        root.localStorage?.removeItem(PIN_PREFERENCES_KEY);
        root.localStorage?.removeItem(PIN_MIGRATION_KEY);
        syncWorkspace({ forcePins: true, reason: "min-reset-layout" });
      }, 0);
    }
  }

  function handleKeydown(event) {
    const control = event.target.closest?.("span[data-min-work-pin]");
    if (!control || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    control.click?.();
  }

  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
  root.addEventListener?.("storage", (event) => {
    if (writing || event.key !== STORAGE_KEY) return;
    root.setTimeout?.(() => syncWorkspace({ reason: "min-storage-sync" }), 0);
  });
  root.addEventListener?.("until-friday-min-state-change", (event) => {
    const reason = String(event.detail?.reason || "");
    if (reason === "desktop-story-sync") {
      root.setTimeout?.(() => syncWorkspace({ reason: "min-work-chat-sync" }), 0);
    } else {
      scheduleDecorate();
    }
  });
  root.addEventListener?.("until-friday-ui-render", scheduleDecorate);
  root.addEventListener?.("until-friday-app-ready", () => {
    syncWorkspace({ reason: "min-app-ready" });
  });

  if (typeof root.MutationObserver === "function" && document.documentElement) {
    const observer = new root.MutationObserver(scheduleDecorate);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  syncWorkspace({ reason: "min-workspace-startup" });
  scheduleDecorate();

  root.UntilFridayMinWorkspace = {
    STORAGE_KEY,
    WORK_FOLDER_ID,
    PIN_PREFERENCES_KEY,
    PIN_MIGRATION_KEY,
    DEFAULT_PINNED,
    WORK_AVATARS_BY_USER,
    WORK_AVATARS_BY_CHAT,
    readState,
    isWorkChat,
    workChatIds,
    ensureWorkFolder,
    avatarForUser,
    avatarForChat,
    ensureWorkAvatarMetadata,
    readPinPreferences,
    applyInitialPins,
    applyPinPreferences,
    syncWorkspace,
    setChatPinned,
    rememberCurrentPin,
    decorateAll
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
