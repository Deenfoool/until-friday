(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UntilFridayEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAVE_VERSION = 2;
  const DEFAULT_START_MINUTE = 8 * 60 + 47;
  const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

  function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hashString(input) {
    let hash = 2166136261;
    const text = String(input ?? "until-friday");
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededUnit(seed) {
    let value = hashString(seed) || 1;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  }

  function chooseWeighted(items, seed) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 1), 0);
    let cursor = seededUnit(seed) * total;
    for (const item of items) {
      cursor -= Math.max(0, Number(item.weight) || 1);
      if (cursor <= 0) return item.id;
    }
    return items.at(-1).id;
  }

  function defaultStats() {
    return {
      work: 0,
      suspicion: 0,
      evidence: 0,
      anxiety: 1,
      access: 0,
      loyalty: 0,
      money: 0,
      collateral: 0
    };
  }

  function createState(story, options = {}) {
    if (!story || !Array.isArray(story.days)) throw new Error("Story must contain a days array.");
    const seed = String(options.seed || `${Date.now()}-${Math.random()}`);
    const truthId = options.truthId || chooseWeighted(story.truths || [], seed);
    return {
      version: SAVE_VERSION,
      seed,
      truthId,
      dayIndex: 0,
      minute: Number(options.startMinute ?? story.days[0]?.startMinute ?? DEFAULT_START_MINUTE),
      dayStarted: false,
      ended: false,
      endingId: null,
      stats: { ...defaultStats(), ...(options.stats || {}) },
      trust: { ...(story.initialTrust || {}), ...(options.trust || {}) },
      flags: { ...(story.initialFlags || {}), ...(options.flags || {}) },
      access: [...new Set(options.access || story.initialAccess || [])],
      inventory: [...new Set(options.inventory || [])],
      completedActions: {},
      deliveredEvents: [],
      scheduledEvents: [],
      missedRequirements: [],
      journal: [],
      inbox: [],
      unlockedContent: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  function hydrateState(story, rawState) {
    const base = createState(story, {
      seed: rawState?.seed || "restored-save",
      truthId: rawState?.truthId
    });
    const state = {
      ...base,
      ...(rawState || {}),
      version: SAVE_VERSION,
      stats: { ...base.stats, ...(rawState?.stats || {}) },
      trust: { ...base.trust, ...(rawState?.trust || {}) },
      flags: { ...base.flags, ...(rawState?.flags || {}) },
      access: [...new Set(rawState?.access || base.access)],
      inventory: [...new Set(rawState?.inventory || [])],
      completedActions: { ...(rawState?.completedActions || {}) },
      deliveredEvents: [...new Set(rawState?.deliveredEvents || [])],
      scheduledEvents: deepClone(rawState?.scheduledEvents || []),
      missedRequirements: deepClone(rawState?.missedRequirements || []),
      journal: deepClone(rawState?.journal || []),
      inbox: deepClone(rawState?.inbox || []),
      unlockedContent: [...new Set(rawState?.unlockedContent || [])],
      metadata: { ...base.metadata, ...(rawState?.metadata || {}) }
    };
    state.dayIndex = clamp(Number(state.dayIndex) || 0, 0, story.days.length - 1);
    state.minute = Math.max(0, Number(state.minute) || DEFAULT_START_MINUTE);
    return state;
  }

  function conditionPasses(condition, state) {
    if (condition == null) return true;
    if (typeof condition === "boolean") return condition;
    if (Array.isArray(condition)) return condition.every((item) => conditionPasses(item, state));
    if (typeof condition !== "object") return Boolean(condition);

    if (condition.all) return condition.all.every((item) => conditionPasses(item, state));
    if (condition.any) return condition.any.some((item) => conditionPasses(item, state));
    if (condition.not) return !conditionPasses(condition.not, state);
    if (condition.truthIs !== undefined) {
      const values = Array.isArray(condition.truthIs) ? condition.truthIs : [condition.truthIs];
      return values.includes(state.truthId);
    }
    if (condition.dayEquals !== undefined) return state.dayIndex === Number(condition.dayEquals);
    if (condition.dayAtLeast !== undefined) return state.dayIndex >= Number(condition.dayAtLeast);
    if (condition.dayAtMost !== undefined) return state.dayIndex <= Number(condition.dayAtMost);
    if (condition.flag !== undefined) return Boolean(state.flags[condition.flag]);
    if (condition.notFlag !== undefined) return !state.flags[condition.notFlag];
    if (condition.actionDone !== undefined) return Boolean(state.completedActions[condition.actionDone]);
    if (condition.actionNotDone !== undefined) return !state.completedActions[condition.actionNotDone];
    if (condition.hasItem !== undefined) return state.inventory.includes(condition.hasItem);
    if (condition.hasAccess !== undefined) return state.access.includes(condition.hasAccess);
    if (condition.eventDelivered !== undefined) return state.deliveredEvents.includes(condition.eventDelivered);
    if (condition.contentUnlocked !== undefined) return state.unlockedContent.includes(condition.contentUnlocked);
    if (condition.statGte) return getStat(state, condition.statGte[0]) >= Number(condition.statGte[1]);
    if (condition.statLte) return getStat(state, condition.statLte[0]) <= Number(condition.statLte[1]);
    if (condition.statGt) return getStat(state, condition.statGt[0]) > Number(condition.statGt[1]);
    if (condition.statLt) return getStat(state, condition.statLt[0]) < Number(condition.statLt[1]);
    if (condition.trustGte) return Number(state.trust[condition.trustGte[0]] || 0) >= Number(condition.trustGte[1]);
    if (condition.trustLte) return Number(state.trust[condition.trustLte[0]] || 0) <= Number(condition.trustLte[1]);
    return true;
  }

  function getStat(state, key) {
    return Number(state.stats[key] || 0);
  }

  function applyEffects(state, effects = {}, context = {}) {
    if (effects.stats) {
      for (const [key, delta] of Object.entries(effects.stats)) {
        state.stats[key] = Number(state.stats[key] || 0) + Number(delta || 0);
      }
    }
    if (effects.setStats) {
      for (const [key, value] of Object.entries(effects.setStats)) state.stats[key] = Number(value || 0);
    }
    if (effects.trust) {
      for (const [key, delta] of Object.entries(effects.trust)) {
        state.trust[key] = Number(state.trust[key] || 0) + Number(delta || 0);
      }
    }
    if (effects.setFlags) Object.assign(state.flags, effects.setFlags);
    if (effects.unsetFlags) effects.unsetFlags.forEach((key) => delete state.flags[key]);
    if (effects.addAccess) state.access = [...new Set([...state.access, ...effects.addAccess])];
    if (effects.removeAccess) state.access = state.access.filter((item) => !effects.removeAccess.includes(item));
    if (effects.addItems) state.inventory = [...new Set([...state.inventory, ...effects.addItems])];
    if (effects.removeItems) state.inventory = state.inventory.filter((item) => !effects.removeItems.includes(item));
    if (effects.unlockContent) state.unlockedContent = [...new Set([...state.unlockedContent, ...effects.unlockContent])];
    if (effects.schedule) {
      for (const schedule of effects.schedule) {
        state.scheduledEvents.push({
          eventId: schedule.eventId,
          dayIndex: schedule.dayIndex ?? state.dayIndex,
          minute: schedule.minute ?? state.minute,
          sourceAction: context.actionId || null
        });
      }
    }
    if (effects.inbox) state.inbox.push(...deepClone(effects.inbox));
    normalizeStats(state);
  }

  function normalizeStats(state) {
    state.stats.anxiety = clamp(state.stats.anxiety, 0, 10);
    state.stats.suspicion = Math.max(0, state.stats.suspicion);
    state.stats.access = Math.max(0, state.stats.access);
    state.stats.collateral = Math.max(0, state.stats.collateral);
  }

  function createEngine(story, rawState = null, options = {}) {
    if (!story || !Array.isArray(story.days) || story.days.length === 0) {
      throw new Error("A valid story with at least one day is required.");
    }
    let state = rawState ? hydrateState(story, rawState) : createState(story, options);

    function snapshot() {
      state.metadata.updatedAt = new Date().toISOString();
      return deepClone(state);
    }

    function currentDay() {
      return story.days[state.dayIndex];
    }

    function startDay() {
      if (state.ended) return { ok: false, reason: "game-ended" };
      if (state.dayStarted) return { ok: true, alreadyStarted: true, events: [] };
      const day = currentDay();
      state.dayStarted = true;
      state.minute = Number(day.startMinute ?? DEFAULT_START_MINUTE);
      appendJournal("day-start", day.title || DAY_KEYS[state.dayIndex] || `День ${state.dayIndex + 1}`);
      applyEffects(state, day.startEffects || {}, { dayIndex: state.dayIndex });
      const events = deliverDueEvents(true);
      return { ok: true, events, day: deepClone(day), state: snapshot() };
    }

    function listActions(channel = null) {
      return Object.values(story.actions || {})
        .filter((action) => Number(action.dayIndex ?? state.dayIndex) === state.dayIndex)
        .filter((action) => !channel || action.channel === channel)
        .filter((action) => !action.once || !state.completedActions[action.id])
        .filter((action) => conditionPasses(action.requires, state))
        .map((action) => deepClone(action));
    }

    function getAction(actionId) {
      return story.actions?.[actionId] || null;
    }

    function canApplyAction(actionId) {
      if (state.ended) return { ok: false, reason: "game-ended" };
      if (!state.dayStarted) return { ok: false, reason: "day-not-started" };
      const action = getAction(actionId);
      if (!action) return { ok: false, reason: "unknown-action" };
      if (Number(action.dayIndex ?? state.dayIndex) !== state.dayIndex) return { ok: false, reason: "wrong-day" };
      if (action.once && state.completedActions[actionId]) return { ok: false, reason: "already-completed" };
      if (!conditionPasses(action.requires, state)) return { ok: false, reason: "requirements-not-met" };
      return { ok: true, action };
    }

    function applyAction(actionId, payload = {}) {
      const check = canApplyAction(actionId);
      if (!check.ok) return check;
      const action = check.action;
      const minutes = Math.max(0, Number(payload.minutes ?? action.minutes ?? 0));
      const before = snapshot();
      applyEffects(state, action.effects || {}, { actionId });
      state.completedActions[actionId] = {
        dayIndex: state.dayIndex,
        minute: state.minute,
        result: action.result || "",
        payload: deepClone(payload)
      };
      appendJournal("action", action.result || action.label || actionId, { actionId, channel: action.channel || null });
      const events = advanceTime(minutes).events;
      return {
        ok: true,
        action: deepClone(action),
        result: action.result || "",
        events,
        before,
        state: snapshot()
      };
    }

    function advanceTime(minutes) {
      if (state.ended) return { ok: false, reason: "game-ended", events: [] };
      state.minute += Math.max(0, Number(minutes) || 0);
      const events = deliverDueEvents(false);
      return { ok: true, events, minute: state.minute, state: snapshot() };
    }

    function deliverDueEvents(includeStart = false) {
      const candidates = [];
      for (const event of Object.values(story.events || {})) {
        const eventDay = Number(event.dayIndex ?? state.dayIndex);
        if (eventDay !== state.dayIndex) continue;
        if (state.deliveredEvents.includes(event.id)) continue;
        if (!conditionPasses(event.requires, state)) continue;
        const at = Number(event.minute ?? currentDay().startMinute ?? DEFAULT_START_MINUTE);
        if (at <= state.minute || (includeStart && event.atStart)) candidates.push({ event, at });
      }
      for (const scheduled of state.scheduledEvents) {
        if (scheduled.dayIndex !== state.dayIndex || scheduled.minute > state.minute) continue;
        const event = story.events?.[scheduled.eventId];
        if (!event || state.deliveredEvents.includes(event.id) || !conditionPasses(event.requires, state)) continue;
        candidates.push({ event, at: scheduled.minute });
      }
      candidates.sort((a, b) => a.at - b.at || String(a.event.id).localeCompare(String(b.event.id)));
      const delivered = [];
      for (const candidate of candidates) {
        if (state.deliveredEvents.includes(candidate.event.id)) continue;
        state.deliveredEvents.push(candidate.event.id);
        applyEffects(state, candidate.event.effects || {}, { eventId: candidate.event.id });
        const copy = deepClone(candidate.event);
        state.inbox.push({
          id: copy.id,
          dayIndex: state.dayIndex,
          minute: candidate.at,
          type: copy.type || "system",
          source: copy.source || "Система",
          title: copy.title || "Новое событие",
          text: copy.text || ""
        });
        appendJournal("event", copy.title || copy.text || copy.id, { eventId: copy.id });
        delivered.push(copy);
      }
      state.scheduledEvents = state.scheduledEvents.filter((item) => {
        return !(item.dayIndex === state.dayIndex && item.minute <= state.minute && state.deliveredEvents.includes(item.eventId));
      });
      return delivered;
    }

    function endDay() {
      if (state.ended) return { ok: false, reason: "game-ended" };
      if (!state.dayStarted) return { ok: false, reason: "day-not-started" };
      const day = currentDay();
      const missed = [];
      for (const requirement of day.requirements || []) {
        if (conditionPasses(requirement.satisfiedWhen, state)) continue;
        missed.push(requirement.id);
        state.missedRequirements.push({
          id: requirement.id,
          dayIndex: state.dayIndex,
          label: requirement.label || requirement.id
        });
        applyEffects(state, requirement.missedEffects || {}, { requirementId: requirement.id });
      }
      applyEffects(state, day.endEffects || {}, { dayIndex: state.dayIndex });
      appendJournal("day-end", day.title || `День ${state.dayIndex + 1}`, { missed });

      const isFinalDay = state.dayIndex >= story.days.length - 1;
      if (isFinalDay) {
        const ending = resolveEnding();
        state.ended = true;
        state.endingId = ending?.id || "unknown";
        return { ok: true, final: true, missed, ending: deepClone(ending), state: snapshot() };
      }

      state.dayIndex += 1;
      state.dayStarted = false;
      state.minute = Number(currentDay().startMinute ?? DEFAULT_START_MINUTE);
      const transitionEvents = startDay().events;
      return {
        ok: true,
        final: false,
        missed,
        nextDay: deepClone(currentDay()),
        events: transitionEvents,
        state: snapshot()
      };
    }

    function resolveEnding() {
      const matches = (story.endings || [])
        .filter((ending) => conditionPasses(ending.requires, state))
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
      const ending = matches[0] || story.fallbackEnding || {
        id: "unknown",
        title: "Пятница",
        text: "Неделя закончилась, но окончательный результат пока не описан."
      };
      appendJournal("ending", ending.title || ending.id, { endingId: ending.id });
      return ending;
    }

    function appendJournal(type, text, details = {}) {
      state.journal.push({
        type,
        text,
        details: deepClone(details),
        dayIndex: state.dayIndex,
        minute: state.minute
      });
    }

    function serialize() {
      return JSON.stringify(snapshot());
    }

    function listVisibleContent(contentType) {
      return (story.content?.[contentType] || [])
        .filter((item) => Number(item.dayIndex ?? state.dayIndex) <= state.dayIndex)
        .filter((item) => conditionPasses(item.requires, state))
        .map((item) => deepClone(item));
    }

    return {
      startDay,
      currentDay: () => deepClone(currentDay()),
      listActions,
      listVisibleContent,
      canApplyAction,
      applyAction,
      advanceTime,
      endDay,
      resolveEnding: () => deepClone(resolveEnding()),
      conditionPasses: (condition) => conditionPasses(condition, state),
      getState: snapshot,
      serialize
    };
  }

  return {
    SAVE_VERSION,
    DAY_KEYS,
    createState,
    hydrateState,
    createEngine,
    conditionPasses,
    chooseWeighted,
    hashString
  };
});