(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayFridayFinale) return;

  const SCENE_KEY = "until-friday-friday-scene-v1";
  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const ACTIONS = {
    calm: { id: "fri-meeting-calm", label: "Спокойно выслушать директора", button: "Сесть и выслушать" },
    work: { id: "fri-meeting-work", label: "Сразу показать результаты недели", button: "Положить на стол рабочий проект" },
    blackmail: { id: "fri-meeting-blackmail", label: "Предъявить компромат", button: "Положить на стол зашифрованный архив" },
    resignation: { id: "fri-send-resignation", label: "Подать заявление первым", button: "Передать заявление до начала разговора" }
  };

  const TRUTHS = {
    player: {
      title: "Решение касалось вашей должности",
      director: "Разговор, который вы услышали, действительно был о вашей позиции. Документы подготовили ещё до вашего возвращения из отпуска.",
      hr: "Фамилию не внесли в черновик до личной встречи. Уведомление планировали вручить сегодня.",
      fact: "К кадровому решению изначально готовили игрока."
    },
    newcomer: {
      title: "Документы готовили не на вас",
      director: "Разговор относился к Кириллу, новому сотруднику отдела. Его испытательный срок решили не продлевать.",
      hr: "В доступных вам копиях фамилия отсутствовала, потому что приказ ещё проходил согласование.",
      fact: "К увольнению готовили молодого сотрудника Кирилла."
    },
    department: {
      title: "Речь шла обо всём отделе",
      director: "Компания передаёт сопровождение внешнему подрядчику. В пятницу должны были объявить решение всему отделу.",
      hr: "Штатные единицы временно сохраняются только на период передачи дел. Затем структура отдела изменится.",
      fact: "Компания планировала сокращение и передачу всего отдела подрядчику."
    },
    contractor: {
      title: "Разговор вообще не касался сотрудников",
      director: "Мы обсуждали подрядчика, который обслуживал резервный канал. В пятницу ему должны были сообщить о расторжении договора.",
      hr: "Кадровый отдел участвовал только потому, что часть пропусков и доступов оформлена на сотрудников подрядчика.",
      fact: "Разговор относился к подрядчику, а не к сотруднику компании."
    }
  };

  const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];
  let queued = false;
  let meetingOverlay = null;
  let endingUpgraded = false;

  function readSave() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function readScene() {
    try {
      return JSON.parse(localStorage.getItem(SCENE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeScene(patch) {
    const next = { ...readScene(), ...patch, updatedAt: new Date().toISOString() };
    localStorage.setItem(SCENE_KEY, JSON.stringify(next));
    return next;
  }

  function playerName() {
    return root.UntilFridayProfile?.playerName?.() || readScene().playerName || "Сотрудник";
  }

  function textOf(element) {
    return element?.textContent?.trim() || "";
  }

  function findCardByLabel(list, label) {
    return Array.from(list.querySelectorAll(":scope > .task-card")).find((card) => textOf(card.querySelector("h3")) === label) || null;
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      document.querySelectorAll(".task-list").forEach(decorateMeetingTask);
      upgradeEndingOverlay();
    });
  }

  function decorateMeetingTask(list) {
    const available = Object.entries(ACTIONS)
      .map(([route, definition]) => {
        const card = findCardByLabel(list, definition.label);
        const button = card?.querySelector(".action-button") || null;
        return card && button ? { route, definition, card, button } : null;
      })
      .filter(Boolean);

    if (!available.length) return;
    available.forEach((item) => { item.card.hidden = true; });
    if (list.querySelector("[data-friday-meeting-launcher]")) return;

    const state = readSave();
    const warning = fridayWarning(state);
    const card = document.createElement("article");
    card.className = "task-card friday-meeting-launcher";
    card.dataset.fridayMeetingLauncher = "true";
    card.innerHTML = `
      <header><h3>Встреча в переговорной №1</h3><span>17:00</span></header>
      <div class="task-body">
        <p></p>
        <div class="friday-meeting-preview">
          <span>Директор</span><span>Сотрудник отдела кадров</span><span>Вы</span>
        </div>
        <div class="action-row"><button class="action-button" type="button">Войти в переговорную</button></div>
      </div>`;
    card.querySelector("p").textContent = warning;
    card.querySelector("button").addEventListener("click", () => openMeeting(available));
    list.insertBefore(card, available[0].card);
  }

  function fridayWarning(state) {
    const flags = state.flags || {};
    if (flags.complaintUnderReview || flags.chiefFramed) {
      return "В кабинете уже лежат материалы службы безопасности по вашей жалобе. Обычным кадровым разговором встреча не ограничится.";
    }
    if (flags.tamperedLogs || flags.auditServerCopyFound) {
      return "Проверка журнала ещё не закрыта. На встрече могут поднять вопрос о доступе к закрытым разделам.";
    }
    if (flags.projectFinished) {
      return "Рабочий прототип принят начальником отдела. Его можно официально представить директору.";
    }
    return "Директор и сотрудник отдела кадров уже внутри. Причина встречи по-прежнему не указана.";
  }

  function openMeeting(available) {
    meetingOverlay?.remove();
    const state = readSave();
    const scene = writeScene({
      started: true,
      playerName: playerName(),
      seed: state.seed || "unknown",
      truthId: state.truthId || "player",
      startedAt: new Date().toISOString()
    });

    const overlay = document.createElement("div");
    overlay.className = "friday-scene-overlay";
    overlay.innerHTML = `
      <section class="friday-scene" role="dialog" aria-modal="true" aria-label="Встреча с директором">
        <header class="friday-scene-header">
          <div><span>Пятница</span><strong>17:00 · Переговорная №1</strong></div>
          <button type="button" data-close aria-label="Вернуться к рабочему столу">×</button>
        </header>
        <div class="friday-room">
          <div class="friday-person director"><span>Д</span><strong>Директор</strong></div>
          <div class="friday-table"><div class="friday-folder"></div><div class="friday-recorder"></div></div>
          <div class="friday-person hr"><span>К</span><strong>Отдел кадров</strong></div>
        </div>
        <main class="friday-dialogue" data-dialogue></main>
        <footer class="friday-choices" data-choices></footer>
      </section>`;
    document.body.appendChild(overlay);
    meetingOverlay = overlay;
    overlay.querySelector("[data-close]").addEventListener("click", () => {
      meetingOverlay = null;
      overlay.remove();
    });

    const dialogue = overlay.querySelector("[data-dialogue]");
    const choices = overlay.querySelector("[data-choices]");
    renderOpening(dialogue, choices, available, scene);
  }

  function renderOpening(dialogue, choices, available, scene) {
    const state = readSave();
    const lines = [
      ["Секретарь", "Дверь за спиной закрывается. На столе лежит тонкая папка без подписи."],
      ["Директор", `${scene.playerName}, садитесь. Разговор будет зарегистрирован как кадровая встреча.`]
    ];

    if (state.flags?.complaintUnderReview || state.flags?.chiefFramed) {
      lines.push(["Директор", "До начала кадровой части: служба безопасности получила жалобу на Андрея Соколова. В журнале есть расхождения, которые придётся объяснить."]);
    } else if (state.flags?.tamperedLogs || state.flags?.auditServerCopyFound) {
      lines.push(["Сотрудник отдела кадров", "К материалам встречи приложена служебная отметка о несовпадении локального и серверного журналов."]);
    } else if (state.flags?.projectAcknowledged || state.flags?.projectFinished) {
      lines.push(["Директор", "Андрей передал мне ваш прототип автоматизации. К нему вернёмся после основной части."]);
    } else {
      lines.push(["Директор", "Сначала я объясню, почему встреча назначена именно сегодня."]);
    }

    renderLines(dialogue, lines);
    choices.replaceChildren();
    available.forEach(({ route, definition, button }) => {
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = `friday-choice route-${route}`;
      choice.innerHTML = `<strong></strong><span></span>`;
      choice.querySelector("strong").textContent = definition.button;
      choice.querySelector("span").textContent = routeDescription(route);
      choice.addEventListener("click", () => performMeetingRoute(route, button, dialogue, choices));
      choices.appendChild(choice);
    });
  }

  function routeDescription(route) {
    const descriptions = {
      calm: "Не перебивать и сначала узнать, о ком шёл разговор.",
      work: "Начать с результатов недели и рабочего прототипа.",
      blackmail: "Сразу показать собранные документы и потребовать объяснений.",
      resignation: "Не ждать объявления решения и первым передать заявление."
    };
    return descriptions[route] || "";
  }

  function performMeetingRoute(route, sourceButton, dialogue, choices) {
    choices.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    sourceButton.click();

    window.setTimeout(() => {
      const state = readSave();
      if (!state.completedActions?.[ACTIONS[route].id]) {
        choices.querySelectorAll("button").forEach((button) => { button.disabled = false; });
        const warning = document.createElement("p");
        warning.className = "friday-scene-warning";
        warning.textContent = "Этот вариант сейчас недоступен. Проверьте условия и сохранённые материалы.";
        choices.prepend(warning);
        return;
      }

      const scene = writeScene({ route, routeActionId: ACTIONS[route].id, routeAt: new Date().toISOString() });
      renderRouteResult(dialogue, choices, route, state, scene);
    }, 160);
  }

  function renderRouteResult(dialogue, choices, route, state, scene) {
    const lines = routeOpeningLines(route, state, scene.playerName);
    const truth = TRUTHS[state.truthId] || TRUTHS.player;
    lines.push(["Директор", truth.director]);
    lines.push(["Сотрудник отдела кадров", truth.hr]);

    const consequence = routeConsequence(route, state);
    if (consequence) lines.push(consequence);
    const colleague = colleagueConsequence(state);
    if (colleague) lines.push(colleague);

    renderLines(dialogue, lines);
    choices.replaceChildren();

    const truthCard = document.createElement("section");
    truthCard.className = "friday-truth-card";
    truthCard.innerHTML = `<span>Что означал разговор</span><strong></strong><p></p>`;
    truthCard.querySelector("strong").textContent = truth.title;
    truthCard.querySelector("p").textContent = truth.fact;
    choices.appendChild(truthCard);

    const followUps = truthFollowUps(state.truthId, route);
    followUps.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "friday-follow-up";
      button.textContent = item.label;
      button.addEventListener("click", () => renderFollowUp(dialogue, choices, item, state));
      choices.appendChild(button);
    });
  }

  function routeOpeningLines(route, state, name) {
    if (route === "work") {
      return [
        [name, "Прежде чем вы объявите решение, я хочу показать, что было сделано за эту неделю."],
        ["Директор", state.flags?.projectFinished
          ? "Я вижу результаты тестирования и рабочую конфигурацию. Это конкретный результат, а не обещание."
          : "Результаты учтём, но они не отменяют причину сегодняшней встречи."]
      ];
    }
    if (route === "blackmail") {
      return [
        [name, "У меня есть копии документов. Сначала я хочу услышать прямой ответ."],
        ["Директор", "Вы принесли внутренние документы на кадровую встречу. Это серьёзно меняет характер разговора."]
      ];
    }
    if (route === "resignation") {
      return [
        [name, "До того как вы начнёте: у меня с собой заявление по собственному желанию."],
        ["Сотрудник отдела кадров", "Документ принимается только после регистрации. Сначала вы всё равно услышите причину встречи."]
      ];
    }
    return [
      [name, "Я слушаю."],
      ["Директор", "Хорошо. Тогда без догадок и обходных формулировок."]
    ];
  }

  function routeConsequence(route, state) {
    const truthId = state.truthId;
    if (route === "work" && state.flags?.projectFinished) {
      if (truthId === "player" && Number(state.stats?.work || 0) >= 8 && Number(state.stats?.suspicion || 0) < 5) {
        return ["Директор", "С учётом результатов недели я готов остановить решение и дать отделу месяц на внедрение проекта."];
      }
      if (truthId === "department") {
        return ["Директор", "Проект полезен для передачи дел. Но решение по структуре отдела утверждено на уровне компании."];
      }
      return ["Директор", "Работа принята. Она будет учтена отдельно от кадрового решения."];
    }
    if (route === "blackmail") {
      if (Number(state.stats?.evidence || 0) >= 5 && Number(state.stats?.suspicion || 0) < 8) {
        return ["Директор", "Часть материалов действительно требует отдельной проверки. Мы обсудим условия передачи копий официально."];
      }
      return ["Директор", "В этих документах много косвенных признаков, но почти нет доказательств. Зато их копирование хорошо видно в журнале."];
    }
    if (route === "resignation") {
      return ["Сотрудник отдела кадров", "После встречи вы сможете зарегистрировать заявление. До этого момента оно остаётся вашей инициативой, а не решением компании."];
    }
    return null;
  }

  function colleagueConsequence(state) {
    if (state.flags?.chiefFramed || state.flags?.complaintUnderReview) {
      return ["Директор", "По жалобе на Андрея идёт отдельная проверка. Серверный журнал пока не подтверждает указанное вами авторство операции."];
    }
    if (state.flags?.blamedFriend || state.flags?.dimaConfrontedPlayer) {
      return ["Директор", "Дмитрия Орлова уже опросили. Ваши объяснения расходятся в нескольких деталях, и это останется в служебной записи."];
    }
    if (state.flags?.auditClosedHonestly) {
      return ["Директор", "Служба безопасности закрыла запрос после вашего прямого объяснения. Этот вопрос не входит в кадровое решение."];
    }
    return null;
  }

  function truthFollowUps(truthId, route) {
    const common = [{ id: "finish", label: "Закончить встречу" }];
    const byTruth = {
      player: [
        { id: "grounds", label: "Попросить назвать основание решения" },
        { id: "written", label: "Потребовать письменную копию документов" }
      ],
      newcomer: [
        { id: "kirill", label: "Спросить, знает ли Кирилл" },
        { id: "privacy", label: "Признать, что вывод был сделан без доказательств" }
      ],
      department: [
        { id: "timeline", label: "Уточнить сроки передачи отдела" },
        { id: "team", label: "Спросить, что будет с коллегами" }
      ],
      contractor: [
        { id: "access", label: "Спросить, почему менялись пропуска" },
        { id: "mistake", label: "Признать, что разговор был истолкован неверно" }
      ]
    };
    const items = [...(byTruth[truthId] || [])];
    if (route === "blackmail") items.unshift({ id: "archive", label: "Потребовать ответ по каждому документу" });
    if (route === "work") items.unshift({ id: "project", label: "Спросить, повлиял ли проект на решение" });
    if (route === "resignation") items.unshift({ id: "register", label: "Подтвердить подачу заявления" });
    return [...items.slice(0, 3), ...common];
  }

  function renderFollowUp(dialogue, choices, item, state) {
    if (item.id === "finish") {
      writeScene({ followUp: "none", meetingFinishedAt: new Date().toISOString() });
      renderMeetingClose(dialogue, choices, state);
      return;
    }

    const responses = {
      grounds: ["Сотрудник отдела кадров", "Основание указано в уведомлении: изменение требований к позиции и результаты предыдущего периода. Вы сможете приложить письменные возражения."],
      written: ["Сотрудник отдела кадров", "После регистрации вам выдадут копию уведомления и лист передачи дел."],
      kirill: ["Директор", "Нет. Разговор с ним назначен после вашего. Мы не обсуждаем его документы подробнее."],
      privacy: ["Директор", "Это было бы точным выводом. Остальное теперь зависит от последствий ваших действий за неделю."],
      timeline: ["Директор", "Передача начинается в понедельник и займёт шесть недель. До этого отдел продолжает работу в обычном режиме."],
      team: ["Сотрудник отдела кадров", "Часть сотрудников получит предложения от подрядчика, часть переведут во внутреннюю поддержку."],
      access: ["Сотрудник отдела кадров", "В списке были пропуска подрядчика и временные карты. Обезличенная запись не относилась к вам."],
      mistake: ["Директор", "Сам разговор не был угрозой. Но доступ к документам и отношения с коллегами теперь имеют реальные последствия."],
      archive: ["Директор", "Мы примем официальный перечень файлов. Но происхождение каждой копии также будет проверено."],
      project: ["Директор", state.truthId === "player" && Number(state.stats?.work || 0) >= 8
        ? "Да. Без проекта решение осталось бы окончательным. Сейчас оно как минимум приостановлено."
        : "Проект повлиял на оценку вашей работы, но не изменил исходную причину встречи."],
      register: ["Сотрудник отдела кадров", "Подтвердите решение после окончания встречи. Тогда заявление будет зарегистрировано сегодняшней датой."]
    };

    const response = responses[item.id] || ["Директор", "Ответ будет приложен к протоколу встречи."];
    appendLine(dialogue, playerName(), item.label);
    appendLine(dialogue, response[0], response[1]);
    writeScene({ followUp: item.id });
    renderMeetingClose(dialogue, choices, state);
  }

  function renderMeetingClose(dialogue, choices, state) {
    choices.replaceChildren();
    const finalLine = endingPreview(state);
    appendLine(dialogue, finalLine[0], finalLine[1]);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "friday-finish-button";
    button.textContent = "Закрыть рабочую неделю";
    button.addEventListener("click", finalizeFriday);
    choices.appendChild(button);
  }

  function endingPreview(state) {
    if (state.flags?.resignationPrepared && readScene().route === "resignation") {
      return ["Сотрудник отдела кадров", "Заявление будет зарегистрировано после выхода из переговорной."];
    }
    if (state.flags?.chiefFramed || Number(state.stats?.suspicion || 0) >= 8) {
      return ["Директор", "Кадровая часть закончена. Дальше разговор продолжит служба безопасности."];
    }
    if (state.truthId === "player") return ["Директор", "Решение и ваши материалы будут оформлены сегодня до конца рабочего дня."];
    return ["Директор", "Встреча окончена. Вернитесь на рабочее место и закройте текущий сеанс."];
  }

  function finalizeFriday() {
    writeScene({ completed: true, completedAt: new Date().toISOString() });
    meetingOverlay?.remove();
    meetingOverlay = null;
    document.querySelector("#clock")?.click();
    window.setTimeout(() => {
      document.querySelector(".modal-overlay [data-confirm]")?.click();
    }, 80);
  }

  function renderLines(container, lines) {
    container.replaceChildren();
    lines.forEach(([speaker, text]) => appendLine(container, speaker, text));
  }

  function appendLine(container, speaker, text) {
    const article = document.createElement("article");
    article.className = "friday-dialogue-line";
    article.innerHTML = `<strong></strong><p></p>`;
    article.querySelector("strong").textContent = speaker;
    article.querySelector("p").textContent = text;
    container.appendChild(article);
    container.scrollTop = container.scrollHeight;
  }

  function upgradeEndingOverlay() {
    const overlay = document.querySelector(".ending-overlay");
    if (!overlay || overlay.dataset.fridayUpgraded === "true" || endingUpgraded) return;
    const state = readSave();
    if (!state.ended) return;

    endingUpgraded = true;
    overlay.dataset.fridayUpgraded = "true";
    const ending = endingDefinition(state.endingId);
    const scene = readScene();
    const truth = TRUTHS[state.truthId] || TRUTHS.player;
    const name = playerName();
    const endingText = endingNarrative(state.endingId, name);
    const timeline = buildTimeline(state);
    const consequences = buildConsequences(state);

    overlay.className = "friday-ending-overlay";
    overlay.innerHTML = `
      <section class="friday-ending-card">
        <header class="friday-ending-header">
          <div><span>До пятницы</span><h1></h1></div>
          <p></p>
        </header>
        <nav class="friday-ending-tabs" aria-label="Итоги прохождения">
          <button type="button" class="selected" data-tab="result">Итог</button>
          <button type="button" data-tab="timeline">Хронология</button>
          <button type="button" data-tab="consequences">Последствия</button>
          <button type="button" data-tab="credits">Титры</button>
        </nav>
        <main class="friday-ending-body">
          <section data-panel="result">
            <div class="friday-ending-truth"><span>Что означал разговор</span><strong></strong><p></p></div>
            <div class="friday-ending-route"><span>Позиция на встрече</span><strong></strong></div>
            <div class="friday-ending-summary"></div>
          </section>
          <section data-panel="timeline" hidden><div class="friday-timeline"></div></section>
          <section data-panel="consequences" hidden><div class="friday-consequences"></div></section>
          <section data-panel="credits" hidden>
            <div class="friday-credits">
              <img src="assets/icon-until-friday.png" alt="" />
              <h2>До пятницы</h2>
              <p>Концепция, сценарий и разработка: Deenfoool</p>
              <p>Прототип создан как самостоятельная браузерная игра.</p>
              <hr />
              <p>Все компании, системы, документы и персонажи вымышлены. Любые совпадения случайны.</p>
              <p>Спасибо за прохождение.</p>
            </div>
          </section>
        </main>
        <footer class="friday-ending-actions">
          <button type="button" data-journal>Открыть журнал</button>
          <button type="button" data-restart>Начать новую неделю</button>
        </footer>
      </section>`;

    overlay.querySelector("h1").textContent = ending?.title || "Неделя завершена";
    overlay.querySelector(".friday-ending-header > p").textContent = endingText;
    overlay.querySelector(".friday-ending-truth strong").textContent = truth.title;
    overlay.querySelector(".friday-ending-truth p").textContent = truth.fact;
    overlay.querySelector(".friday-ending-route strong").textContent = routeTitle(scene.route);
    overlay.querySelector(".friday-ending-summary").append(...summaryCards(state));

    const timelineRoot = overlay.querySelector(".friday-timeline");
    timeline.forEach((item) => timelineRoot.appendChild(timelineElement(item)));
    const consequenceRoot = overlay.querySelector(".friday-consequences");
    consequences.forEach((item) => consequenceRoot.appendChild(consequenceElement(item)));

    overlay.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        overlay.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("selected", item === button));
        overlay.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== button.dataset.tab; });
      });
    });
    overlay.querySelector("[data-journal]").addEventListener("click", () => {
      overlay.remove();
      document.querySelector('[data-app="journal"]')?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    overlay.querySelector("[data-restart]").addEventListener("click", () => {
      localStorage.removeItem(SCENE_KEY);
      document.querySelector("#reset-button")?.click();
    });

    saveFinalReport(state, ending, truth, timeline, consequences, scene);
  }

  function endingDefinition(id) {
    const endings = Array.isArray(Story.endings) ? Story.endings : Object.values(Story.endings || {});
    return endings.find((item) => item.id === id) || Story.fallbackEnding || null;
  }

  function endingNarrative(id, name) {
    const texts = {
      "voluntary-exit": "Заявление было подано до того, как директор объявил решение. Так и осталось неизвестно, изменилось бы что-нибудь без этого шага.",
      caught: "Вместо кадрового разговора встреча превратилась в разбор доступа к закрытым документам. Действия этой недели стали самостоятельным основанием для увольнения.",
      "blackmail-deal": "Собранных материалов хватило, чтобы добиться отдельного соглашения. Компания получила копии, но теперь знает, каким способом они были собраны.",
      "saved-by-work": "Решение пересмотрели после демонстрации результатов недели. Работа сохранена, хотя прежнего доверия к офису уже нет.",
      "fired-clean": "Рабочие результаты признали, но кадровое решение было утверждено раньше. Осталось спокойно передать дела и получить документы.",
      "fired-for-cause": "Первоначальное кадровое решение подтвердилось, а действия этой недели дали компании дополнительные основания не менять его.",
      "wrong-person": "Кадровое решение касалось Кирилла. Работа сохранена, но последствия паники остались в журналах и отношениях с коллегами.",
      "department-cut": "Речь шла не об одном человеке. Отдел передают подрядчику, поэтому личные достижения уже не способны отменить решение компании.",
      "false-alarm-clean": "Разговор относился к подрядчику. Работа сохранена, а ошибочное предположение не успело превратиться в настоящее нарушение.",
      "false-alarm-damage": "Разговор не касался сотрудников, но за пять дней были разрушены отношения и создана реальная причина для служебного разбирательства.",
      "ordinary-friday": "Директор объявил решение. Неделя закончилась тише, чем ожидалось, но прежним офис уже не кажется."
    };
    return texts[id] || `Рабочая неделя для ${name} завершена.`;
  }

  function routeTitle(route) {
    const titles = {
      calm: "Сначала выслушать руководство",
      work: "Представить результаты недели",
      blackmail: "Предъявить собранные материалы",
      resignation: "Подать заявление первым"
    };
    return titles[route] || "Спокойно завершить разговор";
  }

  function buildTimeline(state) {
    const completed = Object.entries(state.completedActions || {})
      .map(([id, data]) => ({ id, data, action: Story.actions?.[id] }))
      .filter((item) => item.action)
      .sort((a, b) => Number(a.data.dayIndex) - Number(b.data.dayIndex) || Number(a.data.minute) - Number(b.data.minute));
    return completed.map((item) => ({
      day: DAY_NAMES[item.data.dayIndex] || "День",
      time: formatTime(item.data.minute),
      title: item.action.label || item.id,
      text: item.data.result || item.action.result || "Действие выполнено."
    }));
  }

  function buildConsequences(state) {
    const flags = state.flags || {};
    const items = [];
    items.push({ title: "Работа", text: workConsequence(state) });
    items.push({ title: "Цифровой след", text: suspicionConsequence(state) });
    items.push({ title: "Дима Орлов", text: relationshipText(Number(state.trust?.friend || 0), flags.blamedFriend ? "В объяснении службе безопасности было использовано его имя." : "Отношения сохранились без открытого конфликта.") });
    items.push({ title: "Андрей Соколов", text: flags.chiefFramed ? "Жалоба стала частью проверки, но серверные данные не подтвердили подменённое авторство." : relationshipText(Number(state.trust?.chief || 0), "Начальник оценивал прежде всего рабочие результаты недели.") });
    if (flags.auditClosedHonestly) items.push({ title: "Служба безопасности", text: "Запрос был закрыт после правдивого объяснения." });
    else if (flags.tamperedLogs || flags.auditServerCopyFound) items.push({ title: "Служба безопасности", text: "Несовпадение локального и серверного журналов осталось в материалах проверки." });
    if (flags.resignationPrepared) items.push({ title: "Заявление", text: readScene().route === "resignation" ? "Черновик был предъявлен на встрече первым." : "Подписанный черновик так и остался в личной папке." });
    return items;
  }

  function workConsequence(state) {
    const work = Number(state.stats?.work || 0);
    if (work >= 8) return "Неделя завершена с сильными рабочими результатами и готовым доказательством профессиональной ценности.";
    if (work >= 4) return "Основные обязательства выполнены, но результаты не перекрывают все ошибки и пропущенные задачи.";
    return "Тревога и расследование заметно вытеснили обычную работу.";
  }

  function suspicionConsequence(state) {
    const value = Number(state.stats?.suspicion || 0);
    if (value >= 8) return "Действия игрока стали отдельным основанием для служебного разбирательства.";
    if (value >= 4) return "В журналах осталось достаточно нетипичных операций, чтобы компания продолжила проверку.";
    return "Нетипичные действия не превратились в самостоятельное нарушение.";
  }

  function relationshipText(value, fallback) {
    if (value >= 2) return "Доверие укрепилось благодаря решениям этой недели.";
    if (value <= -2) return "Доверие серьёзно повреждено и быстро не восстановится.";
    return fallback;
  }

  function summaryCards(state) {
    const values = [
      ["Рабочая позиция", Number(state.stats?.work || 0) >= 8 ? "сильная" : Number(state.stats?.work || 0) >= 4 ? "достаточная" : "слабая"],
      ["Материалы", state.flags?.casePrepared ? "подготовлены" : Number(state.stats?.evidence || 0) >= 2 ? "разрознены" : "почти отсутствуют"],
      ["Служебная проверка", Number(state.stats?.suspicion || 0) >= 8 ? "критическая" : Number(state.stats?.suspicion || 0) >= 4 ? "продолжается" : "не стала главной"],
      ["Коллеги", Number(state.stats?.collateral || 0) >= 2 ? "пострадали от решений" : "не были втянуты серьёзно"]
    ];
    return values.map(([label, value]) => {
      const card = document.createElement("div");
      card.innerHTML = `<span></span><strong></strong>`;
      card.querySelector("span").textContent = label;
      card.querySelector("strong").textContent = value;
      return card;
    });
  }

  function timelineElement(item) {
    const article = document.createElement("article");
    article.innerHTML = `<time></time><div><strong></strong><p></p></div>`;
    article.querySelector("time").textContent = `${item.day}, ${item.time}`;
    article.querySelector("strong").textContent = item.title;
    article.querySelector("p").textContent = item.text;
    return article;
  }

  function consequenceElement(item) {
    const article = document.createElement("article");
    article.innerHTML = `<strong></strong><p></p>`;
    article.querySelector("strong").textContent = item.title;
    article.querySelector("p").textContent = item.text;
    return article;
  }

  function saveFinalReport(state, ending, truth, timeline, consequences, scene) {
    const workflow = root.UntilFridayWorkflow;
    if (!workflow?.saveAttachment) return;
    const id = `final-week-report-${String(state.seed || "save").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const content = [
      "ИТОГ РАБОЧЕЙ НЕДЕЛИ",
      `Сотрудник: ${playerName()}`,
      `Финал: ${ending?.title || "Неделя завершена"}`,
      `Истинная причина встречи: ${truth.fact}`,
      `Позиция на встрече: ${routeTitle(scene.route)}`,
      "",
      "ХРОНОЛОГИЯ",
      ...timeline.map((item) => `${item.day} ${item.time} — ${item.title}: ${item.text}`),
      "",
      "ПОСЛЕДСТВИЯ",
      ...consequences.map((item) => `${item.title}: ${item.text}`),
      "",
      "Все компании, системы, документы и персонажи вымышлены."
    ].join("\n");
    workflow.saveAttachment({
      id,
      name: "Итог_рабочей_недели.txt",
      type: "Итоговый отчёт прохождения",
      icon: "text",
      content
    });
  }

  function formatTime(totalMinutes) {
    const value = Math.max(0, Number(totalMinutes) || 0);
    const hours = Math.floor(value / 60).toString().padStart(2, "0");
    const minutes = (value % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", queueDecorate, { once: true });
  window.addEventListener("until-friday-app-ready", queueDecorate);
  queueDecorate();

  root.UntilFridayFridayFinale = {
    openMeeting,
    buildTimeline,
    buildConsequences,
    upgradeEndingOverlay,
    truth: TRUTHS
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
