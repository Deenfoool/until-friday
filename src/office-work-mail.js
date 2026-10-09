(function (root) {
  "use strict";

  if (root.UntilFridayOfficeWorkMail) return;

  const Runtime = root.UntilFridayRuntimeEngine;
  const Pack = root.UntilFridayOfficeWorkPack;
  if (!Pack) return;

  const renderedLists = new WeakMap();

  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const icon = (name, size = 20) => `${ICON_ROOT}/${size}/${name}.png`;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function mailTasks(state = Runtime?.getEngine?.()?.getState?.()) {
    if (!state || state.ended || !state.dayStarted) return [];
    return Pack.tasksForDay(state.dayIndex)
      .filter((task) => task.unlockMinute <= state.minute)
      .filter((task) => task.config?.sourceText);
  }

  function bodyFor(task) {
    return task.config?.sourceText || task.description;
  }

  function decorateMail(element) {
    const state = Runtime?.getEngine?.()?.getState?.();
    const list = element?.querySelector?.(".mail-list");
    const view = element?.querySelector?.(".mail-view");
    if (!state || !list || !view) return false;

    const completed = Pack.officeState(state).completed;
    const tasks = mailTasks(state);
    const signature = JSON.stringify([state.dayIndex, tasks.map((task) => [task.id, Boolean(completed[task.id])])]);
    if (renderedLists.get(list) === signature) return true;
    if (!renderedLists.has(list)) {
      // Clear the office selection before the base mail handler rebuilds the view.
      list.addEventListener("click", (event) => {
        const item = event.target.closest?.(".mail-item");
        if (item && !item.dataset.officeMailTask) delete element.dataset.officeMailSelection;
      }, true);
    }
    const scrollTop = list.scrollTop;
    const focusedId = document.activeElement?.dataset?.officeMailTask;
    list.querySelectorAll("[data-office-mail-task]").forEach((item) => item.remove());
    renderedLists.set(list, signature);

    tasks.forEach((task) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mail-item office-mail-item ${completed[task.id] ? "completed" : ""}`;
      button.dataset.officeMailTask = task.id;
      button.innerHTML = `<strong>${esc(task.source)}</strong><span>${esc(task.title)}</span><small>${Pack.formatMinute(task.unlockMinute)}</small>`;
      button.addEventListener("click", () => {
        element.dataset.officeMailSelection = task.id;
        list.querySelectorAll(".mail-item").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        renderOfficeMail(view, task, Pack.officeState(Runtime.getEngine().getState()).completed[task.id]);
      });
      list.appendChild(button);
      if (task.id === element.dataset.officeMailSelection) {
        list.querySelectorAll(".mail-item").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        const viewScroll = view.scrollTop;
        renderOfficeMail(view, task, completed[task.id]);
        view.scrollTop = viewScroll;
      }
      if (task.id === focusedId) button.focus({ preventScroll: true });
    });
    if (!tasks.some((task) => task.id === element.dataset.officeMailSelection)) delete element.dataset.officeMailSelection;
    list.scrollTop = scrollTop;
    const status = element.querySelector(".window-status");
    if (status) status.textContent = `Писем: ${list.querySelectorAll(".mail-item").length}`;
    return true;
  }

  function renderOfficeMail(view, task, result) {
    const done = Boolean(result);
    const needsReview = result?.quality === "needs-review";
    const hasArchive = done && task.dayIndex === 0 && result?.submission?.source !== "shared-invoice" && Boolean(result?.submission);
    view.innerHTML = `
      <header class="mail-meta office-mail-meta">
        <h2>${esc(task.title)}</h2>
        <p>От: ${esc(task.source)}</p>
        <p>Время: ${Pack.formatMinute(task.unlockMinute)}</p>
      </header>
      <div class="mail-body office-mail-body">${esc(bodyFor(task))}</div>
      <section class="office-mail-assignment">
        <header><img src="${icon(done ? "checked-checkbox" : "task", 24)}" alt=""><div><b>${needsReview ? "Документ передан на проверку" : done ? "Поручение выполнено" : "Прикреплено рабочее поручение"}</b><span>${esc(task.description)}</span></div></header>
        <footer><span>${task.minutes} минут</span><button type="button" data-office-mail-open ${done && !hasArchive ? "disabled" : ""}>${hasArchive ? "Открыть результат" : needsReview ? "Передано" : done ? "Выполнено" : "Открыть задание"}</button></footer>
      </section>`;
    view.querySelector("[data-office-mail-open]")?.addEventListener("click", () => {
      if (hasArchive) root.UntilFridayDesktop?.openFileById?.("office-output-" + task.id);
      else if (!done) Pack.openTask(task.id);
    });
  }

  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "mail") decorateMail(event.detail.element);
  });

  root.addEventListener?.("until-friday-state-change", () => {
    const mailWindow = document.querySelector(".app-window[data-window-id='mail']");
    if (mailWindow) decorateMail(mailWindow);
  });

  root.UntilFridayOfficeWorkMail = {
    mailTasks,
    bodyFor,
    decorateMail,
    renderOfficeMail
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
