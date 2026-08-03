(function (root) {
  "use strict";

  const assets = root.UNTIL_FRIDAY_ASSETS;
  const sprites = root.UntilFridaySprites;
  if (!assets || !sprites) return;

  const STORAGE_KEY = "until-friday-workflow-files-v1";
  const viewerWindows = new Map();
  let selectedFileId = null;
  let renderQueued = false;
  let topZ = 1200;

  const attachmentRules = [
    {
      matches: ["отчёт за июль", "отчет за июль"],
      file: {
        id: "mail-report-guide",
        name: "Инструкция_к_отчёту.txt",
        type: "Текстовый документ",
        icon: "text",
        content: "ПОРЯДОК ПОДГОТОВКИ ОТЧЁТА\n\n1. Использовать финальную выгрузку.\n2. Сверить число обращений.\n3. Не отправлять файл с пометкой «черновик».\n4. Итоговую версию положить в общий каталог."
      }
    },
    {
      matches: ["актуализация личных данных", "личных данных", "отдел кадров"],
      file: {
        id: "mail-hr-form",
        name: "Форма_актуализации_данных.pdf",
        type: "Форма отдела кадров",
        icon: "pdfLike",
        image: assets.documents.memo,
        content: "Форма для проверки контактных данных и сведений о пропуске."
      }
    },
    {
      matches: ["счёт", "счет", "платёж", "платеж"],
      file: {
        id: "mail-invoice-copy",
        name: "Счёт_7814_копия.xlsx",
        type: "Таблица",
        icon: "spreadsheet",
        content: "Сумма по договору: 84 200 ₽\nСумма к оплате: 842 000 ₽\n\nВ строке оплаты, вероятно, добавлен лишний ноль."
      }
    },
    {
      matches: ["журнал доступа", "проверка журнала", "безопасност"],
      file: {
        id: "mail-access-log",
        name: "Выписка_журнала_доступа.log",
        type: "Системный журнал",
        icon: "systemLog",
        content: "08:58  USER-IV  SHARED/REPORTS\n09:13  USER-IV  LEADERSHIP/DENIED\n09:14  SYSTEM   ACCESS_REQUEST_CREATED\n\nСерверная копия журнала хранится отдельно."
      }
    },
    {
      matches: ["пропуск", "деактивац"],
      file: {
        id: "mail-badge-request",
        name: "Заявка_на_изменение_пропуска.pdf",
        type: "Служебный документ",
        icon: "protected",
        content: "Номер сотрудника: EMP-????\nДата изменения: пятница, 18:00\nСтатус заявки: подготовка."
      }
    },
    {
      matches: ["приказ", "организационные изменения"],
      file: {
        id: "mail-order-draft",
        name: "Приказ_организационные_изменения.pdf",
        type: "Черновик приказа",
        icon: "pdfLike",
        image: assets.documents.contract,
        content: "Черновик приказа. Фамилия сотрудника в доступной копии не указана."
      }
    }
  ];

  function defaultState() {
    return { files: [], trash: [], log: [] };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return parsed && Array.isArray(parsed.files) && Array.isArray(parsed.trash)
        ? { ...defaultState(), ...parsed }
        : defaultState();
    } catch {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    queueRender();
  }

  function logAction(action, file) {
    state.log.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      action,
      file: file.name
    });
    state.log = state.log.slice(0, 30);
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      decorateAll();
    });
  }

  function findAttachment(title) {
    const value = String(title || "").toLowerCase();
    return attachmentRules.find((rule) => rule.matches.some((part) => value.includes(part)))?.file || null;
  }

  function isSaved(id) {
    return state.files.some((file) => file.id === id);
  }

  function isInTrash(id) {
    return state.trash.some((file) => file.id === id);
  }

  function decorateMailView() {
    document.querySelectorAll(".mail-view").forEach((view) => {
      const title = view.querySelector("h2")?.textContent.trim();
      const attachment = findAttachment(title);
      const oldPanel = view.querySelector(".workflow-attachment-panel");
      if (!attachment) {
        oldPanel?.remove();
        return;
      }

      const panelKey = `${title}:${attachment.id}:${isSaved(attachment.id)}:${isInTrash(attachment.id)}`;
      if (oldPanel?.dataset.panelKey === panelKey) return;
      oldPanel?.remove();

      const panel = document.createElement("section");
      panel.className = "workflow-attachment-panel";
      panel.dataset.panelKey = panelKey;
      const icon = sprites.createIcon("attachments", attachment.icon === "spreadsheet" ? "spreadsheet" : attachment.image ? "image" : "file", 34);
      const saved = isSaved(attachment.id);
      const trashed = isInTrash(attachment.id);
      panel.appendChild(icon);

      const info = document.createElement("div");
      info.className = "workflow-attachment-info";
      info.innerHTML = `<strong>${escapeHtml(attachment.name)}</strong><span>${escapeHtml(attachment.type)}</span>`;
      panel.appendChild(info);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-button workflow-save-attachment";
      button.textContent = saved ? "Сохранено" : trashed ? "В Корзине" : "Сохранить в Документы";
      button.disabled = saved || trashed;
      button.addEventListener("click", () => saveAttachment(attachment));
      panel.appendChild(button);

      view.appendChild(panel);
    });
  }

  function saveAttachment(file) {
    if (isSaved(file.id) || isInTrash(file.id)) return;
    const copy = { ...file, source: "Почта", savedAt: Date.now() };
    state.files.push(copy);
    logAction("Сохранено вложение", copy);
    saveState();
    notify("Почта", `${file.name} сохранён в папку «Документы».`);
  }

  function decorateExplorer() {
    document.querySelectorAll(".v2-explorer").forEach((explorer) => {
      const tbody = explorer.querySelector(".file-table tbody");
      const toolbar = explorer.parentElement?.querySelector(".toolbar") || explorer.closest(".window-content")?.querySelector(".toolbar");
      if (!tbody) return;

      state.files.forEach((file) => {
        if (tbody.querySelector(`[data-workflow-file-id="${cssEscape(file.id)}"]`)) return;
        const row = document.createElement("tr");
        row.dataset.workflowFileId = file.id;
        row.innerHTML = `<td><span class="file-icon file-icon-atlas"></span><span>${escapeHtml(file.name)}</span></td><td>${escapeHtml(file.type)}</td><td>Личная папка</td>`;
        const iconTarget = row.querySelector(".file-icon");
        iconTarget.replaceChildren(sprites.createIcon("files", file.icon || "text", 26));
        row.addEventListener("click", () => selectWorkflowFile(tbody, row, file.id));
        row.addEventListener("dblclick", () => openFile(file));
        tbody.appendChild(row);
      });

      if (toolbar && !toolbar.querySelector("[data-workflow-delete]")) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.dataset.workflowDelete = "true";
        deleteButton.textContent = "Удалить выбранный";
        deleteButton.disabled = true;
        deleteButton.addEventListener("click", deleteSelectedFile);
        toolbar.appendChild(deleteButton);
      }

      const deleteButton = toolbar?.querySelector("[data-workflow-delete]");
      if (deleteButton) deleteButton.disabled = !selectedFileId || !state.files.some((file) => file.id === selectedFileId);
    });
  }

  function selectWorkflowFile(tbody, row, id) {
    selectedFileId = id;
    tbody.querySelectorAll("tr").forEach((item) => item.classList.remove("selected"));
    row.classList.add("selected");
    const windowContent = tbody.closest(".window-content");
    const deleteButton = windowContent?.querySelector("[data-workflow-delete]");
    if (deleteButton) deleteButton.disabled = false;
  }

  function deleteSelectedFile() {
    const index = state.files.findIndex((file) => file.id === selectedFileId);
    if (index < 0) return;
    const [file] = state.files.splice(index, 1);
    state.trash.push({ ...file, deletedAt: Date.now() });
    logAction("Удалён в Корзину", file);
    selectedFileId = null;
    closeFileViewer(file.id);
    saveState();
    notify("Проводник", `${file.name} перемещён в Корзину.`);
  }

  function decorateTrash() {
    document.querySelectorAll(".trash-list").forEach((list) => {
      list.querySelectorAll("[data-workflow-trash-id]").forEach((item) => item.remove());
      state.trash.forEach((file) => {
        const item = document.createElement("div");
        item.className = "trash-item workflow-trash-item";
        item.dataset.workflowTrashId = file.id;
        item.appendChild(sprites.createIcon("files", "deleted", 28));

        const info = document.createElement("div");
        info.className = "workflow-trash-info";
        info.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.type)}</span>`;
        item.appendChild(info);

        const restore = document.createElement("button");
        restore.type = "button";
        restore.textContent = "Восстановить";
        restore.addEventListener("click", () => restoreFile(file.id));
        item.appendChild(restore);
        list.appendChild(item);
      });
    });
  }

  function restoreFile(id) {
    const index = state.trash.findIndex((file) => file.id === id);
    if (index < 0) return;
    const [file] = state.trash.splice(index, 1);
    delete file.deletedAt;
    state.files.push(file);
    logAction("Восстановлен из Корзины", file);
    saveState();
    notify("Корзина", `${file.name} восстановлен в папку «Документы».`);
  }

  function decorateJournal() {
    document.querySelectorAll(".journal-list").forEach((list) => {
      list.querySelectorAll("[data-workflow-log-id]").forEach((item) => item.remove());
      state.log.slice(0, 10).forEach((entry) => {
        const row = document.createElement("div");
        row.className = "journal-entry workflow-journal-entry";
        row.dataset.workflowLogId = entry.id;
        row.innerHTML = `<time>${escapeHtml(entry.time)}</time><span>${escapeHtml(entry.action)}: ${escapeHtml(entry.file)}</span><small>USER-IV</small>`;
        list.appendChild(row);
      });
    });
  }

  function openFile(file) {
    if (file.image && root.UntilFridayAssetUI?.openAssetViewer) {
      root.UntilFridayAssetUI.openAssetViewer({
        id: `workflow-${file.id}`,
        title: file.name,
        image: file.image,
        caption: file.content || file.type
      });
      return;
    }

    const existing = viewerWindows.get(file.id);
    if (existing?.isConnected) {
      focusViewer(existing, file.id);
      return;
    }

    const layer = document.querySelector("#windows-layer");
    if (!layer) return;
    const element = document.createElement("section");
    element.className = "app-window focused workflow-file-viewer";
    element.style.left = `${140 + viewerWindows.size * 18}px`;
    element.style.top = `${90 + viewerWindows.size * 16}px`;
    element.style.zIndex = String(++topZ);
    element.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title">${escapeHtml(file.name)}</div>
        <div class="window-controls"><button type="button" data-close aria-label="Закрыть">×</button></div>
      </header>
      <div class="window-content document-view">
        <article class="document-paper workflow-document-paper">${escapeHtml(file.content || "Файл пуст.")}</article>
      </div>
      <footer class="window-status">${escapeHtml(file.type)} · личная папка</footer>`;
    element.querySelector("[data-close]").addEventListener("click", () => closeFileViewer(file.id));
    element.addEventListener("mousedown", () => focusViewer(element, file.id));
    makeDraggable(element, element.querySelector(".window-titlebar"));
    layer.appendChild(element);
    viewerWindows.set(file.id, element);
    createTaskButton(file, element);
  }

  function createTaskButton(file, element) {
    const taskbar = document.querySelector("#task-buttons");
    if (!taskbar) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-button active workflow-viewer-task";
    button.dataset.workflowViewerTask = file.id;
    button.textContent = file.name;
    button.addEventListener("click", () => {
      const minimized = element.classList.toggle("minimized");
      button.classList.toggle("active", !minimized);
      if (!minimized) focusViewer(element, file.id);
    });
    taskbar.appendChild(button);
  }

  function focusViewer(element, id) {
    document.querySelectorAll(".app-window").forEach((windowElement) => windowElement.classList.remove("focused"));
    document.querySelectorAll(".task-button").forEach((button) => button.classList.remove("active"));
    element.classList.remove("minimized");
    element.classList.add("focused");
    element.style.zIndex = String(++topZ);
    document.querySelector(`[data-workflow-viewer-task="${cssEscape(id)}"]`)?.classList.add("active");
  }

  function closeFileViewer(id) {
    viewerWindows.get(id)?.remove();
    viewerWindows.delete(id);
    document.querySelector(`[data-workflow-viewer-task="${cssEscape(id)}"]`)?.remove();
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

  function notify(title, text) {
    const container = document.querySelector("#notifications");
    if (!container) return;
    const notification = document.createElement("div");
    notification.className = "notification workflow-notification";
    notification.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
    container.appendChild(notification);
    window.setTimeout(() => notification.remove(), 4200);
  }

  function decorateAll() {
    decorateMailView();
    decorateExplorer();
    decorateTrash();
    decorateJournal();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cssEscape(value) {
    if (root.CSS?.escape) return root.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  const observer = new MutationObserver(queueRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", queueRender, { once: true });
  queueRender();

  root.UntilFridayWorkflow = {
    getState: () => JSON.parse(JSON.stringify(state)),
    saveAttachment,
    restoreFile,
    deleteSelectedFile
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
