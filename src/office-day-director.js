(function (root) {
  "use strict";

  if (root.UntilFridayOfficeDayDirector) return;

  const Runtime = root.UntilFridayRuntimeEngine;
  const Min = root.UntilFridayMinMessenger;
  const Integration = root.UntilFridayMinDesktopIntegration;
  if (!Runtime || !Min) return;

  const STORAGE_KEY = Min.STORAGE_KEY;
  const WEEK_START = Date.UTC(2026, 7, 3, 0, 0, 0);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function createDirector(config = {}) {
    const id = String(config.id || "workday");
    const dayIndex = Number(config.dayIndex || 0);
    const metadataKey = String(config.metadataKey || `${id}Director`);
    const messagePrefix = String(config.messagePrefix || `${id}-director`);
    const contacts = config.contacts && typeof config.contacts === "object" ? config.contacts : {};
    const beats = Array.isArray(config.beats) ? config.beats : [];
    const pending = new Set();
    let processing = false;
    let retryTimer = null;

    function stateNow() {
      return Runtime.getEngine?.()?.getState?.() || null;
    }

    function directorData(state = stateNow()) {
      const source = state?.metadata?.[metadataKey];
      return {
        version: Number(config.version || 1),
        delivered: source?.delivered && typeof source.delivered === "object" ? source.delivered : {}
      };
    }

    function beatDelivered(state, beatId) {
      return Boolean(directorData(state).delivered[beatId]);
    }

    function dueBeats(state = stateNow()) {
      if (!state || state.ended || !state.dayStarted || Number(state.dayIndex) !== dayIndex) return [];
      const minute = Number(state.minute || 0);
      return beats.filter((beat) => {
        if (!beat || !beat.id || minute < Number(beat.minute || 0)) return false;
        if (beatDelivered(state, beat.id) || pending.has(beat.id)) return false;
        try {
          return typeof beat.when === "function" ? Boolean(beat.when(state)) : true;
        } catch (error) {
          console.warn(`${id} director condition failed`, beat.id, error);
          return false;
        }
      });
    }

    function createdAt(recordDayIndex, minute) {
      const day = Math.max(0, Number(recordDayIndex) || 0);
      const value = Math.max(0, Number(minute) || 0);
      return new Date(WEEK_START + day * 86400000 + value * 60000).toISOString();
    }

    function dispatchMinState(json, reason) {
      try {
        root.dispatchEvent(new root.StorageEvent("storage", {
          key: STORAGE_KEY,
          oldValue: null,
          newValue: json,
          storageArea: root.localStorage,
          url: root.location?.href || ""
        }));
      } catch {
        const event = typeof root.Event === "function" ? new root.Event("storage") : { type: "storage" };
        try {
          Object.defineProperty(event, "key", { value: STORAGE_KEY });
          Object.defineProperty(event, "newValue", { value: json });
        } catch {}
        root.dispatchEvent?.(event);
      }
      try {
        root.dispatchEvent(new root.CustomEvent("until-friday-min-state-change", { detail: { reason } }));
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
        dispatchMinState(json, reason);
        Min.refreshAll?.();
        Integration?.updateBadge?.();
        return true;
      } catch (error) {
        console.warn(`${id} director could not update MIN`, error);
        return false;
      }
    }

    function ensureContact(state, contact) {
      state.users ||= [];
      state.contacts ||= [];
      state.chats ||= [];
      state.messages ||= [];

      let user = state.users.find((item) => item.id === contact.userId);
      const userPatch = {
        id: contact.userId,
        name: contact.name,
        username: contact.username,
        letter: contact.name.slice(0, 1).toUpperCase(),
        color: contact.color,
        status: contact.status || `${contact.role} · внутренняя сеть`,
        workContact: true
      };
      if (!user) {
        user = userPatch;
        state.users.push(user);
      } else {
        Object.assign(user, userPatch, { status: user.status || userPatch.status });
      }
      if (!state.contacts.includes(contact.userId)) state.contacts.push(contact.userId);

      let chat = state.chats.find((item) => item.id === contact.chatId);
      const chatPatch = {
        id: contact.chatId,
        type: "private",
        title: contact.name,
        memberIds: ["self", contact.userId],
        createdAt: chat?.createdAt || createdAt(0, 480),
        pinned: Boolean(chat?.pinned),
        archived: Boolean(chat?.archived),
        muted: Boolean(chat?.muted),
        unread: Number(chat?.unread || 0),
        color: contact.color,
        description: `${contact.role}. Служебная переписка из корпоративной сети.`,
        workChat: true
      };
      if (!chat) {
        chat = chatPatch;
        state.chats.unshift(chat);
      } else {
        Object.assign(chat, chatPatch);
      }
      return { user, chat };
    }

    function setTyping(contactKey, active) {
      const contact = contacts[contactKey];
      if (!contact) return false;
      return mutateMinState((state) => {
        const { user } = ensureContact(state, contact);
        user.status = active ? "печатает…" : `${contact.role} · внутренняя сеть`;
      }, active ? `${id}-typing` : `${id}-online`);
    }

    function insertMessage(beat, state) {
      const record = directorData(state).delivered[beat.id] || {};
      const contact = contacts[record.contact || beat.contact];
      if (!contact) return false;
      const messageId = `${messagePrefix}-${beat.id}`;
      const text = String(record.text || beat.text?.(state) || "").trim();
      const minute = Number(record.minute ?? state?.minute ?? beat.minute);
      const recordDay = Number(record.dayIndex ?? dayIndex);
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
          createdAt: createdAt(recordDay, minute),
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
      }, `${id}-message`);
    }

    function repairMessages(state = stateNow()) {
      if (!state) return 0;
      const delivered = directorData(state).delivered;
      let repaired = 0;
      Object.keys(delivered).forEach((beatId) => {
        if (pending.has(beatId)) return;
        const beat = beats.find((item) => item.id === beatId);
        if (beat && insertMessage(beat, state)) repaired += 1;
      });
      return repaired;
    }

    function claimBeat(beat, state) {
      const current = Runtime.getEngine?.();
      if (!current) return null;
      let text = "";
      try {
        text = String(beat.text?.(state) || "").trim();
      } catch (error) {
        console.warn(`${id} director text failed`, beat.id, error);
        return null;
      }
      if (!text) return null;

      const result = current.updateState((draft) => {
        draft.metadata ||= {};
        const director = draft.metadata[metadataKey] && typeof draft.metadata[metadataKey] === "object"
          ? draft.metadata[metadataKey]
          : { version: Number(config.version || 1), delivered: {} };
        director.version = Number(config.version || 1);
        director.delivered ||= {};
        director.delivered[beat.id] ||= {
          dayIndex,
          minute: Number(state.minute || 0),
          contact: beat.contact,
          text
        };
        draft.metadata[metadataKey] = director;
      }, `${id}-beat`);
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

      const typingDelay = Math.max(0, Number(options.typingDelay ?? config.typingDelay ?? 850));
      if (typingDelay > 0) setTyping(beat.contact, true);
      const complete = () => {
        insertMessage(beat, claimed);
        pending.delete(beat.id);
        scheduleEvaluate(350);
      };
      if (typeof root.setTimeout === "function") root.setTimeout(complete, typingDelay);
      else complete();
      return true;
    }

    function evaluate(state = stateNow()) {
      if (processing) return false;
      repairMessages(state);
      const beat = dueBeats(state)[0];
      return beat ? deliverBeat(beat, state) : false;
    }

    function scheduleEvaluate(delay = 0) {
      if (retryTimer && typeof root.clearTimeout === "function") root.clearTimeout(retryTimer);
      if (typeof root.setTimeout !== "function") return evaluate();
      retryTimer = root.setTimeout(() => {
        retryTimer = null;
        evaluate();
      }, Math.max(0, Number(delay) || 0));
      return retryTimer;
    }

    const stateHandler = (event) => {
      if (processing || event.detail?.reason === `${id}-beat`) return;
      evaluate(event.detail?.state);
    };
    const minHandler = () => scheduleEvaluate(50);
    const readyHandler = () => scheduleEvaluate(100);

    root.addEventListener?.("until-friday-state-change", stateHandler);
    root.addEventListener?.("until-friday-min-state-change", minHandler);
    root.addEventListener?.("until-friday-app-ready", readyHandler);
    root.addEventListener?.("DOMContentLoaded", () => scheduleEvaluate(150), { once: true });

    const api = {
      id,
      dayIndex,
      metadataKey,
      messagePrefix,
      contacts,
      beats,
      pending,
      stateNow,
      directorData,
      beatDelivered,
      dueBeats,
      createdAt,
      setTyping,
      insertMessage,
      repairMessages,
      claimBeat,
      deliverBeat,
      evaluate,
      scheduleEvaluate,
      destroy() {
        root.removeEventListener?.("until-friday-state-change", stateHandler);
        root.removeEventListener?.("until-friday-min-state-change", minHandler);
        root.removeEventListener?.("until-friday-app-ready", readyHandler);
        if (retryTimer && typeof root.clearTimeout === "function") root.clearTimeout(retryTimer);
      },
      snapshot: () => clone(directorData())
    };

    scheduleEvaluate(0);
    return api;
  }

  root.UntilFridayOfficeDayDirector = {
    STORAGE_KEY,
    WEEK_START,
    createDirector
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
