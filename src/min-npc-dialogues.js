(function (root, factory) {
  const story = typeof module === "object" && module.exports
    ? require("./story-v2.js")
    : root?.UNTIL_FRIDAY_STORY;
  const api = factory(story);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UntilFridayMinNpcDialogues = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Story) {
  "use strict";

  const VERSION = 1;
  const PATCH_KEY = "minNpcDialoguesVersion";

  const ACTION_IDS = [
    "mon-tell-friend",
    "mon-friend-hide",
    "mon-friend-probe",
    "mon-friend-ask-changes",
    "mon-friend-ask-who-knows",
    "mon-friend-request-silence",
    "mon-friend-back-off",
    "tue-friend-ask-source",
    "tue-friend-ask-cover",
    "tue-friend-stop-search",
    "tue-friend-tell-late",
    "tue-friend-dismiss-again",
    "tue-answer-admin-honest",
    "tue-answer-admin-lie",
    "tue-answer-admin-deflect"
  ];

  const EVENT_IDS = [
    "mon-friend-reply-truth",
    "mon-friend-reply-hide",
    "mon-friend-reply-probe",
    "mon-friend-reply-changes",
    "mon-friend-reply-who-knows",
    "mon-friend-reply-silence",
    "mon-friend-reply-back-off",
    "tue-friend-rumor",
    "tue-friend-hidden-check",
    "tue-friend-probe-followup",
    "tue-friend-changes-followup",
    "tue-friend-reply-source",
    "tue-friend-reply-cover",
    "tue-friend-reply-stop",
    "tue-friend-reply-late-truth",
    "tue-friend-reply-dismiss-again",
    "tue-admin-question",
    "tue-admin-reply-honest",
    "tue-admin-reply-lie",
    "tue-admin-reply-deflect"
  ];

  function mergeFlags(effects, flags) {
    return {
      ...(effects || {}),
      setFlags: {
        ...(effects?.setFlags || {}),
        ...flags
      }
    };
  }

  function addAction(story, action) {
    story.actions ||= {};
    story.actions[action.id] = action;
    return action;
  }

  function addEvent(story, event) {
    story.events ||= {};
    story.events[event.id] = event;
    return event;
  }

  function chatAction({ id, dayIndex, contactKey, dialogueId, choiceGroup, label, minutes, requires, result, effects, focusCost = 0.25 }) {
    return {
      id,
      dayIndex,
      channel: "chat",
      contactKey,
      dialogueId,
      choiceGroup,
      label,
      messageText: label,
      minutes,
      focusCost,
      once: true,
      ...(requires ? { requires } : {}),
      result,
      effects: effects || {}
    };
  }

  function chatEvent({ id, dayIndex, minute, source, dialogueId, replyToAction, title, text, requires, effects }) {
    return {
      id,
      dayIndex,
      minute,
      type: "chat",
      source,
      contactKey: source === "Дима Орлов" ? "dima" : source === "Роман Белов" ? "roman" : undefined,
      dialogueId,
      replyToAction,
      title,
      text,
      ...(requires ? { requires } : {}),
      ...(effects ? { effects } : {})
    };
  }

  function patchExisting(story) {
    const tellFriend = story.actions?.["mon-tell-friend"];
    if (tellFriend) {
      tellFriend.contactKey = "dima";
      tellFriend.dialogueId = "dima-monday-opening";
      tellFriend.choiceGroup = "monday-dima-opening";
      tellFriend.optionLabel = "Рассказать о подслушанном разговоре";
      tellFriend.label = "Я перед отпуском слышал директора. В пятницу кому-то объявят кадровое решение. Кажется, речь может быть обо мне.";
      tellFriend.messageText = tellFriend.label;
      tellFriend.effects = mergeFlags(tellFriend.effects, {
        toldFriend: true,
        friendInvestigating: true
      });
    }

    const friendRumor = story.events?.["tue-friend-rumor"];
    if (friendRumor) {
      Object.assign(friendRumor, {
        source: "Дима Орлов",
        contactKey: "dima",
        dialogueId: "dima-tuesday-rumor",
        title: "Дима кое-что узнал",
        text: "Поспрашивал осторожно. Похоже, бумаги готовят не на одного человека, но фамилий никто не видел. Олег уверен больше всех, хотя знает меньше всех.",
        requires: { flag: "toldFriend" }
      });
    }

    const adminQuestion = story.events?.["tue-admin-question"];
    if (adminQuestion) {
      Object.assign(adminQuestion, {
        source: "Роман Белов",
        contactKey: "roman",
        dialogueId: "roman-tuesday-access",
        title: "Роман спрашивает о запросе доступа",
        text: "Зачем тебе вчера понадобилась папка руководства? Запрос прав остался в журнале.",
        requires: { flag: "requestedLeadershipAccess" }
      });
    }

    const honest = story.actions?.["tue-answer-admin-honest"];
    if (honest) {
      honest.contactKey = "roman";
      honest.dialogueId = "roman-tuesday-access";
      honest.optionLabel = "Сказать правду";
      honest.label = "Я искал документы о пятничной встрече. Понимаю, что не должен был запрашивать доступ.";
      honest.messageText = honest.label;
      honest.effects = mergeFlags(honest.effects, { answeredAdminHonestly: true });
    }

    const lie = story.actions?.["tue-answer-admin-lie"];
    if (lie) {
      lie.contactKey = "roman";
      lie.dialogueId = "roman-tuesday-access";
      lie.optionLabel = "Соврать о случайном открытии";
      lie.label = "Ничего специально не искал. Папка появилась в списке, я нажал и сразу закрыл.";
      lie.messageText = lie.label;
      lie.effects = mergeFlags(lie.effects, { liedToAdmin: true });
    }
  }

  function addMondayDima(story) {
    addAction(story, chatAction({
      id: "mon-friend-hide",
      dayIndex: 0,
      contactKey: "dima",
      dialogueId: "dima-monday-opening",
      choiceGroup: "monday-dima-opening",
      label: "Да всё нормально. После отпуска просто в рабочий ритм не вошёл.",
      minutes: 3,
      result: "Дима не поверил до конца, но отстал с вопросами.",
      effects: {
        stats: { anxiety: 1 },
        trust: { friend: -1 },
        setFlags: { hidConcernFromFriend: true }
      }
    }));

    addAction(story, chatAction({
      id: "mon-friend-probe",
      dayIndex: 0,
      contactKey: "dima",
      dialogueId: "dima-monday-opening",
      choiceGroup: "monday-dima-opening",
      label: "Ты сказал, что пятничное собрание вроде не про нас. Откуда ты это знаешь?",
      minutes: 4,
      result: "Дима объяснил, откуда взялся слух.",
      effects: {
        stats: { anxiety: 1 },
        trust: { friend: 1 },
        setFlags: { probedFriendRumor: true }
      }
    }));

    addAction(story, chatAction({
      id: "mon-friend-ask-changes",
      dayIndex: 0,
      contactKey: "dima",
      dialogueId: "dima-monday-opening",
      choiceGroup: "monday-dima-opening",
      label: "Лучше скажи, что изменилось, пока меня не было.",
      minutes: 4,
      result: "Дима перечислил странности последних дней.",
      effects: {
        trust: { friend: 1 },
        setFlags: { askedFriendAboutChanges: true }
      }
    }));

    addEvent(story, chatEvent({
      id: "mon-friend-reply-truth",
      dayIndex: 0,
      minute: 535,
      source: "Дима Орлов",
      dialogueId: "dima-monday-opening",
      replyToAction: "mon-tell-friend",
      title: "Дима отвечает",
      text: "Погоди. Ты уверен, что речь была именно о тебе? Я осторожно поспрашиваю, только не лезь пока в кадровые папки.",
      requires: { actionDone: "mon-tell-friend" },
      effects: { setFlags: { friendInvestigating: true } }
    }));

    addEvent(story, chatEvent({
      id: "mon-friend-reply-hide",
      dayIndex: 0,
      minute: 534,
      source: "Дима Орлов",
      dialogueId: "dima-monday-opening",
      replyToAction: "mon-friend-hide",
      title: "Дима не поверил",
      text: "После отпуска ты обычно не такой. Ладно, не хочешь говорить — не буду давить.",
      requires: { actionDone: "mon-friend-hide" }
    }));

    addEvent(story, chatEvent({
      id: "mon-friend-reply-probe",
      dayIndex: 0,
      minute: 535,
      source: "Дима Орлов",
      dialogueId: "dima-monday-opening",
      replyToAction: "mon-friend-probe",
      title: "Источник слуха",
      text: "Олег утром трепался про бумаги со второго этажа. Он половину додумывает, поэтому я и сказал «вроде».",
      requires: { actionDone: "mon-friend-probe" }
    }));

    addEvent(story, chatEvent({
      id: "mon-friend-reply-changes",
      dayIndex: 0,
      minute: 536,
      source: "Дима Орлов",
      dialogueId: "dima-monday-opening",
      replyToAction: "mon-friend-ask-changes",
      title: "Что изменилось",
      text: "Людей тасуют между проектами, Андрей дважды закрывался с кадровиком, а Роман чистит права на общем диске. Может, обычная реорганизация.",
      requires: { actionDone: "mon-friend-ask-changes" }
    }));

    const followupRequires = { eventDelivered: "mon-friend-reply-truth" };
    addAction(story, chatAction({
      id: "mon-friend-ask-who-knows",
      dayIndex: 0,
      contactKey: "dima",
      dialogueId: "dima-monday-followup",
      choiceGroup: "monday-dima-followup",
      label: "Кто ещё об этом знает?",
      minutes: 3,
      requires: followupRequires,
      result: "Дима признался, что пока ни с кем не говорил.",
      effects: {
        trust: { friend: 1 },
        setFlags: { askedFriendWhoKnows: true }
      }
    }));

    addAction(story, chatAction({
      id: "mon-friend-request-silence",
      dayIndex: 0,
      contactKey: "dima",
      dialogueId: "dima-monday-followup",
      choiceGroup: "monday-dima-followup",
      label: "Только никому не говори. Особенно Олегу.",
      minutes: 2,
      requires: followupRequires,
      result: "Дима согласился молчать, но не обещал врать.",
      effects: {
        trust: { friend: 1 },
        setFlags: { askedFriendForSilence: true }
      }
    }));

    addAction(story, chatAction({
      id: "mon-friend-back-off",
      dayIndex: 0,
      contactKey: "dima",
      dialogueId: "dima-monday-followup",
      choiceGroup: "monday-dima-followup",
      label: "Ладно. Забудь, что я сказал.",
      minutes: 2,
      requires: followupRequires,
      result: "Разговор оборвался неловко.",
      effects: {
        stats: { anxiety: 1 },
        trust: { friend: -1 },
        setFlags: { backedOffFromFriend: true }
      }
    }));

    addEvent(story, chatEvent({
      id: "mon-friend-reply-who-knows",
      dayIndex: 0,
      minute: 545,
      source: "Дима Орлов",
      dialogueId: "dima-monday-followup",
      replyToAction: "mon-friend-ask-who-knows",
      title: "Кто знает",
      text: "Кроме меня — теперь никто. Но Олег явно что-то слышал и скоро разнесёт свою версию по этажу.",
      requires: { actionDone: "mon-friend-ask-who-knows" }
    }));

    addEvent(story, chatEvent({
      id: "mon-friend-reply-silence",
      dayIndex: 0,
      minute: 544,
      source: "Дима Орлов",
      dialogueId: "dima-monday-followup",
      replyToAction: "mon-friend-request-silence",
      title: "Дима согласился молчать",
      text: "Я и не собирался рассказывать. Но если начнут спрашивать напрямую, врать за тебя не буду.",
      requires: { actionDone: "mon-friend-request-silence" }
    }));

    addEvent(story, chatEvent({
      id: "mon-friend-reply-back-off",
      dayIndex: 0,
      minute: 544,
      source: "Дима Орлов",
      dialogueId: "dima-monday-followup",
      replyToAction: "mon-friend-back-off",
      title: "Разговор закончен",
      text: "Поздно уже забывать. Но ладно, это останется между нами.",
      requires: { actionDone: "mon-friend-back-off" }
    }));
  }

  function addTuesdayDima(story) {
    addEvent(story, chatEvent({
      id: "tue-friend-hidden-check",
      dayIndex: 1,
      minute: 552,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-hidden",
      title: "Дима снова спрашивает",
      text: "Ты вчера сказал, что всё нормально, но сейчас опять смотришь на дверь директора. Всё-таки что-то случилось?",
      requires: { flag: "hidConcernFromFriend" }
    }));

    addEvent(story, chatEvent({
      id: "tue-friend-probe-followup",
      dayIndex: 1,
      minute: 553,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-probe",
      title: "Дима проверил слух",
      text: "Проверил слова Олега. Фамилии он не знает. Видел только кадровика с пустой папкой приказа и сам придумал остальное.",
      requires: { flag: "probedFriendRumor" }
    }));

    addEvent(story, chatEvent({
      id: "tue-friend-changes-followup",
      dayIndex: 1,
      minute: 554,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-changes",
      title: "Ещё одна странность",
      text: "Вчера ты спрашивал, что поменялось. Сегодня Роман снял доступ к общему диску у двух сотрудников. Может, чистка прав, а может, готовят передачу дел.",
      requires: { flag: "askedFriendAboutChanges" }
    }));

    const rumorRequires = { eventDelivered: "tue-friend-rumor" };
    addAction(story, chatAction({
      id: "tue-friend-ask-source",
      dayIndex: 1,
      contactKey: "dima",
      dialogueId: "dima-tuesday-rumor",
      choiceGroup: "tuesday-dima-rumor",
      label: "Кто тебе это сказал?",
      minutes: 3,
      requires: rumorRequires,
      result: "Дима назвал цепочку слуха, но не смог подтвердить её.",
      effects: {
        trust: { friend: 1 },
        setFlags: { askedTuesdayRumorSource: true }
      }
    }));

    addAction(story, chatAction({
      id: "tue-friend-ask-cover",
      dayIndex: 1,
      contactKey: "dima",
      dialogueId: "dima-tuesday-rumor",
      choiceGroup: "tuesday-dima-rumor",
      label: "Если начнут спрашивать, ты подтвердишь, что я нормально работал?",
      minutes: 4,
      requires: rumorRequires,
      result: "Дима согласился говорить только то, что видел сам.",
      effects: {
        trust: { friend: 1 },
        setFlags: { askedFriendToCover: true }
      }
    }));

    addAction(story, chatAction({
      id: "tue-friend-stop-search",
      dayIndex: 1,
      contactKey: "dima",
      dialogueId: "dima-tuesday-rumor",
      choiceGroup: "tuesday-dima-rumor",
      label: "Больше ничего не узнавай. Слухи только мешают.",
      minutes: 2,
      requires: rumorRequires,
      result: "Дима прекратил расспросы.",
      effects: {
        stats: { anxiety: -1 },
        setFlags: { stoppedFriendInvestigation: true }
      }
    }));

    addEvent(story, chatEvent({
      id: "tue-friend-reply-source",
      dayIndex: 1,
      minute: 566,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-rumor",
      replyToAction: "tue-friend-ask-source",
      title: "Цепочка слуха",
      text: "Олег услышал секретаря, секретарь говорила про несколько комплектов документов. Всё. Остальное — догадки.",
      requires: { actionDone: "tue-friend-ask-source" }
    }));

    addEvent(story, chatEvent({
      id: "tue-friend-reply-cover",
      dayIndex: 1,
      minute: 567,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-rumor",
      replyToAction: "tue-friend-ask-cover",
      title: "Дима ответил",
      text: "Скажу, что видел: ты задачи закрывал. Придумывать за тебя ничего не стану.",
      requires: { actionDone: "tue-friend-ask-cover" }
    }));

    addEvent(story, chatEvent({
      id: "tue-friend-reply-stop",
      dayIndex: 1,
      minute: 565,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-rumor",
      replyToAction: "tue-friend-stop-search",
      title: "Расспросы закончены",
      text: "Хорошо. Тогда работаем как обычно. Насколько это вообще сейчас возможно.",
      requires: { actionDone: "tue-friend-stop-search" }
    }));

    const hiddenRequires = { eventDelivered: "tue-friend-hidden-check" };
    addAction(story, chatAction({
      id: "tue-friend-tell-late",
      dayIndex: 1,
      contactKey: "dima",
      dialogueId: "dima-tuesday-hidden",
      choiceGroup: "tuesday-dima-hidden",
      label: "Ладно. Я слышал разговор директора и кадровика. В пятницу кому-то объявят решение.",
      minutes: 5,
      requires: hiddenRequires,
      result: "Игрок всё-таки рассказал Диме о разговоре.",
      effects: {
        stats: { anxiety: -1 },
        trust: { friend: 1 },
        setFlags: { toldFriendLate: true, friendInvestigating: true }
      }
    }));

    addAction(story, chatAction({
      id: "tue-friend-dismiss-again",
      dayIndex: 1,
      contactKey: "dima",
      dialogueId: "dima-tuesday-hidden",
      choiceGroup: "tuesday-dima-hidden",
      label: "Ничего не случилось. Давай закроем тему.",
      minutes: 2,
      requires: hiddenRequires,
      result: "Дима перестал задавать вопросы.",
      effects: {
        trust: { friend: -2 },
        setFlags: { dismissedFriendTwice: true }
      }
    }));

    addEvent(story, chatEvent({
      id: "tue-friend-reply-late-truth",
      dayIndex: 1,
      minute: 564,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-hidden",
      replyToAction: "tue-friend-tell-late",
      title: "Позднее признание",
      text: "Вот теперь понятно. Вчера мог сразу сказать. Я поспрашиваю, но времени уже меньше.",
      requires: { actionDone: "tue-friend-tell-late" }
    }));

    addEvent(story, chatEvent({
      id: "tue-friend-reply-dismiss-again",
      dayIndex: 1,
      minute: 560,
      source: "Дима Орлов",
      dialogueId: "dima-tuesday-hidden",
      replyToAction: "tue-friend-dismiss-again",
      title: "Дима отступил",
      text: "Хорошо. Тогда больше не спрашиваю.",
      requires: { actionDone: "tue-friend-dismiss-again" }
    }));
  }

  function addTuesdayRoman(story) {
    addAction(story, chatAction({
      id: "tue-answer-admin-deflect",
      dayIndex: 1,
      contactKey: "roman",
      dialogueId: "roman-tuesday-access",
      choiceGroup: "tuesday-admin",
      label: "А почему тебя вообще интересует, какие документы я искал?",
      minutes: 4,
      requires: { eventDelivered: "tue-admin-question" },
      result: "Роман не принял попытку перевести разговор.",
      effects: {
        stats: { suspicion: 2, anxiety: 1 },
        trust: { admin: -2 },
        setFlags: { deflectedAdminQuestion: true }
      }
    }));

    addEvent(story, chatEvent({
      id: "tue-admin-reply-honest",
      dayIndex: 1,
      minute: 574,
      source: "Роман Белов",
      dialogueId: "roman-tuesday-access",
      replyToAction: "tue-answer-admin-honest",
      title: "Роман закрыл вопрос",
      text: "Хорошо. Закрою запрос как ошибочный. Больше туда не лезь: серверный журнал всё равно хранит историю.",
      requires: { actionDone: "tue-answer-admin-honest" },
      effects: { setFlags: { adminWarnedAboutServerLog: true } }
    }));

    addEvent(story, chatEvent({
      id: "tue-admin-reply-lie",
      dayIndex: 1,
      minute: 572,
      source: "Роман Белов",
      dialogueId: "roman-tuesday-access",
      replyToAction: "tue-answer-admin-lie",
      title: "Роман не поверил",
      text: "Папки сами случайно не запрашивают права. Я оставлю запись как есть.",
      requires: { actionDone: "tue-answer-admin-lie" },
      effects: { setFlags: { adminKeptAccessRecord: true } }
    }));

    addEvent(story, chatEvent({
      id: "tue-admin-reply-deflect",
      dayIndex: 1,
      minute: 572,
      source: "Роман Белов",
      dialogueId: "roman-tuesday-access",
      replyToAction: "tue-answer-admin-deflect",
      title: "Роман ответил жёстко",
      text: "Не моя задача обсуждать кадровые решения. Моя задача — видеть, кто куда ходит. На вопрос ты не ответил.",
      requires: { actionDone: "tue-answer-admin-deflect" },
      effects: { setFlags: { adminConversationEscalated: true } }
    }));
  }

  function patchStory(story = Story) {
    if (!story || typeof story !== "object") return story;
    story.metadata ||= {};
    if (Number(story.metadata[PATCH_KEY] || 0) >= VERSION) return story;

    patchExisting(story);
    addMondayDima(story);
    addTuesdayDima(story);
    addTuesdayRoman(story);

    story.metadata[PATCH_KEY] = VERSION;
    return story;
  }

  patchStory();

  return {
    VERSION,
    ACTION_IDS,
    EVENT_IDS,
    patchStory
  };
});