(function () {
  "use strict";

  const Engine = window.UntilFridayEngine;
  const Story = window.UNTIL_FRIDAY_STORY;
  const Migration = window.UntilFridayMigration;
  const LegacyData = window.GAME_DATA || {};

  if (!Engine || !Story || !Migration) {
    throw new Error("Until Friday engine modules are not loaded.");
  }

  const SAVE_KEY = Migration.ENGINE_SAVE_KEY;
  const INTRO_KEY = "until-friday-intro-v2";
  const DAY_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];
  const MONTH_SHORT = "АВГ";
  const APP_DEFS = [
    { id: "explorer", name: "Проводник", icon: "📁" },
    { id: "mail", name: "Почта", icon: "✉" },
    { id: "chat", name: "Связь", icon: "▣" },
    { id: "tasks", name: "Задачи", icon: "☑" },
    { id: "terminal", name: "Терминал", icon: ">_" },
    { id: "journal", name: "Журнал", icon: "≡" },
    { id: "trash", name: "Корзина", icon: "▱" }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ui = {
    desktop: $("#desktop"),
    bootScreen: $("#boot-screen"),
    bootLines: $("#boot-lines"),
    bootNext: $("#boot-next"),
    desktopIcons: $("#desktop-icons"),
    windowsLayer: $("#windows-layer"),
    taskButtons: $("#task-buttons"),
    notifications: $("#notifications"),
    startMenu: $("#start-menu"),
    startButton: $("#start-button"),
    startApps: $("#start-apps"),
    clockTime: $("#clock-time"),
    clockDate: $("#clock-date"),
    saveButton: $("#save-button"),
    resetButton: $("#reset-button")
  };

  const runtime = {
    zIndex: 20,
    activeWindowId: null,
    windows: new Map(),
    introIndex: 0,
    selectedMailId: null,
    selectedContact: null,
    selectedFileId: null,
    terminalLog: [
      { className: "dim", text: "KONTUR OFFICE SHELL 3.0" },
      { className: "dim", text: "Введите help для списка команд." }
    ],
    consumedNotifications: new Set(),
    dayTransitionOpen: false
  };

  Migration.migrateLocalStorage(localStorage, Engine, Story);
  const saved = readSave();
  const engine = Engine.createEngine(Story, saved || null);
  let gameState = engine.getState();

  init();
  window.__UNTIL_FRIDAY_V2_READY__ = true;

  function init() {
    renderDesktopApps();
    bindGlobalControls();
    restoreIntroState();

    if (hasCompletedIntro()) {
      showDesktop();
      ensureDayStarted();
    } else {
      renderIntro();
    }
  }

  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Не удалось прочитать сохранение v2", error);
      return null;
    }
  }

  function persist(showToast = false) {
    gameState = engine.getState();
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    updateClock();
    if (showToast) notify("Система", "Прогресс сохранён на этом компьютере.");
  }

  function restoreIntroState() {
    try {
      runtime.introIndex = Number(localStorage.getItem(INTRO_KEY) || 0);
    } catch {
      runtime.introIndex = 0;
    }
  }

  function hasCompletedIntro() {
    return runtime.introIndex > getIntroLines().length || Boolean(gameState.flags?.introCompleted);
  }

  function getIntroLines() {
    return LegacyData.intro || [
      { speaker: "Женский голос", text: "Он пока ничего не знает?" },
      { speaker: "Мужской голос", text: "Нет. В пятницу всё объявим." },
      { speaker: "Женский голос", text: "А до этого?" },
      { speaker: "Мужской голос", text: "Пусть работает как обычно." }
    ];
  }

  function renderIntro() {
    const lines = getIntroLines();
    ui.bootLines.innerHTML = "";
    lines.slice(0, runtime.introIndex).forEach((line) => ui.bootLines.appendChild(createIntroLine(line)));
    ui.bootNext.textContent = runtime.introIndex >= lines.length ? "Включить рабочий компьютер" : "Продолжить";
  }

  function createIntroLine(line) {
    const p = document.createElement("p");
    p.className = "boot-line";
    p.innerHTML = `<strong>${escapeHtml(line.speaker)}</strong><span>— ${escapeHtml(line.text)}</span>`;
    return p;
  }

  function advanceIntro() {
    const lines = getIntroLines();
    if (runtime.introIndex < lines.length) {
      ui.bootLines.appendChild(createIntroLine(lines[runtime.introIndex]));
      runtime.introIndex += 1;
      localStorage.setItem(INTRO_KEY, String(runtime.introIndex));
      ui.bootNext.textContent = runtime.introIndex >= lines.length ? "Включить рабочий компьютер" : "Продолжить";
      return;
    }

    runtime.introIndex = lines.length + 1;
    localStorage.setItem(INTRO_KEY, String(runtime.introIndex));
    gameState.flags.introCompleted = true;
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    showDesktop();
    ensureDayStarted();
  }

  function showDesktop() {
    ui.bootScreen.classList.add("hidden");
    ui.desktop.classList.remove("hidden");
    updateClock();
  }

  function ensureDayStarted() {
    gameState = engine.getState();
    if (!gameState.dayStarted && !gameState.ended) {
      const result = engine.startDay();
      persist();
      deliverEvents(result.events || []);
      notify("Система", `${result.day?.title || currentDay().title}. Рабочий сеанс открыт.`);
    } else {
      deliverUndisplayedInbox();
      updateClock();
    }
  }

  function bindGlobalControls() {
    ui.bootNext.addEventListener("click", advanceIntro);

    ui.startButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const hidden = ui.startMenu.classList.toggle("hidden");
      ui.startButton.classList.toggle("active", !hidden);
      ui.startButton.setAttribute("aria-expanded", String(!hidden));
    });

    ui.saveButton.addEventListener("click", () => persist(true));
    ui.resetButton.addEventListener("click", resetGame);
    $("#clock").addEventListener("click", openEndDayDialog);

    document.addEventListener("click", (event) => {
      if (!ui.startMenu.contains(event.target) && !ui.startButton.contains(event.target)) closeStartMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeStartMenu();
    });
  }

  function resetGame() {
    const accepted = window.confirm("Удалить сохранение и начать неделю заново?");
    if (!accepted) return;
    localStorage.removeItem(Migration.ENGINE_SAVE_KEY);
    localStorage.removeItem(Migration.LEGACY_SAVE_KEY);
    localStorage.removeItem(INTRO_KEY);
    window.location.reload();
  }

  function closeStartMenu() {
    ui.startMenu.classList.add("hidden");
    ui.startButton.classList.remove("active");
    ui.startButton.setAttribute("aria-expanded", "false");
  }

  function renderDesktopApps() {
    ui.desktopIcons.innerHTML = "";
    ui.startApps.innerHTML = "";

    APP_DEFS.forEach((app) => {
      const desktopButton = document.createElement("button");
      desktopButton.className = "desktop-icon";
      desktopButton.type = "button";
      desktopButton.dataset.app = app.id;
      desktopButton.innerHTML = `<span class="desktop-icon__glyph">${escapeHtml(app.icon)}</span><span class="desktop-icon__label">${escapeHtml(app.name)}</span>`;
      desktopButton.addEventListener("dblclick", () => openApp(app.id));
      desktopButton.addEventListener("click", () => {
        $$(".desktop-icon").forEach((item) => item.classList.remove("selected"));
        desktopButton.classList.add("selected");
      });
      ui.desktopIcons.appendChild(desktopButton);

      const menuButton = document.createElement("button");
      menuButton.className = "start-app";
      menuButton.type = "button";
      menuButton.innerHTML = `<span class="desktop-icon__glyph">${escapeHtml(app.icon)}</span><span>${escapeHtml(app.name)}</span>`;
      menuButton.addEventListener("click", () => {
        closeStartMenu();
        openApp(app.id);
      });
      ui.startApps.appendChild(menuButton);
    });
  }

  function openApp(appId) {
    const existing = runtime.windows.get(appId);
    if (existing) {
      existing.element.classList.remove("minimized");
      existing.render();
      focusWindow(appId);
      return;
    }

    const app = APP_DEFS.find((item) => item.id === appId);
    if (!app) return;
    const element = createWindowElement(appId, app.name, windowSize(appId));
    const render = () => renderApp(appId, element);
    runtime.windows.set(appId, { element, render, app });
    ui.windowsLayer.appendChild(element);
    createTaskButton(appId, app.name);
    bindWindowControls(appId, element);
    makeDraggable(element, $(".window-titlebar", element));
    element.addEventListener("mousedown", () => focusWindow(appId));
    render();
    focusWindow(appId);
  }

  function createWindowElement(id, title, size) {
    const template = $("#window-template");
    const element = template.content.firstElementChild.cloneNode(true);
    element.dataset.windowId = id;
    $(".window-title", element).textContent = title;
    element.style.width = size.width;
    element.style.height = size.height;
    const offset = runtime.windows.size * 24;
    element.style.left = `${Math.max(10, Math.min(135 + offset, window.innerWidth - 440))}px`;
    element.style.top = `${Math.max(10, Math.min(48 + offset, window.innerHeight - 330))}px`;
    return element;
  }

  function windowSize(appId) {
    const sizes = {
      explorer: { width: "780px", height: "520px" },
      mail: { width: "840px", height: "540px" },
      chat: { width: "700px", height: "510px" },
      tasks: { width: "700px", height: "520px" },
      terminal: { width: "710px", height: "440px" },
      journal: { width: "700px", height: "500px" },
      trash: { width: "540px", height: "360px" }
    };
    return sizes[appId] || { width: "620px", height: "440px" };
  }

  function bindWindowControls(appId, element) {
    element.addEventListener("click", (event) => {
      const button = event.target.closest("[data-window-action]");
      if (!button) return;
      if (button.dataset.windowAction === "close") closeWindow(appId);
      if (button.dataset.windowAction === "minimize") minimizeWindow(appId);
    });
  }

  function createTaskButton(appId, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-button";
    button.dataset.taskWindow = appId;
    button.textContent = title;
    button.addEventListener("click", () => {
      const win = runtime.windows.get(appId);
      if (!win) return;
      if (win.element.classList.contains("minimized")) {
        win.element.classList.remove("minimized");
        focusWindow(appId);
      } else if (runtime.activeWindowId === appId) {
        minimizeWindow(appId);
      } else {
        focusWindow(appId);
      }
    });
    ui.taskButtons.appendChild(button);
  }

  function focusWindow(appId) {
    const win = runtime.windows.get(appId);
    if (!win) return;
    runtime.zIndex += 1;
    runtime.activeWindowId = appId;
    win.element.style.zIndex = String(runtime.zIndex);
    runtime.windows.forEach(({ element }) => element.classList.remove("focused"));
    win.element.classList.add("focused");
    $$(".task-button").forEach((button) => button.classList.toggle("active", button.dataset.taskWindow === appId));
  }

  function minimizeWindow(appId) {
    const win = runtime.windows.get(appId);
    if (!win) return;
    win.element.classList.add("minimized");
    if (runtime.activeWindowId === appId) runtime.activeWindowId = null;
    $(`[data-task-window="${cssEscape(appId)}"]`)?.classList.remove("active");
  }

  function closeWindow(appId) {
    const win = runtime.windows.get(appId);
    if (!win) return;
    win.element.remove();
    runtime.windows.delete(appId);
    $(`[data-task-window="${cssEscape(appId)}"]`)?.remove();
    if (runtime.activeWindowId === appId) runtime.activeWindowId = null;
  }

  function closeAllWindows() {
    [...runtime.windows.keys()].forEach(closeWindow);
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
      element.style.left = `${clamp(event.clientX - drag.x, 0, maxX)}px`;
      element.style.top = `${clamp(event.clientY - drag.y, 0, maxY)}px`;
    });
    document.addEventListener("mouseup", () => { drag = null; });
  }

  function renderApp(appId, element) {
    const renderers = {
      explorer: renderExplorer,
      mail: renderMail,
      chat: renderChat,
      tasks: renderTasks,
      terminal: renderTerminal,
      journal: renderJournal,
      trash: renderTrash
    };
    renderers[appId]?.(element);
  }

  function currentDay() {
    return Story.days[gameState.dayIndex] || Story.days[0];
  }

  function currentActions(channel) {
    return engine.listActions(channel);
  }

  function renderExplorer(element) {
    gameState = engine.getState();
    const content = $(".window-content", element);
    const files = buildVisibleFiles();
    content.innerHTML = `
      <div class="toolbar"><button type="button" data-refresh>Обновить</button><span class="day-label">${escapeHtml(currentDay().title)} · Общий диск</span></div>
      <div class="v2-explorer">
        <aside class="sidebar v2-folders">
          <button class="selected" type="button">Рабочий стол</button>
          <button type="button">Документы</button>
          <button type="button">Общий диск</button>
          <button type="button">Система</button>
        </aside>
        <section class="main-pane">
          <table class="file-table">
            <thead><tr><th>Имя</th><th>Тип</th><th>Доступ</th></tr></thead>
            <tbody data-files></tbody>
          </table>
        </section>
      </div>`;

    const tbody = $("[data-files]", content);
    files.forEach((file) => {
      const row = document.createElement("tr");
      row.classList.toggle("selected", runtime.selectedFileId === file.id);
      row.innerHTML = `<td><span class="file-icon">${escapeHtml(file.icon || "TXT")}</span>${escapeHtml(file.title)}</td><td>${escapeHtml(file.type || "Документ")}</td><td>${escapeHtml(file.accessLabel || "Доступен")}</td>`;
      row.addEventListener("click", () => {
        runtime.selectedFileId = file.id;
        $$("tbody tr", content).forEach((item) => item.classList.remove("selected"));
        row.classList.add("selected");
      });
      row.addEventListener("dblclick", () => openStoryFile(file));
      tbody.appendChild(row);
    });

    $("[data-refresh]", content).addEventListener("click", () => {
      advanceTime(1);
      renderExplorer(element);
    });
    $(".window-status", element).textContent = `${files.length} объектов · действия регистрируются`;
  }

  function buildVisibleFiles() {
    const day = gameState.dayIndex;
    const files = [];

    if (day === 0) {
      files.push(
        { id: "report-final", title: "Отчёт_июль_финал.xlsx", type: "Таблица", icon: "XLS", content: "Финальная версия июльского отчёта. Данные сверены с журналом обращений.", actionId: "mon-report-final" },
        { id: "report-old", title: "Отчёт_июль_черновик.xlsx", type: "Таблица", icon: "XLS", content: "Черновая версия отчёта. Несколько цифр ещё не сверены.", actionId: "mon-report-old" },
        { id: "invoice", title: "Счёт_7814.txt", type: "Документ", icon: "TXT", content: "Сумма по договору: 84 200 ₽\nСумма к оплате: 842 000 ₽\n\nВероятно, в документе лишний ноль." },
        { id: "vacancy", title: "Вакансия_специалист.txt", type: "Документ", icon: "TXT", content: "Проект вакансии: специалист отдела сопровождения. Причина открытия позиции не указана.", actionId: "mon-open-vacancy" },
        { id: "leadership", title: "Руководство", type: "Закрытая папка", icon: "DIR", accessLabel: "Нет доступа", restricted: true, actionId: "mon-request-leadership-access", content: "Для чтения требуется дополнительное разрешение." }
      );
    }

    engine.listVisibleContent("files").forEach((item) => {
      files.push({
        id: item.id,
        title: item.title,
        type: item.title.endsWith(".dat") ? "Системные данные" : item.title.endsWith(".zip") ? "Архив" : "Документ",
        icon: item.title.endsWith(".zip") ? "ZIP" : item.title.endsWith(".dat") ? "DAT" : "DOC",
        content: storyFileContent(item.id)
      });
    });

    currentActions("explorer").forEach((action) => {
      if (files.some((file) => file.actionId === action.id)) return;
      files.push({
        id: `action-${action.id}`,
        title: actionFileTitle(action),
        type: "Служебный объект",
        icon: "SYS",
        content: action.result || action.label,
        actionId: action.id
      });
    });

    return dedupeBy(files, "id");
  }

  function storyFileContent(id) {
    const content = {
      "badge-list": "ОЧЕРЕДЬ ДЕАКТИВАЦИИ ПРОПУСКОВ\n\nЗапись: EMP-????\nДата отключения: пятница, 18:00\nФамилия: поле не заполнено.",
      "hr-draft": "ПРОЕКТ КАДРОВОГО ПРИКАЗА\n\nОснование: организационные изменения.\nСотрудник: строка скрыта или ещё не заполнена.\nДата объявления: пятница.",
      project: "Архив проекта автоматизации отчётов. Внутри находятся скрипт, инструкция и результаты тестирования."
    };
    return content[id] || "Служебный файл. Содержимое будет уточнено после подключения финальных ассетов и документов.";
  }

  function actionFileTitle(action) {
    const map = {
      "tue-copy-payment-list": "Платежи_август.xlsx",
      "wed-open-hr-draft": "Приказ_кадры_черновик.doc",
      "thu-build-case": "Материалы_служебные.zip",
      "thu-frame-chief": "Черновик_жалобы.txt"
    };
    return map[action.id] || `${action.label.replace(/[<>:"/\\|?*]/g, "_")}.cmd`;
  }

  function openStoryFile(file) {
    const id = `doc-${file.id}`;
    const existing = runtime.windows.get(id);
    if (existing) {
      focusWindow(id);
      return;
    }

    const element = createWindowElement(id, file.title, { width: "620px", height: "455px" });
    const content = $(".window-content", element);
    content.innerHTML = file.restricted
      ? `<div class="restricted"><div><strong>Доступ запрещён</strong><p>${escapeHtml(file.content)}</p><button class="action-button" data-file-action type="button">Запросить доступ</button></div></div>`
      : `<div class="document-view"><article class="document-paper">${escapeHtml(file.content)}</article>${file.actionId ? `<div class="document-actions"><button class="action-button" data-file-action type="button">${escapeHtml(actionButtonLabel(file.actionId))}</button></div>` : ""}</div>`;

    if (file.actionId) {
      $("[data-file-action]", content)?.addEventListener("click", () => performAction(file.actionId, id));
    }

    $(".window-status", element).textContent = file.restricted ? "Код: ACCESS-14" : "Только чтение";
    runtime.windows.set(id, { element, render: () => {}, app: { id, name: file.title } });
    ui.windowsLayer.appendChild(element);
    createTaskButton(id, file.title);
    bindWindowControls(id, element);
    makeDraggable(element, $(".window-titlebar", element));
    element.addEventListener("mousedown", () => focusWindow(id));
    focusWindow(id);
  }

  function actionButtonLabel(actionId) {
    const action = Story.actions[actionId];
    return action?.label || "Выполнить действие";
  }

  function renderMail(element) {
    gameState = engine.getState();
    const content = $(".window-content", element);
    const messages = buildMailMessages();
    if (!runtime.selectedMailId || !messages.some((item) => item.id === runtime.selectedMailId)) runtime.selectedMailId = messages[0]?.id || null;
    const selected = messages.find((item) => item.id === runtime.selectedMailId) || messages[0];

    content.innerHTML = `
      <div class="toolbar"><button type="button" data-refresh>Получить почту</button><span class="day-label">${escapeHtml(currentDay().title)}</span></div>
      <div class="mail-layout">
        <aside class="mail-list" data-list></aside>
        <article class="mail-view" data-view></article>
      </div>`;

    const list = $("[data-list]", content);
    messages.forEach((message) => {
      const button = document.createElement("button");
      button.className = `mail-item ${message.id === selected?.id ? "selected" : ""}`;
      button.type = "button";
      button.innerHTML = `<strong>${escapeHtml(message.source)}</strong><span>${escapeHtml(message.title)}</span><small>${escapeHtml(formatTime(message.minute))}</small>`;
      button.addEventListener("click", () => {
        runtime.selectedMailId = message.id;
        advanceTime(1);
        renderMail(element);
      });
      list.appendChild(button);
    });

    const view = $("[data-view]", content);
    if (!selected) {
      view.innerHTML = `<div class="empty-state">Новых писем нет.</div>`;
    } else {
      view.innerHTML = `
        <header class="mail-meta"><h2>${escapeHtml(selected.title)}</h2><p>От: ${escapeHtml(selected.source)}</p><p>Время: ${escapeHtml(formatTime(selected.minute))}</p></header>
        <div class="mail-body">${escapeHtml(selected.text)}</div>
        <div class="action-row" data-actions></div>`;
      const actions = currentActions("mail");
      actions.forEach((action) => appendActionButton($("[data-actions]", view), action));
    }

    $("[data-refresh]", content).addEventListener("click", () => {
      const result = advanceTime(2);
      if (!result.events.length) notify("Почта", "Новых писем нет.");
      renderMail(element);
    });
    $(".window-status", element).textContent = `${messages.length} писем`;
  }

  function buildMailMessages() {
    const base = [];
    if (gameState.dayIndex === 0) {
      base.push(
        { id: "mon-report-mail", source: "Андрей Соколов", title: "Отчёт за июль", text: "До 11:30 пришли финальную версию июльского отчёта. В папке лежат два файла, не перепутай.", minute: 486 },
        { id: "mon-hr-mail", source: "Отдел кадров", title: "Актуализация личных данных", text: "До конца недели проверьте контактный телефон, адрес регистрации и данные для пропуска.", minute: 494 }
      );
    }
    gameState.inbox.filter((item) => item.type === "mail").forEach((item) => base.push(normalizeInboxItem(item)));
    deliveredStoryEvents("mail").forEach((event) => base.push(normalizeEvent(event)));
    return dedupeBy(base.sort((a, b) => b.minute - a.minute), "id");
  }

  function renderChat(element) {
    gameState = engine.getState();
    const content = $(".window-content", element);
    const conversations = buildConversations();
    const contactNames = Object.keys(conversations);
    if (!runtime.selectedContact || !conversations[runtime.selectedContact]) runtime.selectedContact = contactNames[0] || "Дима Орлов";
    const messages = conversations[runtime.selectedContact] || [];

    content.innerHTML = `
      <div class="chat-layout">
        <aside class="contact-list" data-contacts></aside>
        <section class="chat-main">
          <header class="chat-header"><strong>${escapeHtml(runtime.selectedContact)}</strong><span>внутренняя сеть</span></header>
          <div class="messages" data-messages></div>
          <div class="reply-panel" data-actions></div>
        </section>
      </div>`;

    const contacts = $("[data-contacts]", content);
    contactNames.forEach((name) => {
      const button = document.createElement("button");
      button.className = `contact ${name === runtime.selectedContact ? "selected" : ""}`;
      button.type = "button";
      button.innerHTML = `<span class="status-dot online"></span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(messagesRole(name))}</small></span>`;
      button.addEventListener("click", () => {
        runtime.selectedContact = name;
        advanceTime(1);
        renderChat(element);
      });
      contacts.appendChild(button);
    });

    const messageArea = $("[data-messages]", content);
    messages.forEach((message) => {
      const block = document.createElement("div");
      block.className = `message ${message.side || "them"}`;
      block.innerHTML = `<div class="message-bubble">${escapeHtml(message.text)}</div><time>${escapeHtml(formatTime(message.minute))}</time>`;
      messageArea.appendChild(block);
    });
    messageArea.scrollTop = messageArea.scrollHeight;

    const chatActions = currentActions("chat");
    chatActions.forEach((action) => appendActionButton($("[data-actions]", content), action));
    if (!chatActions.length) $("[data-actions]", content).innerHTML = `<span class="muted">Новых вариантов ответа нет.</span>`;
    $(".window-status", element).textContent = `${contactNames.length} контакта`;
  }

  function buildConversations() {
    const result = {
      "Дима Орлов": [{ id: "monday-dima", text: "Слышал, в пятницу опять собрание. Но вроде не про нас.", minute: 490, side: "them" }],
      "Олег Казанцев": [{ id: "monday-oleg", text: "Кадровики готовят бумаги на кого-то из второго этажа. Но ты это не от меня слышал.", minute: 507, side: "them" }],
      "Роман Белов": [{ id: "monday-admin", text: "Если общий диск тормозит, не открывай один файл по десять раз. Журнал и так раздулся.", minute: 519, side: "them" }]
    };

    deliveredStoryEvents("chat").forEach((event) => {
      const source = event.source || "Система";
      result[source] ||= [];
      result[source].push({ id: event.id, text: event.text, minute: event.minute, side: "them" });
    });

    Object.entries(gameState.completedActions).forEach(([actionId, completed]) => {
      const action = Story.actions[actionId] || null;
      if (!action || action.channel !== "chat") return;
      const source = actionContact(action.id);
      result[source] ||= [];
      result[source].push({ id: `sent-${action.id}`, text: action.label, minute: completed.minute || gameState.minute, side: "me" });
    });

    Object.values(result).forEach((items) => items.sort((a, b) => a.minute - b.minute));
    return result;
  }

  function actionContact(actionId) {
    if (actionId.includes("admin")) return "Роман Белов";
    if (actionId.includes("friend") || actionId.includes("blame")) return "Дима Орлов";
    return "Андрей Соколов";
  }

  function messagesRole(name) {
    const roles = {
      "Дима Орлов": "соседний стол",
      "Олег Казанцев": "отдел продаж",
      "Роман Белов": "системный администратор",
      "Андрей Соколов": "начальник отдела"
    };
    return roles[name] || "сотрудник";
  }

  function renderTasks(element) {
    gameState = engine.getState();
    const content = $(".window-content", element);
    const taskActions = [...currentActions("tasks"), ...currentActions("meeting")];
    content.innerHTML = `<div class="toolbar"><button type="button" data-refresh>Обновить</button><span class="day-label">${escapeHtml(currentDay().title)} · ${escapeHtml(currentDay().dateLabel)}</span></div><section class="task-list" data-list></section>`;
    const list = $("[data-list]", content);

    if (!taskActions.length) {
      list.innerHTML = `<div class="empty-state">Доступных задач нет. Проверьте почту, Проводник или Терминал.</div>`;
    }

    taskActions.forEach((action) => {
      const card = document.createElement("article");
      card.className = "task-card";
      card.innerHTML = `<header><h3>${escapeHtml(action.label)}</h3><span>${action.minutes || 0} мин.</span></header><div class="task-body"><p>${escapeHtml(action.result || "Результат зависит от выбранного действия.")}</p><div class="action-row" data-actions></div></div>`;
      appendActionButton($("[data-actions]", card), action);
      list.appendChild(card);
    });

    const requirements = currentDay().requirements || [];
    requirements.forEach((requirement) => {
      const satisfied = engine.conditionPasses(requirement.satisfiedWhen);
      const card = document.createElement("article");
      card.className = `task-card requirement ${satisfied ? "done" : ""}`;
      card.innerHTML = `<header><h3>${satisfied ? "Выполнено" : "Обязательная работа"}</h3><span>${satisfied ? "готово" : "до конца дня"}</span></header><div class="task-body"><p>${escapeHtml(requirement.label)}</p></div>`;
      list.prepend(card);
    });

    $("[data-refresh]", content).addEventListener("click", () => {
      advanceTime(1);
      renderTasks(element);
    });
    $(".window-status", element).textContent = `${taskActions.length} доступных действий`;
  }

  function appendActionButton(container, action) {
    if (!container || !action) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.textContent = action.label;
    button.addEventListener("click", () => performAction(action.id));
    container.appendChild(button);
  }

  function performAction(actionId, sourceWindowId = null) {
    const result = engine.applyAction(actionId);
    if (!result.ok) {
      notify("Система", actionErrorText(result.reason));
      return result;
    }

    gameState = result.state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    notify("Действие выполнено", result.result || Story.actions[actionId]?.label || actionId);
    deliverEvents(result.events || []);
    refreshOpenWindows();
    updateClock();
    if (sourceWindowId && runtime.windows.has(sourceWindowId)) closeWindow(sourceWindowId);
    return result;
  }

  function actionErrorText(reason) {
    const messages = {
      "game-ended": "Неделя уже завершена.",
      "day-not-started": "Рабочий день ещё не начался.",
      "unknown-action": "Действие не найдено.",
      "wrong-day": "Это действие недоступно сегодня.",
      "already-completed": "Это действие уже выполнено.",
      "requirements-not-met": "Пока не выполнены условия для этого действия."
    };
    return messages[reason] || "Действие недоступно.";
  }

  function renderTerminal(element) {
    const content = $(".window-content", element);
    content.innerHTML = `<div class="terminal"><div class="terminal-output" data-output></div><div class="terminal-input-row"><span class="terminal-prompt">ivoronov@office:&gt;</span><input class="terminal-input" data-input autocomplete="off" spellcheck="false" /></div></div>`;
    const output = $("[data-output]", content);
    const input = $("[data-input]", content);
    renderTerminalLog(output);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const command = input.value.trim();
      input.value = "";
      executeTerminal(command, output);
    });
    setTimeout(() => input.focus(), 0);
    $(".window-status", element).textContent = "Защищённое соединение · аудит включён";
  }

  function executeTerminal(raw, output) {
    if (!raw) return;
    runtime.terminalLog.push({ text: `ivoronov@office:> ${raw}` });
    const [command, ...args] = raw.trim().split(/\s+/);
    const argument = args.join(" ");

    if (command === "help") {
      terminalPrint("help              список команд\nstatus            состояние сеанса\nday               текущий день\ntasks             доступные задачи\nactions           все доступные действия\nrun <id>          выполнить действие\nfiles             доступные файлы\nlogs              журнал действий\nclear             очистить экран\nendday            завершить день", "dim");
    } else if (command === "status") {
      terminalPrint(`Пользователь: Илья Воронов\nДень: ${currentDay().title}\nВремя: ${formatTime(gameState.minute)}\nСеть: OFFICE-LAN\nАудит: включён`);
    } else if (command === "day") {
      terminalPrint(`${currentDay().title}, ${currentDay().dateLabel}`);
    } else if (command === "tasks") {
      terminalPrint(currentActions("tasks").map((action) => `${action.id} — ${action.label}`).join("\n") || "Нет доступных задач.");
    } else if (command === "actions") {
      terminalPrint(engine.listActions().map((action) => `${action.id} [${action.channel}] — ${action.label}`).join("\n") || "Нет доступных действий.");
    } else if (command === "run") {
      const action = Story.actions[argument];
      if (!action || action.channel !== "terminal") terminalPrint("Команда может запускать только доступные terminal-действия. Введите actions.", "error");
      else {
        const result = performAction(argument);
        terminalPrint(result.ok ? result.result : actionErrorText(result.reason), result.ok ? "" : "error");
      }
    } else if (command === "files") {
      terminalPrint(buildVisibleFiles().map((file) => `${file.id} — ${file.title}`).join("\n") || "Файлы не найдены.");
    } else if (command === "logs") {
      terminalPrint(gameState.journal.slice(-12).map((item) => `${formatTime(item.minute)} ${item.text}`).join("\n") || "Журнал пуст.");
    } else if (command === "clear") {
      runtime.terminalLog = [];
    } else if (command === "endday") {
      openEndDayDialog();
    } else {
      terminalPrint(`Команда «${command}» не найдена. Введите help.`, "error");
    }

    if (!["run", "endday", "clear"].includes(command)) advanceTime(command === "actions" || command === "files" ? 3 : 1);
    renderTerminalLog(output);
  }

  function terminalPrint(text, className = "") {
    runtime.terminalLog.push({ text, className });
  }

  function renderTerminalLog(output) {
    output.innerHTML = "";
    runtime.terminalLog.forEach((line) => {
      const div = document.createElement("div");
      div.className = line.className || "";
      div.textContent = line.text;
      output.appendChild(div);
    });
    output.scrollTop = output.scrollHeight;
  }

  function renderJournal(element) {
    gameState = engine.getState();
    const content = $(".window-content", element);
    content.innerHTML = `<div class="toolbar"><span class="day-label">Локальный журнал пользователя</span></div><div class="journal-list" data-list></div>`;
    const list = $("[data-list]", content);
    const items = [...gameState.journal].reverse();
    if (!items.length) list.innerHTML = `<div class="empty-state">Записей пока нет.</div>`;
    items.forEach((item) => {
      const article = document.createElement("article");
      article.className = "journal-entry";
      article.innerHTML = `<time>${DAY_SHORT[item.dayIndex] || ""} ${escapeHtml(formatTime(item.minute))}</time><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.type)}</small>`;
      list.appendChild(article);
    });
    $(".window-status", element).textContent = `${items.length} записей · часть системного журнала скрыта`;
  }

  function renderTrash(element) {
    const content = $(".window-content", element);
    const removed = gameState.inventory.filter((item) => item.startsWith("deleted-") || item.startsWith("draft-"));
    content.innerHTML = removed.length
      ? `<div class="trash-list">${removed.map((item) => `<div class="trash-item"><span class="file-icon">DEL</span>${escapeHtml(item)}</div>`).join("")}</div>`
      : `<div class="empty-state">Корзина пуста.</div>`;
    $(".window-status", element).textContent = `${removed.length} объектов`;
  }

  function advanceTime(minutes) {
    const result = engine.advanceTime(minutes);
    gameState = result.state || engine.getState();
    persist();
    deliverEvents(result.events || []);
    refreshOpenWindows();
    return result;
  }

  function deliverEvents(events) {
    events.forEach((event) => {
      if (!event || runtime.consumedNotifications.has(event.id)) return;
      runtime.consumedNotifications.add(event.id);
      notify(event.source || event.title || "Система", event.text || event.title || "Новое событие");
    });
  }

  function deliverUndisplayedInbox() {
    gameState.inbox.slice(-4).forEach((item) => {
      const id = item.id || `${item.type}-${item.source}-${item.title}`;
      if (runtime.consumedNotifications.has(id)) return;
      runtime.consumedNotifications.add(id);
      notify(item.source || "Система", item.text || item.title || "Новое сообщение");
    });
  }

  function deliveredStoryEvents(type) {
    return gameState.deliveredEvents
      .map((id) => Story.events[id])
      .filter((event) => event && (!type || event.type === type));
  }

  function normalizeEvent(event) {
    return {
      id: event.id,
      source: event.source || "Система",
      title: event.title || "Сообщение",
      text: event.text || "",
      minute: Number(event.minute || gameState.minute),
      type: event.type
    };
  }

  function normalizeInboxItem(item) {
    return {
      id: item.id || `${item.type}-${item.source}-${item.title}`,
      source: item.source || "Система",
      title: item.title || "Сообщение",
      text: item.text || "",
      minute: Number(item.minute || gameState.minute),
      type: item.type
    };
  }

  function notify(title, text) {
    const toast = document.createElement("button");
    toast.type = "button";
    toast.className = "notification";
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
    toast.addEventListener("click", () => toast.remove());
    ui.notifications.appendChild(toast);
    setTimeout(() => toast.remove(), 6500);
  }

  function refreshOpenWindows() {
    runtime.windows.forEach((win, id) => {
      if (!id.startsWith("doc-")) win.render();
    });
  }

  function openEndDayDialog() {
    if (runtime.dayTransitionOpen || gameState.ended) {
      if (gameState.ended) showEnding(engine.resolveEnding());
      return;
    }
    runtime.dayTransitionOpen = true;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const requirements = currentDay().requirements || [];
    const missing = requirements.filter((item) => !engine.conditionPasses(item.satisfiedWhen));
    overlay.innerHTML = `
      <section class="endday-card">
        <h2>Завершить ${escapeHtml(currentDay().title.toLowerCase())}?</h2>
        <p>${missing.length ? `Невыполненные обязательства: ${missing.map((item) => escapeHtml(item.label)).join("; ")}.` : "Основные обязательства на сегодня закрыты."}</p>
        <p>После завершения дня некоторые решения изменить будет нельзя.</p>
        <footer><button class="button" data-cancel type="button">Вернуться</button><button class="button primary" data-confirm type="button">Завершить день</button></footer>
      </section>`;
    document.body.appendChild(overlay);
    $("[data-cancel]", overlay).addEventListener("click", () => {
      runtime.dayTransitionOpen = false;
      overlay.remove();
    });
    $("[data-confirm]", overlay).addEventListener("click", () => finishDay(overlay));
  }

  function finishDay(overlay) {
    const endingDay = currentDay();
    const result = engine.endDay();
    gameState = result.state || engine.getState();
    persist();
    runtime.dayTransitionOpen = false;

    if (result.final) {
      overlay.remove();
      showEnding(result.ending);
      return;
    }

    closeAllWindows();
    runtime.selectedMailId = null;
    runtime.selectedContact = null;
    runtime.selectedFileId = null;
    deliverEvents(result.events || []);
    overlay.innerHTML = `
      <section class="endday-card day-transition-card">
        <p class="transition-kicker">${escapeHtml(endingDay.title)} завершён</p>
        <h2>${escapeHtml(result.nextDay.title)}</h2>
        <p>${escapeHtml(result.nextDay.dateLabel)}. Компьютер включён, новые письма уже загружаются.</p>
        ${result.missed?.length ? `<p class="transition-warning">Некоторые задачи вчера остались незавершёнными.</p>` : ""}
        <footer><button class="button primary" data-start-next type="button">Начать рабочий день</button></footer>
      </section>`;
    $("[data-start-next]", overlay).addEventListener("click", () => {
      overlay.remove();
      updateClock();
      deliverEvents(result.events || []);
      notify("Система", `${currentDay().title}. Рабочий сеанс открыт.`);
    });
  }

  function showEnding(ending) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay ending-overlay";
    overlay.innerHTML = `
      <section class="endday-card ending-card">
        <p class="transition-kicker">Пятница, 17:00</p>
        <h2>${escapeHtml(ending?.title || "Неделя завершена")}</h2>
        <p>${escapeHtml(ending?.text || "Рабочая неделя закончилась.")}</p>
        <div class="ending-summary">
          <span>Выполнено действий: ${Object.keys(gameState.completedActions).length}</span>
          <span>Записей в журнале: ${gameState.journal.length}</span>
        </div>
        <footer><button class="button" data-close type="button">Вернуться к журналу</button><button class="button primary" data-restart type="button">Начать новую неделю</button></footer>
      </section>`;
    document.body.appendChild(overlay);
    $("[data-close]", overlay).addEventListener("click", () => {
      overlay.remove();
      openApp("journal");
    });
    $("[data-restart]", overlay).addEventListener("click", resetGame);
  }

  function updateClock() {
    gameState = engine.getState();
    const day = currentDay();
    ui.clockTime.textContent = formatTime(gameState.minute);
    ui.clockDate.textContent = `${DAY_SHORT[gameState.dayIndex] || ""}, ${3 + gameState.dayIndex} ${MONTH_SHORT}`;
    const clock = $("#clock");
    if (clock) clock.title = gameState.ended ? "Посмотреть финал" : `Завершить ${day.title.toLowerCase()}`;
  }

  function formatTime(totalMinutes) {
    const value = Math.max(0, Number(totalMinutes) || 0);
    const hours = Math.floor(value / 60).toString().padStart(2, "0");
    const minutes = (value % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function dedupeBy(items, key) {
    const map = new Map();
    items.forEach((item) => map.set(item[key], item));
    return [...map.values()];
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
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/(["\\])/g, "\\$1");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();