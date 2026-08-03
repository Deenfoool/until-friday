(() => {
  "use strict";

  const DATA = window.GAME_DATA;
  const SAVE_KEY = "until-friday-save-v1";

  const defaultState = () => ({
    bootComplete: false,
    introIndex: 0,
    selectedFolder: "Рабочий стол",
    selectedFileId: null,
    selectedMailId: "m1",
    selectedContactId: "friend",
    readMail: [],
    replies: [],
    completedTasks: {},
    openedFiles: [],
    copiedFiles: [],
    terminalHistory: [],
    terminalLog: [],
    workQuality: 0,
    suspicion: 0,
    trust: { friend: 0, gossip: 0, admin: 0 },
    evidence: 0,
    anxiety: 1,
    currentMinute: 8 * 60 + 47,
    endDayShown: false,
    events: [],
    trash: [],
    flags: {
      acceptedReport: false,
      questionedHr: false,
      toldFriend: false,
      askedAdmin: false,
      openedRestricted: false,
      searchedDismissal: false,
      copiedMeeting: false
    }
  });

  let state = loadState();
  let zIndex = 20;
  let activeWindowId = null;
  const windows = new Map();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const desktop = $("#desktop");
  const bootScreen = $("#boot-screen");
  const bootLines = $("#boot-lines");
  const bootNext = $("#boot-next");
  const desktopIcons = $("#desktop-icons");
  const windowsLayer = $("#windows-layer");
  const taskButtons = $("#task-buttons");
  const notifications = $("#notifications");
  const startMenu = $("#start-menu");
  const startButton = $("#start-button");
  const startApps = $("#start-apps");
  const clockTime = $("#clock-time");
  const clockDate = $("#clock-date");

  init();

  function init() {
    renderDesktopApps();
    bindGlobalControls();
    updateClock();

    if (state.bootComplete) {
      bootScreen.classList.add("hidden");
      desktop.classList.remove("hidden");
      queueWelcomeEvents();
    } else {
      renderIntro();
    }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return defaultState();
      const parsed = JSON.parse(saved);
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        trust: { ...base.trust, ...(parsed.trust || {}) },
        flags: { ...base.flags, ...(parsed.flags || {}) }
      };
    } catch (error) {
      console.warn("Не удалось загрузить сохранение", error);
      return defaultState();
    }
  }

  function saveState(showToast = false) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (showToast) notify("Система", "Прогресс сохранён на этом компьютере.");
  }

  function bindGlobalControls() {
    bootNext.addEventListener("click", advanceIntro);

    startButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const hidden = startMenu.classList.toggle("hidden");
      startButton.classList.toggle("active", !hidden);
      startButton.setAttribute("aria-expanded", String(!hidden));
    });

    $("#save-button").addEventListener("click", () => saveState(true));
    $("#reset-button").addEventListener("click", () => {
      const accepted = window.confirm("Удалить локальное сохранение и начать понедельник заново?");
      if (!accepted) return;
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
    });

    $("#clock").addEventListener("click", showEndDayDialog);

    document.addEventListener("click", (event) => {
      if (!startMenu.contains(event.target) && !startButton.contains(event.target)) {
        startMenu.classList.add("hidden");
        startButton.classList.remove("active");
        startButton.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        startMenu.classList.add("hidden");
        startButton.classList.remove("active");
      }
    });
  }

  function renderIntro() {
    bootLines.innerHTML = "";
    for (let i = 0; i < state.introIndex; i += 1) {
      bootLines.appendChild(createIntroLine(DATA.intro[i]));
    }
    bootNext.textContent = state.introIndex >= DATA.intro.length ? "Включить рабочий компьютер" : "Продолжить";
  }

  function createIntroLine(line) {
    const p = document.createElement("p");
    p.className = "boot-line";
    const speaker = document.createElement("strong");
    speaker.textContent = line.speaker;
    const text = document.createElement("span");
    text.textContent = `— ${line.text}`;
    p.append(speaker, text);
    return p;
  }

  function advanceIntro() {
    if (state.introIndex < DATA.intro.length) {
      const line = DATA.intro[state.introIndex];
      state.introIndex += 1;
      bootLines.appendChild(createIntroLine(line));
      bootNext.textContent = state.introIndex >= DATA.intro.length ? "Включить рабочий компьютер" : "Продолжить";
      saveState();
      return;
    }

    state.bootComplete = true;
    saveState();
    bootScreen.classList.add("hidden");
    desktop.classList.remove("hidden");
    queueWelcomeEvents();
  }

  function renderDesktopApps() {
    desktopIcons.innerHTML = "";
    startApps.innerHTML = "";

    DATA.apps.forEach((app) => {
      const button = document.createElement("button");
      button.className = "desktop-icon";
      button.type = "button";
      button.dataset.app = app.id;
      button.innerHTML = `<span class="desktop-icon__glyph">${escapeHtml(app.icon)}</span><span class="desktop-icon__label">${escapeHtml(app.name)}</span>`;
      button.addEventListener("dblclick", () => openApp(app.id));
      button.addEventListener("click", () => {
        $$(".desktop-icon").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
      });
      desktopIcons.appendChild(button);

      const menuButton = document.createElement("button");
      menuButton.className = "start-app";
      menuButton.type = "button";
      menuButton.innerHTML = `<span class="desktop-icon__glyph">${escapeHtml(app.icon)}</span><span>${escapeHtml(app.name)}</span>`;
      menuButton.addEventListener("click", () => {
        startMenu.classList.add("hidden");
        openApp(app.id);
      });
      startApps.appendChild(menuButton);
    });
  }

  function openApp(appId) {
    const existing = windows.get(appId);
    if (existing) {
      existing.element.classList.remove("minimized");
      focusWindow(appId);
      existing.render();
      return;
    }

    const app = DATA.apps.find((item) => item.id === appId);
    if (!app) return;

    const template = $("#window-template");
    const element = template.content.firstElementChild.cloneNode(true);
    element.dataset.windowId = appId;
    $(".window-title", element).textContent = app.name;
    element.style.width = getWindowSize(appId).width;
    element.style.height = getWindowSize(appId).height;
    const offset = windows.size * 26;
    element.style.left = `${Math.min(145 + offset, window.innerWidth - 430)}px`;
    element.style.top = `${Math.min(55 + offset, window.innerHeight - 310)}px`;

    const render = () => renderApp(appId, element);
    windows.set(appId, { element, render, app });
    windowsLayer.appendChild(element);
    createTaskButton(appId, app.name);
    bindWindowControls(appId, element);
    makeDraggable(element, $(".window-titlebar", element));
    element.addEventListener("mousedown", () => focusWindow(appId));
    render();
    focusWindow(appId);
  }

  function getWindowSize(appId) {
    const sizes = {
      explorer: { width: "760px", height: "510px" },
      mail: { width: "820px", height: "530px" },
      chat: { width: "650px", height: "500px" },
      tasks: { width: "650px", height: "510px" },
      terminal: { width: "680px", height: "420px" },
      trash: { width: "520px", height: "360px" }
    };
    return sizes[appId] || { width: "620px", height: "440px" };
  }

  function bindWindowControls(appId, element) {
    element.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-window-action]");
      if (!actionButton) return;
      const action = actionButton.dataset.windowAction;
      if (action === "close") closeWindow(appId);
      if (action === "minimize") minimizeWindow(appId);
    });
  }

  function createTaskButton(appId, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-button";
    button.dataset.taskWindow = appId;
    button.textContent = title;
    button.addEventListener("click", () => {
      const win = windows.get(appId);
      if (!win) return;
      if (win.element.classList.contains("minimized")) {
        win.element.classList.remove("minimized");
        focusWindow(appId);
      } else if (activeWindowId === appId) {
        minimizeWindow(appId);
      } else {
        focusWindow(appId);
      }
    });
    taskButtons.appendChild(button);
  }

  function focusWindow(appId) {
    const win = windows.get(appId);
    if (!win) return;
    zIndex += 1;
    win.element.style.zIndex = String(zIndex);
    activeWindowId = appId;
    windows.forEach(({ element }) => element.classList.remove("focused"));
    win.element.classList.add("focused");
    $$(".task-button").forEach((button) => button.classList.toggle("active", button.dataset.taskWindow === appId));
  }

  function minimizeWindow(appId) {
    const win = windows.get(appId);
    if (!win) return;
    win.element.classList.add("minimized");
    if (activeWindowId === appId) activeWindowId = null;
    const button = $(`[data-task-window="${appId}"]`);
    if (button) button.classList.remove("active");
  }

  function closeWindow(appId) {
    const win = windows.get(appId);
    if (!win) return;
    win.element.remove();
    windows.delete(appId);
    const button = $(`[data-task-window="${appId}"]`);
    if (button) button.remove();
    if (activeWindowId === appId) activeWindowId = null;
  }

  function makeDraggable(element, handle) {
    let drag = null;
    handle.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) return;
      const rect = element.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      document.body.style.cursor = "move";
      event.preventDefault();
    });

    document.addEventListener("mousemove", (event) => {
      if (!drag) return;
      const maxX = Math.max(0, window.innerWidth - element.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - element.offsetHeight - 42);
      element.style.left = `${clamp(event.clientX - drag.x, 0, maxX)}px`;
      element.style.top = `${clamp(event.clientY - drag.y, 0, maxY)}px`;
    });

    document.addEventListener("mouseup", () => {
      drag = null;
      document.body.style.cursor = "";
    });
  }

  function renderApp(appId, element) {
    const renderers = {
      explorer: renderExplorer,
      mail: renderMail,
      chat: renderChat,
      tasks: renderTasks,
      terminal: renderTerminal,
      trash: renderTrash
    };
    renderers[appId]?.(element);
  }

  function renderExplorer(element) {
    const content = $(".window-content", element);
    const status = $(".window-status", element);
    const currentFolder = state.selectedFolder;
    const visibleFiles = DATA.files.filter((file) => file.folder === currentFolder && !file.hidden);
    const childFolders = DATA.folders.filter((folder) => {
      if (folder === currentFolder) return false;
      const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : null;
      return parent === currentFolder || (currentFolder === "Рабочий стол" && !folder.includes("/") && folder !== "Рабочий стол");
    });

    content.innerHTML = `
      <div class="toolbar">
        <button type="button" data-explorer-up title="На уровень выше">↑</button>
        <button type="button" data-explorer-refresh title="Обновить">↻</button>
        <span style="margin-left:8px;font-size:12px">${escapeHtml(currentFolder)}</span>
      </div>
      <div class="split">
        <aside class="sidebar" data-folder-list></aside>
        <section class="main-pane">
          <table class="file-table">
            <thead><tr><th>Имя</th><th>Тип</th><th>Изменён</th><th>Размер</th></tr></thead>
            <tbody data-file-list></tbody>
          </table>
        </section>
      </div>`;

    const folderList = $("[data-folder-list]", content);
    DATA.folders.forEach((folder) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = folder === currentFolder ? "selected" : "";
      button.textContent = `${folder.includes("/") ? "  └ " : "▸ "}${folder.split("/").at(-1)}`;
      button.addEventListener("click", () => {
        state.selectedFolder = folder;
        state.selectedFileId = null;
        advanceTime(2);
        saveAndRefresh("explorer");
      });
      folderList.appendChild(button);
    });

    const fileList = $("[data-file-list]", content);
    childFolders.forEach((folder) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td><span class="file-icon">DIR</span>${escapeHtml(folder.split("/").at(-1))}</td><td>Папка</td><td></td><td></td>`;
      row.addEventListener("dblclick", () => {
        state.selectedFolder = folder;
        advanceTime(2);
        saveAndRefresh("explorer");
      });
      fileList.appendChild(row);
    });

    visibleFiles.forEach((file) => {
      const row = document.createElement("tr");
      row.classList.toggle("selected", state.selectedFileId === file.id);
      row.innerHTML = `<td><span class="file-icon">${fileTypeLabel(file.type)}</span>${escapeHtml(file.name)}</td><td>${escapeHtml(fileTypeName(file.type))}</td><td>${escapeHtml(file.modified)}</td><td>${escapeHtml(file.size)}</td>`;
      row.addEventListener("click", () => {
        state.selectedFileId = file.id;
        $$("tbody tr", content).forEach((item) => item.classList.remove("selected"));
        row.classList.add("selected");
        status.textContent = file.restricted ? "Доступ ограничен" : `${file.size} · ${file.modified}`;
      });
      row.addEventListener("dblclick", () => openFile(file.id));
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openFile(file.id);
      });
      fileList.appendChild(row);
    });

    $("[data-explorer-up]", content).addEventListener("click", () => {
      if (!currentFolder.includes("/")) {
        state.selectedFolder = "Рабочий стол";
      } else {
        state.selectedFolder = currentFolder.slice(0, currentFolder.lastIndexOf("/"));
      }
      saveAndRefresh("explorer");
    });
    $("[data-explorer-refresh]", content).addEventListener("click", () => renderExplorer(element));
    status.textContent = `${childFolders.length + visibleFiles.length} объектов`;
  }

  function openFile(fileId) {
    const file = DATA.files.find((item) => item.id === fileId);
    if (!file) return;

    state.selectedFileId = fileId;
    if (!state.openedFiles.includes(fileId)) state.openedFiles.push(fileId);
    advanceTime(file.restricted ? 4 : 3);

    if (file.restricted) {
      state.flags.openedRestricted = true;
      state.suspicion += 1;
      state.anxiety += 1;
      notify("Проводник", "Для этого файла требуются дополнительные права доступа.");
      saveState();
      openDocumentWindow(file, true);
      return;
    }

    if (fileId === "vacancy") {
      state.anxiety += 1;
      addEvent("Найдена вакансия с названием твоей должности.");
    }
    if (fileId === "invoice") addEvent("В счёте №7814 обнаружено расхождение суммы.");
    saveState();
    openDocumentWindow(file, false);
  }

  function openDocumentWindow(file, restricted) {
    const id = `doc-${file.id}`;
    if (windows.has(id)) {
      focusWindow(id);
      return;
    }

    const template = $("#window-template");
    const element = template.content.firstElementChild.cloneNode(true);
    element.dataset.windowId = id;
    element.style.width = "600px";
    element.style.height = "450px";
    element.style.left = `${Math.max(30, Math.min(230 + windows.size * 15, window.innerWidth - 630))}px`;
    element.style.top = `${Math.max(30, Math.min(80 + windows.size * 15, window.innerHeight - 500))}px`;
    $(".window-title", element).textContent = file.name;
    const content = $(".window-content", element);
    const status = $(".window-status", element);

    if (restricted) {
      content.innerHTML = `<div class="restricted"><div><strong>Доступ запрещён</strong><p>Ваша учётная запись не имеет права читать этот документ.</p><button class="action-button" type="button" data-request-access>Запросить доступ</button></div></div>`;
      $("[data-request-access]", content).addEventListener("click", () => {
        state.suspicion += 1;
        state.flags.askedAdmin = true;
        addEvent(`Запрошен доступ к файлу «${file.name}».`);
        notify("Система доступа", "Запрос отправлен администратору.");
        saveState();
      });
      status.textContent = "Код: ACCESS-14";
    } else {
      content.innerHTML = `<div class="document-view"><article class="document-paper">${escapeHtml(file.content)}</article></div>`;
      status.textContent = `${file.size} · только чтение`;
    }

    const render = () => {};
    windows.set(id, { element, render, app: { id, name: file.name } });
    windowsLayer.appendChild(element);
    createTaskButton(id, file.name);
    bindWindowControls(id, element);
    makeDraggable(element, $(".window-titlebar", element));
    element.addEventListener("mousedown", () => focusWindow(id));
    focusWindow(id);
  }

  function renderMail(element) {
    const content = $(".window-content", element);
    const selected = DATA.mail.find((mail) => mail.id === state.selectedMailId) || DATA.mail[0];
    if (!state.readMail.includes(selected.id)) state.readMail.push(selected.id);

    content.innerHTML = `
      <div class="toolbar"><button type="button" data-mail-refresh>Получить почту</button><button type="button" data-mail-new disabled>Новое письмо</button></div>
      <div class="mail-layout">
        <aside class="mail-list" data-mail-list></aside>
        <article class="mail-view" data-mail-view></article>
      </div>`;

    const list = $("[data-mail-list]", content);
    DATA.mail.forEach((mail) => {
      const button = document.createElement("button");
      const isUnread = mail.unread && !state.readMail.includes(mail.id);
      button.className = `mail-item ${mail.id === selected.id ? "selected" : ""} ${isUnread ? "unread" : ""}`;
      button.type = "button";
      button.innerHTML = `<strong>${escapeHtml(mail.from)}</strong><span>${escapeHtml(mail.subject)}</span><small>${escapeHtml(mail.time)}</small>`;
      button.addEventListener("click", () => {
        state.selectedMailId = mail.id;
        if (!state.readMail.includes(mail.id)) state.readMail.push(mail.id);
        advanceTime(2);
        saveAndRefresh("mail");
      });
      list.appendChild(button);
    });

    const view = $("[data-mail-view]", content);
    view.innerHTML = `
      <header class="mail-meta">
        <h2>${escapeHtml(selected.subject)}</h2>
        <p>От: ${escapeHtml(selected.from)} &lt;${escapeHtml(selected.address)}&gt;</p>
        <p>Время: ${escapeHtml(selected.time)}</p>
      </header>
      <div class="mail-body">${escapeHtml(selected.body)}</div>
      <div class="action-row" data-mail-actions></div>`;

    const actionRow = $("[data-mail-actions]", view);
    const alreadyReplied = state.replies.some((reply) => reply.source === selected.id && reply.channel === "mail");
    if (selected.actions?.length && !alreadyReplied) {
      selected.actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action-button";
        button.textContent = action.label;
        button.addEventListener("click", () => handleMailAction(selected, action));
        actionRow.appendChild(button);
      });
    } else if (alreadyReplied) {
      const reply = state.replies.find((item) => item.source === selected.id && item.channel === "mail");
      actionRow.innerHTML = `<div class="task-result"><strong>Ваш ответ:</strong><br>${escapeHtml(reply.text)}</div>`;
    }

    $("[data-mail-refresh]", content).addEventListener("click", () => {
      advanceTime(1);
      notify("Почта", "Новых писем нет.");
      updateClock();
    });

    $(".window-status", element).textContent = `${DATA.mail.length} письма · ${DATA.mail.filter((mail) => mail.unread && !state.readMail.includes(mail.id)).length} непрочитанных`;
    saveState();
  }

  function handleMailAction(mail, action) {
    state.replies.push({ channel: "mail", source: mail.id, action: action.id, text: action.reply });
    advanceTime(4);

    if (action.id === "mail-report-ok") {
      state.flags.acceptedReport = true;
      state.workQuality += 1;
    }
    if (action.id === "mail-report-later") state.workQuality -= 1;
    if (action.id === "mail-hr-question") {
      state.flags.questionedHr = true;
      state.anxiety += 1;
      scheduleNotification("Отдел кадров", "Это плановая актуализация. Дополнительных комментариев пока нет.", 900);
    }

    notify("Почта", "Ответ отправлен.");
    saveAndRefresh("mail");
  }

  function renderChat(element) {
    const content = $(".window-content", element);
    const contact = DATA.contacts.find((item) => item.id === state.selectedContactId) || DATA.contacts[0];
    const sentReplies = state.replies.filter((reply) => reply.channel === "chat" && reply.source === contact.id);
    const allMessages = [...contact.messages, ...sentReplies.map((reply) => ({ side: "me", time: reply.time, text: reply.text }))]
      .sort((a, b) => a.time.localeCompare(b.time));

    content.innerHTML = `
      <div class="chat-layout">
        <aside class="contact-list" data-contact-list></aside>
        <section class="chat-main">
          <header class="chat-header"><strong>${escapeHtml(contact.name)}</strong><span>${escapeHtml(contact.role)}</span></header>
          <div class="messages" data-messages></div>
          <div class="reply-panel" data-replies></div>
        </section>
      </div>`;

    const contactList = $("[data-contact-list]", content);
    DATA.contacts.forEach((item) => {
      const button = document.createElement("button");
      button.className = `contact ${item.id === contact.id ? "selected" : ""}`;
      button.type = "button";
      button.innerHTML = `<span class="status-dot ${escapeHtml(item.status)}"></span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.role)}</small></span>`;
      button.addEventListener("click", () => {
        state.selectedContactId = item.id;
        advanceTime(1);
        saveAndRefresh("chat");
      });
      contactList.appendChild(button);
    });

    const messages = $("[data-messages]", content);
    allMessages.forEach((message) => {
      const block = document.createElement("div");
      block.className = `message ${message.side}`;
      block.innerHTML = `<div class="message-bubble">${escapeHtml(message.text)}</div><time>${escapeHtml(message.time)}</time>`;
      messages.appendChild(block);
    });
    messages.scrollTop = messages.scrollHeight;

    const replies = $("[data-replies]", content);
    const hasReplied = sentReplies.length > 0;
    if (!hasReplied) {
      contact.replies.forEach((reply) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = reply.label;
        button.addEventListener("click", () => handleChatReply(contact, reply));
        replies.appendChild(button);
      });
    } else {
      replies.innerHTML = `<span style="font-size:12px;color:#69737b">Ответ отправлен. Новых сообщений пока нет.</span>`;
    }

    $(".window-status", element).textContent = contact.status === "online" ? "В сети" : contact.status === "busy" ? "Занят" : "Отошёл";
  }

  function handleChatReply(contact, reply) {
    const time = formatTime(state.currentMinute + 1);
    state.replies.push({ channel: "chat", source: contact.id, action: reply.id, text: reply.text, time });
    advanceTime(5);

    if (reply.id === "chat-friend-trust") {
      state.flags.toldFriend = true;
      state.trust.friend += 2;
      state.anxiety -= 1;
      scheduleNotification("Дима Орлов", "Не накручивай себя. Я попробую осторожно узнать, что происходит.", 1000);
    }
    if (reply.id === "chat-friend-hide") state.trust.friend -= 1;
    if (reply.id === "chat-friend-probe") {
      state.trust.friend += 1;
      state.anxiety += 1;
      scheduleNotification("Дима Орлов", "Мне Олег сказал. Но ты же знаешь Олега: у него каждую неделю кого-то увольняют.", 1000);
    }
    if (reply.id === "chat-gossip-who") {
      state.trust.gossip += 1;
      state.anxiety += 1;
      scheduleNotification("Олег Казанцев", "Фамилии нет. Видел только папку с пометкой «кадровое решение».", 1000);
    }
    if (reply.id === "chat-gossip-dismiss") state.trust.gossip -= 1;
    if (reply.id === "chat-admin-help") {
      state.flags.askedAdmin = true;
      state.trust.admin -= 1;
      state.suspicion += 1;
      scheduleNotification("Роман Белов", "Не ошибка. Тебе туда и не положено. Зачем открывал?", 1000);
    }
    if (reply.id === "chat-admin-neutral") state.trust.admin += 1;

    notify("Связь", "Сообщение отправлено.");
    saveAndRefresh("chat");
  }

  function renderTasks(element) {
    const content = $(".window-content", element);
    content.innerHTML = `<div class="toolbar"><button type="button" data-task-refresh>Обновить</button><span style="margin-left:8px;font-size:12px">Понедельник</span></div><section class="task-list" data-task-list></section>`;
    const list = $("[data-task-list]", content);

    DATA.tasks.forEach((task) => {
      const completed = state.completedTasks[task.id];
      const actualState = task.id === "t-client" && Object.keys(state.completedTasks).length >= 2 ? "open" : task.state;
      const card = document.createElement("article");
      card.className = `task-card ${completed ? "done" : ""} ${actualState === "locked" ? "locked" : ""}`;
      card.innerHTML = `
        <header><h3>${escapeHtml(task.title)}</h3><span>${escapeHtml(task.deadline)}</span></header>
        <div class="task-body"><p>${escapeHtml(task.description)}</p><div class="action-row" data-options></div></div>`;
      const options = $("[data-options]", card);

      if (completed) {
        options.innerHTML = `<div class="task-result">${escapeHtml(completed.message)}</div>`;
      } else if (task.id === "t-client" && actualState === "open") {
        [
          { id: "task-client-confirm", label: "Подтвердить работы на 18:00", outcome: "good" },
          { id: "task-client-delay", label: "Перенести ответ на завтра", outcome: "bad" }
        ].forEach((option) => addTaskOption(options, task, option));
      } else if (actualState === "locked") {
        options.innerHTML = `<span style="font-size:12px;color:#6e7880">Откроется после выполнения основных задач.</span>`;
      } else {
        task.options.forEach((option) => addTaskOption(options, task, option));
      }
      list.appendChild(card);
    });

    $("[data-task-refresh]", content).addEventListener("click", () => {
      advanceTime(1);
      renderTasks(element);
    });

    const completeCount = Object.keys(state.completedTasks).length;
    $(".window-status", element).textContent = `${completeCount} из ${DATA.tasks.length} задач завершено`;
  }

  function addTaskOption(container, task, option) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.textContent = option.label;
    button.addEventListener("click", () => completeTask(task, option));
    container.appendChild(button);
  }

  function completeTask(task, option) {
    const messages = {
      "task-report-final": "Финальная версия отчёта отправлена начальнику.",
      "task-report-old": "Черновик отправлен. Начальник заметил несовпадение цифр.",
      "task-report-copy": "Обе версии сохранены в личную папку. Отчёт пока не отправлен.",
      "task-invoice-fix": "Сумма исправлена, бухгалтер получила уведомление.",
      "task-invoice-report": "Копия счёта передана начальнику как возможное нарушение.",
      "task-invoice-ignore": "Счёт оставлен без изменений.",
      "task-client-confirm": "Клиенту отправлено подтверждение работ на 18:00.",
      "task-client-delay": "Ответ клиенту отложен до завтра."
    };

    state.completedTasks[task.id] = { option: option.id, message: messages[option.id] || "Задача завершена." };
    advanceTime(18);

    if (option.outcome === "good") state.workQuality += 2;
    if (option.outcome === "bad") state.workQuality -= 2;
    if (option.outcome === "suspicious") {
      state.suspicion += 1;
      state.copiedFiles.push("report-old", "report-final");
    }
    if (option.outcome === "evidence") {
      state.evidence += 1;
      state.workQuality += 1;
    }

    if (option.id === "task-report-final") {
      scheduleNotification("Андрей Соколов", "Отчёт получил. В этот раз всё сходится.", 800);
    }
    if (option.id === "task-report-old") {
      scheduleNotification("Андрей Соколов", "Илья, ты снова отправил черновик. Исправься до обеда.", 800);
    }
    if (option.id === "task-invoice-fix") {
      scheduleNotification("Марина Лебедева", "Спасибо. Там действительно был лишний ноль.", 900);
    }
    if (option.id === "task-invoice-report") {
      state.anxiety += 1;
      scheduleNotification("Андрей Соколов", "Почему ты решил, что это нарушение? Зайди позже.", 900);
    }

    notify("Задачи", messages[option.id] || "Задача обновлена.");
    saveAndRefresh("tasks");
  }

  function renderTerminal(element) {
    const content = $(".window-content", element);
    content.innerHTML = `<div class="terminal"><div class="terminal-output" data-terminal-output></div><div class="terminal-input-row"><span class="terminal-prompt">ivoronov@office:&gt;</span><input class="terminal-input" data-terminal-input autocomplete="off" spellcheck="false" aria-label="Команда терминала" /></div></div>`;
    const output = $("[data-terminal-output]", content);
    const input = $("[data-terminal-input]", content);

    if (state.terminalLog.length === 0) {
      state.terminalLog.push({ text: "KONTUR OFFICE SHELL 2.4", className: "dim" });
      state.terminalLog.push({ text: "Введите help для списка доступных команд.", className: "dim" });
    }
    renderTerminalLog(output);

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const command = input.value.trim();
      input.value = "";
      if (!command) return;
      executeCommand(command, output);
    });

    setTimeout(() => input.focus(), 0);
    $(".window-status", element).textContent = "Защищённое соединение · действия регистрируются";
  }

  function executeCommand(rawCommand, output) {
    state.terminalHistory.push(rawCommand);
    state.terminalLog.push({ text: `ivoronov@office:> ${rawCommand}` });
    const [command, ...args] = rawCommand.toLowerCase().split(/\s+/);
    const argument = args.join(" ");

    const commands = {
      help: () => terminalPrint("Доступные команды:\nhelp                 список команд\nstatus               состояние рабочего сеанса\ntasks                список задач\nfiles [слово]         поиск файлов\nopen <имя>           открыть найденный файл\ncopy <имя>           сохранить служебную копию\nlogs                 показать журнал сеанса\nclear                очистить экран\nendday               завершить рабочий день", "dim"),
      status: () => terminalPrint(`Пользователь: ${DATA.player.name}\nОтдел: сопровождение\nСеанс: активен\nВремя: ${formatTime(state.currentMinute)}\nСеть: OFFICE-LAN\nПолитика аудита: включена`),
      tasks: () => terminalPrint(DATA.tasks.map((task) => `${state.completedTasks[task.id] ? "[готово]" : "[ожидает]"} ${task.title}`).join("\n")),
      files: () => terminalSearch(argument),
      search: () => terminalSearch(argument),
      open: () => terminalOpen(argument),
      copy: () => terminalCopy(argument),
      logs: () => terminalLogs(),
      clear: () => { state.terminalLog = []; },
      endday: () => showEndDayDialog()
    };

    if (commands[command]) commands[command]();
    else terminalPrint(`Команда «${command}» не найдена. Введите help.`, "error");

    advanceTime(command === "files" || command === "search" ? 4 : 2);
    saveState();
    renderTerminalLog(output);
  }

  function terminalSearch(query) {
    if (!query) {
      terminalPrint("Укажите слово для поиска: files отчёт", "warn");
      return;
    }

    if (["увольнение", "увол", "кадровое решение", "пятница"].some((word) => query.includes(word))) {
      state.flags.searchedDismissal = true;
      state.anxiety += 1;
      state.suspicion += 1;
    }

    const results = DATA.files.filter((file) => `${file.name} ${file.content}`.toLowerCase().includes(query));
    if (results.length === 0) {
      terminalPrint(`По запросу «${query}» ничего не найдено.`);
      return;
    }

    terminalPrint(results.map((file) => `${file.restricted ? "[закрыто]" : "[файл]"} ${file.name} :: ${file.folder}`).join("\n"));
  }

  function terminalOpen(argument) {
    if (!argument) {
      terminalPrint("Укажите часть имени файла.", "warn");
      return;
    }
    const file = DATA.files.find((item) => item.name.toLowerCase().includes(argument));
    if (!file) {
      terminalPrint("Файл не найден.", "error");
      return;
    }
    terminalPrint(file.restricted ? "ACCESS-14: недостаточно прав." : `Открывается: ${file.name}`, file.restricted ? "error" : "dim");
    openFile(file.id);
  }

  function terminalCopy(argument) {
    if (!argument) {
      terminalPrint("Укажите часть имени файла.", "warn");
      return;
    }
    const file = DATA.files.find((item) => item.name.toLowerCase().includes(argument));
    if (!file) {
      terminalPrint("Файл не найден.", "error");
      return;
    }
    if (file.restricted) {
      state.suspicion += 2;
      terminalPrint("COPY-17: операция отклонена и добавлена в журнал.", "error");
      return;
    }
    if (!state.copiedFiles.includes(file.id)) state.copiedFiles.push(file.id);
    state.suspicion += 1;
    if (file.id === "invoice" || file.id === "vacancy") state.evidence += 1;
    terminalPrint(`Служебная копия создана: user_cache/${file.name}`);
  }

  function terminalLogs() {
    const logLines = [
      `${formatTime(8 * 60 + 5)} AUTH login OK`,
      `${formatTime(8 * 60 + 12)} MAIL sync OK`,
      ...state.openedFiles.map((id, index) => `${formatTime(8 * 60 + 30 + index * 3)} FILE open ${id}`),
      ...state.copiedFiles.map((id, index) => `${formatTime(9 * 60 + index * 2)} CACHE copy ${id}`)
    ];
    terminalPrint(logLines.join("\n"), "dim");
  }

  function terminalPrint(text, className = "") {
    state.terminalLog.push({ text, className });
  }

  function renderTerminalLog(output) {
    output.innerHTML = "";
    state.terminalLog.forEach((line) => {
      const div = document.createElement("div");
      div.className = `terminal-line ${line.className || ""}`;
      div.textContent = line.text;
      output.appendChild(div);
    });
    output.parentElement.scrollTop = output.parentElement.scrollHeight;
  }

  function renderTrash(element) {
    const content = $(".window-content", element);
    if (state.trash.length === 0) {
      content.innerHTML = `<div class="empty-state"><div><div class="big-icon">▱</div><strong>Корзина пуста</strong><p>Удалённые рабочие документы появятся здесь.</p></div></div>`;
    } else {
      content.innerHTML = `<div class="trash-view">${state.trash.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>`;
    }
    $(".window-status", element).textContent = `${state.trash.length} объектов`;
  }

  function queueWelcomeEvents() {
    if (state.events.includes("welcome-shown")) return;
    state.events.push("welcome-shown");
    setTimeout(() => notify("Почта", "Получено новое письмо: «Отчёт за июль»."), 500);
    setTimeout(() => notify("Связь", "Дима Орлов: Ты чего сегодня такой?"), 1600);
    setTimeout(() => notify("Задачи", "На сегодня назначено 3 задачи."), 2700);
    saveState();
  }

  function notify(title, message, duration = 5000) {
    const toast = document.createElement("div");
    toast.className = "notification";
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
    notifications.appendChild(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function scheduleNotification(title, message, delay) {
    window.setTimeout(() => notify(title, message), delay);
  }

  function addEvent(text) {
    if (!state.events.includes(text)) state.events.push(text);
  }

  function advanceTime(minutes) {
    state.currentMinute = Math.min(18 * 60, state.currentMinute + minutes);
    updateClock();
  }

  function updateClock() {
    clockTime.textContent = formatTime(state.currentMinute);
    clockDate.textContent = "ПН, 3 АВГ";
  }

  function showEndDayDialog() {
    if (!state.bootComplete || $(".endday-overlay")) return;

    const completed = Object.keys(state.completedTasks).length;
    const overlay = document.createElement("div");
    overlay.className = "endday-overlay";
    const reaction = getEndDayReaction();
    const log = buildEndDayLog();

    overlay.innerHTML = `
      <section class="endday-card" role="dialog" aria-modal="true" aria-labelledby="endday-title">
        <h2 id="endday-title">Завершить понедельник?</h2>
        <p>Выполнено задач: ${completed} из ${DATA.tasks.length}. Неотвеченные письма и незавершённые задачи останутся до завтра.</p>
        <p><strong>Последнее сообщение:</strong><br>${escapeHtml(reaction)}</p>
        <div class="system-log">${escapeHtml(log)}</div>
        <footer><button class="action-button" type="button" data-cancel>Вернуться</button><button class="button primary" type="button" data-finish>Завершить день</button></footer>
      </section>`;

    $("[data-cancel]", overlay).addEventListener("click", () => overlay.remove());
    $("[data-finish]", overlay).addEventListener("click", () => finishDay(overlay));
    desktop.appendChild(overlay);
  }

  function getEndDayReaction() {
    if (state.workQuality >= 5 && state.suspicion <= 1) return "Андрей Соколов: Нормально поработал. Завтра с утра будет ещё одна задача.";
    if (state.suspicion >= 4) return "Роман Белов: Завтра зайди ко мне. Нужно уточнить несколько обращений к системе.";
    if (state.workQuality <= -2) return "Андрей Соколов: Сегодня было много ошибок. Утром поговорим.";
    if (state.evidence >= 2) return "Андрей Соколов: Вижу, ты нашёл кое-что интересное. Пока никому это не пересылай.";
    return "Дима Орлов: Ну что, пережил понедельник? До пятницы ещё далеко.";
  }

  function buildEndDayLog() {
    const lines = [
      "СЕАНС ПОЛЬЗОВАТЕЛЯ ЗАВЕРШАЕТСЯ",
      `Задач завершено: ${Object.keys(state.completedTasks).length}`,
      `Документов открыто: ${state.openedFiles.length}`,
      `Служебных копий создано: ${state.copiedFiles.length}`,
      `Ответов отправлено: ${state.replies.length}`,
      "",
      "Часть журнала недоступна пользователю."
    ];
    return lines.join("\n");
  }

  function finishDay(overlay) {
    state.endDayShown = true;
    state.currentMinute = 18 * 60;
    saveState();
    overlay.innerHTML = `
      <section class="endday-card">
        <h2>Понедельник завершён</h2>
        <p>${escapeHtml(getEndDayReaction())}</p>
        <p>Это первый вертикальный срез игры. Следующий этап разработки добавит вторник, новые письма, последствия сегодняшних действий и разные версии правды.</p>
        <footer><button class="button primary" type="button" data-return>Вернуться к компьютеру</button></footer>
      </section>`;
    $("[data-return]", overlay).addEventListener("click", () => overlay.remove());
    updateClock();
  }

  function saveAndRefresh(appId) {
    saveState();
    updateClock();
    const win = windows.get(appId);
    win?.render();
  }

  function fileTypeLabel(type) {
    return ({ text: "TXT", sheet: "XLS", log: "LOG" })[type] || "FILE";
  }

  function fileTypeName(type) {
    return ({ text: "Текстовый документ", sheet: "Таблица", log: "Журнал" })[type] || "Файл";
  }

  function formatTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
    const minutes = (totalMinutes % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
