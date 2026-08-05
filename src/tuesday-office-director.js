(function (root) {
  "use strict";

  if (root.UntilFridayTuesdayOfficeDirector) return;

  const Core = root.UntilFridayOfficeDayDirector;
  const Office = root.UntilFridayOfficeWorkPack;
  if (!Core || !Office) return;

  const DAY_INDEX = 1;

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
    marina: {
      userId: "work-marina",
      chatId: "work-chat-marina",
      name: "Марина Лебедева",
      username: "m.lebedeva",
      role: "бухгалтерия",
      color: "#a06472"
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

  function clientHandled(state) {
    return actionDone(state, "tue-client-confirm") || actionDone(state, "tue-client-delay");
  }

  function adminAnswered(state) {
    return actionDone(state, "tue-answer-admin-honest") ||
      actionDone(state, "tue-answer-admin-lie") ||
      actionDone(state, "tue-answer-admin-deflect");
  }

  function morningCarryoverText(state) {
    if (state?.flags?.reportWrong) {
      return "Вчера пришлось возвращать июльский отчёт. Сегодня сначала проверяй версию файла, потом отправляй. Второй такой ошибки не нужно.";
    }
    if (state?.flags?.reportCorrect && state?.flags?.invoiceFixed) {
      return "Вчера отчёт и счёт закрыл нормально. Сегодня держи тот же темп: сначала клиент, потом очередь поручений.";
    }
    if (state?.flags?.invoiceEscalated) {
      return "По счёту 7814 я твою позицию увидел. Сегодня работай по фактам и не называй нарушением то, что ещё не проверено.";
    }
    if (state?.flags?.reportCorrect) {
      return "Отчёт вчера приняли. Сегодня не потеряй обращение клиента среди внутренних задач, срок ответа утром.";
    }
    return "Сегодня приоритет один: не копить хвосты со вчерашнего дня. Клиентское обращение закрой до того, как оно дойдёт до меня.";
  }

  function lateSummaryText(state) {
    const missing = [];
    if (!clientHandled(state)) missing.push("ответ клиенту");
    if (eventDelivered(state, "tue-admin-question") && !adminAnswered(state)) missing.push("ответ Роману по запросу доступа");
    if (eventDelivered(state, "tue-accountant-request") && !actionDone(state, "tue-help-accountant")) missing.push("сверку счетов для Марины");

    if (!missing.length) {
      return "Основные вопросы вторника закрыты. Перед уходом проверь непрочитанные письма и не оставляй открытыми служебные документы.";
    }
    if (missing.length === 1) return `До конца смены меньше часа. Осталось закрыть: ${missing[0]}.`;
    return `До конца смены меньше часа. Остались: ${missing.join(", ")}.`;
  }

  function dimaEveningText(state) {
    if (state?.flags?.askedFriendToCover) {
      return "Я запомнил, что ты просил подтвердить работу. Скажу только то, что видел сам. Сегодня ты хотя бы не сидел без дела.";
    }
    if (state?.flags?.askedTuesdayRumorSource) {
      return "По цепочке слуха новых имён нет. Олег слышал секретаря, секретарь говорила о нескольких комплектах документов. На этом всё.";
    }
    if (state?.flags?.stoppedFriendInvestigation) {
      return "Больше никого не расспрашивал, как ты просил. Но люди сами начали обсуждать освобождающиеся столы у окна.";
    }
    if (state?.flags?.toldFriendLate) {
      return "Я попробовал узнать хоть что-то после твоего признания. Пока только пятничная переговорная и несколько комплектов документов. Мало времени.";
    }
    if (state?.flags?.dismissedFriendTwice) {
      return "Не буду снова спрашивать, что происходит. Просто имей в виду: со стороны видно, что ты чего-то ждёшь.";
    }
    return "Вторник закончился, а яснее не стало. Андрей после обеда был у кадровиков, Роман копался в правах, Олег придумал ещё две версии.";
  }

  const BEATS = Object.freeze([
    {
      id: "morning-carryover",
      minute: 548,
      contact: "andrey",
      when: () => true,
      text: morningCarryoverText
    },
    {
      id: "steady-three",
      minute: 0,
      contact: "andrey",
      when: (state) => completedOfficeCount(state) >= 3 && completedOfficeCount(state) < Number(Office.DAILY_QUOTA || 5) && Number(state.minute || 0) < 900,
      text: () => "Три поручения уже закрыты. Нормальный темп. Не уходи целиком в мелочь, пока висят клиент и служебные ответы."
    },
    {
      id: "client-overdue",
      minute: 635,
      contact: "andrey",
      when: (state) => !clientHandled(state),
      text: () => "Срок ответа «Северному узлу» уже прошёл. Мне пересылать их обращение или ты сам наконец закроешь вопрос?"
    },
    {
      id: "roman-unanswered",
      minute: 720,
      contact: "roman",
      when: (state) => eventDelivered(state, "tue-admin-question") && !adminAnswered(state),
      text: () => "Я всё ещё жду объяснение по вчерашнему запросу доступа. Молчание в журнал не запишется как ответ."
    },
    {
      id: "daily-quota",
      minute: 0,
      contact: "andrey",
      when: (state) => completedOfficeCount(state) >= Number(Office.DAILY_QUOTA || 5),
      text: () => "Дневную норму по поручениям закрыл. Хорошо. Теперь добей сюжетные вопросы, которые не считаются обычными карточками."
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
    id: "tuesday-director",
    version: 1,
    dayIndex: DAY_INDEX,
    metadataKey: "tuesdayDirector",
    messagePrefix: "tuesday-director",
    contacts: CONTACTS,
    beats: BEATS,
    typingDelay: 850
  });

  root.UntilFridayTuesdayOfficeDirector = {
    DAY_INDEX,
    CONTACTS,
    BEATS,
    actionDone,
    eventDelivered,
    completedOfficeIds,
    completedOfficeCount,
    clientHandled,
    adminAnswered,
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
