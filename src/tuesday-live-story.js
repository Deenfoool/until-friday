(function (root, factory) {
  const story = typeof module === "object" && module.exports
    ? require("./story-v2.js")
    : root?.UNTIL_FRIDAY_STORY;
  if (typeof module === "object" && module.exports) {
    try { require("./min-npc-dialogues.js"); } catch {}
    try { require("./min-npc-dialogue-schedules.js"); } catch {}
    try { require("./monday-live-story.js"); } catch {}
  }
  const api = factory(story);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UntilFridayTuesdayLiveStory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Story) {
  "use strict";

  const VERSION = 1;
  const PATCH_KEY = "tuesdayLiveStoryVersion";

  const FIXED_EVENT_IDS = [
    "tue-live-room-schedule",
    "tue-live-license-inventory",
    "tue-live-desk-labels"
  ];

  const CONDITIONAL_EVENT_IDS = [
    "tue-live-oleg-details",
    "tue-live-oleg-quiet",
    "tue-live-oleg-encouraged",
    "tue-live-marina-followup",
    "tue-live-roman-honest-tip",
    "tue-live-roman-lie-log",
    "tue-live-roman-deflect-log"
  ];

  const MARINA_ACTION_IDS = [
    "tue-accountant-ask-pattern",
    "tue-accountant-ask-access",
    "tue-accountant-focus-work"
  ];

  const MARINA_REPLY_IDS = [
    "tue-accountant-reply-pattern",
    "tue-accountant-reply-access",
    "tue-accountant-reply-focus"
  ];

  function addEvent(story, event) {
    story.events ||= {};
    story.events[event.id] = event;
    return event;
  }

  function addAction(story, action) {
    story.actions ||= {};
    story.actions[action.id] = action;
    return action;
  }

  function mailEvent(id, minute, source, title, text, extra = {}) {
    return { id, dayIndex: 1, minute, type: "mail", source, title, text, ...extra };
  }

  function chatEvent(id, minute, source, contactKey, title, text, extra = {}) {
    return {
      id,
      dayIndex: 1,
      minute,
      type: "chat",
      source,
      contactKey,
      title,
      text,
      ...extra
    };
  }

  function marinaAction({ id, optionLabel, label, minutes, result, effects }) {
    return {
      id,
      dayIndex: 1,
      channel: "chat",
      contactKey: "marina",
      dialogueId: "marina-tuesday-invoices",
      choiceGroup: "tuesday-marina-invoices",
      optionLabel,
      label,
      messageText: label,
      minutes,
      focusCost: 0.2,
      once: true,
      requires: { eventDelivered: "tue-live-marina-followup" },
      result,
      effects
    };
  }

  function patchStory(story = Story) {
    if (!story || typeof story !== "object") return story;
    story.metadata ||= {};
    if (Number(story.metadata[PATCH_KEY] || 0) >= VERSION) return story;

    addEvent(story, chatEvent(
      "tue-live-oleg-details",
      590,
      "Олег Казанцев",
      "oleg",
      "Олег уточнил вчерашний слух",
      "Ты вчера спрашивал про источник. Красную папку действительно носили между Андреем и кадрами, но фамилии на ней не было.",
      { requires: { flag: "questionedOlegRumor" } }
    ));

    addEvent(story, chatEvent(
      "tue-live-oleg-quiet",
      590,
      "Олег Казанцев",
      "oleg",
      "Олег демонстративно молчит",
      "Раз ты просил не разгонять слухи, я молчу. Правда, теперь весь отдел сам обсуждает два освобождающихся стола.",
      { requires: { flag: "stoppedOlegRumor" } }
    ));

    addEvent(story, chatEvent(
      "tue-live-oleg-encouraged",
      590,
      "Олег Казанцев",
      "oleg",
      "Новая версия Олега",
      "Появилась версия, что решение касается сразу нескольких человек. Пока без фамилий. Как и договаривались, пишу сначала тебе.",
      {
        requires: { flag: "encouragedOlegRumor" },
        effects: { stats: { anxiety: 1 }, setFlags: { olegFeedsRumors: true } }
      }
    ));

    addEvent(story, chatEvent(
      "tue-live-marina-followup",
      600,
      "Марина Лебедева",
      "marina",
      "Марина прислала документы",
      "Отправила три комплекта на сверку. В каждом ровно одно расхождение. Сначала отметь ошибки, потом открою чтение платёжного списка.",
      { requires: { eventDelivered: "tue-accountant-request" } }
    ));

    addEvent(story, mailEvent(
      "tue-live-room-schedule",
      650,
      "Секретарь директора",
      "Изменение календаря руководства",
      "Сегодня после 14:00 Андрей Соколов недоступен: закрытая встреча с отделом кадров. Срочные вопросы передайте до обеда."
    ));

    addEvent(story, chatEvent(
      "tue-live-roman-honest-tip",
      700,
      "Роман Белов",
      "roman",
      "Роман оставил подсказку",
      "Раз уж сказал прямо: в служебной очереди пропусков есть запись без фамилии на пятницу. Посмотреть можно только чтением, ничего не меняй.",
      {
        requires: { flag: "answeredAdminHonestly" },
        effects: { stats: { access: 1 }, unlockContent: ["badge-list-hint"], setFlags: { romanSharedBadgeTip: true } }
      }
    ));

    addEvent(story, chatEvent(
      "tue-live-roman-lie-log",
      700,
      "Роман Белов",
      "roman",
      "Запрос оставлен в журнале",
      "Я проверил: случайного открытия не было, был отдельный запрос прав. Запись не удаляю. Дальше это уже не мой вопрос.",
      {
        requires: { flag: "liedToAdmin" },
        effects: { stats: { suspicion: 1 }, setFlags: { romanVerifiedAdminLie: true } }
      }
    ));

    addEvent(story, chatEvent(
      "tue-live-roman-deflect-log",
      700,
      "Роман Белов",
      "roman",
      "Роман закрыл разговор",
      "Ответа я так и не получил. Запрос доступа и переписку оставляю в журнале без комментариев.",
      {
        requires: { flag: "deflectedAdminQuestion" },
        effects: { stats: { suspicion: 1 }, setFlags: { romanLoggedDeflection: true } }
      }
    ));

    addEvent(story, mailEvent(
      "tue-live-license-inventory",
      820,
      "ИТ-отдел",
      "Инвентаризация учётных записей",
      "До четверга будет проведена сверка активных учётных записей, лицензий и закреплённой техники. Возможны временные ограничения доступа."
    ));

    addEvent(story, mailEvent(
      "tue-live-desk-labels",
      930,
      "Административный отдел",
      "Маркировка техники у окна",
      "На двух рабочих местах у окна необходимо оставить системные блоки и мониторы без личных наклеек. Перемещение запланировано на конец недели."
    ));

    addAction(story, marinaAction({
      id: "tue-accountant-ask-pattern",
      optionLabel: "Спросить, часто ли стали появляться ошибки",
      label: "Марина, такие расхождения сейчас часто встречаются? Вчерашний счёт тоже выглядел слишком аккуратной ошибкой.",
      minutes: 3,
      result: "Марина согласилась проверить, не повторяется ли один и тот же шаблон.",
      effects: {
        trust: { accountant: 1 },
        stats: { anxiety: 1 },
        setFlags: { askedAccountantAboutPattern: true },
        schedule: [{ eventId: "tue-accountant-reply-pattern", dayIndex: 1, minute: 610 }]
      }
    }));

    addAction(story, marinaAction({
      id: "tue-accountant-ask-access",
      optionLabel: "Сразу попросить платёжный список",
      label: "Можешь сразу открыть мне платёжный список? Так будет проще сверить всё целиком.",
      minutes: 2,
      result: "Марина отказалась выдавать доступ до завершения поручения.",
      effects: {
        trust: { accountant: -1 },
        stats: { suspicion: 1 },
        setFlags: { askedAccountantForEarlyAccess: true },
        schedule: [{ eventId: "tue-accountant-reply-access", dayIndex: 1, minute: 610 }]
      }
    }));

    addAction(story, marinaAction({
      id: "tue-accountant-focus-work",
      optionLabel: "Не обсуждать причины и заняться сверкой",
      label: "Принял. Сначала отмечу расхождения, потом напишу по результату.",
      minutes: 1,
      result: "Разговор остался строго рабочим.",
      effects: {
        trust: { accountant: 1 },
        stats: { anxiety: -1 },
        setFlags: { keptAccountantConversationProfessional: true },
        schedule: [{ eventId: "tue-accountant-reply-focus", dayIndex: 1, minute: 606 }]
      }
    }));

    addEvent(story, chatEvent(
      "tue-accountant-reply-pattern",
      610,
      "Марина Лебедева",
      "marina",
      "Марина заметила закономерность",
      "После переноса базы ошибок стало больше, но счёт 7814 выбивается: там итог увеличен ровно в десять раз, а остальные строки верные. Я сохраню копию.",
      {
        dialogueId: "marina-tuesday-invoices",
        replyToAction: "tue-accountant-ask-pattern",
        requires: { actionDone: "tue-accountant-ask-pattern" },
        effects: { stats: { evidence: 1 }, setFlags: { accountantSavedInvoiceCopy: true } }
      }
    ));

    addEvent(story, chatEvent(
      "tue-accountant-reply-access",
      610,
      "Марина Лебедева",
      "marina",
      "Доступ пока закрыт",
      "Нет. Сначала закончи три комплекта. После проверки дам только чтение и только на сегодня.",
      {
        dialogueId: "marina-tuesday-invoices",
        replyToAction: "tue-accountant-ask-access",
        requires: { actionDone: "tue-accountant-ask-access" }
      }
    ));

    addEvent(story, chatEvent(
      "tue-accountant-reply-focus",
      606,
      "Марина Лебедева",
      "marina",
      "Марина подтвердила",
      "Хорошо. Ничего исправлять в исходниках не нужно, только отметь строки с расхождениями.",
      {
        dialogueId: "marina-tuesday-invoices",
        replyToAction: "tue-accountant-focus-work",
        requires: { actionDone: "tue-accountant-focus-work" }
      }
    ));

    story.metadata[PATCH_KEY] = VERSION;
    return story;
  }

  patchStory();

  return {
    VERSION,
    FIXED_EVENT_IDS,
    CONDITIONAL_EVENT_IDS,
    MARINA_ACTION_IDS,
    MARINA_REPLY_IDS,
    patchStory
  };
});
