(function (root, factory) {
  const story = typeof module === "object" && module.exports
    ? require("./story-v2.js")
    : root?.UNTIL_FRIDAY_STORY;
  if (typeof module === "object" && module.exports) {
    try { require("./min-npc-dialogues.js"); } catch {}
    try { require("./min-npc-dialogue-schedules.js"); } catch {}
    try { require("./monday-live-story.js"); } catch {}
    try { require("./tuesday-live-story.js"); } catch {}
    try { require("./wednesday-minigames.js"); } catch {}
  }
  const api = factory(story);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UntilFridayWednesdayLiveStory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Story) {
  "use strict";

  const VERSION = 1;
  const PATCH_KEY = "wednesdayLiveStoryVersion";

  const FIXED_EVENT_IDS = [
    "wed-live-security-intro",
    "wed-live-workstation-check",
    "wed-live-security-room",
    "wed-live-clean-roman"
  ];

  const CONDITIONAL_EVENT_IDS = [
    "wed-live-security-honest-followup",
    "wed-live-security-tamper-followup",
    "wed-live-security-blame-followup",
    "wed-live-security-reply-admit",
    "wed-live-security-reply-work",
    "wed-live-security-reply-formal",
    "wed-live-security-reply-tamper-admit",
    "wed-live-security-reply-tamper-deny",
    "wed-live-security-reply-retract",
    "wed-live-security-reply-confirm"
  ];

  const HONEST_ACTION_IDS = [
    "wed-security-admit-fear",
    "wed-security-claim-work",
    "wed-security-request-formal"
  ];

  const TAMPER_ACTION_IDS = [
    "wed-security-admit-tampering",
    "wed-security-deny-tampering"
  ];

  const BLAME_ACTION_IDS = [
    "wed-security-retract-blame",
    "wed-security-confirm-blame"
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
    return { id, dayIndex: 2, minute, type: "mail", source, title, text, ...extra };
  }

  function chatEvent(id, minute, source, contactKey, title, text, extra = {}) {
    return {
      id,
      dayIndex: 2,
      minute,
      type: "chat",
      source,
      contactKey,
      title,
      text,
      ...extra
    };
  }

  function securityAction({ id, dialogueId, choiceGroup, requires, optionLabel, label, minutes, result, effects }) {
    return {
      id,
      dayIndex: 2,
      channel: "chat",
      contactKey: "security",
      dialogueId,
      choiceGroup,
      optionLabel,
      label,
      messageText: label,
      minutes,
      focusCost: 0.25,
      once: true,
      requires,
      result,
      effects
    };
  }

  function patchStory(story = Story) {
    if (!story || typeof story !== "object") return story;
    story.metadata ||= {};
    if (Number(story.metadata[PATCH_KEY] || 0) >= VERSION) return story;

    addEvent(story, chatEvent(
      "wed-live-security-intro",
      550,
      "Виктор Сергеев",
      "security",
      "Проверка журнала доступа",
      "Добрый день. Я веду проверку по вашему сетевому журналу. Ответ на официальное письмо нужен до 13:00. В МИН можете уточнить только процедуру, не содержание объяснения.",
      { requires: { eventDelivered: "wed-security-audit" } }
    ));

    addEvent(story, chatEvent(
      "wed-live-clean-roman",
      610,
      "Роман Белов",
      "roman",
      "Плановая сверка журналов",
      "Сегодня безопасность снимает контрольную копию журналов. У тебя отдельного запроса нет, но лучше не открывай старые служебные папки без необходимости.",
      { requires: { eventDelivered: "wed-normal-morning" } }
    ));

    addEvent(story, mailEvent(
      "wed-live-workstation-check",
      650,
      "Административный отдел",
      "Сверка техники и рабочих мест",
      "Сегодня после 14:00 будет проведена проверка инвентарных номеров на рабочих местах у окна. Личные вещи и носители необходимо убрать."
    ));

    addEvent(story, mailEvent(
      "wed-live-security-room",
      870,
      "Секретарь директора",
      "Переговорная №2 занята службой безопасности",
      "Переговорная №2 недоступна до конца дня. Документы для внутренней проверки передавайте только через систему документооборота."
    ));

    addEvent(story, chatEvent(
      "wed-live-security-honest-followup",
      742,
      "Виктор Сергеев",
      "security",
      "Дополнительный вопрос",
      "Пояснение принято. Остался один вопрос: почему рабочий интерес возник именно к папке руководства и документам на пятницу?",
      { requires: { flag: "auditClosedHonestly" } }
    ));

    addAction(story, securityAction({
      id: "wed-security-admit-fear",
      dialogueId: "security-wednesday-honest",
      choiceGroup: "wednesday-security-honest",
      requires: { eventDelivered: "wed-live-security-honest-followup" },
      optionLabel: "Признать, что испугался после случайно услышанного разговора",
      label: "Я случайно услышал разговор директора с кадровиком и решил, что в пятницу будут увольнять кого-то из отдела. Испугался и полез искать подтверждение.",
      minutes: 5,
      result: "Игрок признал личную причину поиска документов.",
      effects: {
        stats: { suspicion: -1, anxiety: -1 },
        setFlags: { securityAdmittedFear: true },
        schedule: [{ eventId: "wed-live-security-reply-admit", dayIndex: 2, minute: 752 }]
      }
    }));

    addAction(story, securityAction({
      id: "wed-security-claim-work",
      dialogueId: "security-wednesday-honest",
      choiceGroup: "wednesday-security-honest",
      requires: { eventDelivered: "wed-live-security-honest-followup" },
      optionLabel: "Сказать, что искал материалы для рабочего отчёта",
      label: "Искал материалы для рабочего отчёта и сверки задач отдела. Папка руководства попалась среди связанных разделов.",
      minutes: 4,
      result: "Игрок связал поиск документов с обычной работой.",
      effects: {
        stats: { suspicion: 1 },
        setFlags: { securityClaimedWorkReason: true },
        schedule: [{ eventId: "wed-live-security-reply-work", dayIndex: 2, minute: 752 }]
      }
    }));

    addAction(story, securityAction({
      id: "wed-security-request-formal",
      dialogueId: "security-wednesday-honest",
      choiceGroup: "wednesday-security-honest",
      requires: { eventDelivered: "wed-live-security-honest-followup" },
      optionLabel: "Попросить направить дополнительный вопрос официально",
      label: "Этот вопрос выходит за рамки первоначального письма. Направьте его официально, и я отвечу через систему документооборота.",
      minutes: 3,
      result: "Игрок отказался продолжать неформальный разговор.",
      effects: {
        stats: { anxiety: 1 },
        setFlags: { securityRequestedFormalQuestion: true },
        schedule: [{ eventId: "wed-live-security-reply-formal", dayIndex: 2, minute: 750 }]
      }
    }));

    addEvent(story, chatEvent(
      "wed-live-security-reply-admit",
      752,
      "Виктор Сергеев",
      "security",
      "Признание зарегистрировано",
      "Понял. Паника не является служебной необходимостью, но ваше объяснение совпадает с последовательностью действий. На этом вопрос пока закрыт.",
      {
        dialogueId: "security-wednesday-honest",
        replyToAction: "wed-security-admit-fear",
        requires: { actionDone: "wed-security-admit-fear" },
        effects: { setFlags: { securityAcceptedFearExplanation: true } }
      }
    ));

    addEvent(story, chatEvent(
      "wed-live-security-reply-work",
      752,
      "Виктор Сергеев",
      "security",
      "Рабочая версия будет проверена",
      "Хорошо. Сверим это с назначенными задачами и открытыми вами файлами. Дополнительный ответ сейчас не требуется.",
      {
        dialogueId: "security-wednesday-honest",
        replyToAction: "wed-security-claim-work",
        requires: { actionDone: "wed-security-claim-work" },
        effects: { setFlags: { securityCheckingWorkClaim: true } }
      }
    ));

    addEvent(story, chatEvent(
      "wed-live-security-reply-formal",
      750,
      "Виктор Сергеев",
      "security",
      "Вопрос направят письмом",
      "Принято. Дополнительный вопрос будет зарегистрирован отдельно. До получения письма ничего больше отправлять не нужно.",
      {
        dialogueId: "security-wednesday-honest",
        replyToAction: "wed-security-request-formal",
        requires: { actionDone: "wed-security-request-formal" },
        effects: { setFlags: { securityFormalQuestionPending: true } }
      }
    ));

    addEvent(story, chatEvent(
      "wed-live-security-tamper-followup",
      750,
      "Виктор Сергеев",
      "security",
      "Обнаружено изменение локального журнала",
      "Серверная копия не совпадает с локальной. Вы пытались изменить журнал после получения запроса пояснений? Ответьте прямо.",
      { requires: { flag: "auditServerCopyFound" } }
    ));

    addAction(story, securityAction({
      id: "wed-security-admit-tampering",
      dialogueId: "security-wednesday-tamper",
      choiceGroup: "wednesday-security-tamper",
      requires: { eventDelivered: "wed-live-security-tamper-followup" },
      optionLabel: "Признать попытку скрыть локальные записи",
      label: "Да. Я испугался и попытался скрыть локальные строки журнала. Серверную копию не трогал и доступ к ней не имел.",
      minutes: 5,
      result: "Игрок признал попытку изменить локальный журнал.",
      effects: {
        stats: { suspicion: 1, anxiety: -1 },
        setFlags: { securityAdmittedTampering: true },
        schedule: [{ eventId: "wed-live-security-reply-tamper-admit", dayIndex: 2, minute: 762 }]
      }
    }));

    addAction(story, securityAction({
      id: "wed-security-deny-tampering",
      dialogueId: "security-wednesday-tamper",
      choiceGroup: "wednesday-security-tamper",
      requires: { eventDelivered: "wed-live-security-tamper-followup" },
      optionLabel: "Отрицать изменение журнала",
      label: "Нет. Я ничего не менял. Возможно, локальный журнал повредился или не успел синхронизироваться.",
      minutes: 3,
      result: "Игрок отрицал изменение журнала вопреки серверной копии.",
      effects: {
        stats: { suspicion: 2, anxiety: 1 },
        setFlags: { securityDeniedTampering: true },
        schedule: [{ eventId: "wed-live-security-reply-tamper-deny", dayIndex: 2, minute: 760 }]
      }
    }));

    addEvent(story, chatEvent(
      "wed-live-security-reply-tamper-admit",
      762,
      "Виктор Сергеев",
      "security",
      "Признание добавлено к проверке",
      "Признание зафиксировано. До завершения проверки не удаляйте и не перемещайте служебные файлы. Часть прав будет временно ограничена.",
      {
        dialogueId: "security-wednesday-tamper",
        replyToAction: "wed-security-admit-tampering",
        requires: { actionDone: "wed-security-admit-tampering" },
        effects: { setFlags: { securityTamperCaseOpen: true } }
      }
    ));

    addEvent(story, chatEvent(
      "wed-live-security-reply-tamper-deny",
      760,
      "Виктор Сергеев",
      "security",
      "Отрицание не принято",
      "Версия синхронизации проверена: расхождение появилось после локальной операции удаления. Дальнейшие вопросы будут направлены руководителю отдела.",
      {
        dialogueId: "security-wednesday-tamper",
        replyToAction: "wed-security-deny-tampering",
        requires: { actionDone: "wed-security-deny-tampering" },
        effects: { stats: { suspicion: 1 }, trust: { chief: -1 }, setFlags: { securityEscalatedTampering: true } }
      }
    ));

    addEvent(story, chatEvent(
      "wed-live-security-blame-followup",
      800,
      "Виктор Сергеев",
      "security",
      "Уточнение по Диме Орлову",
      "В объяснении указано, что интерес к документам возник из-за действий Димы Орлова. Подтверждаете, что он просил вас искать закрытые сведения?",
      { requires: { flag: "dimaConfrontedPlayer" } }
    ));

    addAction(story, securityAction({
      id: "wed-security-retract-blame",
      dialogueId: "security-wednesday-blame",
      choiceGroup: "wednesday-security-blame",
      requires: { eventDelivered: "wed-live-security-blame-followup" },
      optionLabel: "Отозвать обвинение и взять ответственность на себя",
      label: "Нет. Дима ничего не просил и не направлял меня. Я упомянул его, потому что испугался последствий. Ответственность за запросы моя.",
      minutes: 5,
      result: "Игрок отозвал обвинение против Димы.",
      effects: {
        stats: { suspicion: 1, collateral: -1 },
        trust: { friend: 1 },
        setFlags: { retractedFriendBlame: true },
        schedule: [{ eventId: "wed-live-security-reply-retract", dayIndex: 2, minute: 812 }]
      }
    }));

    addAction(story, securityAction({
      id: "wed-security-confirm-blame",
      dialogueId: "security-wednesday-blame",
      choiceGroup: "wednesday-security-blame",
      requires: { eventDelivered: "wed-live-security-blame-followup" },
      optionLabel: "Подтвердить, что Дима подтолкнул к поиску",
      label: "Да. Он принёс слух и предложил проверить, что происходит. Без этого разговора я бы не стал искать документы.",
      minutes: 4,
      result: "Игрок подтвердил обвинение против Димы.",
      effects: {
        stats: { suspicion: -1, collateral: 1 },
        trust: { friend: -2 },
        setFlags: { confirmedFriendBlame: true },
        schedule: [{ eventId: "wed-live-security-reply-confirm", dayIndex: 2, minute: 810 }]
      }
    }));

    addEvent(story, chatEvent(
      "wed-live-security-reply-retract",
      812,
      "Виктор Сергеев",
      "security",
      "Уточнение принято",
      "Исправление добавлено к объяснению. Орлов будет исключён из этой части проверки, но первоначальная версия останется в истории документа.",
      {
        dialogueId: "security-wednesday-blame",
        replyToAction: "wed-security-retract-blame",
        requires: { actionDone: "wed-security-retract-blame" },
        effects: { setFlags: { friendRemovedFromAudit: true } }
      }
    ));

    addEvent(story, chatEvent(
      "wed-live-security-reply-confirm",
      810,
      "Виктор Сергеев",
      "security",
      "Показания подтверждены",
      "Подтверждение зарегистрировано. Орлову будет направлен отдельный запрос пояснений.",
      {
        dialogueId: "security-wednesday-blame",
        replyToAction: "wed-security-confirm-blame",
        requires: { actionDone: "wed-security-confirm-blame" },
        effects: { stats: { collateral: 1 }, setFlags: { friendAuditOpened: true } }
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
    HONEST_ACTION_IDS,
    TAMPER_ACTION_IDS,
    BLAME_ACTION_IDS,
    patchStory
  };
});
