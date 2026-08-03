(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayWednesdayMinigames) return;

  const LABELS = {
    explain: "Дать правдивое объяснение журналу доступа",
    remove: "Попытаться удалить записи журнала",
    blame: "Указать на действия Димы",
    backlog: "Закрыть накопившиеся обращения",
    hr: "Скопировать черновик кадрового приказа"
  };

  let queued = false;
  let activeWindow = null;
  let topZ = 2050;

  function appendSchedule(action, eventId, minute) {
    if (!action) return;
    action.effects ||= {};
    action.effects.schedule ||= [];
    if (!action.effects.schedule.some((item) => item.eventId === eventId)) {
      action.effects.schedule.push({ eventId, dayIndex: 2, minute });
    }
  }

  function actionDoneCondition(actionId) {
    return { actionDone: actionId };
  }

  function extendWednesdayStory() {
    const explain = Story.actions?.["wed-audit-explain"];
    const remove = Story.actions?.["wed-audit-delete"];
    const blame = Story.actions?.["wed-audit-blame"];
    const backlog = Story.actions?.["wed-finish-backlog"];
    const hr = Story.actions?.["wed-copy-hr-draft"];

    if (remove) remove.channel = "mail";
    if (hr) hr.channel = "tasks";

    appendSchedule(explain, "wed-security-honest-reply", 720);
    appendSchedule(remove, "wed-security-server-copy", 735);
    appendSchedule(blame, "wed-dima-blame-reaction", 780);
    appendSchedule(backlog, "wed-chief-backlog-reply", 810);
    appendSchedule(hr, "wed-hr-copy-warning", 850);
    appendSchedule(remove, "wed-access-tightened", 930);
    appendSchedule(blame, "wed-access-tightened", 930);
    appendSchedule(hr, "wed-access-tightened", 930);

    Story.events ||= {};
    Story.events["wed-security-honest-reply"] ||= {
      id: "wed-security-honest-reply",
      dayIndex: 2,
      minute: 720,
      type: "mail",
      source: "Служба безопасности",
      title: "Пояснение принято",
      text: "Пояснение зарегистрировано. Дополнительных действий от вас сейчас не требуется.",
      requires: actionDoneCondition("wed-audit-explain"),
      effects: { stats: { anxiety: -1 }, setFlags: { auditClosedHonestly: true } }
    };
    Story.events["wed-security-server-copy"] ||= {
      id: "wed-security-server-copy",
      dayIndex: 2,
      minute: 735,
      type: "mail",
      source: "Служба безопасности",
      title: "Несоответствие локального журнала",
      text: "Локальная история отличается от серверной копии. Проверка переведена в ручной режим.",
      requires: actionDoneCondition("wed-audit-delete"),
      effects: {
        stats: { suspicion: 1, anxiety: 1 },
        removeAccess: ["finance-read"],
        setFlags: { auditServerCopyFound: true }
      }
    };
    Story.events["wed-dima-blame-reaction"] ||= {
      id: "wed-dima-blame-reaction",
      dayIndex: 2,
      minute: 780,
      type: "chat",
      source: "Дима Орлов",
      title: "Ты серьёзно?",
      text: "Мне только что задали вопросы про твой запрос к руководству. Ты зачем вообще вписал меня в объяснение?",
      requires: actionDoneCondition("wed-audit-blame"),
      effects: { stats: { anxiety: 1 }, trust: { friend: -1 }, setFlags: { dimaConfrontedPlayer: true } }
    };
    Story.events["wed-chief-backlog-reply"] ||= {
      id: "wed-chief-backlog-reply",
      dayIndex: 2,
      minute: 810,
      type: "chat",
      source: "Андрей Соколов",
      title: "Очередь обращений",
      text: "Приоритеты выставлены правильно. Критические заявки закрывайте первыми, остальное перенесите в план.",
      requires: actionDoneCondition("wed-finish-backlog"),
      effects: { trust: { chief: 1 }, setFlags: { backlogPrioritized: true } }
    };
    Story.events["wed-hr-copy-warning"] ||= {
      id: "wed-hr-copy-warning",
      dayIndex: 2,
      minute: 850,
      type: "system",
      source: "Система документооборота",
      title: "Копирование служебного документа",
      text: "Операция с черновиком кадрового приказа зарегистрирована. Временный доступ будет закрыт.",
      requires: actionDoneCondition("wed-copy-hr-draft"),
      effects: {
        stats: { suspicion: 1, anxiety: 1 },
        removeAccess: ["hr-temp"],
        setFlags: { hrCopyRegistered: true }
      }
    };
    Story.events["wed-access-tightened"] ||= {
      id: "wed-access-tightened",
      dayIndex: 2,
      minute: 930,
      type: "system",
      source: "КОНТУР-СЕРВИС",
      title: "Права доступа обновлены",
      text: "Часть временных разрешений отозвана. Изменения вступят в силу при следующем входе в систему.",
      requires: {
        any: [
          actionDoneCondition("wed-audit-delete"),
          actionDoneCondition("wed-audit-blame"),
          actionDoneCondition("wed-copy-hr-draft")
        ]
      },
      effects: { removeAccess: ["hr-temp"], setFlags: { accessTightened: true } }
    };
  }

  extendWednesdayStory();

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorateAuditMail();
      document.querySelectorAll(".task-list").forEach(decorateTaskList);
    });
  }

  function textOf(element) {
    return element?.textContent?.trim() || "";
  }

  function buttonByLabel(rootElement, label) {
    return Array.from(rootElement?.querySelectorAll(".action-button") || []).find((button) => textOf(button) === label) || null;
  }

  function cardByTitle(list, title) {
    return Array.from(list.querySelectorAll(":scope > .task-card")).find((card) =>
      textOf(card.querySelector("h3")) === title
    ) || null;
  }

  function decorateAuditMail() {
    document.querySelectorAll(".mail-view").forEach((view) => {
      if (textOf(view.querySelector("h2")) !== "Запрос пояснений") return;
      const actions = view.querySelector("[data-actions]");
      if (!actions) return;

      const sourceButtons = {
        explain: buttonByLabel(actions, LABELS.explain),
        remove: buttonByLabel(actions, LABELS.remove),
        blame: buttonByLabel(actions, LABELS.blame)
      };
      if (!sourceButtons.explain && !sourceButtons.remove && !sourceButtons.blame) return;

      actions.hidden = true;
      if (view.querySelector("[data-wednesday-audit-launcher]")) return;

      const panel = document.createElement("section");
      panel.className = "wednesday-audit-launcher";
      panel.dataset.wednesdayAuditLauncher = "true";
      panel.innerHTML = `
        <strong>К письму приложена выписка журнала доступа</strong>
        <p>Отметьте строки, которые требуют объяснения, затем выберите способ ответа.</p>
        <button type="button" class="action-button">Открыть выписку</button>`;
      panel.querySelector("button").addEventListener("click", () => openAuditReview(sourceButtons));
      view.appendChild(panel);
    });
  }

  function decorateTaskList(list) {
    decorateBacklogTask(list);
    decorateHrTask(list);
  }

  function decorateBacklogTask(list) {
    const sourceCard = cardByTitle(list, LABELS.backlog);
    if (!sourceCard) return;
    sourceCard.hidden = true;
    if (list.querySelector('[data-wednesday-card="backlog"]')) return;

    const card = createTaskCard(
      "backlog",
      "Разобрать очередь обращений",
      "Шесть обращений накопились за время отпуска. Расставьте их по приоритету до передачи дежурной смене.",
      "Открыть очередь"
    );
    card.querySelector("button").addEventListener("click", () => openBacklogSorter(sourceCard.querySelector(".action-button")));
    list.insertBefore(card, sourceCard);
  }

  function decorateHrTask(list) {
    const sourceCard = cardByTitle(list, LABELS.hr);
    if (!sourceCard) return;
    sourceCard.hidden = true;
    if (list.querySelector('[data-wednesday-card="hr"]')) return;

    const card = createTaskCard(
      "hr",
      "Изучить черновик кадрового приказа",
      "Временный доступ открыл несколько частей документа. Фамилия сотрудника скрыта, но метаданные и приложения доступны.",
      "Открыть документ"
    );
    card.querySelector("button").addEventListener("click", () => openHrDraft(sourceCard.querySelector(".action-button")));
    list.insertBefore(card, sourceCard);
  }

  function createTaskCard(id, title, description, buttonLabel) {
    const card = document.createElement("article");
    card.className = "task-card wednesday-task-card";
    card.dataset.wednesdayCard = id;
    card.innerHTML = `
      <header><h3></h3><span>среда</span></header>
      <div class="task-body">
        <p></p>
        <div class="action-row"><button class="action-button" type="button"></button></div>
      </div>`;
    card.querySelector("h3").textContent = title;
    card.querySelector("p").textContent = description;
    card.querySelector("button").textContent = buttonLabel;
    return card;
  }

  function createWindow(title, id, status = "Служебная операция будет записана в журнал") {
    closeActiveWindow();
    const layer = document.querySelector("#windows-layer");
    if (!layer) return null;

    const win = document.createElement("section");
    win.className = "app-window focused wednesday-minigame-window";
    win.dataset.wednesdayMinigame = id;
    win.style.zIndex = String(++topZ);
    win.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title"></div>
        <div class="window-controls"><button type="button" data-close aria-label="Закрыть">×</button></div>
      </header>
      <div class="window-content wednesday-minigame-content"></div>
      <footer class="window-status"></footer>`;
    win.querySelector(".window-title").textContent = title;
    win.querySelector(".window-status").textContent = status;
    win.querySelector("[data-close]").addEventListener("click", closeActiveWindow);
    win.addEventListener("mousedown", () => focusWindow(win));
    makeDraggable(win, win.querySelector(".window-titlebar"));
    layer.appendChild(win);
    activeWindow = win;
    focusWindow(win);
    return win;
  }

  function focusWindow(win) {
    document.querySelectorAll(".app-window").forEach((item) => item.classList.toggle("focused", item === win));
    win.style.zIndex = String(++topZ);
  }

  function closeActiveWindow() {
    activeWindow?.remove();
    activeWindow = null;
  }

  function openAuditReview(sourceButtons) {
    const win = createWindow("Служба безопасности — выписка журнала", "audit");
    if (!win) return;
    const content = win.querySelector(".wednesday-minigame-content");
    const suspiciousIds = new Set(["leadership-denied", "access-request"]);
    const selected = new Set();
    const rows = [
      ["08:47:12", "AUTH", "Вход в корпоративную сеть", "успешно", "login"],
      ["08:58:04", "SHARED/REPORTS", "Чтение рабочего отчёта", "разрешено", "report"],
      ["09:13:27", "LEADERSHIP/FRIDAY", "Открытие закрытой папки", "отказано", "leadership-denied"],
      ["09:14:01", "ACCESS", "Запрос расширенных прав", "создан", "access-request"],
      ["10:06:44", "MAIL", "Сохранение вложения", "успешно", "mail"],
      ["10:22:18", "TASKS", "Отправка рабочего результата", "успешно", "task"]
    ];

    content.innerHTML = `
      <div class="wednesday-heading">
        <strong>Найдите нетипичные действия</strong>
        <p>Отметьте только те строки, из-за которых служба безопасности запросила пояснение.</p>
      </div>
      <div class="audit-log-table" data-log></div>
      <div class="audit-review-status" data-status>Выбрано строк: 0</div>
      <div class="audit-decision-panel" data-decisions hidden>
        <p>Строки определены. Выберите, что отправить службе безопасности.</p>
      </div>`;

    const log = content.querySelector("[data-log]");
    const status = content.querySelector("[data-status]");
    const decisions = content.querySelector("[data-decisions]");

    rows.forEach(([time, section, operation, result, id]) => {
      const label = document.createElement("label");
      label.className = "audit-log-row";
      label.innerHTML = `<input type="checkbox"><time></time><strong></strong><span></span><small></small>`;
      label.querySelector("time").textContent = time;
      label.querySelector("strong").textContent = section;
      label.querySelector("span").textContent = operation;
      label.querySelector("small").textContent = result;
      const checkbox = label.querySelector("input");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selected.add(id);
        else selected.delete(id);
        const correct = selected.size === suspiciousIds.size && [...suspiciousIds].every((item) => selected.has(item));
        label.classList.toggle("checked", checkbox.checked);
        status.textContent = correct
          ? "Нетипичные строки определены."
          : `Выбрано строк: ${selected.size}. В выписке есть две связанные операции.`;
        decisions.hidden = !correct;
      });
      log.appendChild(label);
    });

    addAuditDecision(decisions, sourceButtons.explain, "Отправить правдивое объяснение", "explain");
    addAuditDecision(decisions, sourceButtons.remove, "Удалить строки из локальной копии", "remove");
    if (sourceButtons.blame) addAuditDecision(decisions, sourceButtons.blame, "Указать, что запрос обсуждался с Димой", "blame");
  }

  function addAuditDecision(container, sourceButton, label, mode) {
    if (!sourceButton) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-button ${mode === "remove" || mode === "blame" ? "secondary" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      const player = root.UntilFridayProfile?.playerName?.() || "Сотрудник";
      const files = {
        explain: {
          id: "wed-audit-explanation-honest",
          name: "Пояснение_службе_безопасности.txt",
          type: "Исходящее пояснение",
          icon: "text",
          content: `Автор: ${player}\n\nНетипичные обращения были связаны с попыткой понять назначение закрытой папки. Доступ получен не был. Запрос расширенных прав отправлен вручную. Дополнительных действий с разделом не выполнялось.`
        },
        remove: {
          id: "wed-audit-local-log-edited",
          name: "Журнал_доступа_локальная_копия.log",
          type: "Изменённый системный журнал",
          icon: "systemLog",
          content: "08:47:12 AUTH LOGIN OK\n08:58:04 SHARED/REPORTS READ OK\n10:06:44 MAIL ATTACHMENT SAVED\n10:22:18 TASKS RESULT SENT\n\nДве строки удалены из локальной копии."
        },
        blame: {
          id: "wed-audit-explanation-dima",
          name: "Пояснение_с_упоминанием_Димы.txt",
          type: "Исходящее пояснение",
          icon: "text",
          content: `Автор: ${player}\n\nЗапрос к закрытому разделу выполнялся после разговора с Дмитрием Орловым. Он также интересовался содержанием документов, связанных с пятницей.`
        }
      };
      commitViaButton(sourceButton, files[mode], "Пояснение отправлено. Ожидайте ответ службы безопасности.");
    });
    container.appendChild(button);
  }

  function openBacklogSorter(sourceButton) {
    const win = createWindow("Задачи — очередь обращений", "backlog", "Приоритеты: P1 критический, P2 высокий, P3 плановый");
    if (!win) return;
    const content = win.querySelector(".wednesday-minigame-content");
    const tickets = [
      { id: "INC-2041", client: "Технопарк", text: "Недоступен производственный шлюз, остановлена отгрузка.", expected: "P1" },
      { id: "INC-2044", client: "Вектор", text: "У пяти сотрудников не открывается корпоративная почта.", expected: "P2" },
      { id: "REQ-1182", client: "Гранит", text: "Сбросить пароль одному пользователю до конца недели.", expected: "P3" },
      { id: "INC-2050", client: "Северный узел", text: "Платёжный шлюз периодически отклоняет операции.", expected: "P1" },
      { id: "REQ-1190", client: "Альтаир", text: "Подтвердить перенос сервера, запланированный на завтра.", expected: "P2" },
      { id: "REQ-1197", client: "Логос", text: "Исправить выравнивание колонок в месячном отчёте.", expected: "P3" }
    ];
    const answers = new Map();

    content.innerHTML = `
      <div class="wednesday-heading"><strong>Очередь поддержки</strong><p>Оцените влияние и срочность каждого обращения.</p></div>
      <div class="backlog-ticket-list" data-tickets></div>
      <div class="backlog-footer">
        <span data-result>Распределено: 0 из 6</span>
        <button type="button" class="action-button" data-check disabled>Проверить приоритеты</button>
      </div>`;

    const list = content.querySelector("[data-tickets]");
    const result = content.querySelector("[data-result]");
    const check = content.querySelector("[data-check]");

    tickets.forEach((ticket) => {
      const row = document.createElement("article");
      row.className = "backlog-ticket";
      row.innerHTML = `
        <header><strong></strong><span></span></header>
        <p></p>
        <select aria-label="Выбрать приоритет">
          <option value="">Не назначен</option>
          <option value="P1">P1 — критический</option>
          <option value="P2">P2 — высокий</option>
          <option value="P3">P3 — плановый</option>
        </select>`;
      row.querySelector("strong").textContent = ticket.id;
      row.querySelector("span").textContent = ticket.client;
      row.querySelector("p").textContent = ticket.text;
      row.querySelector("select").addEventListener("change", (event) => {
        if (event.target.value) answers.set(ticket.id, event.target.value);
        else answers.delete(ticket.id);
        row.classList.remove("wrong", "correct");
        result.textContent = `Распределено: ${answers.size} из ${tickets.length}`;
        check.disabled = answers.size !== tickets.length;
      });
      list.appendChild(row);
    });

    check.addEventListener("click", () => {
      let errors = 0;
      tickets.forEach((ticket, index) => {
        const row = list.children[index];
        const correct = answers.get(ticket.id) === ticket.expected;
        row.classList.toggle("correct", correct);
        row.classList.toggle("wrong", !correct);
        if (!correct) errors += 1;
      });
      if (errors) {
        result.textContent = `Ошибок: ${errors}. Проверьте влияние на работу клиента и срок.`;
        return;
      }

      result.textContent = "Очередь распределена. Результат готов к передаче.";
      check.textContent = "Передать дежурной смене";
      check.onclick = () => {
        const contentText = tickets.map((ticket) => `${ticket.expected}  ${ticket.id}  ${ticket.client} — ${ticket.text}`).join("\n");
        commitViaButton(sourceButton, {
          id: "wed-backlog-priority-report",
          name: "Очередь_обращений_приоритеты.txt",
          type: "Рабочий отчёт",
          icon: "text",
          content: `ОЧЕРЕДЬ ПОДДЕРЖКИ\nСреда\n\n${contentText}`
        }, "Очередь передана дежурной смене.");
      };
    });
  }

  function openHrDraft(sourceButton) {
    const win = createWindow("Кадры — проект приказа", "hr", "Временный доступ · только чтение");
    if (!win) return;
    const content = win.querySelector(".wednesday-minigame-content");
    const fragments = [
      {
        id: "cover",
        label: "Основной лист",
        title: "Проект приказа № HR-17/08",
        body: "Основание: организационные изменения.\nДата объявления: пятница.\nДата вступления в силу: следующий понедельник.\nСотрудник: ███████████████"
      },
      {
        id: "staffing",
        label: "Приложение 1",
        title: "Изменение штатного расписания",
        body: "Подразделение: отдел сопровождения.\nКоличество ставок до изменения: 6.\nКоличество ставок после изменения: 6.\nПримечание: замещение позиции после уведомления."
      },
      {
        id: "access",
        label: "Приложение 2",
        title: "План изменения доступа",
        body: "Закрыть удалённый доступ: пятница, 18:00.\nАрхивировать рабочую папку.\nСохранить доступ к расчётным документам до завершения передачи дел."
      },
      {
        id: "approval",
        label: "Лист согласования",
        title: "Согласование документа",
        body: "Директор: согласовано.\nОтдел кадров: согласовано.\nНачальник отдела: ознакомлен.\nКомментарий: фамилию внести после личной встречи."
      }
    ];
    const viewed = new Set();

    content.innerHTML = `
      <div class="hr-draft-layout">
        <aside class="hr-fragment-list" data-list></aside>
        <section class="hr-fragment-view" data-view><div class="wednesday-empty-state">Выберите часть документа.</div></section>
      </div>
      <div class="hr-draft-footer">
        <span data-progress>Просмотрено частей: 0 из 4</span>
        <button type="button" class="action-button" data-copy disabled>Сохранить копию в личную папку</button>
      </div>`;

    const list = content.querySelector("[data-list]");
    const view = content.querySelector("[data-view]");
    const progress = content.querySelector("[data-progress]");
    const copy = content.querySelector("[data-copy]");

    fragments.forEach((fragment) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hr-fragment-button";
      button.innerHTML = `<strong></strong><small>не просмотрено</small>`;
      button.querySelector("strong").textContent = fragment.label;
      button.addEventListener("click", () => {
        viewed.add(fragment.id);
        list.querySelectorAll("button").forEach((item) => item.classList.toggle("selected", item === button));
        button.classList.add("viewed");
        button.querySelector("small").textContent = "просмотрено";
        view.innerHTML = `<header><h3></h3><span>Черновик</span></header><article></article>`;
        view.querySelector("h3").textContent = fragment.title;
        view.querySelector("article").textContent = fragment.body;
        progress.textContent = `Просмотрено частей: ${viewed.size} из ${fragments.length}`;
        copy.disabled = viewed.size !== fragments.length;
      });
      list.appendChild(button);
    });

    copy.addEventListener("click", () => {
      const combined = fragments.map((fragment) => `${fragment.title}\n${fragment.body}`).join("\n\n----------------\n\n");
      commitViaButton(sourceButton, {
        id: "wed-hr-draft-composite",
        name: "Приказ_HR-17-08_черновик.txt",
        type: "Копия кадрового документа",
        icon: "protected",
        content: combined
      }, "Копия сохранена. Операция зарегистрирована системой документооборота.");
    });
  }

  function commitViaButton(sourceButton, file, successText) {
    if (!sourceButton || !sourceButton.isConnected) {
      setWindowStatus("Исходное действие больше недоступно. Обновите приложение.");
      return;
    }
    sourceButton.click();
    window.setTimeout(() => {
      if (sourceButton.isConnected) {
        setWindowStatus("Действие не выполнено. Возможно, рабочий лимит на сегодня исчерпан.");
        return;
      }
      root.UntilFridayWorkflow?.saveAttachment?.(file);
      closeActiveWindow();
      notify("Задачи", successText);
    }, 120);
  }

  function setWindowStatus(text) {
    const status = activeWindow?.querySelector(".window-status");
    if (status) status.textContent = text;
  }

  function notify(title, text) {
    const container = document.querySelector("#notifications");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "notification";
    toast.innerHTML = `<strong></strong><span></span>`;
    toast.querySelector("strong").textContent = title;
    toast.querySelector("span").textContent = text;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 5000);
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
      element.style.left = `${Math.max(0, Math.min(event.clientX - drag.x, maxX))}px`;
      element.style.top = `${Math.max(0, Math.min(event.clientY - drag.y, maxY))}px`;
    });
    document.addEventListener("mouseup", () => { drag = null; });
  }

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", queueDecorate, { once: true });
  window.addEventListener("until-friday-app-ready", queueDecorate);
  queueDecorate();

  root.UntilFridayWednesdayMinigames = {
    labels: LABELS,
    extendWednesdayStory,
    openAuditReview,
    openBacklogSorter,
    openHrDraft
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
