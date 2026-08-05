(function (root) {
  "use strict";

  if (root.UntilFridayMondayOfficeDirector) return;

  const Runtime = root.UntilFridayRuntimeEngine;
  const Min = root.UntilFridayMinMessenger;
  const Integration = root.UntilFridayMinDesktopIntegration;
  const Office = root.UntilFridayOfficeWorkPack;
  if (!Runtime || !Min || !Office) return;

  const VERSION = 1;
  const STORAGE_KEY = Min.STORAGE_KEY;
  const WORK_START = Date.UTC(2026, 7, 3, 0, 0, 0);
  const pending = new Set();
  let processing = false;
  let retryTimer = null;

  const CONTACTS = Object.freeze({
    dima: {
      userId: "work-dima",
      chatId: "work-chat-dima",
      name: "Дима Орлов",
      username: "d.orlov",
      role: "соседний стол",
      color: "#4e9a72"
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

  function officeCompletedIds(state) {
    const completed = state?.metadata?.officeWork?.completed;
    return new Set(completed && typeof completed === "object" ? Object.keys(completed) : []);
  }

  function officeCompletedCount(state) {
    return officeCompletedIds(state).size;
  }

  function actionDone(state, actionId) {
    return Boolean(state?.completedActions?.[actionId]);
  }

  function reportDone(state) {
    return actionDone(state, "mon-report-final") || actionDone(state, "mon-report-old");
  }

  function invoiceDecisionDone(state) {
    return actionDone(state, "mon-invoice-fix") || actionDone(state, "mon-invoice-report");
  }

  function directorData(state) {
    const source = state?.metadata?.mondayDirector;
    return {
      version: VERSION,
      delivered: source?.delivered && typeof source.delivered === "object" ? source.delivered : {}
    };
  }

  function beatDelivered(state, beatId) {
    return Boolean(directorData(state).delivered[beatId]);
  }

  function dimaEveningText(state) {
    if (state?.flags?.toldFriend) {
      return "Я пока ничего точного не узнал. Олег несёт три разные версии, а Андрей после обеда почти не выходил из кабинета. Завтра попробую ещё поспрашивать.";
    }
    if (state?.flags?.hidConcernFromFriend) {
      return "Ты весь день был какой-то дёрганый. Я не лезу, как обещал, но если что-то случилось — лучше скажи мне раньше Олега.";
    }
    if (state?.flags?.probedFriendRumor || state?.flags?.askedFriendAboutChanges) {
      return "К вечеру яснее не стало. Права на диске всё ещё чистят, а пятничную переговорную закрыли на час. Может, обычная реорганизация. Может, нет.";
    }
    return "Первый день после отпуска пережил? В отделе сегодня все делали вид, что работают как обычно. Даже слишком старательно.";
  }

  function lateWorkText(state) {
    const missing = [];
    if (!reportDone(state)) missing.push("июльский отчёт");
    if (!invoiceDecisionDone(state)) missing.push("решение по счёту 7814");
    if (missing.length === 2) return "До конца смены меньше часа. У тебя всё ещё не закрыты июльский отчёт и решение по счёту 7814.";
    if (missing.length === 1) return `До конца смены меньше часа. Не забудь закрыть ${missing[0]}.`;
    return "Основные вопросы на сегодня закрыты. Перед уходом проверь, что нужные файлы сохранились на общем диске.";
  }

  const BEATS = Object.freeze([
    {
      id: "morning-stalled",
      minute: 600,
      contact: "andrey",
      when: (state) => officeCompletedCount(state) === 0,
      text: () => "Утренняя сводка всё ещё висит без результата. После отпуска можно войти в ритм, но не до обеда."
    },
    {
      id: "steady-three",
      minute: 0,
      contact: "andrey",
      when: (state) => officeCompletedCount(state) >= 3 && Number(state.minute || 0) < 900,
      text: () => "Вижу, очередь двигается. Продолжай в том же темпе и не потеряй основные задачи среди мелких поручений."
    },
    {
      id: "midday-behind",
      minute: 780,
      contact: "andrey",
      when: (state) => officeCompletedCount(state) < 3,
      text: () => "К обеду закрыто меньше трёх поручений. Разберись с очередью, иначе всё это переедет на завтра."
    },
    {
      id: "invoice-bridge",
      minute: 805,
      contact: "andrey",
      when: (state) => officeCompletedIds(state).has("office-mon-invoice-fix") && !invoiceDecisionDone(state),
      text: () => "Расчёт в рабочем поручении исправлен. Теперь отдельно реши, что делать с самим счётом 7814: тихо поправить или зафиксировать как нарушение."
    },
    {
      id: "daily-quota",
      minute: 0,
      contact: "andrey",
      when: (state) => officeCompletedCount(state) >= Number(Office.DAILY_QUOTA || 5),
      text: () => "Дневную норму по поручениям закрыл. Это заметно. Остальные карточки можно брать ради результата, но отчёт и счёт важнее."
    },
    {
      id: "late-main-work",
      minute: 1005,
      contact: "andrey",
      when: () => true,
      text: lateWorkText
    },
    {
      id: "dima-evening",
      minute: 1018,
      contact: "dima",
      when: () => true,
      text: dimaEveningText
    }
  ]);

  function dueBeats(state) {
    if (!state || state.ended || !state.dayStarted || Number(state.dayIndex) !== 0) return [];
    const minute = Number(state.minute || 0);
    return BEATS.filter((beat) =>
      minute >= beat.minute &&
      !beatDelivered(state, beat.id) &&
      !pending.has(beat.id) &&
      beat.when(state)
    );
  }

  function createdAt(minute) {
    return new Date(WORK_START + Math.max(0, Number(minute) || 0) * 60000).toISOString();
  }

  function dispatchMinStorage(json, reason) {
    try {
      root.dispatchEvent(new StorageEvent("storage", {
        key: STORAGE_KEY,
        oldValue: null,
        newValue: json,
        storageArea: root.localStorage,
        url: root.location?.href || ""
      }));
    } catch {
      const event = typeof Event === "function" ? new Event("storage") : { type: "storage" };
      try {
        Object.defineProperty(event, "key", { value: STORAGE_KEY });
        Object.defineProperty(event, "newValue", { value: json });
      } catch {}
      root.dispatchEvent?.(event);
    }
    try {
      root.dispatchEvent(new CustomEvent("until-friday-min-state-change", { detail: { reason } }));
    } catch {}
  }

  function mutateMinState(updater, reason) {
    try {
      const raw = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || "{}");
      const state = Min.normalize(raw);
      const before = JSON.stringify(state);
      updater(state);
      if (JSON.stringify(state) === before) return false;
      state.updatedAt = new Date().toISOString();
      const json = JSON.stringify(state);
      root.localStorage?.setItem(STORAGE_KEY, json);
      dispatchMinStorage(json, reason);
      Min.refreshAll?.();
      Integration?.updateBadge?.();
      return true;
    } catch (error) {
      console.warn("Monday director could not update MIN", error);
      return false;
    }
  }

  function ensureContact(state, contact) {
    let user = state.users.find((item) => item.id === contact.userId);
    if (!user) {
      user = {
        id: contact.userId,
        name: contact.name,
        username: contact.username,
        letter: contact.name.slice(0, 1).toUpperCase(),
        color: contact.color,
        status: `${contact.role} · внутренняя сеть`,
        workContact: true
      };
      state.users.push(user);
    }
    if (!state.contacts.includes(contact.userId)) state.contacts.push(contact.userId);

    let chat = state.chats.find((item) => item.id === contact.chatId);
    if (!chat) {
      chat = {
        id: contact.chatId,
        type: "private",
        title: contact.name,
        memberIds: ["self", contact.userId],
        createdAt: createdAt(480),
        pinned: false,
        archived: false,
        muted: false,
        unread: 0,
        color: contact.color,
        description: `${contact.role}. Служебная переписка из корпоративной сети.`,
        workChat: true
      };
      state.chats.unshift(chat);
    }
    return { user, chat };
  }

  function setTyping(contactKey, active) {
    const contact = CONTACTS[contactKey];
    if (!contact) return false;
    return mutateMinState((state) => {
      const { user } = ensureContact(state, contact);
      user.status = active ? "печатает…" : `${contact.role} · внутренняя сеть`;
    }, active ? "monday-director-typing" : "monday-director-online");
  }

  function insertMessage(beat, state) {
    const contact = CONTACTS[beat.contact];
    if (!contact) return false;
    const messageId = `monday-director-${beat.id}`;
    const text = String(beat.text(state) || "").trim();
    if (!text) return false;

    return mutateMinState((minState) => {
      const { user, chat } = ensureContact(minState, contact);
      user.status = `${contact.role} · внутренняя сеть`;
      if (minState.messages.some((message) => message.id === messageId)) return;
      minState.messages.push({
        id: messageId,
        chatId: contact.chatId,
        senderId: contact.userId,
        text,
        createdAt: createdAt(state.minute),
        editedAt: null,
        deleted: false,
        pinned: false,
        attachments: [],
        replyTo: null,
        forwardedFrom: null,
        reactions: {},
        status: "delivered",
        storyMessage: true,
        directorMessage: true,
        storySourceId: beat.id
      });
      chat.unread = Number(chat.unread || 0) + 1;
    }, "monday-director-message");
  }

  function claimBeat(beat, state) {
    const current = Runtime.getEngine?.();
    if (!current) return null;
    const result = current.updateState((draft) => {
      draft.metadata ||= {};
      const director = draft.metadata.mondayDirector && typeof draft.metadata.mondayDirector === "object"
        ? draft.metadata.mondayDirector
        : { version: VERSION, delivered: {} };
      director.version = VERSION;
      director.delivered ||= {};
      if (!director.delivered[beat.id]) {
        director.delivered[beat.id] = {
          dayIndex: 0,
          minute: Number(state.minute || 0),
          contact: beat.contact
        };
        draft.journal ||= [];
        draft.journal.push({
          id: `monday-director-${beat.id}`,
          dayIndex: 0,
          minute: Number(state.minute || 0),
          type: "office-director",
          text: `Реакция рабочего дня: ${beat.id}`
        });
      }
      draft.metadata.mondayDirector = director;
    }, "monday-director-beat");
    return result?.ok ? result.state : null;
  }

  function deliverBeat(beat, state, options = {}) {
    if (!beat || pending.has(beat.id)) return false;
    pending.add(beat.id);
    processing = true;
    const claimed = options.skipClaim ? state : claimBeat(beat, state);
    processing = false;
    if (!claimed) {
      pending.delete(beat.id);
      return false;
    }

    const typingDelay = Math.max(0, Number(options.typingDelay ?? 850));
    if (typingDelay > 0) setTyping(beat.contact, true);
    root.setTimeout?.(() => {
      insertMessage(beat, claimed);
      pending.delete(beat.id);
      scheduleEvaluate(350);
    }, typingDelay);
    return true;
  }

  function evaluate(state) {
    if (processing) return false;
    const currentState = state || Runtime.getEngine?.()?.getState?.();
    const beat = dueBeats(currentState)[0];
    return beat ? deliverBeat(beat, currentState) : false;
  }

  function scheduleEvaluate(delay = 0) {
    if (retryTimer) root.clearTimeout?.(retryTimer);
    retryTimer = root.setTimeout?.(() => {
      retryTimer = null;
      evaluate();
    }, Math.max(0, Number(delay) || 0));
  }

  root.addEventListener?.("until-friday-state-change", (event) => {
    if (processing || event.detail?.reason === "monday-director-beat") return;
    evaluate(event.detail?.state);
  });

  root.addEventListener?.("until-friday-app-ready", () => scheduleEvaluate(100));
  root.addEventListener?.("DOMContentLoaded", () => scheduleEvaluate(150), { once: true });

  root.UntilFridayMondayOfficeDirector = {
    VERSION,
    BEATS,
    CONTACTS,
    officeCompletedIds,
    officeCompletedCount,
    reportDone,
    invoiceDecisionDone,
    directorData,
    beatDelivered,
    dimaEveningText,
    lateWorkText,
    dueBeats,
    insertMessage,
    claimBeat,
    deliverBeat,
    evaluate
  };

  scheduleEvaluate(0);
})(typeof globalThis !== "undefined" ? globalThis : window);
