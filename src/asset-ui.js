(function (root) {
  "use strict";

  const assets = root.UNTIL_FRIDAY_ASSETS;
  const sprites = root.UntilFridaySprites;
  if (!assets || !sprites) return;

  const DAY_CODES = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];
  const viewerWindows = new Map();
  let decorateQueued = false;
  let topZ = 900;

  const storyAssets = {
    0: [
      {
        id: "scan-contract-2019",
        title: "Договор_2019_скан.pdf",
        type: "Скан договора",
        icon: "pdfLike",
        image: assets.documents.contract,
        caption: "Старый договор из общего архива. На последней странице видны подпись и печать.",
        overlays: [
          { src: assets.signatures.director, className: "asset-overlay signature director" },
          { src: assets.stamps.company, className: "asset-overlay stamp company" }
        ]
      }
    ],
    1: [
      {
        id: "photo-empty-desk",
        title: "Фото_пустое_место.jpg",
        type: "Изображение",
        icon: "image",
        image: assets.photos.emptyDesk,
        caption: "Фотография пустого рабочего места. Непонятно, сотрудник переезжает или уже собирает вещи."
      },
      {
        id: "photo-boxes-corridor",
        title: "Коробки_коридор.jpg",
        type: "Изображение",
        icon: "image",
        image: assets.photos.boxes,
        caption: "Коробки возле закрытого кабинета. На одной лежат папки и канцелярия."
      }
    ],
    2: [
      {
        id: "scan-office-memo",
        title: "Служебная_записка_черновик.pdf",
        type: "Служебный документ",
        icon: "pdfLike",
        image: assets.documents.memo,
        caption: "Черновик служебной записки. Часть текста плохо читается, дата приходится на текущую неделю.",
        overlays: [
          { src: assets.signatures.accountant, className: "asset-overlay signature accountant" },
          { src: assets.stamps.confidential, className: "asset-overlay stamp confidential" }
        ]
      }
    ],
    3: [
      {
        id: "photo-office-party",
        title: "Корпоратив_архив.jpg",
        type: "Изображение",
        icon: "image",
        image: assets.photos.party,
        caption: "Старая фотография с корпоратива. Несколько людей на снимке сейчас избегают друг друга."
      }
    ]
  };

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    window.requestAnimationFrame(() => {
      decorateQueued = false;
      decorateAll();
    });
  }

  function currentDayIndex() {
    const text = document.querySelector("#clock-date")?.textContent.trim().toUpperCase() || "";
    const index = DAY_CODES.findIndex((code) => text.startsWith(code));
    return index >= 0 ? index : 0;
  }

  function atlasIcon(group, name, size, className) {
    const holder = document.createElement("span");
    holder.className = className || "atlas-icon-holder";
    holder.appendChild(sprites.createIcon(group, name, size, { className: "atlas-icon" }));
    return holder;
  }

  function replaceWithAtlas(target, group, name, size) {
    if (!target) return;
    const key = `${group}.${name}.${size}`;
    if (target.dataset.atlasIcon === key) return;
    target.dataset.atlasIcon = key;
    target.replaceChildren(sprites.createIcon(group, name, size, { className: "atlas-icon" }));
  }

  function inferFileIcon(row) {
    const text = row.textContent.toLowerCase();
    if (text.includes("закрыт") || text.includes("нет доступа") || text.includes("защищ")) return ["files", "protected"];
    if (text.includes("корзин") || text.includes("удален")) return ["files", "deleted"];
    if (text.includes("папка") || text.includes("руководство")) return ["folders", text.includes("нет доступа") ? "protected" : "normal"];
    if (text.includes("таблиц") || text.includes("xlsx") || text.includes("xls")) return ["files", "spreadsheet"];
    if (text.includes("изображ") || text.includes(".jpg") || text.includes(".png") || text.includes("фото")) return ["files", "image"];
    if (text.includes("архив") || text.includes(".zip")) return ["files", "archive"];
    if (text.includes("журнал") || text.includes(".log") || text.includes("системн")) return ["files", "systemLog"];
    if (text.includes(".cmd") || text.includes("исполня") || text.includes("скрипт")) return ["files", "executable"];
    if (text.includes(".pdf") || text.includes("договор") || text.includes("приказ") || text.includes("записк")) return ["files", "pdfLike"];
    if (text.includes("неизвест")) return ["files", "unknown"];
    return ["files", "text"];
  }

  function decorateFileRows() {
    document.querySelectorAll(".file-table tbody tr").forEach((row) => {
      const target = row.querySelector(".file-icon");
      if (!target || row.dataset.assetStory === "true") return;
      const [group, icon] = inferFileIcon(row);
      replaceWithAtlas(target, group, icon, 26);
      target.classList.add("file-icon-atlas");
    });
  }

  function decorateFolderSidebar() {
    const iconMap = {
      "рабочий стол": "normal",
      "документы": "open",
      "общий диск": "shared",
      "система": "protected"
    };

    document.querySelectorAll(".v2-folders button").forEach((button) => {
      if (button.dataset.folderDecorated === "true") return;
      const label = button.textContent.trim().toLowerCase();
      const name = iconMap[label] || "normal";
      button.dataset.folderDecorated = "true";
      button.prepend(atlasIcon("folders", name, 24, "folder-sidebar-icon"));
    });
  }

  function contactStatus(name, dayIndex) {
    const schedules = {
      "Дима Орлов": ["online", "online", "away", "busy", "offline"],
      "Олег Казанцев": ["away", "online", "online", "busy", "offline"],
      "Роман Белов": ["busy", "busy", "doNotDisturb", "online", "offline"],
      "Андрей Соколов": ["doNotDisturb", "busy", "busy", "doNotDisturb", "offline"],
      "Марина Лебедева": ["online", "away", "busy", "online", "offline"]
    };
    return schedules[name]?.[dayIndex] || "offline";
  }

  function statusLabel(status) {
    return {
      online: "В сети",
      away: "Отошёл",
      busy: "Занят",
      doNotDisturb: "Не беспокоить",
      offline: "Не в сети",
      blocked: "Заблокирован"
    }[status] || "Не в сети";
  }

  function decorateContacts() {
    const day = currentDayIndex();
    document.querySelectorAll(".contact").forEach((button) => {
      const name = button.querySelector("strong")?.textContent.trim() || "";
      const status = contactStatus(name, day);
      let holder = button.querySelector(".contact-status-icon");
      if (!holder) {
        holder = document.createElement("span");
        holder.className = "contact-status-icon";
        button.appendChild(holder);
      }
      replaceWithAtlas(holder, "statuses", status, 14);
      holder.title = statusLabel(status);
      holder.setAttribute("aria-label", statusLabel(status));
    });
  }

  function notificationIcon(text) {
    const value = text.toLowerCase();
    if (value.includes("ошиб") || value.includes("критич")) return "criticalError";
    if (value.includes("доступ") || value.includes("безопас") || value.includes("администратор")) return "security";
    if (value.includes("почт") || value.includes("письм")) return "newMail";
    if (value.includes("связ") || value.includes("сообщ")) return "newMessage";
    if (value.includes("нет соедин") || value.includes("отключ")) return "networkLost";
    if (value.includes("сеть") || value.includes("сеанс")) return "networkConnected";
    if (value.includes("вниман") || value.includes("предупреж")) return "warning";
    return "information";
  }

  function decorateNotifications() {
    document.querySelectorAll(".notification, .toast").forEach((notification) => {
      if (notification.dataset.systemIcon === "true") return;
      notification.dataset.systemIcon = "true";
      notification.prepend(atlasIcon("system", notificationIcon(notification.textContent), 28, "notification-system-icon"));
    });
  }

  function attachmentIcon(text) {
    const value = text.toLowerCase();
    if (value.includes("отчёт") || value.includes("счёт") || value.includes("таблиц")) return "spreadsheet";
    if (value.includes("архив")) return "archive";
    if (value.includes("фото") || value.includes("изображ")) return "image";
    if (value.includes("безопас") || value.includes("защищ")) return "protectedArchive";
    if (value.includes("ошиб") || value.includes("повреж")) return "damaged";
    if (value.includes("документ") || value.includes("кадр") || value.includes("приказ")) return "file";
    return null;
  }

  function decorateMailAttachments() {
    document.querySelectorAll(".mail-item").forEach((button) => {
      if (button.dataset.attachmentDecorated === "true") return;
      const icon = attachmentIcon(button.textContent);
      button.dataset.attachmentDecorated = "true";
      if (!icon) return;
      const holder = atlasIcon("attachments", icon, 22, "mail-attachment-icon");
      holder.title = "Есть вложение";
      button.appendChild(holder);
    });
  }

  function decorateRestrictedViews() {
    document.querySelectorAll(".restricted").forEach((container) => {
      if (container.dataset.restrictedDecorated === "true") return;
      container.dataset.restrictedDecorated = "true";
      const panel = container.firstElementChild || container;
      const image = document.createElement("img");
      image.src = assets.system.lockedAccess;
      image.alt = "Закрытый доступ";
      image.className = "restricted-access-image";
      panel.prepend(image);
    });
  }

  function storyRowsForDay(day) {
    return storyAssets[day] || [];
  }

  function addStoryAssetRows() {
    const day = currentDayIndex();
    document.querySelectorAll(".file-table tbody").forEach((tbody) => {
      storyRowsForDay(day).forEach((file) => {
        if (tbody.querySelector(`[data-story-asset-id="${file.id}"]`)) return;
        const row = document.createElement("tr");
        row.dataset.storyAssetId = file.id;
        row.dataset.assetStory = "true";
        row.innerHTML = `<td><span class="file-icon file-icon-atlas"></span><span>${escapeHtml(file.title)}</span></td><td>${escapeHtml(file.type)}</td><td>Доступен</td>`;
        replaceWithAtlas(row.querySelector(".file-icon"), "files", file.icon, 26);
        row.addEventListener("click", () => {
          tbody.querySelectorAll("tr").forEach((item) => item.classList.remove("selected"));
          row.classList.add("selected");
        });
        row.addEventListener("dblclick", () => openAssetViewer(file));
        tbody.appendChild(row);
      });
    });
  }

  function openAssetViewer(file) {
    const existing = viewerWindows.get(file.id);
    if (existing?.isConnected) {
      focusAssetViewer(existing, file.id);
      return;
    }

    const layer = document.querySelector("#windows-layer");
    if (!layer) return;
    const element = document.createElement("section");
    element.className = "app-window focused asset-viewer-window";
    element.dataset.assetViewer = file.id;
    element.style.left = `${Math.max(24, 110 + viewerWindows.size * 22)}px`;
    element.style.top = `${Math.max(24, 72 + viewerWindows.size * 18)}px`;
    element.style.zIndex = String(++topZ);
    element.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title">${escapeHtml(file.title)}</div>
        <div class="window-controls"><button type="button" data-close aria-label="Закрыть">×</button></div>
      </header>
      <div class="window-content asset-viewer-content">
        <figure class="asset-document-stage">
          <img class="asset-document-image" src="${escapeAttribute(file.image)}" alt="${escapeAttribute(file.title)}" />
        </figure>
        <p class="asset-document-caption">${escapeHtml(file.caption || "")}</p>
      </div>
      <footer class="window-status">Просмотр · только чтение</footer>`;

    const stage = element.querySelector(".asset-document-stage");
    (file.overlays || []).forEach((overlay) => {
      const image = document.createElement("img");
      image.src = overlay.src;
      image.alt = "";
      image.className = overlay.className;
      stage.appendChild(image);
    });

    element.querySelector("[data-close]").addEventListener("click", () => closeAssetViewer(file.id));
    element.addEventListener("mousedown", () => focusAssetViewer(element, file.id));
    makeDraggable(element, element.querySelector(".window-titlebar"));
    layer.appendChild(element);
    viewerWindows.set(file.id, element);
    createViewerTaskButton(file, element);
  }

  function createViewerTaskButton(file, element) {
    const taskbar = document.querySelector("#task-buttons");
    if (!taskbar) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-button active asset-viewer-task";
    button.dataset.assetViewerTask = file.id;
    button.textContent = file.title;
    button.addEventListener("click", () => {
      if (!element.isConnected) return;
      const minimized = element.classList.toggle("minimized");
      button.classList.toggle("active", !minimized);
      if (!minimized) focusAssetViewer(element, file.id);
    });
    taskbar.appendChild(button);
  }

  function focusAssetViewer(element, id) {
    document.querySelectorAll(".app-window").forEach((win) => win.classList.remove("focused"));
    document.querySelectorAll(".task-button").forEach((button) => button.classList.remove("active"));
    element.classList.remove("minimized");
    element.classList.add("focused");
    element.style.zIndex = String(++topZ);
    document.querySelector(`[data-asset-viewer-task="${id}"]`)?.classList.add("active");
  }

  function closeAssetViewer(id) {
    viewerWindows.get(id)?.remove();
    viewerWindows.delete(id);
    document.querySelector(`[data-asset-viewer-task="${id}"]`)?.remove();
  }

  function makeDraggable(element, handle) {
    let drag = null;
    handle.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) return;
      const rect = element.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      event.preventDefault();
    });
    document.addEventListener("mousemove", (event) => {
      if (!drag) return;
      const maxX = Math.max(0, window.innerWidth - element.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - element.offsetHeight - 42);
      element.style.left = `${Math.max(0, Math.min(maxX, event.clientX - drag.x))}px`;
      element.style.top = `${Math.max(0, Math.min(maxY, event.clientY - drag.y))}px`;
    });
    document.addEventListener("mouseup", () => { drag = null; });
  }

  function updateTrashIcon() {
    const hasItems = document.querySelectorAll(".trash-item").length > 0;
    const url = hasItems ? assets.system.trashFull : assets.system.trashEmpty;
    document.querySelectorAll('.desktop-icon[data-app="trash"] .desktop-icon__glyph img, .start-app .desktop-icon__glyph img').forEach((image) => {
      const button = image.closest(".desktop-icon, .start-app");
      const isTrash = button?.dataset.app === "trash" || button?.textContent.toLowerCase().includes("корзина");
      if (isTrash && image.src !== new URL(url, document.baseURI).href) image.src = url;
    });
  }

  function decorateEndings() {
    document.querySelectorAll(".ending-overlay").forEach((overlay) => {
      if (overlay.dataset.assetBackground === "true") return;
      overlay.dataset.assetBackground = "true";
      overlay.style.setProperty("--ending-background", `url("${assets.backgrounds.lockscreen}")`);
    });
  }

  function decorateAll() {
    decorateFileRows();
    decorateFolderSidebar();
    decorateContacts();
    decorateNotifications();
    decorateMailAttachments();
    decorateRestrictedViews();
    addStoryAssetRows();
    updateTrashIcon();
    decorateEndings();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", queueDecorate, { once: true });
  window.addEventListener("load", queueDecorate, { once: true });
  queueDecorate();

  root.UntilFridayAssetUI = {
    decorate: decorateAll,
    openAssetViewer,
    storyAssets
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
