(function (root) {
  "use strict";

  const Engine = root.UntilFridayEngine;
  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Engine || !Story || root.UntilFridayDayTransitionGuard) return;

  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const originalCreateEngine = Engine.createEngine.bind(Engine);
  let activeEngine = null;
  let pendingTransition = null;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function dedupeEvents(events) {
    const seen = new Set();
    return (events || []).filter((event) => {
      const id = event?.id || `${event?.source || ""}:${event?.title || ""}:${event?.minute || ""}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function flushPendingConsequences(instance) {
    const state = instance.getState();
    if (!state.dayStarted || state.ended) return [];
    const delivered = new Set(state.deliveredEvents || []);
    const pending = (state.scheduledEvents || []).filter((item) =>
      item.dayIndex === state.dayIndex &&
      !delivered.has(item.eventId) &&
      (!item.sourceAction || Boolean(state.completedActions?.[item.sourceAction]))
    );
    if (!pending.length) return [];
    const targetMinute = Math.max(...pending.map((item) => Number(item.minute) || state.minute));
    const result = instance.advanceTime(Math.max(0, targetMinute - state.minute));
    return result?.events || [];
  }

  function normalizeTransition(instance, before, result) {
    if (!result || typeof result !== "object") {
      return { ok: false, reason: "empty-transition-result" };
    }

    if (!result.ok) return result;

    let state = result.state || instance.getState();
    let events = [...(result.events || [])];

    if (!result.final && !state.dayStarted) {
      const started = instance.startDay();
      if (started?.ok) {
        state = started.state || instance.getState();
        events.push(...(started.events || []));
      }
    }

    const nextDay = result.final
      ? null
      : result.nextDay || clone(Story.days?.[state.dayIndex]) || instance.currentDay?.();

    if (!result.final && (!nextDay || state.dayIndex <= before.dayIndex)) {
      return {
        ok: false,
        reason: "transition-did-not-advance",
        state,
        beforeDayIndex: before.dayIndex,
        currentDayIndex: state.dayIndex
      };
    }

    return {
      ...result,
      ok: true,
      state,
      nextDay,
      events: dedupeEvents(events)
    };
  }

  Engine.createEngine = function createEngineWithTransitionGuard(...args) {
    const instance = originalCreateEngine(...args);
    const originalEndDay = instance.endDay.bind(instance);
    const originalStartDay = instance.startDay.bind(instance);

    instance.endDay = function guardedEndDay(...endArgs) {
      const before = instance.getState();
      let result;
      let flushedEvents = [];

      try {
        if (before.dayStarted) flushedEvents = flushPendingConsequences(instance);
        result = originalEndDay(...endArgs);
      } catch (error) {
        console.error("Ошибка перехода между рабочими днями", error);
        return {
          ok: false,
          reason: "transition-exception",
          message: error?.message || String(error),
          state: instance.getState()
        };
      }

      if (result?.ok === false && result.reason === "day-not-started" && !before.ended) {
        const started = originalStartDay();
        if (started?.ok) {
          flushedEvents = flushPendingConsequences(instance);
          result = originalEndDay(...endArgs);
        }
      }

      if (result?.ok && flushedEvents.length) {
        result = { ...result, events: [...flushedEvents, ...(result.events || [])] };
      }
      return normalizeTransition(instance, before, result);
    };

    activeEngine = instance;
    return instance;
  };

  function saveState(state) {
    if (!state) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Не удалось сохранить восстановленный переход", error);
    }
  }

  function formatDate(dayIndex) {
    const short = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];
    return `${short[dayIndex] || ""}, ${3 + dayIndex} АВГ`;
  }

  function updateClock(state) {
    const time = document.querySelector("#clock-time");
    const date = document.querySelector("#clock-date");
    if (time) {
      const minute = Math.max(0, Number(state.minute) || 0);
      time.textContent = `${Math.floor(minute / 60).toString().padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
    }
    if (date) date.textContent = formatDate(state.dayIndex);
  }

  function buildRecoveredTransition(overlay, result, previousTitle) {
    const nextDay = result.nextDay || Story.days?.[result.state?.dayIndex];
    if (!overlay || !nextDay) return;

    overlay.dataset.transitionRecovered = "true";
    overlay.innerHTML = `
      <section class="endday-card day-transition-card">
        <p class="transition-kicker"></p>
        <h2></h2>
        <p data-transition-text></p>
        <p class="transition-warning">Переход был восстановлен после ошибки интерфейса. Сохранение не потеряно.</p>
        <footer><button class="button primary" data-recovered-start type="button">Начать рабочий день</button></footer>
      </section>`;

    overlay.querySelector(".transition-kicker").textContent = `${previousTitle || "Рабочий день"} завершён`;
    overlay.querySelector("h2").textContent = nextDay.title || "Следующий день";
    overlay.querySelector("[data-transition-text]").textContent = `${nextDay.dateLabel || ""}. Рабочий сеанс подготовлен.`;
    overlay.querySelector("[data-recovered-start]").addEventListener("click", () => {
      saveState(activeEngine?.getState?.() || result.state);
      window.location.reload();
    });
  }

  function recoverFailedTransition() {
    const context = pendingTransition;
    pendingTransition = null;
    if (!context || !activeEngine) return;

    const overlay = context.overlay;
    if (!overlay?.isConnected) return;
    if (overlay.querySelector("[data-start-next], [data-recovered-start]")) return;

    let state = activeEngine.getState();
    if (state.ended) return;

    if (state.dayIndex > context.beforeDayIndex) {
      const result = {
        ok: true,
        final: false,
        state,
        nextDay: clone(Story.days?.[state.dayIndex]),
        events: []
      };
      saveState(state);
      updateClock(state);
      buildRecoveredTransition(overlay, result, context.previousTitle);
      return;
    }

    const retry = activeEngine.endDay();
    if (retry?.ok && !retry.final) {
      state = retry.state || activeEngine.getState();
      saveState(state);
      updateClock(state);
      buildRecoveredTransition(overlay, retry, context.previousTitle);
      return;
    }

    const card = overlay.querySelector(".endday-card");
    if (!card) return;
    let error = card.querySelector("[data-transition-error]");
    if (!error) {
      error = document.createElement("p");
      error.dataset.transitionError = "true";
      error.className = "transition-warning";
      card.insertBefore(error, card.querySelector("footer"));
    }
    error.textContent = "Не удалось завершить день автоматически. Прогресс сохранён. Обновите страницу и повторите переход.";
  }

  document.addEventListener("click", (event) => {
    const confirm = event.target.closest(".modal-overlay .endday-card [data-confirm]");
    if (confirm && activeEngine) {
      const state = activeEngine.getState();
      pendingTransition = {
        overlay: confirm.closest(".modal-overlay"),
        beforeDayIndex: state.dayIndex,
        previousTitle: Story.days?.[state.dayIndex]?.title || "Рабочий день"
      };
      window.setTimeout(recoverFailedTransition, 350);
      return;
    }

    const startNext = event.target.closest("[data-start-next]");
    if (startNext) {
      window.setTimeout(() => {
        const overlay = startNext.closest(".modal-overlay");
        if (overlay?.isConnected) overlay.remove();
        const state = activeEngine?.getState?.();
        if (state) {
          saveState(state);
          updateClock(state);
        }
        root.UntilFridayPassiveClock?.resetDayClock?.();
        window.dispatchEvent(new CustomEvent("until-friday-day-started", { detail: { state } }));
      }, 0);
    }
  }, true);

  root.UntilFridayDayTransitionGuard = {
    normalizeTransition,
    flushPendingConsequences,
    recoverFailedTransition,
    getEngine: () => activeEngine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
