(function (root) {
  "use strict";

  if (root.UntilFridayMinDesktopIntegration) return;

  const Min = root.UntilFridayMinMessenger;
  const Runtime = root.UntilFridayRuntimeEngine;
  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Min || !Runtime || !Story) return;

  const APP_ID = "chat";
  const APP_TITLE = "МИН";
  const STORAGE_KEY = Min.STORAGE_KEY;
  const ROUTE_KEY = "until-friday-min-desktop-route-v1";
  const ICON_URL = "https://img.icons8.com/fluency/48/chat.png";
  const WORK_START = Date.UTC(2026, 7, 3, 0, 0, 0);

  const WORK_CONTACTS = [
    { key: "dima", userId: "work-dima", chatId: "work-chat-dima", name: "Дима Орлов", username: "d.orlov", role: "соседний стол", color: "#4e9a72", status: "внутренняя сеть" },
    { key: "oleg", userId: "work-oleg", chatId: "work-chat-oleg", name: "Олег Казанцев", username: "o.kazantsev", role: "отдел продаж", color: "#b87849", status: "внутренняя сеть" },
    { key: "roman", userId: "work-roman", chatId: "work-chat-roman", name: "Роман Белов", username: "r.belov", role: "системный администратор", color: "#4f8ca8", status: "внутренняя сеть" },
    { key: "andrey", userId: "work-andrey", chatId: "work-chat-andrey", name: "Андрей Соколов", username: "a.sokolov", role: "начальник отдела", color: "#7c62a7", status: "внутренняя сеть" }
  ];

  const BASE_MESSAGES = [
    { id: "story-base-dima", source: "Дима Орлов", text: "Слышал, в пятницу опять собрание. Но вроде не про нас.", minute: 490 },
    { id: "story-base-oleg", source: "Олег Казанцев", text: "Кадровики готовят бумаги на кого-то из второго этажа. Но ты это не от меня слышал.", minute: 507 },
    { id: "story-base-roman", source: "Роман Белов", text: "Если общий диск тормозит, не открывай один файл по десять раз. Журнал и так раздулся.", minute: 519 }
  ];

  let appWindow = null;
  let taskButton = null;
  let mountCleanup = null;
  let contentObserver = null;
  let decorateQueued = false;
  let topZ = 2600;
  let currentRoute = readRoute();

  function engine() {
    return Runtime.getEngine?.() || null;
  }

  function readRoute() {
    try {
      return root.sessionStorage?.getItem(ROUTE_KEY) || "https://min.local/chat/work-chat-dima";
    } catch {
      return "https://min.local/chat/work-chat-dima";
    }
  }

  function saveRoute(value) {
    currentRoute = String(value || "https://min.local/");
    try { root.sessionStorage?.setItem(ROUTE_KEY, currentRoute); } catch {}
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slug(value) {
    const normalized = String(value || "contact").toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return normalized || "contact";
  }

  function createdAt(dayIndex, minute) {
    const day = Math.max(0, Number(dayIndex) || 0);
    const value = Math.max(0, Number(minute) || 0);
    return new Date(WORK_START + day * 86400000 + value * 60000).toISOString();
  }

  function dispatchStorage(json) {
    try {
      root.dispatchEvent(new StorageEvent("storage", {
        key: STORAGE_KEY,
        oldValue: null,
        newValue: json,
        storageArea: root.localStorage,
        url: root.location?.href || ""
      }));
    } catch {
      const event = new Event("storage");
      Object.defineProperty(event, "key", { value: STORAGE_KEY });
      Object.defineProperty(event, "newValue", { value: json });
      root.dispatchEvent(event);
    }
  }

  function mutateMinState(updater) {
    try {
      const raw = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || "{}");
      const state = Min.normalize(raw);
      const before = JSON.stringify(state);
      updater(state);
      if (JSON.stringify(state) === before) return false;
      state.updatedAt = new Date().toISOString();
      const json = JSON.stringify(state);
      root.localStorage?.setItem(STORAGE_KEY, json);
      dispatchStorage(json);
      root.dispatchEvent(new CustomEvent("until-friday-min-state-change", { detail: { reason: "desktop-story-sync" } }));
      return true;
    } catch (error) {
      console.warn("MIN desktop story sync failed", error);
      return false;
    }
  }

  function knownContactByName(name) {
    return WORK_CONTACTS.find((item) => item.name === name) || null;
  }

  function contactForSource(name) {
    const known = knownContactByName(name);
    if (known) return known;
    const key = slug(name);
    return {
      key,
      userId: `work-${key}`,
      chatId: `work-chat-${key}`,
      name: String(name || "Система"),
      username: key,
      role: "служебный контакт",
      color: "#667d8c",
      status: "внутренняя сеть"
    };
  }

  function contactForAction(actionId) {
    const id = String(actionId || "");
    if (id.includes("admin")) return knownContactByName("Роман Белов");
    if (id.includes("friend") || id.includes("blame")) return knownContactByName("Дима Орлов");
    if (id.includes("gossip") || id.includes("sales")) return knownContactByName("Олег Казанцев");
    return knownContactByName("Андрей Соколов");
  }

  function ensureUser(state, contact) {
    let user = state.users.find((item) => item.id === contact.userId);
    const next = {
      id: contact.userId,
      name: contact.name,
      username: contact.username,
      letter: contact.name.slice(0, 1).toUpperCase(),
      color: contact.color,
      status: `${contact.role} · ${contact.status}`,
      workContact: true
    };
    if (!user) {
      state.users.push(next);
      user = next;
    } else {
      Object.assign(user, next);
    }
    if (!state.contacts.includes(contact.userId)) state.contacts.push(contact.userId);
    return user;
  }

  function ensureChat(state, contact) {
    let chat = state.chats.find((item) => item.id === contact.chatId);
    const next = {
      id: contact.chatId,
      type: "private",
      title: contact.name,
      memberIds: ["self", contact.userId],
      createdAt: createdAt(0, 480),
      pinned: Boolean(chat?.pinned),
      archived: Boolean(chat?.archived),
      muted: Boolean(chat?.muted),
      unread: Number(chat?.unread || 0),
      color: contact.color,
      description: `${contact.role}. Служебная переписка из корпоративной сети.`,
      workChat: true
    };
    if (!chat) {
      state.chats.unshift(next);
      chat = next;
    } else {
      Object.assign(chat, next);
    }
    return chat;
  }

  function upsertStoryMessage(state, contact, data, incrementUnread) {
    const id = `work-${data.id}`;
    let message = state.messages.find((item) => item.id === id);
    const next = {
      id,
      chatId: contact.chatId,
      senderId: data.side === "me" ? "self" : contact.userId,
      text: String(data.text || ""),
      createdAt: createdAt(data.dayIndex, data.minute),
      editedAt: null,
      deleted: false,
      pinned: false,
      attachments: [],
      replyTo: null,
      forwardedFrom: null,
      reactions: {},
      status: data.side === "me" ? "read" : "delivered",
      storyMessage: true,
      storySourceId: data.id
    };
    if (!message) {
      state.messages.push(next);
      if (incrementUnread && data.side !== "me") {
        const chat = state.chats.find((item) => item.id === contact.chatId);
        if (chat) chat.unread = Number(chat.unread || 0) + 1;
      }
    } else {
      Object.assign(message, next);
    }
  }

  function syncStoryMessages() {
    const current = engine();
    const gameState = current?.getState?.();
    if (!current || !gameState) return false;

    return mutateMinState((state) => {
      WORK_CONTACTS.forEach((contact) => {
        ensureUser(state, contact);
        ensureChat(state, contact);
      });

      BASE_MESSAGES.forEach((message) => {
        const contact = contactForSource(message.source);
        ensureUser(state, contact);
        ensureChat(state, contact);
        upsertStoryMessage(state, contact, { ...message, dayIndex: 0, side: "them" }, false);
      });

      (gameState.deliveredEvents || []).forEach((eventId) => {
        const event = Story.events?.[eventId];
        if (!event || event.type !== "chat") return;
        const contact = contactForSource(event.source || "Система");
        ensureUser(state, contact);
        ensureChat(state, contact);
        upsertStoryMessage(state, contact, {
          id: event.id,
          text: event.text || event.title || "Новое служебное сообщение",
          dayIndex: Number(event.dayIndex ?? gameState.dayIndex),
          minute: Number(event.minute ?? gameState.minute),
          side: "them"
        }, true);
      });

      Object.entries(gameState.completedActions || {}).forEach(([actionId, completed]) => {
        const action = Story.actions?.[actionId];
        if (!action || action.channel !== "chat") return;
        const contact = contactForAction(actionId);
        ensureUser(state, contact);
        ensureChat(state, contact);
        upsertStoryMessage(state, contact, {
          id: `sent-${actionId}`,
          text: action.label,
          dayIndex: Number(completed?.dayIndex ?? gameState.dayIndex),
          minute: Number(completed?.minute ?? gameState.minute),
          side: "me"
        }, false);
      });
    });
  }

  function availableStoryActions() {
    return engine()?.listActions?.("chat") || [];
  }

  function performStoryAction(actionId) {
    const current = engine();
    if (!current) return;
    const result = current.applyAction(actionId);
    if (result?.ok) {
      Runtime.notify?.("МИН", result.result || Story.actions?.[actionId]?.label || "Сообщение отправлено.");
    } else {
      Runtime.notify?.("МИН", actionErrorText(result?.reason));
    }
    syncStoryMessages();
    Min.refreshAll?.();
    scheduleDecorate();
    updateBadge();
  }

  function actionErrorText(reason) {
    const messages = {
      "game-ended": "Рабочая неделя уже завершена.",
      "day-not-started": "Рабочий день ещё не начат.",
      "wrong-day": "Этот ответ сегодня недоступен.",
      "already-completed": "Этот вариант уже использован.",
      "requirements-not-met": "Сначала нужно выполнить другие условия.",
      "choice-locked": "Для этой ситуации уже выбран другой ответ.",
      "focus-exhausted": "На сегодня не осталось времени для этого решения.",
      "not-enough-time": "До конца рабочего дня недостаточно времени.",
      "save-failed": "Ответ не сохранён. Освободите место в браузере и повторите."
    };
    return messages[reason] || "Этот ответ сейчас недоступен.";
  }

  function currentWorkContact() {
    const match = currentRoute.match(/\/chat\/([^?#]+)/);
    const chatId = match?.[1] || "";
    return WORK_CONTACTS.find((item) => item.chatId === chatId) || null;
  }

  function decorateStoryActions() {
    decorateQueued = false;
    if (!appWindow?.isConnected) return;
    const content = appWindow.querySelector(".window-content");
    const conversation = content?.querySelector(".min-conversation");
    if (!conversation || conversation.querySelector("[data-min-story-actions]")) return;

    const contact = currentWorkContact();
    if (!contact) return;
    const actions = availableStoryActions().filter((action) => contactForAction(action.id)?.chatId === contact.chatId);
    if (!actions.length) return;

    const panel = document.createElement("section");
    panel.className = "min-desktop-story-actions";
    panel.dataset.minStoryActions = "true";
    panel.innerHTML = `<header><div><b>Служебные варианты ответа</b><small>Эти ответы влияют на сюжет и рабочее время.</small></div></header><div></div>`;
    const list = panel.querySelector("div:last-child");
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<span>${escapeHtml(action.label)}</span><small>${Math.max(0, Number(action.minutes || 0))} мин.</small>`;
      button.addEventListener("click", () => performStoryAction(action.id));
      list.appendChild(button);
    });
    const composer = conversation.querySelector(".min-composer");
    conversation.insertBefore(panel, composer || null);
  }

  function scheduleDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    root.requestAnimationFrame?.(decorateStoryActions) || root.setTimeout?.(decorateStoryActions, 0);
  }

  function mountMessenger() {
    if (!appWindow?.isConnected) return;
    syncStoryMessages();
    const content = appWindow.querySelector(".window-content");
    mountCleanup = Min.mount(content, {
      url: currentRoute,
      navigate(url) {
        saveRoute(url);
        mountMessenger();
      }
    });
    appWindow.querySelector(".window-status").textContent = `МИН · ${Min.unreadCount()} непрочитанных · P2P доступен в настройках`;
    scheduleDecorate();
    updateBadge();
  }

  function focusWindow() {
    if (!appWindow?.isConnected) return;
    document.querySelectorAll(".app-window").forEach((element) => element.classList.remove("focused"));
    document.querySelectorAll(".task-button").forEach((button) => button.classList.remove("active"));
    appWindow.classList.remove("minimized");
    appWindow.classList.add("focused");
    appWindow.style.zIndex = String(++topZ);
    taskButton?.classList.add("active");
  }

  function closeWindow() {
    contentObserver?.disconnect();
    contentObserver = null;
    mountCleanup?.();
    mountCleanup = null;
    appWindow?.remove();
    taskButton?.remove();
    appWindow = null;
    taskButton = null;
  }

  function createTaskButton() {
    const taskbar = document.querySelector("#task-buttons");
    if (!taskbar) return;
    taskButton = document.createElement("button");
    taskButton.type = "button";
    taskButton.className = "task-button min-desktop-task active";
    taskButton.dataset.taskWindow = APP_ID;
    taskButton.textContent = APP_TITLE;
    taskButton.addEventListener("click", () => {
      if (!appWindow?.isConnected) return;
      if (appWindow.classList.contains("minimized")) {
        appWindow.classList.remove("minimized");
        focusWindow();
      } else if (appWindow.classList.contains("focused")) {
        appWindow.classList.add("minimized");
        appWindow.classList.remove("focused");
        taskButton.classList.remove("active");
      } else {
        focusWindow();
      }
    });
    taskbar.appendChild(taskButton);
  }

  function openMin() {
    const stale = document.querySelector(`.app-window[data-window-id="${APP_ID}"]:not(.min-desktop-window)`);
    stale?.remove();
    document.querySelector(`.task-button[data-task-window="${APP_ID}"]:not(.min-desktop-task)`)?.remove();

    if (appWindow?.isConnected) {
      mountMessenger();
      focusWindow();
      return;
    }

    const template = document.querySelector("#window-template");
    const layer = document.querySelector("#windows-layer");
    if (!template || !layer) return;

    appWindow = template.content.firstElementChild.cloneNode(true);
    appWindow.dataset.windowId = APP_ID;
    appWindow.classList.add("min-desktop-window", "desktop-app-window");
    appWindow.style.left = "24px";
    appWindow.style.top = "18px";
    appWindow.style.width = "1040px";
    appWindow.style.height = "650px";
    appWindow.querySelector(".window-title").textContent = APP_TITLE;
    appWindow.querySelector(".window-status").textContent = "Запуск МИН…";
    appWindow.querySelector(".window-content").innerHTML = `<div class="min-desktop-loading">Подключение мессенджера…</div>`;
    appWindow.addEventListener("pointerdown", focusWindow);
    appWindow.addEventListener("click", (event) => {
      const action = event.target.closest("[data-window-action]")?.dataset.windowAction;
      if (action === "close") closeWindow();
      if (action === "minimize") {
        appWindow.classList.add("minimized");
        appWindow.classList.remove("focused");
        taskButton?.classList.remove("active");
      }
    });

    layer.appendChild(appWindow);
    createTaskButton();
    focusWindow();

    const content = appWindow.querySelector(".window-content");
    contentObserver = new MutationObserver(scheduleDecorate);
    contentObserver.observe(content, { childList: true, subtree: true });

    root.UntilFridayWindowLayout?.enhance?.(appWindow, APP_ID);
    root.UntilFridayWindowLayout?.maximize?.(appWindow);
    mountMessenger();
  }

  function launcherIconMarkup() {
    return `<img class="min-desktop-icon-image" src="${ICON_URL}" alt="">`;
  }

  function badgeMarkup() {
    return `<span class="min-desktop-badge" data-min-desktop-badge hidden></span>`;
  }

  function replaceDesktopLauncher(button) {
    if (!button || button.dataset.minDesktopLauncher) return button;
    const clone = button.cloneNode(true);
    clone.dataset.app = APP_ID;
    clone.dataset.minDesktopLauncher = "true";
    const glyph = clone.querySelector(".desktop-icon__glyph");
    const label = clone.querySelector(".desktop-icon__label");
    if (glyph) glyph.innerHTML = launcherIconMarkup();
    if (label) label.textContent = APP_TITLE;
    clone.insertAdjacentHTML("beforeend", badgeMarkup());
    clone.addEventListener("click", () => {
      document.querySelectorAll(".desktop-icon").forEach((item) => item.classList.remove("selected"));
      clone.classList.add("selected");
    });
    clone.addEventListener("dblclick", openMin);
    clone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMin();
      }
    });
    button.replaceWith(clone);
    return clone;
  }

  function replaceStartLauncher(button) {
    if (!button || button.dataset.minDesktopLauncher) return button;
    const clone = button.cloneNode(true);
    clone.dataset.app = APP_ID;
    clone.dataset.minDesktopLauncher = "true";
    const glyph = clone.querySelector(".desktop-icon__glyph");
    const labels = clone.querySelectorAll("span");
    if (glyph) glyph.innerHTML = launcherIconMarkup();
    if (labels.length) labels[labels.length - 1].textContent = APP_TITLE;
    clone.insertAdjacentHTML("beforeend", badgeMarkup());
    clone.addEventListener("click", () => {
      document.querySelector("#start-menu")?.classList.add("hidden");
      document.querySelector("#start-button")?.classList.remove("active");
      openMin();
    });
    button.replaceWith(clone);
    return clone;
  }

  function ensureLaunchers() {
    const desktop = document.querySelector(`.desktop-icon[data-app="${APP_ID}"]`);
    replaceDesktopLauncher(desktop);

    const startButtons = [...document.querySelectorAll("#start-apps .start-app")];
    const start = startButtons.find((button) => button.dataset.app === APP_ID || /Связь|МИН/.test(button.textContent));
    replaceStartLauncher(start);
    updateBadge();
  }

  function updateBadge() {
    const count = Math.max(0, Number(Min.unreadCount?.() || 0));
    document.querySelectorAll("[data-min-desktop-badge]").forEach((badge) => {
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.setAttribute("aria-label", `Непрочитанных сообщений МИН: ${count}`);
    });
    if (appWindow?.isConnected) {
      appWindow.querySelector(".window-status").textContent = `МИН · ${count} непрочитанных · P2P доступен в настройках`;
    }
  }

  function isMinAddress(value) {
    const text = String(value || "").trim().toLowerCase();
    return text === "мин" || text === "min" || text.includes("min.local") || text.includes("мессенджер мин");
  }

  document.addEventListener("click", (event) => {
    const minLink = event.target.closest('[data-rb-page="min"], [data-rb-address-value*="min.local"]');
    if (minLink) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMin();
      return;
    }
    root.setTimeout?.(updateBadge, 0);
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("[data-rb-address]");
    if (!form) return;
    const value = form.querySelector("input")?.value;
    if (!isMinAddress(value)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMin();
  }, true);

  root.addEventListener("until-friday-open-app", (event) => {
    if (event.detail?.appId === APP_ID || event.detail?.appId === "min") openMin();
  });

  root.addEventListener("until-friday-app-ready", () => {
    ensureLaunchers();
    syncStoryMessages();
    updateBadge();
  });

  root.addEventListener("until-friday-state-change", () => {
    syncStoryMessages();
    if (appWindow?.isConnected) mountMessenger();
    ensureLaunchers();
    updateBadge();
  });

  root.addEventListener("until-friday-min-state-change", updateBadge);
  root.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) updateBadge();
  });

  document.addEventListener("DOMContentLoaded", () => {
    root.setTimeout?.(() => {
      ensureLaunchers();
      syncStoryMessages();
      updateBadge();
    }, 0);
  }, { once: true });

  root.UntilFridayMinDesktopIntegration = {
    APP_ID,
    APP_TITLE,
    WORK_CONTACTS,
    contactForAction,
    syncStoryMessages,
    ensureLaunchers,
    updateBadge,
    openMin,
    closeWindow
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
