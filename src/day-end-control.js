(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayDayEndControl) return;

  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const STORAGE_TEST_KEY = "__until_friday_storage_test__";
  let activeOverlay = null;
  let decorateQueued = false;

  function getEngine() {
    return root.UntilFridayPersistentEngineGuard?.getEngine?.()
      || root.UntilFridayDayTransitionGuard?.getEngine?.()
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

  function applicableRequirements(engine, state) {
    const day = currentDay(state);
    return (day?.requirements || []).filter((requirement) =>
      !requirement.appliesWhen || conditionPasses(engine, requirement.appliesWhen)
    );
  }

  function missingRequirements(engine, state) {
    return applicableRequirements(engine, state)
      .filter((requirement) => !conditionPasses(engine, requirement.satisfiedWhen));
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
    const requirements = applicableRequirements(engine, state);
    const done = requirements.filter((item) => conditionPasses(engine, item.satisfiedWhen)).length;
    return {
      done,
      total: requirements.length,
      complete: requirements.length === 0 || done === requirements.length
    };
  }

  function storageAvailable() {
    try {
      localStorage.setItem(STORAGE_TEST_KEY, "1");
      localStorage.removeItem(STORAGE_TEST_KEY);
      return true;
    } catch {
      return false;
    }
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
    if (activeOverlay?.dataset.locked === "true") return;
    activeOverlay?.remove();
    activeOverlay = null;
  }

  function setWarning(overlay, text) {
    const warning = overlay.querySelector("[data-warning]");
    if (!warning) return;
    warning.hidden = false;
    warning.textContent = text;
  }

  function openDayEndDialog() {
    const engine = getEngine();
    if (!engine) return false;

    const state = engine.getState();
    if (!state || state.ended || state.dayIndex >= Story.days.length - 1) return false;

    if (activeOverlay?.isConnected) {
      activeOverlay.querySelector("button:not([disabled])")?.focus();
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
      setWarning(overlay, `Невыполненные обязательства: ${missing.map((item) => item.label || item.id).join("; ")}.`);
    }

    overlay.querySelector("[data-cancel]").addEventListener("click", removeOverlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && overlay.dataset.locked !== "true") removeOverlay();
    });
    overlay.querySelector("[data-confirm]").addEventListener("click", () => finishDay(engine, overlay, day));

    document.body.appendChild(overlay);
    activeOverlay = overlay;
    overlay.querySelector("[data-confirm]").focus();
    return true;
  }

  function renderNextDay(overlay, result, endingDay, nextDay) {
    overlay.__pendingTransition = null;
    overlay.dataset.locked = "true";
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

  function retryPendingSave(overlay) {
    const pending = overlay.__pendingTransition;
    if (!pending) return false;
    const confirm = overlay.querySelector("[data-confirm]");
    if (!saveState(pending.state)) {
      confirm.disabled = false;
      confirm.textContent = "Повторить сохранение";
      setWarning(overlay, "День уже переключён внутри игры, но браузер пока не сохранил его. Освободите место или разрешите локальное хранилище, затем повторите сохранение.");
      return true;
    }
    renderNextDay(overlay, pending.result, pending.endingDay, pending.nextDay);
    return true;
  }

  function finishDay(engine, overlay, endingDay) {
    const confirm = overlay.querySelector("[data-confirm]");
    const cancel = overlay.querySelector("[data-cancel]");

    confirm.disabled = true;
    if (cancel) cancel.disabled = true;
    confirm.textContent = "Сохранение...";

    if (retryPendingSave(overlay)) return;

    if (!storageAvailable()) {
      confirm.disabled = false;
      if (cancel) cancel.disabled = false;
      confirm.textContent = "Завершить день";
      setWarning(overlay, "Браузер не разрешает локальное сохранение. Переход не выполнен, прогресс текущего дня не изменён.");
      return;
    }

    const before = engine.getState();
    let result;
    try {
      result = engine.endDay();
    } catch (error) {
      result = { ok: false, reason: "exception", message: error?.message || String(error) };
    }

    if (!result?.ok || result.final) {
      confirm.disabled = false;
      if (cancel) cancel.disabled = false;
      confirm.textContent = "Повторить";
      setWarning(overlay, result?.final
        ? "Финальный день завершается через сцену встречи с директором."
        : `Не удалось завершить день: ${result?.message || result?.reason || "неизвестная ошибка"}.`);
      return;
    }

    const state = result.state || engine.getState();
    const nextDay = result.nextDay || clone(Story.days?.[state.dayIndex]);
    if (!nextDay || state.dayIndex <= before.dayIndex) {
      confirm.disabled = false;
      if (cancel) cancel.disabled = false;
      confirm.textContent = "Повторить";
      setWarning(overlay, "Движок не переключил день. Прогресс текущего дня не удалён.");
      return;
    }

    if (!saveState(state)) {
      overlay.dataset.locked = "true";
      overlay.__pendingTransition = { state, result, nextDay, endingDay };
      confirm.disabled = false;
      confirm.textContent = "Повторить сохранение";
      setWarning(overlay, "День переключён, но запись сохранения не удалась. Повторная кнопка сохранит тот же переход и не перескочит ещё на один день.");
      return;
    }

    renderNextDay(overlay, result, endingDay, nextDay);
  }

  function updateTaskCard(card, progress) {
    card.querySelector("[data-day-end-state]").textContent = `${progress.done}/${progress.total}`;
    card.querySelector("[data-day-end-text]").textContent = progress.complete
      ? "Основные задачи закрыты. Перейдите к следующему дню."
      : "День можно завершить досрочно, но незакрытые обязательства повлияют на последствия.";
    card.classList.toggle("day-end-ready", progress.complete);
  }

  function decorateTaskLists() {
    const engine = getEngine();
    if (!engine) return;
    const state = engine.getState();
    if (!state || state.ended || state.dayIndex >= Story.days.length - 1) return;

    document.querySelectorAll(".task-list").forEach((list) => {
      const progress = dayProgress(engine, state);
      let card = list.querySelector("[data-day-end-card]");
      if (!card) {
        card = document.createElement("article");
        card.className = "task-card day-end-task-card";
        card.dataset.dayEndCard = "true";
        card.innerHTML = `
          <header><h3>Завершение рабочего дня</h3><span data-day-end-state></span></header>
          <div class="task-body">
            <p data-day-end-text></p>
            <div class="action-row"><button type="button" class="action-button" data-day-end-control>Завершить рабочий день</button></div>
          </div>`;
        list.appendChild(card);
      }
      updateTaskCard(card, progress);
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
    if (event.key === "Escape" && activeOverlay?.isConnected && activeOverlay.dataset.locked !== "true") removeOverlay();
  });

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("until-friday-app-ready", queueDecorate);
  document.addEventListener("DOMContentLoaded", queueDecorate, { once: true });
  queueDecorate();

  root.UntilFridayDayEndControl = {
    open: openDayEndDialog,
    progress: dayProgress,
    applicableRequirements,
    finishDay,
    getEngine,
    storageAvailable
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
