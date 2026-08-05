(function (root) {
  "use strict";

  if (root.UntilFridayThursdayOfficeDirector) return;

  const Core = root.UntilFridayOfficeDayDirector;
  if (!Core) return;

  const DAY_INDEX = 3;
  const CONTACTS = Object.freeze({
    andrey: { userId: "work-andrey", chatId: "work-chat-andrey", name: "Андрей Соколов", username: "a.sokolov", role: "начальник отдела", color: "#7c62a7" },
    dima: { userId: "work-dima", chatId: "work-chat-dima", name: "Дима Орлов", username: "d.orlov", role: "соседний стол", color: "#4e9a72" },
    roman: { userId: "work-roman", chatId: "work-chat-roman", name: "Роман Белов", username: "r.belov", role: "системный администратор", color: "#4f8ca8" },
    marina: { userId: "work-marina", chatId: "work-chat-marina", name: "Марина Лебедева", username: "m.lebedeva", role: "бухгалтерия", color: "#a06472" },
    security: { userId: "work-security", chatId: "work-chat-security", name: "Виктор Сергеев", username: "v.sergeev", role: "служба безопасности", color: "#596a76" }
  });

  function actionDone(state, id) { return Boolean(state?.completedActions?.[id]); }
  function eventDelivered(state, id) { return Array.isArray(state?.deliveredEvents) && state.deliveredEvents.includes(id); }
  function workCount(state) {
    const completed = state?.metadata?.officeWork?.completed || {};
    return Object.keys(completed).filter((id) => completed[id]).length;
  }

  function morningText(state) {
    if (state?.flags?.securityTamperCaseOpen || state?.flags?.securityDeniedTampering) {
      return "После вчерашней проверки у нас мало пространства для импровизации. Сегодня работай только с теми материалами, которые можешь объяснить завтра директору.";
    }
    if (state?.flags?.securityAcceptedFearExplanation || state?.flags?.securityFormalQuestionPending) {
      return "Вчерашнюю проверку считаю закрытой настолько, насколько это возможно. Сегодня подготовь нормальный результат к завтрашней встрече, а не новую версию событий.";
    }
    return "Завтра в 17:00 встреча. Сегодня мне нужен понятный результат и никаких новых странностей в журналах.";
  }

  function lateText(state) {
    const missing = [];
    if (!actionDone(state, "thu-finish-project")) missing.push("рабочий прототип");
    if (!actionDone(state, "thu-build-case") && !actionDone(state, "thu-resign") && !actionDone(state, "thu-frame-chief")) missing.push("материалы к встрече");
    if (!missing.length) return "На завтра у тебя уже есть что показать. Не перегружай встречу лишними объяснениями: сначала факты, потом выводы.";
    return `До встречи остался один рабочий день. Пока не вижу готового: ${missing.join(" и ")}. Реши, что именно будешь защищать завтра.`;
  }

  function dimaText(state) {
    if (state?.flags?.marinaKnowsResignationDraft) return "Марина спрашивала, не собираешься ли ты уйти. Я не стал отвечать за тебя. Если завтра решишь что-то менять, хотя бы не делай вид, что решение появилось за пять минут.";
    if (state?.flags?.securityLinkedComplaintToMeeting) return "Про жалобу уже знают. Я бы на твоём месте завтра говорил только то, что можешь подтвердить документом. Остальное тебя же и утопит.";
    if (state?.flags?.chiefHasWorkArgument) return "Прототип у Андрея. Если завтра пойдёшь по рабочей линии, у тебя хотя бы есть чем показать, что ты не просто переживал всю неделю.";
    return "Завтра встреча. Если хочешь просто пережить её, не придумывай сегодня ещё десять новых проблем.";
  }

  const BEATS = Object.freeze([
    { id: "morning", minute: 548, contact: "andrey", when: () => true, text: morningText },
    { id: "project-progress", minute: 700, contact: "andrey", when: (state) => actionDone(state, "thu-finish-project"), text: () => "Проект автоматизации вижу. Хорошо, что закрыл его до встречи. Не переделывай работающий результат ради красоты." },
    { id: "security-pressure", minute: 735, contact: "security", when: (state) => Boolean(state?.flags?.restrictedThursdaySession) && !actionDone(state, "thu-build-case") && !actionDone(state, "thu-finish-project"), text: () => "Напоминаю: после вчерашней проверки любые новые копии служебных документов будут видны в журнале. Если файл нужен для работы, укажите основание." },
    { id: "resignation-pressure", minute: 840, contact: "andrey", when: (state) => actionDone(state, "thu-resign"), text: () => "Черновик заявления увидел в локальной активности. Я не спрашиваю, решил ли ты уходить. Завтра на встрече кадровик сможет принять документ, если это будет окончательное решение." },
    { id: "complaint-pressure", minute: 870, contact: "security", when: (state) => actionDone(state, "thu-frame-chief"), text: () => "Материал по жалобе уже связан с завтрашней встречей. Ничего не редактируйте задним числом." },
    { id: "late-summary", minute: 1005, contact: "andrey", when: () => true, text: lateText },
    { id: "dima-evening", minute: 1020, contact: "dima", when: () => true, text: dimaText }
  ]);

  const director = Core.createDirector({
    id: "thursday-director",
    version: 1,
    dayIndex: DAY_INDEX,
    metadataKey: "thursdayDirector",
    messagePrefix: "thursday-director",
    contacts: CONTACTS,
    beats: BEATS,
    typingDelay: 850
  });

  root.UntilFridayThursdayOfficeDirector = {
    DAY_INDEX,
    CONTACTS,
    BEATS,
    actionDone,
    eventDelivered,
    workCount,
    morningText,
    lateText,
    dimaText,
    director,
    dueBeats: (...args) => director.dueBeats(...args),
    claimBeat: (...args) => director.claimBeat(...args),
    insertMessage: (...args) => director.insertMessage(...args),
    repairMessages: (...args) => director.repairMessages(...args),
    evaluate: (...args) => director.evaluate(...args)
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
