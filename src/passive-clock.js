(function (root) {
  "use strict";

  const Runtime = root.UntilFridayRuntimeEngine;
  if (!Runtime || root.UntilFridayPassiveClock) return;

  const REAL_MS_PER_GAME_MINUTE = 3000;
  const WORKDAY_END_MINUTE = 18 * 60;
  const DAY_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];
  const MONTH_SHORT = "АВГ";

  let timerId = null;
  let lastRealTimestamp = Date.now();
  let lastDayIndex = null;
  let endOfDayNoticeShown = false;

  function getEngine() {
    return Runtime.getEngine?.() || null;
  }

  function shouldPause(state) {
    if (!state || state.ended || !state.dayStarted) return true;
    if (document.hidden) return true;
    if (document.querySelector("#opening-flow")) return true;
    if (!document.querySelector("#desktop:not(.hidden)")) return true;
    if (document.querySelector(".modal-overlay")) return true;
    if (document.querySelector(".day-end-control-overlay")) return true;
    if (document.querySelector(".friday-scene-overlay, .friday-ending-overlay")) return true;
    return false;
  }

  function persist(state) {
    const result = Runtime.persist(state);
    if (!result.ok) console.warn("Не удалось сохранить пассивное течение времени", result.message);
    return result.ok;
  }

  function formatTime(totalMinutes) {
    const value = Math.max(0, Number(totalMinutes) || 0);
    const hours = Math.floor(value / 60).toString().padStart(2, "0");
    const minutes = (value % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function updateClock(state) {
    const time = document.querySelector("#clock-time");
    const date = document.querySelector("#clock-date");
    if (time) time.textContent = formatTime(state.minute);
    if (date) date.textContent = `${DAY_SHORT[state.dayIndex] || ""}, ${3 + state.dayIndex} ${MONTH_SHORT}`;
  }

  function notify(title, text) {
    Runtime.notify(title || "Система", text || "Новое событие");
  }

  function deliverEvents(events) {
    (events || []).forEach((event) => {
      notify(event.source || event.title || "Система", event.text || event.title || "Новое событие");
    });
  }

  function cssEscape(value) {
    if (root.CSS?.escape) return root.CSS.escape(value);
    return String(value).replace(/(["\\])/g, "\\$1");
  }

  function refreshOpenWindows() {
    const windows = Array.from(document.querySelectorAll('.app-window[data-window-id]:not(.minimized)'));
    if (!windows.length) return;
    const activeId = document.querySelector('.app-window.focused[data-window-id]')?.dataset.windowId || null;
    const ids = windows.map((windowElement) => windowElement.dataset.windowId).filter(Boolean);

    ids.forEach((appId) => {
      const icon = document.querySelector(`.desktop-icon[data-app="${cssEscape(appId)}"]`);
      icon?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    if (activeId) {
      const activeIcon = document.querySelector(`.desktop-icon[data-app="${cssEscape(activeId)}"]`);
      activeIcon?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    }
  }

  function tick(now = Date.now()) {
    const engine = getEngine();
    if (!engine) {
      lastRealTimestamp = now;
      return { advanced: 0, events: [] };
    }

    const state = engine.getState();
    if (lastDayIndex !== state.dayIndex) {
      lastDayIndex = state.dayIndex;
      lastRealTimestamp = now;
      endOfDayNoticeShown = false;
      updateClock(state);
      return { advanced: 0, events: [], dayChanged: true };
    }

    if (shouldPause(state)) {
      lastRealTimestamp = now;
      return { advanced: 0, events: [] };
    }

    if (state.minute >= WORKDAY_END_MINUTE) {
      lastRealTimestamp = now;
      updateClock(state);
      if (!endOfDayNoticeShown) {
        endOfDayNoticeShown = true;
        notify("Система", "18:00. Рабочий день завершён. Нажмите на часы, чтобы перейти дальше.");
      }
      return { advanced: 0, events: [] };
    }

    const elapsed = Math.max(0, now - lastRealTimestamp);
    const elapsedMinutes = Math.floor(elapsed / REAL_MS_PER_GAME_MINUTE);
    if (elapsedMinutes < 1) return { advanced: 0, events: [] };

    const minutesToAdvance = Math.min(elapsedMinutes, WORKDAY_END_MINUTE - state.minute);
    lastRealTimestamp += minutesToAdvance * REAL_MS_PER_GAME_MINUTE;
    const result = engine.advanceTime(minutesToAdvance);
    const nextState = result.state || engine.getState();

    if (!persist(nextState)) {
      engine.replaceState?.(state, "passive-clock-rollback");
      lastRealTimestamp = now;
      return { advanced: 0, events: [], rolledBack: true, state };
    }

    updateClock(nextState);
    deliverEvents(result.events || []);
    if (result.events?.length) refreshOpenWindows();

    if (nextState.minute >= WORKDAY_END_MINUTE && !endOfDayNoticeShown) {
      endOfDayNoticeShown = true;
      notify("Система", "18:00. Рабочий день завершён. Нажмите на часы, чтобы перейти дальше.");
    }

    return { advanced: minutesToAdvance, events: result.events || [], state: nextState };
  }

  function start() {
    if (timerId) return;
    lastRealTimestamp = Date.now();
    timerId = window.setInterval(() => tick(Date.now()), 1000);
  }

  function stop() {
    if (!timerId) return;
    window.clearInterval(timerId);
    timerId = null;
  }

  function resetDayClock() {
    lastRealTimestamp = Date.now();
    lastDayIndex = getEngine()?.getState?.().dayIndex ?? null;
    endOfDayNoticeShown = false;
  }

  window.addEventListener("until-friday-app-ready", () => {
    resetDayClock();
    start();
  });
  window.addEventListener("until-friday-state-change", (event) => {
    const state = event.detail?.state;
    if (!state) return;
    if (lastDayIndex !== state.dayIndex) resetDayClock();
    updateClock(state);
  });
  document.addEventListener("visibilitychange", () => {
    lastRealTimestamp = Date.now();
    const engine = getEngine();
    if (!document.hidden && engine) updateClock(engine.getState());
  });
  window.addEventListener("pagehide", () => {
    lastRealTimestamp = Date.now();
  });
  window.addEventListener("beforeunload", stop);

  root.UntilFridayPassiveClock = {
    REAL_MS_PER_GAME_MINUTE,
    WORKDAY_END_MINUTE,
    start,
    stop,
    tick,
    resetDayClock,
    getEngine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
