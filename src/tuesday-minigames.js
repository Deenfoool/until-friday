(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayTuesdayMinigames) return;

  const CLIENT_CONFIRM = "Подтвердить профилактические работы";
  const CLIENT_DELAY = "Отложить ответ до среды";
  const ACCOUNTANT_HELP = "Помочь бухгалтеру сверить ещё три счёта";

  let queued = false;
  let activeWindow = null;
  let topZ = 1850;

  function appendSchedule(action, eventId, minute) {
    if (!action) return;
    action.effects ||= {};
    action.effects.schedule ||= [];
    if (!action.effects.schedule.some((item) => item.eventId === eventId)) {
      action.effects.schedule.push({ eventId, dayIndex: 1, minute });
    }
  }

  function extendTuesdayStory() {
    const confirm = Story.actions?.["tue-client-confirm"];
    const delay = Story.actions?.["tue-client-delay"];
    const accountant = Story.actions?.["tue-help-accountant"];

    if (confirm) {
      confirm.result = "Клиенту отправлены подтверждение работ, окно обслуживания и инструкция по подготовке.";
      appendSchedule(confirm, "tue-client-thanks", 630);
    }
    if (delay) {
      delay.result = "Ответ клиенту отложен, хотя подтверждение уже было доступно во внутренних документах.";
      appendSchedule(delay, "tue-client-escalation", 625);
    }
    if (accountant) {
      accountant.result = "Три дополнительных счёта сверены. Завышенная сумма, дубль услуги и устаревшие реквизиты отмечены в отчёте.";
      appendSchedule(accountant, "tue-accountant-thanks", 760);
    }

    Story.events ||= {};
    Story.events["tue-client-thanks"] ||= {
      id: "tue-client-thanks",
      dayIndex: 1,
      minute: 630,
      type: "mail",
      source: "АО «Северный узел»",
      title: "RE: Профилактические работы",
      text: "Подтверждение получили. Спасибо за точное окно работ и инструкцию для дежурной смены.",
      effects: { stats: { work: 1 }, trust: { chief: 1 } }
    };
    Story.events["tue-client-escalation"] ||= {
      id: "tue-client-escalation",
      dayIndex: 1,
      minute: 625,
      type: "mail",
      source: "Андрей Соколов",
      title: "Эскалация по клиенту",
      text: "«Северный узел» не получил ответ вовремя и написал мне напрямую. Закрой обращение до конца дня.",
      effects: { stats: { work: -1, anxiety: 1 }, trust: { chief: -1 } }
    };
    Story.events["tue-accountant-thanks"] ||= {
      id: "tue-accountant-thanks",
      dayIndex: 1,
      minute: 760,
      type: "chat",
      source: "Марина Лебедева",
      title: "Сверка завершена",
      text: "Нашла твои пометки. Особенно хорошо, что заметил старые реквизиты, платёж бы вернулся. Спасибо.",
      effects: { trust: { accountant: 1 } }
    };
  }

  extendTuesdayStory();

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      document.querySelectorAll(".task-list").forEach(decorateTaskList);
    });
  }

  function cardByTitle(list, title) {
    return Array.from(list.querySelectorAll(":scope > .task-card")).find((card) =>
      card.querySelector("h3")?.textContent.trim() === title
    ) || null;
  }

  function actionButton(card) {
    return card?.querySelector(".action-button") || null;
  }

  function decorateTaskList(list) {
    decorateClientTask(list);
    decorateAccountantTask(list);
  }

  function decorateClientTask(list) {
    const confirmCard = cardByTitle(list, CLIENT_CONFIRM);
    const delayCard = cardByTitle(list, CLIENT_DELAY);
    if (!confirmCard || !delayCard) return;

    confirmCard.hidden = true;
    delayCard.hidden = true;
    if (list.querySelector('[data-tuesday-minigame-card="client"]')) return;

    const card = createTaskCard(
      "client",
      "Обработать обращение «Северный узел»",
      "Изучите заявку, план работ и состояние сервиса. После проверки подготовьте ответ клиенту.",
      "Открыть обращение"
    );
    card.querySelector("button").addEventListener("click", () => openClientCase({
      confirm: actionButton(confirmCard),
      delay: actionButton(delayCard)
    }));
    list.insertBefore(card, confirmCard);
  }

  function decorateAccountantTask(list) {
    const sourceCard = cardByTitle(list, ACCOUNTANT_HELP);
    if (!sourceCard) return;

    sourceCard.hidden = true;
    if (list.querySelector('[data-tuesday-minigame-card="accountant"]')) return;

    const card = createTaskCard(
      "accountant",
      "Сверить три дополнительных счёта",
      "Марина прислала договоры, счета и реквизиты. В каждом комплекте находится одно расхождение.",
      "Начать сверку"
    );
    card.querySelector("button").addEventListener("click", () => openAccountantAudit({
      complete: actionButton(sourceCard)
    }));
    list.insertBefore(card, sourceCard);
  }

  function createTaskCard(id, title, description, buttonLabel) {
    const card = document.createElement("article");
    card.className = "task-card tuesday-minigame-card";
    card.dataset.tuesdayMinigameCard = id;
    card.innerHTML = `
      <header><h3></h3><span>вторник</span></header>
      <div class="task-body">
        <p></p>
        <div class="action-row"><button class="action-button" type="button"></button></div>
      </div>`;
    card.querySelector("h3").textContent = title;
    card.querySelector("p").textContent = description;
    card.querySelector("button").textContent = buttonLabel;
    return card;
  }

  function createWindow(title, id) {
    closeActiveWindow();
    const layer = document.querySelector("#windows-layer");
    if (!layer) return null;

    const win = document.createElement("section");
    win.className = "app-window focused tuesday-minigame-window";
    win.dataset.tuesdayMinigame = id;
    win.style.zIndex = String(++topZ);
    win.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title"></div>
        <div class="window-controls"><button type="button" data-close aria-label="Закрыть">×</button></div>
      </header>
      <div class="window-content tuesday-minigame-content"></div>
      <footer class="window-status">Рабочее действие будет записано в журнал</footer>`;
    win.querySelector(".window-title").textContent = title;
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

  function openClientCase(actions) {
    const win = createWindow("Задачи — обращение клиента", "client");
    if (!win) return;
    const content = win.querySelector(".tuesday-minigame-content");
    const evidence = [
      {
        id: "request",
        title: "Заявка клиента",
        label: "Обращение #SUP-4187",
        body: "АО «Северный узел» сообщает о кратком разрыве соединения в 08:14 и просит подтвердить, связана ли проблема с сегодняшними профилактическими работами. Ответ нужен до 10:00."
      },
      {
        id: "plan",
        title: "План работ",
        label: "План_обслуживания_04-08.pdf",
        body: "Узел NS-04. Утверждённое окно: 18:00–19:00. Работы согласованы 31 июля. Клиента необходимо уведомить не позднее чем за четыре часа до начала."
      },
      {
        id: "monitoring",
        title: "Мониторинг",
        label: "Журнал состояния NS-04",
        body: "08:14:03 — потеря пакетов 38%\n08:14:19 — восстановление маршрута\n08:15–09:02 — показатели в норме\nТекущий статус: сервис доступен."
      }
    ];
    const visited = new Set();

    content.innerHTML = `
      <div class="tuesday-task-heading">
        <strong>Клиентское обращение</strong>
        <p>Проверьте все доступные материалы перед отправкой ответа.</p>
      </div>
      <div class="client-case-layout">
        <aside class="client-evidence-list" data-evidence-list></aside>
        <section class="client-evidence-view" data-evidence-view>
          <div class="tuesday-empty-state">Выберите документ слева.</div>
        </section>
      </div>
      <div class="client-case-progress" data-progress>Проверено документов: 0 из 3</div>
      <div class="client-case-actions">
        <button type="button" class="action-button" data-confirm disabled>Подтвердить работы и отправить инструкцию</button>
        <button type="button" class="action-button secondary" data-delay disabled>Отложить ответ до среды</button>
      </div>`;

    const list = content.querySelector("[data-evidence-list]");
    const view = content.querySelector("[data-evidence-view]");
    const progress = content.querySelector("[data-progress]");
    const confirm = content.querySelector("[data-confirm]");
    const delay = content.querySelector("[data-delay]");

    function updateProgress() {
      progress.textContent = `Проверено документов: ${visited.size} из ${evidence.length}`;
      const ready = visited.size === evidence.length;
      confirm.disabled = !ready;
      delay.disabled = !ready;
    }

    evidence.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "client-evidence-button";
      button.innerHTML = `<strong></strong><span></span><small>не просмотрено</small>`;
      button.querySelector("strong").textContent = item.title;
      button.querySelector("span").textContent = item.label;
      button.addEventListener("click", () => {
        visited.add(item.id);
        list.querySelectorAll("button").forEach((entry) => entry.classList.toggle("selected", entry === button));
        button.classList.add("viewed");
        button.querySelector("small").textContent = "просмотрено";
        view.innerHTML = `<header><h3></h3><span>Только чтение</span></header><article></article>`;
        view.querySelector("h3").textContent = item.label;
        view.querySelector("article").textContent = item.body;
        updateProgress();
      });
      list.appendChild(button);
    });

    confirm.addEventListener("click", () => completeClientAction(actions.confirm, "confirm"));
    delay.addEventListener("click", () => completeClientAction(actions.delay, "delay"));
  }

  function completeClientAction(button, mode) {
    if (!button) return;
    const name = root.UntilFridayProfile?.playerName?.() || "Сотрудник";
    const confirmed = mode === "confirm";
    root.UntilFridayWorkflow?.saveAttachment?.({
      id: confirmed ? "tue-client-response-confirmed" : "tue-client-response-delayed",
      name: "Ответ_Северный_узел.msg",
      type: "Исходящее сообщение",
      icon: "text",
      content: confirmed
        ? `От: ${name}\nКому: АО «Северный узел»\n\nПодтверждаем профилактические работы 4 августа с 18:00 до 19:00. Утренний краткий разрыв устранён, сервис работает штатно. Перед началом работ сохраните незавершённые операции.`
        : `От: ${name}\nКому: АО «Северный узел»\n\nВаш запрос принят. Подробный ответ будет направлен позднее.`
    });
    closeActiveWindow();
    button.click();
  }

  function openAccountantAudit(actions) {
    const win = createWindow("Задачи — сверка дополнительных счетов", "accountant");
    if (!win) return;
    const content = win.querySelector(".tuesday-minigame-content");
    const invoices = [
      {
        id: "7921",
        title: "Счёт №7921",
        reference: "Договор: сопровождение серверов, 102 000 ₽, без дополнительных услуг.",
        issue: "Итоговая сумма завышена на 18 000 ₽.",
        rows: [
          { id: "base", label: "Сопровождение серверов", value: "102 000 ₽" },
          { id: "total", label: "Итого к оплате", value: "120 000 ₽", correct: true },
          { id: "tax", label: "НДС", value: "Без НДС" }
        ]
      },
      {
        id: "7934",
        title: "Счёт №7934",
        reference: "Заказ: миграция данных, одна услуга стоимостью 18 500 ₽.",
        issue: "Услуга «Миграция данных» добавлена дважды.",
        rows: [
          { id: "migration-1", label: "Миграция данных", value: "18 500 ₽" },
          { id: "migration-2", label: "Миграция данных", value: "18 500 ₽", correct: true },
          { id: "total", label: "Итого", value: "37 000 ₽" }
        ]
      },
      {
        id: "7940",
        title: "Счёт №7940",
        reference: "Карточка контрагента: расчётный счёт оканчивается на 4821.",
        issue: "В счёте указаны устаревшие банковские реквизиты.",
        rows: [
          { id: "amount", label: "Итого", value: "64 300 ₽" },
          { id: "account", label: "Расчётный счёт", value: "•••• 1176", correct: true },
          { id: "due", label: "Оплатить до", value: "7 августа" }
        ]
      }
    ];

    let activeId = invoices[0].id;
    const resolved = new Set();

    content.innerHTML = `
      <div class="tuesday-task-heading">
        <strong>Сверка документов Марины Лебедевой</strong>
        <p>В каждом комплекте одно расхождение. Выберите проблемную строку.</p>
      </div>
      <div class="accountant-audit-layout">
        <aside class="accountant-invoice-list" data-invoice-list></aside>
        <section class="accountant-invoice-view" data-invoice-view></section>
      </div>
      <div class="accountant-audit-footer">
        <span data-audit-message>Найдено расхождений: 0 из 3</span>
        <button type="button" class="action-button" data-complete disabled>Сохранить отчёт и завершить сверку</button>
      </div>`;

    const list = content.querySelector("[data-invoice-list]");
    const view = content.querySelector("[data-invoice-view]");
    const message = content.querySelector("[data-audit-message]");
    const complete = content.querySelector("[data-complete]");

    function renderList() {
      list.innerHTML = "";
      invoices.forEach((invoice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "accountant-invoice-button";
        button.classList.toggle("selected", invoice.id === activeId);
        button.classList.toggle("resolved", resolved.has(invoice.id));
        button.innerHTML = `<strong></strong><span></span>`;
        button.querySelector("strong").textContent = invoice.title;
        button.querySelector("span").textContent = resolved.has(invoice.id) ? "расхождение найдено" : "требует проверки";
        button.addEventListener("click", () => {
          activeId = invoice.id;
          renderList();
          renderInvoice();
        });
        list.appendChild(button);
      });
    }

    function renderInvoice() {
      const invoice = invoices.find((item) => item.id === activeId);
      if (!invoice) return;
      view.innerHTML = `
        <header><h3></h3><span>Документы получены из Почты</span></header>
        <div class="accountant-reference"><strong>Основание</strong><p></p></div>
        <div class="accountant-rows" data-rows></div>
        <div class="accountant-result" data-result></div>`;
      view.querySelector("h3").textContent = invoice.title;
      view.querySelector(".accountant-reference p").textContent = invoice.reference;
      const rows = view.querySelector("[data-rows]");
      const result = view.querySelector("[data-result]");

      invoice.rows.forEach((row) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "accountant-row";
        button.innerHTML = `<span></span><strong></strong>`;
        button.querySelector("span").textContent = row.label;
        button.querySelector("strong").textContent = row.value;
        button.disabled = resolved.has(invoice.id);
        button.addEventListener("click", () => {
          if (!row.correct) {
            result.className = "accountant-result error";
            result.textContent = "Эта строка соответствует основанию. Проверьте остальные значения.";
            button.classList.add("wrong");
            window.setTimeout(() => button.classList.remove("wrong"), 300);
            return;
          }
          resolved.add(invoice.id);
          result.className = "accountant-result success";
          result.textContent = invoice.issue;
          message.textContent = `Найдено расхождений: ${resolved.size} из ${invoices.length}`;
          complete.disabled = resolved.size !== invoices.length;
          renderList();
          renderInvoice();
        });
        rows.appendChild(button);
      });

      if (resolved.has(invoice.id)) {
        result.className = "accountant-result success";
        result.textContent = invoice.issue;
      }
    }

    complete.addEventListener("click", () => {
      if (resolved.size !== invoices.length || !actions.complete) return;
      root.UntilFridayWorkflow?.saveAttachment?.({
        id: "tue-accountant-audit-report",
        name: "Сверка_счетов_04-08.xlsx",
        type: "Отчёт о сверке",
        icon: "spreadsheet",
        content: "РЕЗУЛЬТАТ СВЕРКИ\n\n№7921 — итоговая сумма завышена на 18 000 ₽.\n№7934 — услуга «Миграция данных» продублирована.\n№7940 — указаны устаревшие банковские реквизиты.\n\nСтатус: передано Марине Лебедевой."
      });
      closeActiveWindow();
      actions.complete.click();
    });

    renderList();
    renderInvoice();
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
      const maxY = Math.max(0, window.innerHeight - element.offsetHeight - 44);
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

  root.UntilFridayTuesdayMinigames = {
    openClientCase,
    openAccountantAudit
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
