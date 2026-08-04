(function (root) {
  "use strict";

  if (root.UntilFridayMinUIFixes) return;

  const Min = root.UntilFridayMinMessenger;
  if (!Min) return;

  const STORAGE_KEY = Min.STORAGE_KEY;
  const SYSTEM_FOLDER_IDS = new Set(["all", "unread", "personal", "groups", "channels"]);
  const REACTIONS = [
    { key: "👍", label: "Нравится", icon: "facebook-like" },
    { key: "😁", label: "Смешно", icon: "happy" },
    { key: "❤️", label: "Сердце", icon: "like--v1" },
    { key: "🔥", label: "Огонь", icon: "fire-element" },
    { key: "😮", label: "Удивление", icon: "surprised" },
    { key: "😢", label: "Грустно", icon: "crying" }
  ];
  const REACTION_BY_KEY = new Map(REACTIONS.map((reaction) => [reaction.key, reaction]));
  const ICON_ROOT = "https://img.icons8.com/fluency";
  const iconUrl = (name, size = 18) => `${ICON_ROOT}/${size}/${name}.png`;

  let scheduled = false;
  let pendingSelectFolderId = "";
  let pressState = null;
  let dragState = null;
  let holdTimer = null;
  let suppressClickUntil = 0;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uid(prefix = "folder") {
    const cryptoId = root.crypto?.randomUUID?.();
    return cryptoId ? `${prefix}-${cryptoId}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function readState() {
    try {
      const raw = root.localStorage?.getItem(STORAGE_KEY);
      return Min.normalize(raw ? JSON.parse(raw) : Min.getState());
    } catch {
      return Min.normalize(Min.getState());
    }
  }

  function dispatchStorage(json, reason) {
    try {
      if (typeof root.StorageEvent === "function") {
        root.dispatchEvent(new root.StorageEvent("storage", {
          key: STORAGE_KEY,
          oldValue: null,
          newValue: json,
          storageArea: root.localStorage,
          url: root.location?.href || ""
        }));
      } else {
        const event = typeof root.Event === "function" ? new root.Event("storage") : { type: "storage" };
        Object.defineProperty(event, "key", { value: STORAGE_KEY });
        Object.defineProperty(event, "newValue", { value: json });
        root.dispatchEvent?.(event);
      }
    } catch {
      try {
        const fallback = typeof root.Event === "function" ? new root.Event("storage") : null;
        if (fallback) {
          Object.defineProperty(fallback, "key", { value: STORAGE_KEY });
          Object.defineProperty(fallback, "newValue", { value: json });
          root.dispatchEvent?.(fallback);
        }
      } catch {}
    }
    try {
      root.dispatchEvent?.(new root.CustomEvent("until-friday-min-state-change", { detail: { reason } }));
    } catch {}
  }

  function writeState(state, reason = "ui-folders") {
    state.updatedAt = new Date().toISOString();
    const json = JSON.stringify(state);
    root.localStorage?.setItem(STORAGE_KEY, json);
    dispatchStorage(json, reason);
    return state;
  }

  function isCustomFolder(folder) {
    return Boolean(folder && (folder.custom === true || Array.isArray(folder.chatIds)) && !SYSTEM_FOLDER_IDS.has(folder.id));
  }

  function createFolder(title, chatIds) {
    const cleanTitle = String(title || "").trim().slice(0, 32);
    const state = readState();
    const available = new Set(state.chats.filter((chat) => !chat.archived).map((chat) => chat.id));
    const selected = [...new Set(Array.isArray(chatIds) ? chatIds : [])].filter((id) => available.has(id));
    if (!cleanTitle) return { ok: false, reason: "empty-title" };
    if (!selected.length) return { ok: false, reason: "empty-folder" };

    const folder = {
      id: uid("folder"),
      title: cleanTitle,
      custom: true,
      chatIds: selected,
      createdAt: new Date().toISOString()
    };
    state.folders = [...state.folders, folder];
    writeState(state, "create-folder");
    return { ok: true, folder };
  }

  function reorderFolders(folderIds) {
    const state = readState();
    const systemFolders = state.folders.filter((folder) => !isCustomFolder(folder));
    const customFolders = state.folders.filter(isCustomFolder);
    const customById = new Map(customFolders.map((folder) => [folder.id, folder]));
    const ordered = [];
    for (const id of folderIds || []) {
      const folder = customById.get(id);
      if (!folder || ordered.includes(folder)) continue;
      ordered.push(folder);
    }
    for (const folder of customFolders) if (!ordered.includes(folder)) ordered.push(folder);
    state.folders = [...systemFolders, ...ordered];
    writeState(state, "reorder-folders");
    return ordered.map((folder) => folder.id);
  }

  function reactionIcon(reactionKey) {
    return REACTION_BY_KEY.get(reactionKey) || { key: reactionKey, label: "Реакция", icon: "approval" };
  }

  function enhanceReactions(app) {
    app.querySelectorAll(".min-reactions [data-min-reaction]").forEach((button) => {
      if (button.dataset.minIcons8Reaction === "true") return;
      const key = button.dataset.minReaction || "👍";
      const reaction = reactionIcon(key);
      const count = button.querySelector("span")?.textContent || "";
      button.dataset.minIcons8Reaction = "true";
      button.title = reaction.label;
      button.setAttribute("aria-label", `${reaction.label}: ${count || 0}`);
      button.innerHTML = `<img src="${iconUrl(reaction.icon)}" alt=""><span>${esc(count)}</span>`;
    });
  }

  function folderStateById(state, id) {
    return state.folders.find((folder) => folder.id === id) || null;
  }

  function applyCustomFolderFilter(app, state) {
    const activeButton = app.querySelector(".min-folders [data-min-folder].active");
    const activeFolder = folderStateById(state, activeButton?.dataset.minFolder);
    const rows = [...app.querySelectorAll(".min-chat-items [data-min-chat]")];
    const list = app.querySelector(".min-chat-items");
    const existingEmpty = list?.querySelector("[data-min-custom-folder-empty]") || null;

    if (!isCustomFolder(activeFolder)) {
      rows.forEach((row) => { row.hidden = false; });
      existingEmpty?.remove();
      return;
    }

    const allowed = new Set(activeFolder.chatIds || []);
    let visible = 0;
    rows.forEach((row) => {
      row.hidden = !allowed.has(row.dataset.minChat);
      if (!row.hidden) visible += 1;
    });
    if (visible) {
      existingEmpty?.remove();
      return;
    }
    if (!existingEmpty && list) {
      const empty = document.createElement("div");
      empty.className = "min-custom-folder-empty";
      empty.dataset.minCustomFolderEmpty = "true";
      empty.innerHTML = `<img src="${iconUrl("folder-invoices", 40)}" alt=""><b>В этой папке нет доступных чатов</b><span>Создайте новую папку или выберите другую.</span>`;
      list.appendChild(empty);
    }
  }

  function enhanceFolders(app) {
    const bar = app.querySelector(".min-folders");
    if (!bar) return;
    const state = readState();

    bar.querySelectorAll("[data-min-folder]").forEach((button) => {
      const folder = folderStateById(state, button.dataset.minFolder);
      if (!isCustomFolder(folder)) {
        delete button.dataset.minCustomFolder;
        return;
      }
      button.dataset.minCustomFolder = "true";
      button.title = "Удерживайте левую кнопку мыши, чтобы переместить папку";
    });

    if (!bar.querySelector("[data-min-folder-add]")) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "min-folder-add";
      add.dataset.minFolderAdd = "true";
      add.title = "Создать папку";
      add.setAttribute("aria-label", "Создать папку с чатами");
      add.innerHTML = `<img src="${iconUrl("plus-math", 17)}" alt="">`;
      bar.appendChild(add);
    }

    applyCustomFolderFilter(app, state);

    if (pendingSelectFolderId) {
      const target = bar.querySelector(`[data-min-folder="${pendingSelectFolderId}"]`);
      if (target) {
        const id = pendingSelectFolderId;
        pendingSelectFolderId = "";
        root.requestAnimationFrame?.(() => {
          const current = document.querySelector(`.min-app .min-folders [data-min-folder="${id}"]`);
          current?.click();
          current?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" });
        });
      }
    }
  }

  function folderModalHtml(state) {
    const chats = state.chats.filter((chat) => !chat.archived);
    return `<div class="min-folder-modal-backdrop" data-min-folder-modal><form class="min-folder-modal" data-min-folder-form><header><div><h2>Новая папка</h2><p>Дайте папке название и выберите чаты.</p></div><button type="button" data-min-folder-close><img src="${iconUrl("delete-sign", 19)}" alt=""></button></header><label class="min-folder-name"><span>Название папки</span><input name="title" maxlength="32" autocomplete="off" placeholder="Например, Работа" required></label><fieldset><legend>Чаты</legend><div class="min-folder-chat-options">${chats.map((chat) => `<label><input type="checkbox" name="chatId" value="${esc(chat.id)}"><span class="min-folder-chat-avatar" style="--folder-avatar:${esc(chat.color || "#527fa8")}">${esc(chat.title.slice(0, 1).toUpperCase())}</span><span><b>${esc(chat.title)}</b><small>${chat.type === "group" ? "Группа" : chat.type === "channel" ? "Канал" : chat.type === "saved" ? "Избранное" : "Личный чат"}</small></span></label>`).join("")}</div></fieldset><p class="min-folder-error" data-min-folder-error hidden></p><footer><button type="button" data-min-folder-close>Отмена</button><button class="primary"><img src="${iconUrl("folder-invoices", 18)}" alt="">Создать папку</button></footer></form></div>`;
  }

  function openFolderModal(app) {
    app.querySelector("[data-min-folder-modal]")?.remove();
    app.insertAdjacentHTML("beforeend", folderModalHtml(readState()));
    root.requestAnimationFrame?.(() => app.querySelector("[data-min-folder-form] input[name=title]")?.focus());
  }

  function closeFolderModal(target) {
    target?.closest("[data-min-folder-modal]")?.remove();
  }

  function handleFolderSubmit(event) {
    const form = event.target.closest?.("[data-min-folder-form]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const result = createFolder(data.get("title"), data.getAll("chatId"));
    const error = form.querySelector("[data-min-folder-error]");
    if (!result.ok) {
      error.hidden = false;
      error.textContent = result.reason === "empty-title" ? "Введите название папки." : "Выберите хотя бы один чат.";
      return;
    }
    pendingSelectFolderId = result.folder.id;
    closeFolderModal(form);
    scheduleEnhance();
  }

  function clearHoldTimer() {
    if (holdTimer) root.clearTimeout?.(holdTimer);
    holdTimer = null;
  }

  function beginFolderDrag(button, pointerId) {
    const bar = button.closest(".min-folders");
    if (!bar || !button.dataset.minCustomFolder) return;
    dragState = { button, bar, moved: false, pointerId };
    button.classList.add("dragging");
    bar.classList.add("drag-mode");
    document.body?.classList.add("min-folder-dragging");
    try { button.setPointerCapture?.(pointerId); } catch {}
  }

  function persistDraggedFolderOrder() {
    if (!dragState) return;
    const ids = [...dragState.bar.querySelectorAll("[data-min-custom-folder]")].map((button) => button.dataset.minFolder);
    reorderFolders(ids);
  }

  function finishFolderDrag() {
    clearHoldTimer();
    if (dragState) {
      persistDraggedFolderOrder();
      suppressClickUntil = Date.now() + 550;
      dragState.button.classList.remove("dragging");
      dragState.bar.classList.remove("drag-mode");
      document.body?.classList.remove("min-folder-dragging");
      try { dragState.button.releasePointerCapture?.(dragState.pointerId); } catch {}
    }
    dragState = null;
    pressState = null;
  }

  function handlePointerDown(event) {
    const button = event.target.closest?.("[data-min-custom-folder]");
    if (!button || event.button !== 0) return;
    clearHoldTimer();
    pressState = { button, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    holdTimer = root.setTimeout?.(() => beginFolderDrag(button, event.pointerId), 420);
  }

  function handlePointerMove(event) {
    if (pressState && !dragState) {
      const distance = Math.hypot(event.clientX - pressState.x, event.clientY - pressState.y);
      if (distance > 7) {
        clearHoldTimer();
        pressState = null;
      }
      return;
    }
    if (!dragState) return;
    event.preventDefault();
    const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.("[data-min-custom-folder]");
    if (!target || target === dragState.button || target.closest(".min-folders") !== dragState.bar) return;
    const rect = target.getBoundingClientRect();
    const before = event.clientX < rect.left + rect.width / 2;
    dragState.bar.insertBefore(dragState.button, before ? target : target.nextSibling);
    dragState.moved = true;
  }

  function handleClickCapture(event) {
    const add = event.target.closest?.("[data-min-folder-add]");
    if (add) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openFolderModal(add.closest(".min-app"));
      return;
    }
    const close = event.target.closest?.("[data-min-folder-close]");
    if (close) {
      event.preventDefault();
      closeFolderModal(close);
      return;
    }
    if (Date.now() < suppressClickUntil && event.target.closest?.("[data-min-custom-folder]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function enhanceAll() {
    scheduled = false;
    document.querySelectorAll(".min-app").forEach((app) => {
      enhanceReactions(app);
      enhanceFolders(app);
    });
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(enhanceAll);
    else root.setTimeout?.(enhanceAll, 0);
  }

  document.addEventListener("click", handleClickCapture, true);
  document.addEventListener("submit", handleFolderSubmit);
  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("pointermove", handlePointerMove, { capture: true, passive: false });
  document.addEventListener("pointerup", finishFolderDrag, true);
  document.addEventListener("pointercancel", finishFolderDrag, true);
  root.addEventListener?.("storage", (event) => { if (event.key === STORAGE_KEY) scheduleEnhance(); });
  root.addEventListener?.("until-friday-min-state-change", scheduleEnhance);

  if (typeof root.MutationObserver === "function" && document.documentElement) {
    const observer = new root.MutationObserver(scheduleEnhance);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
  scheduleEnhance();

  root.UntilFridayMinUIFixes = {
    REACTIONS,
    readState,
    createFolder,
    reorderFolders,
    isCustomFolder,
    enhanceAll,
    openFolderModal
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
