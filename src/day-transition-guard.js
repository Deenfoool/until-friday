(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  const Runtime = root.UntilFridayRuntimeEngine;
  if (!Story || !Runtime || root.UntilFridayDayTransitionGuard) return;

  let pendingTransition = null;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function getEngine() {
    return Runtime.getEngine?.() || null;
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

  function normalizeTransition(instance, before, result) {
    return Runtime.normalizeTransition(instance, before, result);
  }

  function flushPendingConsequences(instance = getEngine()) {
    const result = instance?.flushPendingConsequences?.();
    return result?.events || result || [];
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
    overlay.querySelector("[data-recovered-start]").addEventListener("click", () => window.location.reload());
  }

  function recoverFailedTransition() {
    const context = pendingTransition;
    pendingTransition = null;
    const engine = getEngine();
    if (!context || !engine) return;

    const overlay = context.overlay;
    if (!overlay?.isConnected) return;
    if (overlay.querySelector("[data-start-next], [data-recovered-start]")) return;

    let state = engine.getState();
    if (state.ended) return;

    if (state.dayIndex > context.beforeDayIndex) {
      const result = {
        ok: true,
        final: false,
        state,
        nextDay: clone(Story.days?.[state.dayIndex]),
        events: []
      };
      updateClock(state);
      buildRecoveredTransition(overlay, result, context.previousTitle);
      return;
    }

    const retry = engine.endDay();
    if (retry?.ok && !retry.final) {
      state = retry.state || engine.getState();
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
    error.textContent = retry?.reason === "save-failed"
      ? "Переход отменён: браузер не смог записать сохранение. Освободите место и повторите."
      : "Не удалось завершить день автоматически. Обновите страницу и повторите переход.";
  }

  document.addEventListener("click", (event) => {
    const confirm = event.target.closest(".modal-overlay .endday-card [data-confirm]");
    const engine = getEngine();
    if (confirm && engine) {
      const state = engine.getState();
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
        const state = getEngine()?.getState?.();
        if (state) updateClock(state);
        root.UntilFridayPassiveClock?.resetDayClock?.();
        window.dispatchEvent(new CustomEvent("until-friday-day-started", { detail: { state } }));
      }, 0);
    }
  }, true);

  root.UntilFridayDayTransitionGuard = {
    normalizeTransition,
    flushPendingConsequences,
    recoverFailedTransition
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
