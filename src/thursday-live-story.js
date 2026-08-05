(function (root, factory) {
  const story = root?.UNTIL_FRIDAY_STORY;
  if (!story || root.UntilFridayThursdayLiveStory) return;
  const api = factory(story);
  root.UntilFridayThursdayLiveStory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Story) {
  "use strict";

  const VERSION = 1;
  const PATCH_KEY = "thursdayLiveStoryVersion";

  function event(id, minute, type, source, title, text, requires, effects = {}) {
    return { id, dayIndex: 3, minute, type, source, title, text, ...(requires ? { requires } : {}), ...(Object.keys(effects).length ? { effects } : {}) };
  }

  function add(id, value) {
    Story.events ||= {};
    if (!Story.events[id]) Story.events[id] = value;
  }

  function schedule(actionId, eventId, minute) {
    const action = Story.actions?.[actionId];
    if (!action) return;
    action.effects ||= {};
    action.effects.schedule ||= [];
    if (!action.effects.schedule.some((item) => item.eventId === eventId)) {
      action.effects.schedule.push({ eventId, dayIndex: 3, minute });
    }
  }

  function patch() {
    Story.metadata ||= {};
    if (Number(Story.metadata[PATCH_KEY] || 0) >= VERSION) return Story;

    add("thu-live-morning-andrey", event(
      "thu-live-morning-andrey", 548, "chat", "Андрей Соколов", "Завтра в 17:00",
      "Напоминаю про встречу с директором и кадрами. Сегодня мне важно понимать, что ты собираешься показать официально. Без самодеятельности в последний момент.",
      null, { setFlags: { thursdayMeetingConfirmed: true } }
    ));

    add("thu-live-marina-question", event(
      "thu-live-marina-question", 615, "chat", "Марина Лебедева", "Счёт 7814 ещё нужен?",
      "Я видела, что по 7814 снова открывали материалы. Если ты нашёл там что-то существенное, скажи до того, как я закрою сверку. Иначе оставлю только бухгалтерскую часть.",
      { any: [{ flag: "invoiceEscalated" }, { flag: "invoiceFixed" }, { flag: "caseArchiveLogged" }] }
    ));

    add("thu-live-roman-access", event(
      "thu-live-roman-access", 675, "chat", "Роман Белов", "Права урезали",
      "После вчерашней проверки я снял временные права с финансового и кадрового разделов. Если тебе реально нужен файл для работы, скажи какой. Старые копии лучше не таскать по папкам.",
      { flag: "restrictedThursdaySession" }
    ));

    add("thu-live-dima-afternoon", event(
      "thu-live-dima-afternoon", 810, "chat", "Дима Орлов", "Что ты вообще будешь делать завтра?",
      "Я не спрашиваю из любопытства. Просто завтра тебя ждёт директор, а ты третий день ходишь так, будто уже знаешь результат. Если хочешь, могу просто не лезть.",
      null
    ));

    add("thu-live-project-reaction", event(
      "thu-live-project-reaction", 785, "chat", "Андрей Соколов", "Автоматизация замечена",
      "Прототип увидел. Если завтра решишь идти по рабочей линии, это будет твоим самым понятным аргументом: ты сделал то, что от тебя ждали.",
      { actionDone: "thu-finish-project" }, { setFlags: { chiefHasWorkArgument: true }, trust: { chief: 1 } }
    ));
    schedule("thu-finish-project", "thu-live-project-reaction", 785);

    add("thu-live-case-reaction", event(
      "thu-live-case-reaction", 810, "chat", "Роман Белов", "Архив заметили",
      "Система зарегистрировала создание архива. Я не открывал содержимое, но время и факт операции видны. Если завтра спросят, лучше не делать вид, что архива не существует.",
      { actionDone: "thu-build-case" }, { setFlags: { caseArchiveVisibleToRoman: true } }
    ));
    schedule("thu-build-case", "thu-live-case-reaction", 810);

    add("thu-live-resignation-reaction", event(
      "thu-live-resignation-reaction", 830, "chat", "Марина Лебедева", "Ты точно это отправлять не будешь?",
      "Если это заявление, которое ты заполнил сегодня, то до регистрации оно остаётся только твоим решением. Я спрашиваю не как бухгалтер: ты уже решил уйти или просто готовишь запасной выход?",
      { actionDone: "thu-resign" }, { setFlags: { marinaKnowsResignationDraft: true } }
    ));
    schedule("thu-resign", "thu-live-resignation-reaction", 830);

    add("thu-live-complaint-reaction", event(
      "thu-live-complaint-reaction", 855, "chat", "Виктор Сергеев", "Материал по жалобе принят",
      "Жалоба поступила в проверку. Если завтра будете обсуждать её с директором, не меняйте формулировки задним числом: серверные записи уже привязаны к материалу.",
      { actionDone: "thu-frame-chief" }, { setFlags: { securityLinkedComplaintToMeeting: true } }
    ));
    schedule("thu-frame-chief", "thu-live-complaint-reaction", 855);

    add("thu-live-evening-pressure", event(
      "thu-live-evening-pressure", 965, "mail", "Секретарь директора", "Материалы к встрече",
      "Напоминание: завтра в 17:00 директор и сотрудник кадров будут ждать вас в переговорной №1. Подготовьте только те документы, которые готовы представить официально.",
      null, { setFlags: { fridayMeetingPressure: true } }
    ));

    Story.metadata[PATCH_KEY] = VERSION;
    return Story;
  }

  patch();
  return { VERSION, PATCH_KEY, patch };
});
