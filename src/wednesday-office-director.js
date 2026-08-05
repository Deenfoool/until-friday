(function (root) {
  "use strict";

  if (root.UntilFridayWednesdayOfficeDirector) return;

  const Core = root.UntilFridayOfficeDayDirector;
  const Office = root.UntilFridayOfficeWorkPack;
  if (!Core || !Office) return;

  const DAY_INDEX = 2;

  const CONTACTS = Object.freeze({
    dima: {
      userId: "work-dima",
      chatId: "work-chat-dima",
      name: "Дима Орлов",
      username: "d.orlov",
      role: "соседний стол",
      color: "#4e9a72"
    },
    roman: {
      userId: "work-roman",
      chatId: "work-chat-roman",
      name: "Роман Белов",
      username: "r.belov",
      role: "системный администратор",
      color: "#4f8ca8"
    },
    security: {
      userId: "work-security",
      chatId: "work-chat-security",
      name: "Виктор Сергеев",
      username: "v.sergeev",
      role: "служба безопасности",
      color: "#596a76"
    },
    andrey: {
      userId: "work-andrey",
      chatId: "work-chat-andrey",
      name: "Андрей Соколов",
      username: "a.sokolov",
      role: "начальник отдела",
      color: "#7c62a7"
    }
  });

  function actionDone(state, id) {
    return Boolean(state?.completedActions?.[id]);
  }

  function eventDelivered(state, id) {
    return Array.isArray(state?.deliveredEvents) && state.deliveredEvents.includes(id);
  }

  function completedOfficeIds(state) {
    const completed = state?.metadata?.officeWork?.completed || {};
    return new Set(Office.tasksForDay(DAY_INDEX).filter((task) => completed[task.id]).map((task) => task.id));
  }

  function completedOfficeCount(state) {
    return completedOfficeIds(state).size;
  }

  function auditAnswered(state) {
    return actionDone(state, "wed-audit-explain") ||
      actionDone(state, "wed-audit-delete") ||
      actionDone(state, "wed-audit-blame");
  }

  function securityFollowupAnswered(state) {
    if (eventDelivered(state, "wed-live-security-honest-followup")) {
      return actionDone(state, "wed-security-admit-fear") ||
        actionDone(state, "wed-security-claim-work") ||
        actionDone(state, "wed-security-request-formal");
    }
    if (eventDelivered(state, "wed-live-security-tamper-followup")) {
      return actionDone(state, "wed-security-admit-tampering") ||
        actionDone(state, "wed-security-deny-tampering");
    }
    if (eventDelivered(state, "wed-live-security-blame-followup")) {
      return actionDone(state, "wed-security-retract-blame") ||
        actionDone(state, "wed-security-confirm-blame");
    }
    return true;
  }

  function morningCarryoverText(state) {
    if (state?.flags?.clientEscalated || state?.flags?.clientDelayed) {
      return "Вчера клиентский вопрос остался хвостом. Сегодня не добавляй к нему ещё и проверку безопасности: сначала официальные ответы, потом всё остальное.";
    }
    if (state?.flags?.romanVerifiedAdminLie || state?.flags?.romanLoggedDeflection) {
      return "Роман оставил замечание по твоему запросу доступа. Если сегодня придёт проверка, отвечай по фактам и не пытайся спорить с журналом.";
    }
    if (state?.flags?.clientHandled && state?.flags?.adminConfession) {
      return "Вчера клиент закрыт, с Романом ты объяснился. Сегодня спокойно разбери очередь и не открывай служебные разделы без задачи.";
    }
    if (actionDone(state, "tue-help-accountant")) {
      return "Марина вчера отметила хорошую сверку. Сегодня держи рабочий темп, даже если начнут отвлекать внутренними проверками.";
    }
    return "Сегодня закрой накопившиеся обращения и не оставляй официальные запросы без ответа. Среда обычно показывает, кто умеет работать под давлением.";
  }

  function followupPending(state) {
    const delivered = [
      "wed-live-security-honest-followup",
      "wed-live-security-tamper-followup",
      "wed-live-security-blame-followup"
    ].some((id) => eventDelivered(state, id));
    return delivered && !securityFollowupAnswered(state);
  }

  function lateSummaryText(state) {
    const missing = [];
    if (eventDelivered(state, "wed-security-audit") && !auditAnswered(state)) missing.push("ответ службе безопасности");
    if (followupPending(state)) missing.push("уточнение Виктору Сергееву в МИН");
    if (!actionDone(state, "wed-finish-backlog")) missing.push("очередь накопившихся обращений");

    if (!missing.length) {
      return "Основные вопросы среды закрыты. Перед уходом проверь, не осталось ли открытых служебных документов и временных прав.";
    }
    if (missing.length === 1) return `До конца смены меньше часа. Не закрыто: ${missing[0]}.`;
    return `До конца смены меньше часа. Не закрыты: ${missing.join(", ")}.`;
  }

  function dimaEveningText(state) {
    if (state?.flags?.confirmedFriendBlame || state?.flags?.friendAuditOpened) {
      return "Мне пришёл отдельный запрос от безопасности. Теперь хотя бы понятно, что ты решил спасаться за мой счёт. Больше ко мне с этой историей не обращайся.";
    }
    if (state?.flags?.retractedFriendBlame) {
      return "Виктор написал, что ты отозвал слова про меня. Спасибо, что исправил. Но первый вариант объяснения я тоже видел, и забыть его сразу не получится.";
    }
    if (state?.flags?.blamedFriend) {
      return "Безопасность спрашивала обо мне из-за твоего объяснения. Я пока не понимаю, ты реально решил меня подставить или просто запаниковал.";
    }
    if (state?.flags?.securityAcceptedFearExplanation) {
      return "Значит, ты всё-таки сказал им про разговор и панику. Неприятно, но хотя бы никого не втянул. Посмотрим, что будет завтра.";
    }
    if (state?.flags?.securityAdmittedTampering) {
      return "Роман сказал, что локальный журнал пытались чистить. Хорошо, что ты хотя бы признался, но теперь проверка точно не закончится сегодня.";
    }
    if (state?.flags?.securityDeniedTampering || state?.flags?.securityEscalatedTampering) {
      return "По отделу уже ходит слух, что безопасность нашла разницу в журналах. Не знаю, что ты им ответил, но Андрей после этого был совсем не в настроении.";
    }
    if (state?.flags?.auditClosedHonestly) {
      return "Проверку вроде закрыли без шума. Сегодня это уже считается хорошей новостью. Завтра всё равно будь осторожнее с временными папками.";
    }
    return "Среда прошла странно: безопасность заняла переговорную, Роман снимал копии журналов, а у окна снова считали технику. Слишком много совпадений.";
  }

  const BEATS = Object.freeze([
    {
      id: "morning-carryover",
      minute: 545,
      contact: "andrey",
      when: () => true,
      text: morningCarryoverText
    },
    {
      id: "steady-three",
      minute: 0,
      contact: "andrey",
      when: (state) => completedOfficeCount(state) >= 3 && completedOfficeCount(state) < Number(Office.DAILY_QUOTA || 5) && Number(state.minute || 0) < 900,
      text: () => "Три обычных поручения закрыты. Хорошо. Не бросай работу из-за внутренней проверки, но официальный запрос тоже не игнорируй."
    },
    {
      id: "audit-unanswered",
      minute: 750,
      contact: "security",
      when: (state) => eventDelivered(state, "wed-security-audit") && !auditAnswered(state),
      text: () => "До срока ответа осталось меньше получаса. Если пояснение не поступит, проверка автоматически перейдёт в ручной режим."
    },
    {
      id: "roman-tamper-warning",
      minute: 770,
      contact: "roman",
      when: (state) => Boolean(state?.flags?.auditServerCopyFound),
      text: () => "Серверная копия уже у безопасности. Больше не трогай локальные журналы и временные файлы: любая новая операция только добавит строку в проверку."
    },
    {
      id: "security-followup-reminder",
      minute: 900,
      contact: "security",
      when: followupPending,
      text: () => "Дополнительный вопрос в МИН остаётся без ответа. До конца рабочего дня нужно либо ответить, либо официально запросить перенос срока."
    },
    {
      id: "daily-quota",
      minute: 0,
      contact: "andrey",
      when: (state) => completedOfficeCount(state) >= Number(Office.DAILY_QUOTA || 5),
      text: () => "Дневная норма выполнена. Теперь закрой проверку и остальные сюжетные вопросы, чтобы обычная работа не выглядела прикрытием."
    },
    {
      id: "late-summary",
      minute: 1005,
      contact: "andrey",
      when: () => true,
      text: lateSummaryText
    },
    {
      id: "dima-evening",
      minute: 1020,
      contact: "dima",
      when: () => true,
      text: dimaEveningText
    }
  ]);

  const director = Core.createDirector({
    id: "wednesday-director",
    version: 1,
    dayIndex: DAY_INDEX,
    metadataKey: "wednesdayDirector",
    messagePrefix: "wednesday-director",
    contacts: CONTACTS,
    beats: BEATS,
    typingDelay: 850
  });

  root.UntilFridayWednesdayOfficeDirector = {
    DAY_INDEX,
    CONTACTS,
    BEATS,
    actionDone,
    eventDelivered,
    completedOfficeIds,
    completedOfficeCount,
    auditAnswered,
    securityFollowupAnswered,
    followupPending,
    morningCarryoverText,
    lateSummaryText,
    dimaEveningText,
    director,
    dueBeats: (...args) => director.dueBeats(...args),
    claimBeat: (...args) => director.claimBeat(...args),
    insertMessage: (...args) => director.insertMessage(...args),
    repairMessages: (...args) => director.repairMessages(...args),
    evaluate: (...args) => director.evaluate(...args)
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
