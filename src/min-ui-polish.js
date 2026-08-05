(function (root) {
  "use strict";

  if (root.UntilFridayMinPolish) return;

  const STORAGE_KEY = root.UntilFridayMinMessenger?.STORAGE_KEY || "until-friday-min-messenger-v1";
  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const COLORS = ["#4f83b7", "#527f70", "#8768a8", "#b06f52", "#5277a6", "#9b6b83"];
  const TRANSLIT = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
  };

  let activeModal = null;
  let observer = null;

  function icon(name, size = 22) {
    return `${ICON_ROOT}/${size}/${name}.png`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUsername(value) {
    const transliterated = String(value || "")
      .trim()
      .toLowerCase()
      .split("")
      .map((letter) => TRANSLIT[letter] ?? letter)
      .join("")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_.-]/g, "")
      .replace(/^[_.-]+|[_.-]+$/g, "")
      .slice(0, 32);
    return transliterated || `contact_${Date.now().toString(36).slice(-6)}`;
  }

  function safePeerId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  }

  function uid(prefix) {
    const random = root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    return `${prefix}-${random}`;
  }

  function stateSnapshot() {
    const Min = root.UntilFridayMinMessenger;
    let raw = null;
    try {
      raw = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || "null");
    } catch {}
    if (Min?.normalize) return Min.normalize(raw);
    return raw && typeof raw === "object" ? raw : { users: [], contacts: [], chats: [], messages: [], folders: [], settings: {} };
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
      const event = typeof Event === "function" ? new Event("storage") : { type: "storage" };
      try {
        Object.defineProperty(event, "key", { value: STORAGE_KEY });
        Object.defineProperty(event, "newValue", { value: json });
      } catch {
        event.key = STORAGE_KEY;
        event.newValue = json;
      }
      root.dispatchEvent?.(event);
    }
  }

  function persistState(state, reason) {
    state.updatedAt = new Date().toISOString();
    const json = JSON.stringify(state);
    root.localStorage?.setItem(STORAGE_KEY, json);
    dispatchStorage(json);
    try {
      root.dispatchEvent(new CustomEvent("until-friday-min-state-change", { detail: { reason } }));
    } catch {}
    root.UntilFridayMinMessenger?.refreshAll?.();
    return state;
  }

  function colorFor(value) {
    const hash = [...String(value || "")].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    return COLORS[hash % COLORS.length];
  }

  function addContact(payload = {}) {
    const name = String(payload.name || "").trim().slice(0, 48);
    if (!name) throw new Error("Введите имя контакта.");

    const username = safeUsername(payload.username || name);
    const state = stateSnapshot();
    state.users = Array.isArray(state.users) ? state.users : [];
    state.contacts = Array.isArray(state.contacts) ? state.contacts : [];
    state.chats = Array.isArray(state.chats) ? state.chats : [];

    let user = state.users.find((item) => String(item.username || "").toLowerCase() === username.toLowerCase());
    if (!user) {
      user = {
        id: uid("contact"),
        name,
        username,
        letter: name.slice(0, 1).toUpperCase(),
        color: colorFor(username),
        status: "контакт МИН"
      };
      state.users.push(user);
    } else {
      user.name = name;
      user.letter = name.slice(0, 1).toUpperCase();
    }

    if (!state.contacts.includes(user.id)) state.contacts.push(user.id);

    let chat = state.chats.find((item) => item.type === "private" && Array.isArray(item.memberIds) && item.memberIds.includes(user.id));
    if (!chat) {
      chat = {
        id: uid("chat"),
        type: "private",
        title: user.name,
        memberIds: ["self", user.id],
        createdAt: new Date().toISOString(),
        pinned: false,
        archived: false,
        muted: false,
        unread: 0,
        color: user.color,
        description: `Контакт @${user.username}`
      };
      state.chats.unshift(chat);
    }

    persistState(state, "add-contact");
    return { user, chat };
  }

  function connectPeerId(value) {
    const id = safePeerId(value);
    if (!id) throw new Error("Введите MIN-ID собеседника.");
    const P2P = root.UntilFridayMinP2P;
    if (!P2P?.connect) throw new Error("P2P-модуль ещё не запущен.");
    if (id === P2P.peerId) throw new Error("Нельзя подключиться к собственному MIN-ID.");
    if (!P2P.connect(id)) throw new Error("Не удалось начать подключение.");
    return id;
  }

  function appFor(element) {
    return element?.closest?.(".min-app") || root.document?.querySelector?.(".min-app") || null;
  }

  function closeModal() {
    activeModal?.remove?.();
    activeModal = null;
  }

  function showToast(app, text, type = "success") {
    if (!app || !root.document) return;
    app.querySelectorAll(".min-polish-toast").forEach((item) => item.remove());
    const toast = root.document.createElement("div");
    toast.className = `min-polish-toast ${type}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `<img src="${icon(type === "success" ? "checkmark" : "high-priority")}" alt=""><span>${escapeHtml(text)}</span>`;
    app.appendChild(toast);
    root.setTimeout(() => toast.classList.add("leaving"), 2200);
    root.setTimeout(() => toast.remove(), 2500);
  }

  function modalShell(app, options) {
    closeModal();
    if (!app || !root.document) return null;
    const backdrop = root.document.createElement("div");
    backdrop.className = "min-polish-modal-backdrop";
    backdrop.dataset.minPolishBackdrop = "true";
    backdrop.innerHTML = `<section class="min-polish-modal" role="dialog" aria-modal="true" aria-labelledby="min-polish-modal-title"><header><div class="min-polish-modal-icon"><img src="${icon(options.icon || "info")}" alt=""></div><div><h2 id="min-polish-modal-title">${escapeHtml(options.title)}</h2><p>${escapeHtml(options.subtitle || "")}</p></div><button type="button" data-min-polish-close aria-label="Закрыть"><img src="${icon("delete-sign")}" alt=""></button></header><div class="min-polish-modal-body">${options.body}</div></section>`;
    app.appendChild(backdrop);
    activeModal = backdrop;
    root.requestAnimationFrame?.(() => backdrop.classList.add("visible"));
    root.setTimeout(() => backdrop.querySelector("input:not([readonly])")?.focus(), 30);
    return backdrop;
  }

  function openContactDialog(app) {
    const modal = modalShell(app, {
      icon: "add-user-male",
      title: "Добавить контакт",
      subtitle: "Контакт появится в списке и получит отдельный диалог.",
      body: `<form class="min-polish-form" data-min-polish-contact-form><label><span>Имя</span><input name="name" required maxlength="48" autocomplete="off" placeholder="Например, Алексей"></label><label><span>Имя пользователя</span><div class="min-polish-input-prefix"><b>@</b><input name="username" maxlength="32" autocomplete="off" placeholder="aleksey"></div><small>Можно оставить пустым — МИН создаст имя пользователя автоматически.</small></label><p class="min-polish-form-error" data-min-polish-error hidden></p><footer><button type="button" data-min-polish-close>Отмена</button><button class="primary" type="submit"><img src="${icon("add-user-male")}" alt="">Добавить</button></footer></form>`
    });
    modal?.querySelector("[data-min-polish-contact-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const error = event.currentTarget.querySelector("[data-min-polish-error]");
      try {
        const result = addContact({ name: data.get("name"), username: data.get("username") });
        closeModal();
        showToast(app, `${result.user.name} добавлен в контакты`);
      } catch (reason) {
        error.hidden = false;
        error.textContent = reason.message || String(reason);
      }
    });
  }

  function openPeerDialog(app) {
    const connected = Number(root.UntilFridayMinP2P?.connections?.size || 0);
    const modal = modalShell(app, {
      icon: "connect",
      title: "Подключиться по MIN-ID",
      subtitle: connected ? `Сейчас активно подключений: ${connected}` : "Собеседник должен держать МИН открытым в браузере.",
      body: `<form class="min-polish-form" data-min-polish-peer-form><label><span>MIN-ID собеседника</span><input name="peerId" required maxlength="64" autocomplete="off" spellcheck="false" placeholder="min-xxxxxxxxxxxx"></label><div class="min-polish-peer-note"><img src="${icon("lock")}" alt=""><span>После подключения появится отдельный реальный P2P-диалог. Можно подключить несколько пользователей.</span></div><p class="min-polish-form-error" data-min-polish-error hidden></p><footer><button type="button" data-min-polish-close>Отмена</button><button class="primary" type="submit"><img src="${icon("connect")}" alt="">Подключиться</button></footer></form>`
    });
    modal?.querySelector("[data-min-polish-peer-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const error = event.currentTarget.querySelector("[data-min-polish-error]");
      try {
        const id = connectPeerId(data.get("peerId"));
        closeModal();
        showToast(app, `Подключение к ${id} начато`);
      } catch (reason) {
        error.hidden = false;
        error.textContent = reason.message || String(reason);
      }
    });
  }

  function groupHeaderActions(header) {
    if (!header) return;
    let actions = header.querySelector(":scope > .min-page-actions");
    const directButtons = [...header.children].filter((element) => element.tagName === "BUTTON");
    if (directButtons.length && !actions) {
      actions = root.document.createElement("div");
      actions.className = "min-page-actions";
      header.appendChild(actions);
    }
    directButtons.forEach((button) => actions?.appendChild(button));
    actions?.querySelectorAll("button").forEach((button) => button.classList.add("min-action-button"));
  }

  function convertP2PButton(header) {
    const button = header?.querySelector("button[data-min-p2p-open]");
    if (!button) return;
    button.removeAttribute("data-min-p2p-open");
    button.dataset.minPolishP2pOpen = "true";
    button.title = "Подключить реального пользователя по MIN-ID";
    if (!header.querySelector("[data-min-p2p-sentinel]")) {
      const sentinel = root.document.createElement("span");
      sentinel.hidden = true;
      sentinel.dataset.minP2pOpen = "true";
      sentinel.dataset.minP2pSentinel = "true";
      header.appendChild(sentinel);
    }
  }

  function decorateApp(app) {
    if (!app) return;
    app.classList.add("min-ui-polished");
    app.querySelectorAll(".min-page > header").forEach((header) => {
      convertP2PButton(header);
      groupHeaderActions(header);
    });
    app.querySelectorAll("button").forEach((button) => {
      if (!button.hasAttribute("type")) button.type = "button";
    });
  }

  function decorateAll() {
    root.document?.querySelectorAll?.(".min-app").forEach(decorateApp);
  }

  function onClick(event) {
    const close = event.target.closest?.("[data-min-polish-close]");
    if (close) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.target.matches?.("[data-min-polish-backdrop]") || event.target.dataset?.minPolishBackdrop) {
      closeModal();
      return;
    }
    const add = event.target.closest?.("[data-min-add-contact]");
    if (add) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openContactDialog(appFor(add));
      return;
    }
    const peer = event.target.closest?.("[data-min-polish-p2p-open]");
    if (peer) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openPeerDialog(appFor(peer));
    }
  }

  function start() {
    if (!root.document) return;
    root.document.addEventListener("click", onClick, true);
    root.document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeModal) closeModal();
    });
    observer = new MutationObserver(decorateAll);
    observer.observe(root.document.documentElement, { childList: true, subtree: true });
    decorateAll();
  }

  root.UntilFridayMinPolish = {
    safeUsername,
    safePeerId,
    addContact,
    connectPeerId,
    openContactDialog,
    openPeerDialog,
    decorateAll,
    closeModal
  };

  start();
})(typeof globalThis !== "undefined" ? globalThis : window);
