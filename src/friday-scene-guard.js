(function (root) {
  "use strict";

  const SCENE_KEY = "until-friday-friday-scene-v1";
  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const ROUTES = {
    "fri-meeting-calm": { route: "calm", title: "Сначала выслушать руководство" },
    "fri-meeting-work": { route: "work", title: "Представить результаты недели" },
    "fri-meeting-blackmail": { route: "blackmail", title: "Предъявить собранные материалы" },
    "fri-send-resignation": { route: "resignation", title: "Подать заявление первым" }
  };

  if (root.UntilFridayFridaySceneGuard) return;
  let queued = false;
  let recoveryOverlay = null;

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function writeScene(patch) {
    const next = { ...readJson(SCENE_KEY), ...patch, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(SCENE_KEY, JSON.stringify(next)); } catch { /* optional recovery metadata */ }
    return next;
  }

  function committedContext() {
    const save = readJson(SAVE_KEY);
    if (save.ended || Number(save.dayIndex) !== 4) return null;

    const actionId = Object.keys(ROUTES).find((id) => Boolean(save.completedActions?.[id]));
    if (!actionId) return null;

    const scene = readJson(SCENE_KEY);
    if (scene.completed) return null;
    const definition = ROUTES[actionId];
    return {
      save,
      scene,
      actionId,
      route: scene.route || definition.route,
      title: definition.title
    };
  }

  function lockActiveMeeting() {
    const context = committedContext();
    if (!context) return;
    document.querySelectorAll(".friday-scene-overlay [data-close]").forEach((button) => {
      button.disabled = true;
      button.hidden = true;
      button.title = "После начала кадрового разговора встречу необходимо завершить";
    });
  }

  function createRecoveryCard(list, context) {
    let card = list.querySelector("[data-friday-recovery-card]");
    if (!card) {
      card = document.createElement("article");
      card.className = "task-card friday-meeting-launcher friday-recovery-card";
      card.dataset.fridayRecoveryCard = "true";
      card.innerHTML = `
        <header><h3>Вернуться в переговорную №1</h3><span>встреча начата</span></header>
        <div class="task-body">
          <p></p>
          <div class="action-row"><button class="action-button" type="button">Продолжить встречу</button></div>
        </div>`;
      card.querySelector("button").addEventListener("click", openRecovery);
      list.prepend(card);
    }
    card.querySelector("p").textContent = `Вы уже выбрали позицию: «${context.title}». Разговор нужно довести до завершения.`;
  }

  function decorateRecoveryCards() {
    const context = committedContext();
    if (!context || document.querySelector(".friday-scene-overlay")) {
      document.querySelectorAll("[data-friday-recovery-card]").forEach((card) => card.remove());
      return;
    }
    document.querySelectorAll(".task-list").forEach((list) => createRecoveryCard(list, context));
  }

  function openRecovery() {
    const context = committedContext();
    if (!context) return;
    recoveryOverlay?.remove();

    const truth = root.UntilFridayFridayFinale?.truth?.[context.save.truthId]
      || root.UntilFridayFridayFinale?.truth?.player
      || { title: "Причина встречи установлена", fact: "Кадровый разговор необходимо завершить." };

    const overlay = document.createElement("div");
    overlay.className = "friday-scene-overlay friday-recovery-overlay";
    overlay.innerHTML = `
      <section class="friday-scene" role="dialog" aria-modal="true" aria-label="Продолжение встречи с директором">
        <header class="friday-scene-header">
          <div><span>Пятница</span><strong>17:00 · Переговорная №1</strong></div>
        </header>
        <main class="friday-dialogue" data-dialogue>
          <article class="friday-dialogue-line"><strong>Система</strong><p>Рабочий сеанс был восстановлен после прерванной встречи.</p></article>
          <article class="friday-dialogue-line"><strong>Ваша позиция</strong><p data-route></p></article>
          <article class="friday-dialogue-line"><strong>Что означал разговор</strong><p data-truth></p></article>
        </main>
        <footer class="friday-choices">
          <section class="friday-truth-card"><span>Итог разговора</span><strong data-truth-title></strong><p>Ранее выбранное решение сохранено. Можно безопасно закрыть рабочую неделю.</p></section>
          <button type="button" class="friday-finish-button" data-recovery-finish>Закрыть рабочую неделю</button>
        </footer>
      </section>`;
    overlay.querySelector("[data-route]").textContent = context.title;
    overlay.querySelector("[data-truth]").textContent = truth.fact;
    overlay.querySelector("[data-truth-title]").textContent = truth.title;
    overlay.querySelector("[data-recovery-finish]").addEventListener("click", finishRecoveredMeeting);
    document.body.appendChild(overlay);
    recoveryOverlay = overlay;
  }

  function finishRecoveredMeeting() {
    writeScene({ completed: true, recovered: true, completedAt: new Date().toISOString() });
    recoveryOverlay?.remove();
    recoveryOverlay = null;

    const clock = document.querySelector("#clock");
    clock?.click();
    window.setTimeout(() => {
      document.querySelector(".modal-overlay [data-confirm]")?.click();
    }, 100);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      lockActiveMeeting();
      decorateRecoveryCards();
    });
  }

  document.addEventListener("click", (event) => {
    const close = event.target.closest?.(".friday-scene-overlay [data-close]");
    if (!close || !committedContext()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  const observer = new MutationObserver(queue);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", queue, { once: true });
  window.addEventListener("until-friday-app-ready", queue);
  queue();

  root.UntilFridayFridaySceneGuard = {
    committedContext,
    lockActiveMeeting,
    openRecovery,
    finishRecoveredMeeting
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
