(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayThursdayMinigames) return;

  const LABELS = {
    project: "Завершить автоматизацию отчётов",
    caseFile: "Собрать материалы к пятничной встрече",
    resign: "Подготовить заявление по собственному желанию",
    complaint: "Подготовить жалобу на начальника"
  };

  const FRIDAY_MEETING_ACTIONS = [
    "fri-meeting-calm",
    "fri-meeting-work",
    "fri-meeting-blackmail",
    "fri-send-resignation"
  ];

  let queued = false;
  let activeWindow = null;
  let topZ = 2250;

  function actionDoneCondition(actionId) {
    return { actionDone: actionId };
  }

  function appendSchedule(action, eventId, minute, dayIndex = 3) {
    if (!action) return;
    action.effects ||= {};
    action.effects.schedule ||= [];
    if (!action.effects.schedule.some((item) => item.eventId === eventId)) {
      action.effects.schedule.push({ eventId, dayIndex, minute });
    }
  }

  function addRequirement(action, condition) {
    if (!action) return;
    if (!action.requires) {
      action.requires = condition;
      return;
    }
    if (action.requires.eventDelivered === condition.eventDelivered) return;
    if (action.requires.all?.some((item) => item.eventDelivered === condition.eventDelivered)) return;
    action.requires = { all: [condition, action.requires] };
  }

  function extendThursdayStory() {
    const project = Story.actions?.["thu-finish-project"];
    const caseFile = Story.actions?.["thu-build-case"];
    const resign = Story.actions?.["thu-resign"];
    const complaint = Story.actions?.["thu-frame-chief"];

    if (project) {
      project.channel = "tasks";
      project.label = LABELS.project;
      project.result = "Автоматизация отчётов настроена, прошла контрольные тесты и передана начальнику.";
      appendSchedule(project, "thu-project-reviewed", 780);
    }

    if (caseFile) {
      caseFile.channel = "tasks";
      caseFile.label = LABELS.caseFile;
      caseFile.result = "Найденные документы собраны в зашифрованный архив для пятничной встречи.";
      appendSchedule(caseFile, "thu-case-archive-traced", 805);
    }

    if (resign) {
      resign.channel = "tasks";
      resign.label = LABELS.resign;
      resign.result = "Подписанный черновик заявления сохранён локально и пока не отправлен.";
      appendSchedule(resign, "thu-resignation-draft-saved", 825);
    }

    if (complaint) {
      complaint.channel = "tasks";
      complaint.label = LABELS.complaint;
      complaint.result = "Жалоба отправлена со спорной записью, указывающей на начальника отдела.";
      appendSchedule(complaint, "thu-complaint-registered", 850);
    }

    const calendar = Story.events?.["thu-director-calendar"];
    if (calendar) {
      calendar.text = "Директор ждёт вас завтра в 17:00. На встрече будет сотрудник отдела кадров. Подготовьте материалы по текущим задачам.";
    }

    Story.events ||= {};
    Story.events["thu-restricted-session"] ||= {
      id: "thu-restricted-session",
      dayIndex: 3,
      minute: 540,
      atStart: true,
      type: "system",
      source: "КОНТУР-СЕРВИС",
      title: "Ограниченный рабочий сеанс",
      text: "После вчерашней проверки часть временных разрешений отозвана. Финансовый и кадровый разделы доступны только для ранее сохранённых копий.",
      requires: { flag: "accessTightened" },
      effects: {
        removeAccess: ["finance-read", "hr-temp"],
        stats: { anxiety: 1 },
        setFlags: { restrictedThursdaySession: true }
      }
    };

    Story.events["thu-project-reviewed"] ||= {
      id: "thu-project-reviewed",
      dayIndex: 3,
      minute: 780,
      type: "chat",
      source: "Андрей Соколов",
      title: "Прототип получил",
      text: "Тесты посмотрел. Если на пятничной встрече спросят о текущих результатах, покажем этот прототип.",
      requires: actionDoneCondition("thu-finish-project"),
      effects: { trust: { chief: 2 }, stats: { work: 1 }, setFlags: { projectAcknowledged: true } }
    };

    Story.events["thu-case-archive-traced"] ||= {
      id: "thu-case-archive-traced",
      dayIndex: 3,
      minute: 805,
      type: "system",
      source: "Система защиты данных",
      title: "Создан зашифрованный архив",
      text: "Архив в личной папке зарегистрирован. Имена вложенных файлов скрыты, но время создания сохранено в журнале.",
      requires: actionDoneCondition("thu-build-case"),
      effects: { stats: { suspicion: 1, anxiety: 1 }, setFlags: { caseArchiveLogged: true } }
    };

    Story.events["thu-resignation-draft-saved"] ||= {
      id: "thu-resignation-draft-saved",
      dayIndex: 3,
      minute: 825,
      type: "system",
      source: "Редактор документов",
      title: "Черновик сохранён",
      text: "Заявление не отправлено и не зарегистрировано отделом кадров. Его можно подать на встрече в пятницу.",
      requires: actionDoneCondition("thu-resign"),
      effects: { setFlags: { resignationReadyForMeeting: true } }
    };

    Story.events["thu-complaint-registered"] ||= {
      id: "thu-complaint-registered",
      dayIndex: 3,
      minute: 850,
      type: "mail",
      source: "Служба безопасности",
      title: "Жалоба зарегистрирована",
      text: "Материал принят. Авторство спорной операции будет сверено с серверным журналом и учётными записями согласования.",
      requires: actionDoneCondition("thu-frame-chief"),
      effects: { stats: { suspicion: 1, anxiety: 2 }, setFlags: { complaintUnderReview: true } }
    };

    Story.events["thu-evening-reminder"] ||= {
      id: "thu-evening-reminder",
      dayIndex: 3,
      minute: 960,
      type: "mail",
      source: "Секретарь директора",
      title: "Напоминание о встрече",
      text: "Встреча завтра в 17:00, переговорная №1. Возьмите только те материалы, которые готовы представить официально.",
      effects: { setFlags: { fridayReminderReceived: true } }
    };

    Story.days ||= [];
    if (Story.days[4]) Story.days[4].focusLimit = Math.max(2, Number(Story.days[4].focusLimit || 1));

    Story.actions ||= {};
    Story.actions["fri-wait-meeting"] ||= {
      id: "fri-wait-meeting",
      dayIndex: 4,
      channel: "tasks",
      label: "Работать до встречи в 17:00",
      minutes: 475,
      once: true,
      focusCost: 1,
      result: "Обычные задачи пятницы завершены. Наступило время встречи с директором.",
      effects: { setFlags: { fridayWorkdayCompleted: true } }
    };

    FRIDAY_MEETING_ACTIONS.forEach((actionId) => {
      addRequirement(Story.actions?.[actionId], { eventDelivered: "fri-meeting" });
    });
  }

  extendThursdayStory();

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      document.querySelectorAll(".task-list").forEach(decorateTaskList);
    });
  }

  function textOf(element) {
    return element?.textContent?.trim() || "";
  }

  function cardByTitle(list, title) {
    return Array.from(list.querySelectorAll(":scope > .task-card")).find((card) =>
      textOf(card.querySelector("h3")) === title
    ) || null;
  }

  function decorateTaskList(list) {
    decorateAction(list, LABELS.project, "project", "Завершить проект автоматизации", "Настройте обработку только финальных отчётов и добейтесь успешного прохождения контрольных тестов.", "Открыть проект", openProjectBuilder);
    decorateAction(list, LABELS.caseFile, "case", "Собрать материалы к встрече", "Выберите документы, которые действительно подтверждают ваши выводы, и сформируйте зашифрованное досье.", "Открыть материалы", openCaseBuilder);
    decorateAction(list, LABELS.resign, "resign", "Подготовить заявление", "Заполните и подпишите локальный черновик. До пятничной встречи документ никуда не отправляется.", "Заполнить заявление", openResignationDraft);
    decorateAction(list, LABELS.complaint, "complaint", "Подготовить жалобу на начальника", "Сопоставьте платёжную запись и учётные данные. Этот путь требует сознательно приписать спорную операцию начальнику.", "Открыть запись", openComplaintBuilder);
  }

  function decorateAction(list, sourceTitle, id, title, description, buttonLabel, opener) {
    const sourceCard = cardByTitle(list, sourceTitle);
    if (!sourceCard) return;
    sourceCard.hidden = true;
    if (list.querySelector(`[data-thursday-card="${id}"]`)) return;

    const card = document.createElement("article");
    card.className = "task-card thursday-task-card";
    card.dataset.thursdayCard = id;
    card.innerHTML = `
      <header><h3></h3><span>четверг</span></header>
      <div class="task-body">
        <p></p>
        <div class="action-row"><button class="action-button" type="button"></button></div>
      </div>`;
    card.querySelector("h3").textContent = title;
    card.querySelector("p").textContent = description;
    card.querySelector("button").textContent = buttonLabel;
    card.querySelector("button").addEventListener("click", () => opener(sourceCard.querySelector(".action-button")));
    list.insertBefore(card, sourceCard);
  }

  function createWindow(title, id, status = "Результат будет записан в локальный журнал") {
    closeActiveWindow();
    const layer = document.querySelector("#windows-layer");
    if (!layer) return null;

    const win = document.createElement("section");
    win.className = "app-window focused thursday-minigame-window";
    win.dataset.thursdayMinigame = id;
    win.style.zIndex = String(++topZ);
    win.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title"></div>
        <div class="window-controls"><button type="button" data-close aria-label="Закрыть">×</button></div>
      </header>
      <div class="window-content thursday-minigame-content"></div>
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

  function openProjectBuilder(sourceButton) {
    const win = createWindow("Проект — автоматизация отчётов", "project", "Тестовая среда · изменения применяются только после передачи прототипа");
    if (!win) return;
    const content = win.querySelector(".thursday-minigame-content");
    let configured = false;
    let tested = false;

    content.innerHTML = `
      <div class="thursday-heading">
        <strong>Настройка обработчика ежемесячных отчётов</strong>
        <p>Система должна брать только проверенные финальные файлы, отклонять черновики и сохранять результат в общий архив.</p>
      </div>
      <div class="project-builder-grid">
        <label>Источник
          <select data-field="source">
            <option value="">Выберите каталог</option>
            <option value="desktop">Рабочий стол пользователя</option>
            <option value="reports-root">/shared/reports</option>
            <option value="reports-final">/shared/reports/final</option>
          </select>
        </label>
        <label>Маска файла
          <select data-field="mask">
            <option value="">Выберите маску</option>
            <option value="all">*.xlsx</option>
            <option value="draft">*_черновик.xlsx</option>
            <option value="final">*_финал.xlsx</option>
          </select>
        </label>
        <label>Проверка
          <select data-field="validation">
            <option value="">Выберите правило</option>
            <option value="none">Не проверять содержимое</option>
            <option value="name">Проверять только имя</option>
            <option value="full">Сверять суммы и отклонять пометку «черновик»</option>
          </select>
        </label>
        <label>Каталог результата
          <select data-field="output">
            <option value="">Выберите каталог</option>
            <option value="personal">/users/current/documents</option>
            <option value="temporary">/shared/temp</option>
            <option value="archive">/shared/archive/monthly</option>
          </select>
        </label>
        <label>Время запуска
          <select data-field="schedule">
            <option value="">Выберите время</option>
            <option value="morning">08:30</option>
            <option value="work">12:00</option>
            <option value="evening">18:30</option>
          </select>
        </label>
      </div>
      <div class="project-builder-actions">
        <span data-status>Конфигурация не проверена.</span>
        <button type="button" class="action-button" data-validate>Проверить конфигурацию</button>
      </div>
      <section class="project-test-panel" data-tests hidden>
        <header><strong>Контрольные тесты</strong><span data-test-summary>не запускались</span></header>
        <div class="project-test-list">
          <div><span>Финальный отчёт с верными суммами</span><strong data-test="valid">ожидание</strong></div>
          <div><span>Файл с пометкой «черновик»</span><strong data-test="draft">ожидание</strong></div>
          <div><span>Отчёт с расхождением итогов</span><strong data-test="mismatch">ожидание</strong></div>
        </div>
        <button type="button" class="action-button" data-run-tests>Запустить тесты</button>
        <button type="button" class="action-button" data-submit disabled>Передать прототип начальнику</button>
      </section>`;

    const status = content.querySelector("[data-status]");
    const tests = content.querySelector("[data-tests]");
    const validate = content.querySelector("[data-validate]");
    const runTests = content.querySelector("[data-run-tests]");
    const submit = content.querySelector("[data-submit]");

    validate.addEventListener("click", () => {
      const values = Object.fromEntries(
        Array.from(content.querySelectorAll("[data-field]")).map((field) => [field.dataset.field, field.value])
      );
      const expected = {
        source: "reports-final",
        mask: "final",
        validation: "full",
        output: "archive",
        schedule: "evening"
      };
      const wrong = Object.keys(expected).filter((key) => values[key] !== expected[key]);
      configured = wrong.length === 0;
      tested = false;
      submit.disabled = true;
      tests.hidden = !configured;
      status.textContent = configured
        ? "Конфигурация принята. Запустите контрольные тесты."
        : `Неверных параметров: ${wrong.length}. Проверьте источник, маску, валидацию, архив и время запуска.`;
      content.querySelectorAll("[data-test]").forEach((item) => {
        item.textContent = "ожидание";
        item.className = "";
      });
      content.querySelector("[data-test-summary]").textContent = "не запускались";
    });

    runTests.addEventListener("click", () => {
      if (!configured) return;
      const outcomes = {
        valid: ["принят", "passed"],
        draft: ["отклонён", "passed"],
        mismatch: ["отклонён", "passed"]
      };
      Object.entries(outcomes).forEach(([id, [label, className]]) => {
        const cell = content.querySelector(`[data-test="${id}"]`);
        cell.textContent = label;
        cell.className = className;
      });
      tested = true;
      content.querySelector("[data-test-summary]").textContent = "3 из 3 успешно";
      submit.disabled = false;
    });

    submit.addEventListener("click", () => {
      if (!configured || !tested) return;
      const player = playerName();
      commitViaButton(sourceButton, {
        id: "thu-report-automation-ready",
        name: "Автоматизация_отчётов_готово.zip",
        type: "Архив рабочего проекта",
        icon: "archive",
        content: [
          "ПРОЕКТ АВТОМАТИЗАЦИИ ОТЧЁТОВ",
          `Автор: ${player}`,
          "",
          "Источник: /shared/reports/final",
          "Маска: *_финал.xlsx",
          "Проверка: сверка итогов, запрет черновиков",
          "Архив: /shared/archive/monthly",
          "Запуск: 18:30",
          "",
          "ТЕСТЫ",
          "Финальный корректный файл: принят",
          "Черновик: отклонён",
          "Расхождение итогов: отклонено"
        ].join("\n")
      }, "Рабочий прототип передан начальнику.");
    });
  }

  function readGameState() {
    try {
      const key = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  }

  function evidenceItems() {
    const state = readGameState();
    const flags = state.flags || {};
    const inventory = new Set(state.inventory || []);
    const workflowFiles = new Set((root.UntilFridayWorkflow?.getState?.().files || []).map((file) => file.id));
    const items = [];

    if (flags.sawVacancy) {
      items.push({
        id: "vacancy",
        title: "Проект вакансии",
        strength: "косвенно",
        risk: "низкий",
        body: "Открыта вакансия с названием вашей должности, но причина открытия позиции не указана."
      });
    }
    if (flags.sawBadgeDeactivation || inventory.has("badge-list")) {
      items.push({
        id: "badge",
        title: "Очередь деактивации пропусков",
        strength: "средне",
        risk: "средний",
        body: "В очереди есть обезличенная запись с отключением доступа в пятницу в 18:00."
      });
    }
    if (flags.invoiceEscalated || inventory.has("invoice-copy")) {
      items.push({
        id: "invoice",
        title: "Счёт №7814",
        strength: "слабо",
        risk: "низкий",
        body: "В счёте была завышенная сумма. Начальник назвал её обычной опечаткой."
      });
    }
    if (inventory.has("payment-list") || workflowFiles.has("mail-invoice-copy")) {
      items.push({
        id: "payments",
        title: "Список платежей",
        strength: "средне",
        risk: "высокий",
        body: "Служебная копия финансовых операций показывает цепочку согласования, но не доказывает цель кадрового решения."
      });
    }
    if (inventory.has("hr-order-draft") || workflowFiles.has("wed-hr-draft-composite")) {
      items.push({
        id: "hr",
        title: "Черновик кадрового приказа",
        strength: "сильно",
        risk: "высокий",
        body: "Документ касается отдела сопровождения, пятницы и последующего замещения позиции. Фамилия скрыта."
      });
    }
    if (flags.heardMultiplePeopleRumor) {
      items.push({
        id: "rumor",
        title: "Сообщение Димы",
        strength: "слух",
        risk: "средний",
        body: "Дима считает, что документы могут готовить не на одного человека, но сам не уверен."
      });
    }

    items.push({
      id: "calendar",
      title: "Приглашение директора",
      strength: "факт",
      risk: "низкий",
      body: "На пятницу назначена встреча с директором и сотрудником отдела кадров."
    });

    if (items.length < 2) {
      items.push({
        id: "week-log",
        title: "Хронология недели",
        strength: "контекст",
        risk: "низкий",
        body: "Сводка писем, изменений доступа и рабочих событий без прямого указания фамилии."
      });
    }
    return items;
  }

  function openCaseBuilder(sourceButton) {
    const win = createWindow("Материалы к пятничной встрече", "case", "Личный архив · шифрование не скрывает факт создания файла");
    if (!win) return;
    const content = win.querySelector(".thursday-minigame-content");
    const items = evidenceItems();
    const selected = new Set();

    content.innerHTML = `
      <div class="thursday-heading">
        <strong>Соберите связное досье</strong>
        <p>Выберите минимум два материала. Слухи и косвенные признаки не становятся доказательствами только из-за количества.</p>
      </div>
      <div class="case-builder-layout">
        <div class="case-evidence-list" data-list></div>
        <section class="case-preview">
          <label>Цель подготовки
            <select data-goal>
              <option value="">Выберите цель</option>
              <option value="questions">Задать директору конкретные вопросы</option>
              <option value="written">Потребовать письменное объяснение решения</option>
              <option value="pressure">Использовать материалы для давления</option>
            </select>
          </label>
          <div data-summary>Выбрано материалов: 0</div>
          <button type="button" class="action-button" data-build disabled>Создать зашифрованный архив</button>
        </section>
      </div>`;

    const list = content.querySelector("[data-list]");
    const goal = content.querySelector("[data-goal]");
    const summary = content.querySelector("[data-summary]");
    const build = content.querySelector("[data-build]");

    function refresh() {
      const strong = items.filter((item) => selected.has(item.id) && ["сильно", "средне", "факт"].includes(item.strength)).length;
      summary.textContent = `Выбрано материалов: ${selected.size}. Более надёжных: ${strong}.`;
      build.disabled = selected.size < 2 || !goal.value;
    }

    items.forEach((item) => {
      const label = document.createElement("label");
      label.className = "case-evidence-card";
      label.innerHTML = `
        <input type="checkbox">
        <span><strong></strong><small></small></span>
        <p></p>
        <em></em>`;
      label.querySelector("strong").textContent = item.title;
      label.querySelector("small").textContent = `Сила: ${item.strength}`;
      label.querySelector("p").textContent = item.body;
      label.querySelector("em").textContent = `Риск хранения: ${item.risk}`;
      label.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) selected.add(item.id);
        else selected.delete(item.id);
        label.classList.toggle("selected", event.target.checked);
        refresh();
      });
      list.appendChild(label);
    });

    goal.addEventListener("change", refresh);
    build.addEventListener("click", () => {
      const chosen = items.filter((item) => selected.has(item.id));
      const goals = {
        questions: "Задать директору конкретные вопросы",
        written: "Потребовать письменное объяснение решения",
        pressure: "Использовать материалы для давления"
      };
      const body = [
        "МАТЕРИАЛЫ К ПЯТНИЧНОЙ ВСТРЕЧЕ",
        `Подготовил: ${playerName()}`,
        `Цель: ${goals[goal.value]}`,
        "",
        ...chosen.flatMap((item, index) => [
          `${index + 1}. ${item.title}`,
          `Оценка: ${item.strength}; риск: ${item.risk}`,
          item.body,
          ""
        ]),
        "Примечание: ни один документ не содержит открытой фамилии сотрудника, которого касается решение."
      ].join("\n");
      commitViaButton(sourceButton, {
        id: "thu-friday-case-archive",
        name: "Материалы_к_пятнице.enc",
        type: "Зашифрованный архив",
        icon: "protectedArchive",
        content: body
      }, "Зашифрованный архив создан в личной папке.");
    });
  }

  function openResignationDraft(sourceButton) {
    const win = createWindow("Редактор — заявление", "resign", "Локальный черновик · отдел кадров документ не получит");
    if (!win) return;
    const content = win.querySelector(".thursday-minigame-content");
    const player = playerName();

    content.innerHTML = `
      <div class="resignation-paper">
        <header>
          <span>Директору ООО «Контур-Сервис»</span>
          <span>от <strong data-name></strong></span>
        </header>
        <h2>ЗАЯВЛЕНИЕ</h2>
        <p>Прошу уволить меня по собственному желанию после передачи текущих дел.</p>
        <label>Формулировка причины
          <select data-reason>
            <option value="">Выберите формулировку</option>
            <option value="personal">По личным обстоятельствам</option>
            <option value="conditions">В связи с изменением условий работы</option>
            <option value="trust">В связи с утратой доверия к работодателю</option>
            <option value="none">Без указания причины</option>
          </select>
        </label>
        <label class="resignation-check">
          <input type="checkbox" data-draft>
          <span>Сохранить только черновик и не отправлять до пятничной встречи</span>
        </label>
        <footer>
          <span>Дата: 6 августа</span>
          <span>Подпись: <button type="button" data-sign>подписать</button></span>
        </footer>
      </div>
      <div class="resignation-actions">
        <span data-status>Документ не подписан.</span>
        <button type="button" class="action-button" data-save disabled>Сохранить черновик</button>
      </div>`;

    content.querySelector("[data-name]").textContent = player;
    const reason = content.querySelector("[data-reason]");
    const draft = content.querySelector("[data-draft]");
    const sign = content.querySelector("[data-sign]");
    const status = content.querySelector("[data-status]");
    const save = content.querySelector("[data-save]");
    let signed = false;

    function refresh() {
      save.disabled = !signed || !draft.checked || !reason.value;
    }

    sign.addEventListener("click", () => {
      signed = true;
      sign.textContent = player;
      sign.disabled = true;
      status.textContent = "Черновик подписан локальной подписью.";
      refresh();
    });
    reason.addEventListener("change", refresh);
    draft.addEventListener("change", refresh);

    save.addEventListener("click", () => {
      const reasons = {
        personal: "по личным обстоятельствам",
        conditions: "в связи с изменением условий работы",
        trust: "в связи с утратой доверия к работодателю",
        none: "без указания причины"
      };
      commitViaButton(sourceButton, {
        id: "thu-resignation-draft",
        name: "Заявление_по_собственному_черновик.txt",
        type: "Подписанный черновик",
        icon: "text",
        content: [
          "Директору ООО «Контур-Сервис»",
          `от ${player}`,
          "",
          "ЗАЯВЛЕНИЕ",
          "",
          "Прошу уволить меня по собственному желанию после передачи текущих дел.",
          `Причина: ${reasons[reason.value]}.`,
          "",
          "Дата: 6 августа",
          `Подпись: ${player}`,
          "",
          "СТАТУС: ЧЕРНОВИК. НЕ ОТПРАВЛЕНО."
        ].join("\n")
      }, "Черновик заявления сохранён. Отдел кадров его не получил.");
    });
  }

  function openComplaintBuilder(sourceButton) {
    const win = createWindow("Служебная жалоба — спорный платёж", "complaint", "Операция необратима после отправки");
    if (!win) return;
    const content = win.querySelector(".thursday-minigame-content");
    let selectedAuthor = "";
    let acknowledged = false;

    content.innerHTML = `
      <div class="thursday-heading danger">
        <strong>Запись платежа №7814</strong>
        <p>Серверная выписка не содержит прямого подтверждения, что спорную сумму ввёл Андрей Соколов.</p>
      </div>
      <table class="complaint-record-table">
        <tbody>
          <tr><th>Документ</th><td>Счёт №7814</td></tr>
          <tr><th>Исходная учётная запись</th><td>ACCOUNTING-SVC</td></tr>
          <tr><th>Согласование начальника</th><td>ASOKOLOV · просмотрено</td></tr>
          <tr><th>Подтверждённый автор суммы</th><td>не определён</td></tr>
        </tbody>
      </table>
      <fieldset class="complaint-author-choice">
        <legend>Кого указать автором спорной операции</legend>
        <label><input type="radio" name="author" value="service"> ACCOUNTING-SVC, как в исходной записи</label>
        <label><input type="radio" name="author" value="chief"> Андрей Соколов, начальник отдела</label>
      </fieldset>
      <label class="complaint-warning">
        <input type="checkbox" data-ack>
        <span>Я понимаю, что серверная выписка не подтверждает авторство начальника, а подмена будет зарегистрирована.</span>
      </label>
      <label>Получатель
        <select data-recipient>
          <option value="">Выберите получателя</option>
          <option value="security">Служба безопасности</option>
          <option value="director">Директор</option>
        </select>
      </label>
      <div class="complaint-actions">
        <span data-status>Для сюжетного действия нужно сознательно указать начальника.</span>
        <button type="button" class="action-button danger-button" data-send disabled>Подменить запись и отправить жалобу</button>
      </div>`;

    const ack = content.querySelector("[data-ack]");
    const recipient = content.querySelector("[data-recipient]");
    const send = content.querySelector("[data-send]");
    const status = content.querySelector("[data-status]");

    function refresh() {
      acknowledged = ack.checked;
      send.disabled = selectedAuthor !== "chief" || !acknowledged || !recipient.value;
      status.textContent = selectedAuthor === "service"
        ? "Исходная запись не позволяет выполнить действие «подставить начальника»."
        : "Подмена автора создаст дополнительную запись аудита.";
    }

    content.querySelectorAll('input[name="author"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        selectedAuthor = radio.value;
        refresh();
      });
    });
    ack.addEventListener("change", refresh);
    recipient.addEventListener("change", refresh);

    send.addEventListener("click", () => {
      if (selectedAuthor !== "chief" || !acknowledged || !recipient.value) return;
      const recipients = { security: "Служба безопасности", director: "Директор" };
      commitViaButton(sourceButton, {
        id: "thu-chief-complaint",
        name: "Жалоба_на_Андрея_Соколова.txt",
        type: "Отправленная служебная жалоба",
        icon: "protected",
        content: [
          `Отправитель: ${playerName()}`,
          `Получатель: ${recipients[recipient.value]}`,
          "Тема: спорный платёж №7814",
          "",
          "В приложенной записи автором изменения суммы указан Андрей Соколов.",
          "Прошу провести проверку его действий и цепочки согласования.",
          "",
          "СИСТЕМНАЯ ПОМЕТКА:",
          "Исходная запись: ACCOUNTING-SVC.",
          "Автор в копии жалобы: ASOKOLOV.",
          "Подмена выполнена пользователем перед отправкой."
        ].join("\n")
      }, "Жалоба отправлена. Служба безопасности начала сверку серверной копии.");
    });
  }

  function playerName() {
    return root.UntilFridayProfile?.playerName?.() || "Сотрудник";
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
      notify("Четверг", successText);
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
    toast.innerHTML = "<strong></strong><span></span>";
    toast.querySelector("strong").textContent = title;
    toast.querySelector("span").textContent = text;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 5500);
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

  root.UntilFridayThursdayMinigames = {
    labels: LABELS,
    extendThursdayStory,
    openProjectBuilder,
    openCaseBuilder,
    openResignationDraft,
    openComplaintBuilder,
    evidenceItems
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
