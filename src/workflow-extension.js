(function (root) {
  "use strict";

  const assets = root.UNTIL_FRIDAY_ASSETS;
  const sprites = root.UntilFridaySprites;
  if (!assets || !sprites) return;

  const STORAGE_KEY = "until-friday-workflow-files-v1";
  const viewers = new Map();
  let selectedFileId = null;
  let queued = false;
  let topZ = 1200;

  const attachments = [
    {
      terms: ["отчёт за июль", "отчет за июль"],
      file: {
        id: "mail-report-guide",
        name: "Инструкция_к_отчёту.txt",
        type: "Текстовый документ",
        icon: "text",
        content: "ПОРЯДОК ПОДГОТОВКИ ОТЧЁТА\n\n1. Использовать финальную выгрузку.\n2. Сверить число обращений.\n3. Не отправлять файл с пометкой «черновик».\n4. Итоговую версию положить в общий каталог."
      }
    },
    {
      terms: ["актуализация личных данных", "личных данных", "отдел кадров"],
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
      terms: ["счёт", "счет", "платёж", "платеж"],
      file: {
        id: "mail-invoice-copy",
        name: "Счёт_7814_копия.xlsx",
        type: "Таблица",
        icon: "spreadsheet",
        content: "Сумма по договору: 84 200 ₽\nСумма к оплате: 842 000 ₽\n\nВ строке оплаты, вероятно, добавлен лишний ноль."
      }
    },
    {
      terms: ["журнал доступа", "проверка журнала", "безопасност"],
      file: {
        id: "mail-access-log",
        name: "Выписка_журнала_доступа.log",
        type: "Системный журнал",
        icon: "systemLog",
        content: "08:58  USER-IV  SHARED/REPORTS\n09:13  USER-IV  LEADERSHIP/DENIED\n09:14  SYSTEM   ACCESS_REQUEST_CREATED\n\nСерверная копия журнала хранится отдельно."
      }
    },
    {
      terms: ["пропуск", "деактивац"],
      file: {
        id: "mail-badge-request",
        name: "Заявка_на_изменение_пропуска.pdf",
        type: "Служебный документ",
        icon: "protected",
        content: "Номер сотрудника: EMP-????\nДата изменения: пятница, 18:00\nСтатус заявки: подготовка."
      }
    },
    {
      terms: ["приказ", "организационные изменения"],
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

  function emptyState() {
    return { files: [], trash: [], log: [] };
  }

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value && Array.isArray(value.files) && Array.isArray(value.trash)
        ? { ...emptyState(), ...value }
        : emptyState();
    } catch {
      return emptyState();
    }
  }

  let state = readState();

  function writeState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    queueRender();
  }

  function addLog(action, file) {
    state.log.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      action,
      file: file.name
    });
    state.log = state.log.slice(0, 30);
  }

  function queueRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      renderAll();
    });
  }

  function attachmentFor(title) {
    const value = String(title || "").toLowerCase();
    return attachments.find((item) => item.terms.some((term) => value.includes(term)))?.file || null;
  }

  function saved(id) {
    return state.files.some((file) => file.id === id);
  }

  function trashed(id) {
    return state.trash.some((file) => file.id === id);
  }

  function renderMailAttachments() {
    document.querySelectorAll(".mail-view").forEach((view) => {
      const title = view.querySelector("h2")?.textContent.trim();
      const file = attachmentFor(title);
      const previous = view.querySelector(".workflow-attachment-panel");
      if (!file) {
        previous?.remove();
        return;
      }

      const signature = `${title}:${file.id}:${saved(file.id)}:${trashed(file.id)}`;
      if (previous?.dataset.signature === signature) return;
      previous?.remove();

      const panel = document.createElement("section");
      panel.className = "workflow-attachment-panel";
      panel.dataset.signature = signature;
      const attachmentIcon = file.icon === "spreadsheet" ? "spreadsheet" : file.image ? "image" : "file";
      panel.appendChild(sprites.createIcon("attachments", attachmentIcon, 34));

      const info = document.createElement("div");
      info.className = "workflow-attachment-info";
      info.innerHTML = `<strong>${html(file.name)}</strong><span>${html(file.type)}</span>`;
      panel.appendChild(info);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-button workflow-save-attachment";
      button.textContent = saved(file.id) ? "Сохранено" : trashed(file.id) ? "В Корзине" : "Сохранить в Документы";
      button.disabled = saved(file.id) || trashed(file.id);
      button.addEventListener("click", () => saveAttachment(file));
      panel.appendChild(button);
      view.appendChild(panel);
    });
  }

  function saveAttachment(file) {
    if (saved(file.id) || trashed(file.id)) return;
    const copy = { ...file, source: "Почта", savedAt: Date.now() };
    state.files.push(copy);
    addLog("Сохранено вложение", copy);
    writeState();
    notify("Почта", `${file.name} сохранён в папку «Документы».`);
  }

  function renderExplorerFiles() {
    document.querySelectorAll(".v2-explorer").forEach((explorer) => {
      const tbody = explorer.querySelector(".file-table tbody");
      const content = explorer.closest(".window-content");
      const toolbar = content?.querySelector(".toolbar");
      if (!tbody) return;

      state.files.forEach((file) => {
        if (tbody.querySelector(`[data-workflow-file-id="${selector(file.id)}"]`)) return;
        const row = document.createElement("tr");
        row.dataset.workflowFileId = file.id;
        row.innerHTML = `<td><span class="file-icon file-icon-atlas"></span><span>${html(file.name)}</span></td><td>${html(file.type)}</td><td>Личная папка</td>`;
        row.querySelector(".file-icon").appendChild(sprites.createIcon("files", file.icon || "text", 26));
        row.addEventListener("click", () => selectFile(tbody, row, file.id));
        row.addEventListener("dblclick", () => openFile(file));
        tbody.appendChild(row);
      });

      if (toolbar && !toolbar.querySelector("[data-workflow-delete]")) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.workflowDelete = "true";
        button.textContent = "Удалить выбранный";
        button.disabled = true;
        button.addEventListener("click", deleteSelectedFile);
        toolbar.appendChild(button);
      }

      const deleteButton = toolbar?.querySelector("[data-workflow-delete]");
      if (deleteButton) deleteButton.disabled = !selectedFileId || !saved(selectedFileId);
    });
  }

  function selectFile(tbody, row, id) {
    selectedFileId = id;
    tbody.querySelectorAll("tr").forEach((item) => item.classList.remove("selected"));
    row.classList.add("selected");
    const button = tbody.closest(".window-content")?.querySelector("[data-workflow-delete]");
    if (button) button.disabled = false;
  }

  function deleteSelectedFile() {
    const index = state.files.findIndex((file) => file.id === selectedFileId);
    if (index < 0) return;
    const [file] = state.files.splice(index, 1);
    state.trash.push({ ...file, deletedAt: Date.now() });
    addLog("Удалён в Корзину", file);
    closeViewer(file.id);
    selectedFileId = null;
    writeState();
    notify("Проводник", `${file.name} перемещён в Корзину.`);
  }

  function renderTrash() {
    const signature = state.trash.map((file) => `${file.id}:${file.deletedAt || 0}`).join("|");
    document.querySelectorAll(".trash-list").forEach((list) => {
      if (list.dataset.workflowSignature === signature) return;
      list.dataset.workflowSignature = signature;
      list.querySelectorAll("[data-workflow-trash-id]").forEach((item) => item.remove());

      state.trash.forEach((file) => {
        const row = document.createElement("div");
        row.className = "trash-item workflow-trash-item";
        row.dataset.workflowTrashId = file.id;
        row.appendChild(sprites.createIcon("files", "deleted", 28));

        const info = document.createElement("div");
        info.className = "workflow-trash-info";
        info.innerHTML = `<strong>${html(file.name)}</strong><span>${html(file.type)}</span>`;
        row.appendChild(info);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Восстановить";
        button.addEventListener("click", () => restoreFile(file.id));
        row.appendChild(button);
        list.appendChild(row);
      });
    });
  }

  function restoreFile(id) {
    const index = state.trash.findIndex((file) => file.id === id);
    if (index < 0) return;
    const [file] = state.trash.splice(index, 1);
    delete file.deletedAt;
    state.files.push(file);
    addLog("Восстановлен из Корзины", file);
    writeState();
    notify("Корзина", `${file.name} восстановлен в папку «Документы».`);
  }

  function renderJournal() {
    const entries = state.log.slice(0, 10);
    const signature = entries.map((entry) => entry.id).join("|");
    document.querySelectorAll(".journal-list").forEach((list) => {
      if (list.dataset.workflowSignature === signature) return;
      list.dataset.workflowSignature = signature;
      list.querySelectorAll("[data-workflow-log-id]").forEach((item) => item.remove());

      entries.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "journal-entry workflow-journal-entry";
        row.dataset.workflowLogId = entry.id;
        row.innerHTML = `<time>${html(entry.time)}</time><span>${html(entry.action)}: ${html(entry.file)}</span><small>USER-IV</small>`;
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

    const existing = viewers.get(file.id);
    if (existing?.isConnected) {
      focusViewer(existing, file.id);
      return;
    }

    const layer = document.querySelector("#windows-layer");
    if (!layer) return;
    const win = document.createElement("section");
    win.className = "app-window focused workflow-file-viewer";
    win.style.left = `${140 + viewers.size * 18}px`;
    win.style.top = `${90 + viewers.size * 16}px`;
    win.style.zIndex = String(++topZ);
    win.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title">${html(file.name)}</div>
        <div class="window-controls"><button type="button" data-close aria-label="Закрыть">×</button></div>
      </header>
      <div class="window-content document-view">
        <article class="document-paper workflow-document-paper">${html(file.content || "Файл пуст.")}</article>
      </div>
      <footer class="window-status">${html(file.type)} · личная папка</footer>`;
    win.querySelector("[data-close]").addEventListener("click", () => closeViewer(file.id));
    win.addEventListener("mousedown", () => focusViewer(win, file.id));
    draggable(win, win.querySelector(".window-titlebar"));
    layer.appendChild(win);
    viewers.set(file.id, win);
    createTaskButton(file, win);
  }

  function createTaskButton(file, win) {
    const bar = document.querySelector("#task-buttons");
    if (!bar) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-button active workflow-viewer-task";
    button.dataset.workflowViewerTask = file.id;
    button.textContent = file.name;
    button.addEventListener("click", () => {
      const minimized = win.classList.toggle("minimized");
      button.classList.toggle("active", !minimized);
      if (!minimized) focusViewer(win, file.id);
    });
    bar.appendChild(button);
  }

  function focusViewer(win, id) {
    document.querySelectorAll(".app-window").forEach((item) => item.classList.remove("focused"));
    document.querySelectorAll(".task-button").forEach((item) => item.classList.remove("active"));
    win.classList.remove("minimized");
    win.classList.add("focused");
    win.style.zIndex = String(++topZ);
    document.querySelector(`[data-workflow-viewer-task="${selector(id)}"]`)?.classList.add("active");
  }

  function closeViewer(id) {
    viewers.get(id)?.remove();
    viewers.delete(id);
    document.querySelector(`[data-workflow-viewer-task="${selector(id)}"]`)?.remove();
  }

  function draggable(element, handle) {
    let drag = null;
    handle.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) return;
      const rect = element.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      event.preventDefault();
    });
    document.addEventListener("mousemove", (event) => {
      if (!drag) return;
      const maxX = Math.max(0, innerWidth - element.offsetWidth);
      const maxY = Math.max(0, innerHeight - element.offsetHeight - 42);
      element.style.left = `${Math.max(0, Math.min(maxX, event.clientX - drag.x))}px`;
      element.style.top = `${Math.max(0, Math.min(maxY, event.clientY - drag.y))}px`;
    });
    document.addEventListener("mouseup", () => { drag = null; });
  }

  function notify(title, text) {
    const container = document.querySelector("#notifications");
    if (!container) return;
    const item = document.createElement("div");
    item.className = "notification workflow-notification";
    item.innerHTML = `<strong>${html(title)}</strong><span>${html(text)}</span>`;
    container.appendChild(item);
    setTimeout(() => item.remove(), 4200);
  }

  function renderAll() {
    renderMailAttachments();
    renderExplorerFiles();
    renderTrash();
    renderJournal();
  }

  function html(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function selector(value) {
    return root.CSS?.escape ? root.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
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
