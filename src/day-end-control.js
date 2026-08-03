(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayDayEndControl) return;

  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  let activeOverlay = null;
  let decorateQueued = false;

  function getEngine() {
    return root.UntilFridayDayTransitionGuard?.getEngine?.()
      || root.UntilFridayPassiveClock?.getEngine?.()
      || null;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function currentDay(state) {
    return Story.days?.[state?.dayIndex] || null;
  }

  function conditionPasses(engine, condition) {
    try {
      return Boolean(engine.conditionPasses(condition));
    } catch {
      return false;
    }
  }

  function missingRequirements(engine, state) {
    const day = currentDay(state);
    return (day?.requirements || []).filter((requirement) => !conditionPasses(engine, requirement.satisfiedWhen));
  }

  function mondayProgress(state) {
    const completed = state?.completedActions || {};
    const reportDone = Boolean(completed["mon-report-final"] || completed["mon-report-old"]);
    const invoiceDone = Boolean(completed["mon-invoice-fix"] || completed["mon-invoice-report"]);
    return {
      done: Number(reportDone) + Number(invoiceDone),
      total: 2,
      complete: reportDone && invoiceDone
    };
  }

  function dayProgress(engine, state) {
    if (state.dayIndex === 0) return mondayProgress(state);
    const requirements = currentDay(state)?.requirements || [];
    const done = requirements.filter((item) => conditionPasses(engine, item.satisfiedWhen)).length;
    return {
      done,
      total: requirements.length,
      complete: requirements.length === 0 || done === requirements.length
    };
  }

  function saveState(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Не удалось сохранить переход на следующий день", error);
      return false;
    }
  }

  function removeOverlay() {
    activeOverlay?.remove();
    activeOverlay = null;
  }

  function openDayEndDialog() {
    const engine = getEngine();
    if (!engine) return false;

    const state = engine.getState();
    if (!state || state.ended || state.dayIndex >= Story.days.length - 1) return false;

    if (activeOverlay?.isConnected) {
      activeOverlay.querySelector("button")?.focus();
      return true;
    }

    const day = currentDay(state);
    const missing = missingRequirements(engine, state);
    const progress = dayProgress(engine, state);
    const overlay = document.createElement("div");
    overlay.className = "day-end-control-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.innerHTML = `
      <section class="day-end-control-dialog" role="dialog" aria-modal="true" aria-labelledby="day-end-title">
        <header>
          <span>Рабочий день</span>
          <h2 id="day-end-title"></h2>
        </header>
        <div class="day-end-control-body">
          <div class="day-end-progress">
            <span>Основные задачи</span>
            <strong data-progress></strong>
          </div>
          <p data-status></p>
          <div class="day-end-warning" data-warning hidden></div>
        </div>
        <footer>
          <button type="button" class="button" data-cancel>Вернуться</button>
          <button type="button" class="button primary" data-confirm>Завершить день</button>
        </footer>
      </section>`;

    overlay.querySelector("h2").textContent = `Завершить ${String(day?.title || "день").toLowerCase()}?`;
    overlay.querySelector("[data-progress]").textContent = `${progress.done} из ${progress.total}`;
    overlay.querySelector("[data-status]").textContent = progress.complete
      ? "Основные задачи выполнены. После подтверждения начнётся следующий рабочий день."
      : "Часть основных задач ещё не завершена. День всё равно можно закончить, но это повлияет на итог недели.";

    if (missing.length) {
      const warning = overlay.querySelector("[data-warning]");
      warning.hidden = false;
      warning.textContent = `Невыполненные обязательства: ${missing.map((item) => item.label || item.id).join("; ")}.`;
    }

    overlay.querySelector("[data-cancel]").addEventListener("click", removeOverlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) removeOverlay();
    });
    overlay.querySelector("[data-confirm]").addEventListener("click", () => finishDay(engine, overlay, day));

    document.body.appendChild(overlay);
    activeOverlay = overlay;
    overlay.querySelector("[data-confirm]").focus();
    return true;
  }

  function finishDay(engine, overlay, endingDay) {
    const confirm = overlay.querySelector("[data-confirm]");
    const cancel = overlay.querySelector("[data-cancel]");
    const warning = overlay.querySelector("[data-warning]");
    confirm.disabled = true;
    cancel.disabled = true;
    confirm.textContent = "Сохранение...";

    let result;
    try {
      result = engine.endDay();
    } catch (error) {
      result = { ok: false, reason: "exception", message: error?.message || String(error) };
    }

    if (!result?.ok || result.final) {
      confirm.disabled = false;
      cancel.disabled = false;
      confirm.textContent = "Повторить";
      warning.hidden = false;
      warning.textContent = result?.final
        ? "Финальный день завершается через сцену встречи с директором."
        : `Не удалось завершить день: ${result?.message || result?.reason || "неизвестная ошибка"}.`;
      return;
    }

    const state = result.state || engine.getState();
    const nextDay = result.nextDay || clone(Story.days?.[state.dayIndex]);
    if (!nextDay || state.dayIndex <= Number(endingDay?.dayIndex ?? -1)) {
      confirm.disabled = false;
      cancel.disabled = false;
      confirm.textContent = "Повторить";
      warning.hidden = false;
      warning.textContent = "Движок не переключил день. Прогресс текущего дня не удалён.";
      return;
    }

    if (!saveState(state)) {
      confirm.disabled = false;
      cancel.disabled = false;
      confirm.textContent = "Повторить";
      warning.hidden = false;
      warning.textContent = "Браузер не разрешил сохранить переход. Проверьте доступ к локальному хранилищу.";
      return;
    }

    root.UntilFridayPassiveClock?.resetDayClock?.();
    overlay.querySelector(".day-end-control-dialog").innerHTML = `
      <header>
        <span>${escapeHtml(endingDay?.title || "Рабочий день")} завершён</span>
        <h2>${escapeHtml(nextDay.title || "Следующий день")}</h2>
      </header>
      <div class="day-end-control-body">
        <p>${escapeHtml(nextDay.dateLabel || "")}. Сохранение готово, рабочий сеанс следующего дня будет открыт после перезагрузки.</p>
        ${result.missed?.length ? '<div class="day-end-warning">Некоторые обязательства предыдущего дня остались незавершёнными.</div>' : ""}
      </div>
      <footer>
        <button type="button" class="button primary" data-start-next>Начать следующий день</button>
      </footer>`;

    overlay.querySelector("[data-start-next]").addEventListener("click", () => window.location.reload());
    overlay.querySelector("[data-start-next]").focus();
  }

  function decorateTaskLists() {
    const engine = getEngine();
    if (!engine) return;
    const state = engine.getState();
    if (!state || state.ended || state.dayIndex >= Story.days.length - 1) return;

    document.querySelectorAll(".task-list").forEach((list) => {
      if (list.querySelector("[data-day-end-card]")) return;
      const progress = dayProgress(engine, state);
      const card = document.createElement("article");
      card.className = "task-card day-end-task-card";
      card.dataset.dayEndCard = "true";
      card.innerHTML = `
        <header><h3>Завершение рабочего дня</h3><span data-day-end-state></span></header>
        <div class="task-body">
          <p data-day-end-text></p>
          <div class="action-row"><button type="button" class="action-button" data-day-end-control>Завершить рабочий день</button></div>
        </div>`;
      card.querySelector("[data-day-end-state]").textContent = `${progress.done}/${progress.total}`;
      card.querySelector("[data-day-end-text]").textContent = progress.complete
        ? "Основные задачи закрыты. Перейдите к следующему дню."
        : "День можно завершить досрочно, но незакрытые обязательства повлияют на последствия.";
      list.appendChild(card);
    });
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(() => {
      decorateQueued = false;
      decorateTaskLists();
    });
  }

  function handleActivation(event) {
    const clock = event.target.closest?.("#clock");
    const explicitButton = event.target.closest?.("[data-day-end-control]");
    if (!clock && !explicitButton) return;

    const engine = getEngine();
    const state = engine?.getState?.();
    if (!engine || !state || state.ended || state.dayIndex >= Story.days.length - 1) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openDayEndDialog();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  document.addEventListener("click", handleActivation, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeOverlay?.isConnected) removeOverlay();
  });

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("until-friday-app-ready", queueDecorate);
  document.addEventListener("DOMContentLoaded", queueDecorate, { once: true });
  queueDecorate();

  root.UntilFridayDayEndControl = {
    open: openDayEndDialog,
    progress: dayProgress,
    finishDay,
    getEngine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
