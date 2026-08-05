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
    "mon-live-oleg-rumor",
    "mon-live-room-booking",
    "mon-live-roman-rights",
    "mon-live-workspace-move"
  ];

  const CONDITIONAL_EVENT_IDS = [
    "mon-live-oleg-followup-details",
    "mon-live-oleg-followup-encouraged"
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
    return { id, dayIndex: 0, minute, type: "mail", source, title, text, ...extra };
  }

  function chatEvent(id, minute, source, title, text, extra = {}) {
    const keys = { "Олег Казанцев": "oleg", "Роман Белов": "roman" };
    return {
      id,
      dayIndex: 0,
      minute,
      type: "chat",
      source,
      contactKey: keys[source],
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

    addEvent(story, chatEvent(
      "mon-live-oleg-rumor",
      552,
      "Олег Казанцев",
      "Олег снова что-то слышал",
      "С возвращением. Пока тебя не было, Андрей дважды закрывался с кадровиками. Говорят, к пятнице готовят какие-то бумаги."
    ));

    addEvent(story, mailEvent(
      "mon-live-room-booking",
      620,
      "Секретарь директора",
      "Переговорная №1 недоступна в пятницу",
      "В пятницу с 16:30 до 18:30 переговорная №1 зарезервирована руководством и отделом кадров. Просьба перенести внутренние встречи."
    ));

    addEvent(story, chatEvent(
      "mon-live-roman-rights",
      710,
      "Роман Белов",
      "Обновление прав на общем диске",
      "Сегодня пересобираю группы доступа. Если какая-то рабочая папка пропадёт, не запрашивай права повторно десять раз — напиши мне."
    ));

    addEvent(story, mailEvent(
      "mon-live-workspace-move",
      850,
      "Административный отдел",
      "Подготовка двух рабочих мест",
      "До конца недели нужно освободить два стола у окна и проверить комплектность техники. Конкретные сотрудники будут указаны позже."
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
      { dialogueId: "oleg-monday-rumor", replyToAction: "mon-gossip-ask-details", requires: { actionDone: "mon-gossip-ask-details" } }
    ));

    addEvent(story, chatEvent(
      "mon-gossip-reply-stop",
      560,
      "Олег Казанцев",
      "Олег отступил",
      "Да я вообще молчу. Это люди сами всё замечают. Но ладно, от меня сегодня больше ничего не услышишь.",
      { dialogueId: "oleg-monday-rumor", replyToAction: "mon-gossip-stop-rumor", requires: { actionDone: "mon-gossip-stop-rumor" } }
    ));

    addEvent(story, chatEvent(
      "mon-gossip-reply-play-along",
      560,
      "Олег Казанцев",
      "Олег обещал сообщить",
      "Вот это правильный подход. Если всплывёт фамилия, ты узнаешь раньше половины отдела.",
      { dialogueId: "oleg-monday-rumor", replyToAction: "mon-gossip-play-along", requires: { actionDone: "mon-gossip-play-along" } }
    ));

    addEvent(story, chatEvent(
      "mon-live-oleg-followup-details",
      950,
      "Олег Казанцев",
      "Олег нашёл ещё одну деталь",
      "Красная папка всё ещё у Андрея. Секретарь сказала, что вернёт её в кадры только после пятничной встречи. Фамилию я так и не видел.",
      { requires: { flag: "questionedOlegRumor" } }
    ));

    addEvent(story, chatEvent(
      "mon-live-oleg-followup-encouraged",
      950,
      "Олег Казанцев",
      "Новая версия Олега",
      "Говорят, освобождают сразу два места у окна. Совпадает с письмом административного отдела, но ты пока никому не пересылай.",
      { requires: { flag: "encouragedOlegRumor" } }
    ));

    story.metadata[PATCH_KEY] = VERSION;
    return story;
  }

  patchStory();

  return {
    VERSION,
    FIXED_EVENT_IDS,
    CONDITIONAL_EVENT_IDS,
    OLEG_ACTION_IDS,
    OLEG_REPLY_IDS,
    patchStory
  };
});
