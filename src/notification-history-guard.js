(function (root) {
  "use strict";

  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const HISTORY_KEY = "until-friday-notification-history-v1";
  if (root.UntilFridayNotificationHistoryGuard) return;

  let queued = false;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveState() {
    const value = readJson(SAVE_KEY, {});
    return value && typeof value === "object" ? value : {};
  }

  function readHistory(seed) {
    const value = readJson(HISTORY_KEY, {});
    if (!value || value.seed !== seed || !Array.isArray(value.ids)) {
      return { seed, ids: [] };
    }
    return { seed, ids: [...new Set(value.ids.filter((id) => typeof id === "string" && id))].slice(-300) };
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify({
        seed: history.seed,
        ids: [...history.ids].slice(-300)
      }));
    } catch {
      // Duplicate suppression is optional when storage is unavailable.
    }
  }

  function notificationText(element) {
    return {
      source: element.querySelector("strong")?.textContent.trim() || "",
      text: element.querySelector("span")?.textContent.trim() || ""
    };
  }

  function matchInboxItem(state, notification) {
    return [...(Array.isArray(state.inbox) ? state.inbox : [])].reverse().find((item) => {
      const source = String(item.source || item.title || "Система").trim();
      const text = String(item.text || item.title || "Новое событие").trim();
      return source === notification.source && text === notification.text;
    }) || null;
  }

  function itemKey(item) {
    return String(item.id || `${item.dayIndex}:${item.minute}:${item.source}:${item.title}:${item.text}`);
  }

  function belongsInsideApp(item) {
    return String(item?.type || "").toLowerCase() === "chat";
  }

  function inspectNotification(element) {
    if (!element?.matches?.(".notification") || element.dataset.historyChecked === "true") return;
    element.dataset.historyChecked = "true";

    const state = saveState();
    if (!state.seed) return;
    const item = matchInboxItem(state, notificationText(element));
    if (!item) return;

    // Сообщения коллег должны существовать только внутри МИН. Отдельный тост
    // превращает компьютер в рассказчика и ломает ощущение рабочего интерфейса.
    if (belongsInsideApp(item)) {
      element.remove();
      return;
    }

    const history = readHistory(String(state.seed));
    const key = itemKey(item);
    if (history.ids.includes(key)) {
      element.remove();
      return;
    }

    history.ids.push(key);
    writeHistory(history);
  }

  function inspect() {
    document.querySelectorAll("#notifications .notification").forEach(inspectNotification);
  }

  function queue() {
    if (queued) return;
    queued = true;
    const schedule = typeof root.queueMicrotask === "function"
      ? root.queueMicrotask.bind(root)
      : (callback) => Promise.resolve().then(callback);
    schedule(() => {
      queued = false;
      inspect();
    });
  }

  document.addEventListener("DOMContentLoaded", queue, { once: true });
  root.addEventListener?.("until-friday-state-change", queue);
  root.addEventListener?.("until-friday-ui-render", queue);
  root.addEventListener?.("until-friday-app-ready", queue);
  queue();

  root.UntilFridayNotificationHistoryGuard = {
    HISTORY_KEY,
    readHistory,
    matchInboxItem,
    itemKey,
    belongsInsideApp,
    inspectNotification,
    inspect,
    queue
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
