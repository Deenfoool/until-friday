(function (root, factory) {
  const story = typeof module === "object" && module.exports
    ? require("./story-v2.js")
    : root?.UNTIL_FRIDAY_STORY;
  if (typeof module === "object" && module.exports) {
    try { require("./min-npc-dialogues.js"); } catch {}
    try { require("./min-npc-dialogue-schedules.js"); } catch {}
  }
  const api = factory(story);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UntilFridayMondayLiveStory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Story) {
  "use strict";

  const VERSION = 1;
  const PATCH_KEY = "mondayLiveStoryVersion";

  const FIXED_EVENT_IDS = [
    "mon-live-support-brief",
    "mon-live-oleg-rumor",
    "mon-live-supplier-letter",
    "mon-live-accounting-register",
    "mon-live-admin-memo",
    "mon-live-document-sort",
    "mon-live-invoice-check",
    "mon-live-courier-register",
    "mon-live-hr-redaction"
  ];

  const OLEG_ACTION_IDS = [
    "mon-gossip-ask-details",
    "mon-gossip-stop-rumor",
    "mon-gossip-play-along"
  ];

  const OLEG_REPLY_IDS = [
    "mon-gossip-reply-details",
    "mon-gossip-reply-stop",
    "mon-gossip-reply-play-along"
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
    return {
      id,
      dayIndex: 0,
      minute,
      type: "mail",
      source,
      title,
      text,
      ...extra
    };
  }

  function chatEvent(id, minute, source, title, text, extra = {}) {
    return {
      id,
      dayIndex: 0,
      minute,
      type: "chat",
      source,
      contactKey: source === "Олег Казанцев" ? "oleg" : undefined,
      title,
      text,
      ...extra
    };
  }

  function olegAction({ id, optionLabel, label, minutes, result, effects }) {
    return {
      id,
      dayIndex: 0,
      channel: "chat",
      contactKey: "oleg",
      dialogueId: "oleg-monday-rumor",
      choiceGroup: "monday-oleg-rumor",
      optionLabel,
      label,
      messageText: label,
      minutes,
      focusCost: 0.2,
      once: true,
      requires: { eventDelivered: "mon-live-oleg-rumor" },
      result,
      effects
    };
  }

  function patchStory(story = Story) {
    if (!story || typeof story !== "object") return story;
    story.metadata ||= {};
    if (Number(story.metadata[PATCH_KEY] || 0) >= VERSION) return story;

    addEvent(story, mailEvent(
      "mon-live-support-brief",
      534,
      "Служба поддержки",
      "Сводка обращений за утро",
      "В приложении «Задачи» опубликована утренняя сводка. Нужно сверить обращения четырёх отделов и заполнить итоговую строку."
    ));

    addEvent(story, chatEvent(
      "mon-live-oleg-rumor",
      552,
      "Олег Казанцев",
      "Олег снова что-то слышал",
      "С возвращением. Пока тебя не было, Андрей дважды закрывался с кадровиками. Говорят, к пятнице готовят какие-то бумаги."
    ));

    addEvent(story, mailEvent(
      "mon-live-supplier-letter",
      565,
      "ООО «Север Комплект»",
      "Подтверждение поставки КС-18",
      "Просим подтвердить получение партии кабеля КС-18 до 12:00. В поставке 24 бухты, сопроводительные документы переданы курьеру."
    ));

    addEvent(story, mailEvent(
      "mon-live-accounting-register",
      609,
      "Марина Лебедева",
      "Пропуск в платёжном реестре",
      "В реестре на 84 200 рублей отсутствует сумма по канцелярии. Восстанови значение по остальным строкам и общему итогу."
    ));

    addEvent(story, mailEvent(
      "mon-live-admin-memo",
      659,
      "Административный отдел",
      "Вычитка служебной записки",
      "Перед отправкой в хозяйственный отдел исправь орфографию и пунктуацию в записке о переезде. Смысл текста менять не нужно."
    ));

    addEvent(story, mailEvent(
      "mon-live-document-sort",
      729,
      "Документооборот",
      "Неразобранные счета на общем диске",
      "Пять входящих файлов остались без папок назначения. Разложи документы по разделам «Связь», «Аренда» и «Канцелярия»."
    ));

    addEvent(story, chatEvent(
      "mon-live-invoice-check",
      805,
      "Андрей Соколов",
      "Счёт №7814",
      "Посмотри счёт 7814. В итоговой сумме явно лишний ноль. Мне нужен не только исправленный расчёт, но и решение, как оформить ошибку."
    ));

    addEvent(story, mailEvent(
      "mon-live-courier-register",
      883,
      "Секретариат",
      "Курьер Север Комплекта",
      "В 11:40 был курьер Павел Ершов с УПД №418. Перенеси данные в журнал регистрации, чтобы закрыть доставку."
    ));

    addEvent(story, mailEvent(
      "mon-live-hr-redaction",
      961,
      "Отдел кадров",
      "Обезличивание заявки подрядчику",
      "Перед отправкой заявки на пропуск удали телефон и паспортные данные сотрудника. Имя и рабочую цель оставь."
    ));

    addAction(story, olegAction({
      id: "mon-gossip-ask-details",
      optionLabel: "Спросить, что именно он знает",
      label: "Какие бумаги? Ты сам что-нибудь видел или опять пересказываешь чужие разговоры?",
      minutes: 3,
      result: "Олег признался, что документов не видел.",
      effects: {
        stats: { anxiety: 1 },
        trust: { gossip: 1 },
        setFlags: { questionedOlegRumor: true },
        schedule: [{ eventId: "mon-gossip-reply-details", dayIndex: 0, minute: 560 }]
      }
    }));

    addAction(story, olegAction({
      id: "mon-gossip-stop-rumor",
      optionLabel: "Попросить не разгонять слух",
      label: "Пока нет фамилий и документов, не разгоняй это по отделу. Люди и так дёрганые.",
      minutes: 2,
      result: "Олег сделал вид, что не собирался никому рассказывать.",
      effects: {
        stats: { anxiety: -1 },
        trust: { gossip: -1 },
        setFlags: { stoppedOlegRumor: true },
        schedule: [{ eventId: "mon-gossip-reply-stop", dayIndex: 0, minute: 560 }]
      }
    }));

    addAction(story, olegAction({
      id: "mon-gossip-play-along",
      optionLabel: "Подыграть и выведать больше",
      label: "Значит, всё-таки кого-то убирают. Держи меня в курсе, если услышишь фамилию.",
      minutes: 2,
      result: "Олег решил, что нашёл благодарного слушателя.",
      effects: {
        stats: { anxiety: 1 },
        trust: { gossip: 2 },
        setFlags: { encouragedOlegRumor: true },
        schedule: [{ eventId: "mon-gossip-reply-play-along", dayIndex: 0, minute: 560 }]
      }
    }));

    addEvent(story, chatEvent(
      "mon-gossip-reply-details",
      560,
      "Олег Казанцев",
      "Источник Олега",
      "Самих бумаг не видел. Секретарь несла красную папку из кадров, а потом Андрей попросил не занимать переговорную в пятницу. Делай выводы сам.",
      {
        dialogueId: "oleg-monday-rumor",
        replyToAction: "mon-gossip-ask-details",
        requires: { actionDone: "mon-gossip-ask-details" }
      }
    ));

    addEvent(story, chatEvent(
      "mon-gossip-reply-stop",
      560,
      "Олег Казанцев",
      "Олег отступил",
      "Да я вообще молчу. Это люди сами всё замечают. Но ладно, от меня сегодня больше ничего не услышишь.",
      {
        dialogueId: "oleg-monday-rumor",
        replyToAction: "mon-gossip-stop-rumor",
        requires: { actionDone: "mon-gossip-stop-rumor" }
      }
    ));

    addEvent(story, chatEvent(
      "mon-gossip-reply-play-along",
      560,
      "Олег Казанцев",
      "Олег обещал сообщить",
      "Вот это правильный подход. Если всплывёт фамилия, ты узнаешь раньше половины отдела.",
      {
        dialogueId: "oleg-monday-rumor",
        replyToAction: "mon-gossip-play-along",
        requires: { actionDone: "mon-gossip-play-along" }
      }
    ));

    story.metadata[PATCH_KEY] = VERSION;
    return story;
  }

  patchStory();

  return {
    VERSION,
    FIXED_EVENT_IDS,
    OLEG_ACTION_IDS,
    OLEG_REPLY_IDS,
    patchStory
  };
});
