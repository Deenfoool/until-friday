(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayUiRuntimeGuards) return;

  const STORAGE_TEST_KEY = "__until_friday_action_storage_test__";
  const MAIL_CONTEXT = {
    "wed-audit-explain": "Запрос пояснений",
    "wed-audit-delete": "Запрос пояснений",
    "wed-audit-blame": "Запрос пояснений"
  };
  const CHAT_CONTEXT = {
    "mon-tell-friend": "Дима Орлов",
    "tue-answer-admin-honest": "Роман Белов",
    "tue-answer-admin-lie": "Роман Белов"
  };
  const DISABLED_ACTION_TEXT = {
    "choice-locked": "Другой вариант уже выбран",
    "focus-exhausted": "Не хватает времени сегодня",
    "workday-ended": "Рабочий день завершён",
    "requirements-not-met": "Условия не выполнены",
    "already-completed": "Уже выполнено"
  };

  let queued = false;
  let lastActionAttempt = null;

  function engine() {
    return root.UntilFridayDayTransitionGuard?.getEngine?.()
      || root.UntilFridayPassiveClock?.getEngine?.()
      || null;
  }

  function setText(element, value) {
    const next = String(value ?? "");
    if (element && element.textContent !== next) element.textContent = next;
  }

  function actionByLabel(label) {
    return Object.values(Story.actions || {}).find((action) => action.label === String(label || "").trim()) || null;
  }

  function storageWritable() {
    try {
      localStorage.setItem(STORAGE_TEST_KEY, "1");
      localStorage.removeItem(STORAGE_TEST_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function notify(title, text) {
    const container = document.querySelector("#notifications");
    if (!container) return;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification ui-guard-notification";
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = title;
    span.textContent = text;
    item.append(strong, span);
    item.addEventListener("click", () => item.remove());
    container.appendChild(item);
    window.setTimeout(() => item.remove(), 7000);
  }

  function applyContext(button, expected, actual) {
    if (!button || !expected) return false;
    const visible = expected === actual;
    button.hidden = !visible;
    button.setAttribute("aria-hidden", String(!visible));
    return visible;
  }

  function contextHint(container, text, needed) {
    let hint = container.querySelector(":scope > .context-action-hint");
    if (!needed) {
      hint?.remove();
      return;
    }
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "muted context-action-hint";
      container.appendChild(hint);
    }
    setText(hint, text);
  }

  function repairMailActionContext() {
    document.querySelectorAll(".mail-view").forEach((view) => {
      const title = view.querySelector("h2")?.textContent.trim() || "";
      const row = view.querySelector("[data-actions]");
      if (!row) return;
      let contextual = 0;
      let visible = 0;
      row.querySelectorAll(".action-button").forEach((button) => {
        const action = actionByLabel(button.textContent);
        const expected = action && MAIL_CONTEXT[action.id];
        if (!expected) return;
        contextual += 1;
        if (applyContext(button, expected, title)) visible += 1;
      });
      contextHint(row, "Для этого письма нет доступных служебных ответов.", contextual > 0 && visible === 0);
    });
  }

  function repairChatActionContext() {
    document.querySelectorAll(".chat-layout").forEach((layout) => {
      const contact = layout.querySelector(".chat-header strong")?.textContent.trim() || "";
      const row = layout.querySelector("[data-actions]");
      if (!row) return;
      let contextual = 0;
      let visible = 0;
      row.querySelectorAll(".action-button").forEach((button) => {
        const action = actionByLabel(button.textContent);
        const expected = action && CHAT_CONTEXT[action.id];
        if (!expected) return;
        contextual += 1;
        if (applyContext(button, expected, contact)) visible += 1;
      });
      contextHint(row, "Для этого контакта сейчас нет вариантов ответа.", contextual > 0 && visible === 0);
    });
  }

  function repairWorkflowSelection() {
    document.querySelectorAll(".v2-explorer").forEach((explorer) => {
      const deleteButton = explorer.closest(".window-content")?.querySelector("[data-workflow-delete]");
      if (!deleteButton) return;
      const selected = explorer.querySelector("[data-workflow-file-id].selected");
      deleteButton.disabled = !selected;
    });
  }

  function repairDocumentActionButtons() {
    const currentEngine = engine();
    if (!currentEngine) return;
    document.querySelectorAll(".document-actions .action-button, .restricted .action-button").forEach((button) => {
      const action = Story.actions?.[button.dataset.runtimeActionId] || actionByLabel(button.textContent);
      if (!action) return;
      button.dataset.runtimeActionId = action.id;
      const result = currentEngine.canApplyAction(action.id);
      if (result.ok) {
        button.disabled = false;
        setText(button, action.label);
        button.removeAttribute("title");
        return;
      }
      button.disabled = true;
      setText(button, DISABLED_ACTION_TEXT[result.reason] || "Действие недоступно");
      button.title = result.reason || "Недоступно";
    });
  }

  function removeDuplicateEndings() {
    const overlays = Array.from(document.querySelectorAll(".friday-ending-overlay, .ending-overlay"));
    if (overlays.length <= 1) return;
    const preferred = overlays.find((item) => item.classList.contains("friday-ending-overlay")) || overlays.at(-1);
    overlays.forEach((item) => {
      if (item !== preferred) item.remove();
    });
  }

  function repairEndingNarrative() {
    const state = engine()?.getState?.();
    if (!state?.endingId || !["voluntary-exit", "fired-clean"].includes(state.endingId)) return;
    const definition = (Story.endings || []).find((item) => item.id === state.endingId);
    const paragraph = document.querySelector(".friday-ending-header > p");
    if (paragraph && definition?.text) setText(paragraph, definition.text);
  }

  function repairWindowPositions() {
    if (!Number.isFinite(window.innerWidth) || !Number.isFinite(window.innerHeight)) return;
    document.querySelectorAll(".app-window:not(.minimized)").forEach((win) => {
      if (typeof win.getBoundingClientRect !== "function") return;
      const rect = win.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - Math.min(rect.width, window.innerWidth));
      const maxY = Math.max(0, window.innerHeight - 42 - Math.min(rect.height, window.innerHeight - 42));
      const left = Math.min(maxX, Math.max(0, Number.parseFloat(win.style.left) || rect.left || 0));
      const top = Math.min(maxY, Math.max(0, Number.parseFloat(win.style.top) || rect.top || 0));
      if (window.innerWidth > 760) {
        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
      }
    });
  }

  function improveGenericActionError() {
    const attempt = lastActionAttempt;
    if (!attempt || Date.now() - attempt.at > 1500) return;
    const currentEngine = engine();
    if (!currentEngine) return;
    const result = currentEngine.canApplyAction(attempt.actionId);
    if (result.ok) return;

    const messages = {
      "choice-locked": "Для этой ситуации уже выбран другой вариант.",
      "focus-exhausted": "На сегодня не осталось времени для ещё одного крупного действия.",
      "workday-ended": "Рабочий день уже закончился. Завершите его через часы или приложение «Задачи».",
      "requirements-not-met": "Сначала выполните условия, необходимые для этого решения.",
      "already-completed": "Это действие уже выполнено."
    };
    const replacement = messages[result.reason];
    if (!replacement) return;

    Array.from(document.querySelectorAll(".notification")).slice(-3).forEach((item) => {
      const span = item.querySelector("span");
      if (span?.textContent.trim() === "Действие недоступно.") setText(span, replacement);
    });
  }

  function decorate() {
    repairMailActionContext();
    repairChatActionContext();
    repairWorkflowSelection();
    repairDocumentActionButtons();
    removeDuplicateEndings();
    repairEndingNarrative();
    repairWindowPositions();
    improveGenericActionError();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorate();
    });
  }

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest?.(".action-button");
    const action = actionButton
      ? Story.actions?.[actionButton.dataset.runtimeActionId] || actionByLabel(actionButton.textContent)
      : null;
    if (action) {
      lastActionAttempt = { actionId: action.id, at: Date.now() };
      if (!storageWritable()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        notify("Сохранение недоступно", "Действие не выполнено, потому что браузер запретил локальное хранилище.");
        return;
      }
    }

    const deleteButton = event.target.closest?.("[data-workflow-delete]");
    if (deleteButton && !deleteButton.closest(".window-content")?.querySelector("[data-workflow-file-id].selected")) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      deleteButton.disabled = true;
      notify("Проводник", "Сначала выберите файл в папке «Документы».");
      return;
    }

    const clock = event.target.closest?.("#clock");
    const currentEngine = engine();
    if (clock && currentEngine?.getState?.().ended) {
      const ending = document.querySelector(".friday-ending-overlay, .ending-overlay");
      if (ending) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        ending.querySelector("button:not([disabled])")?.focus();
      }
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    const icon = event.target.closest?.(".desktop-icon[data-app]");
    if (!icon || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    icon.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  }, true);

  document.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch") return;
    const icon = event.target.closest?.(".desktop-icon[data-app]");
    if (!icon) return;
    icon.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  }, true);

  const observer = new MutationObserver(queue);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  document.addEventListener("DOMContentLoaded", queue, { once: true });
  window.addEventListener("until-friday-app-ready", queue);
  window.addEventListener("resize", queue);
  queue();

  root.UntilFridayUiRuntimeGuards = {
    MAIL_CONTEXT,
    CHAT_CONTEXT,
    actionByLabel,
    storageWritable,
    repairMailActionContext,
    repairChatActionContext,
    repairWorkflowSelection,
    repairDocumentActionButtons,
    repairEndingNarrative,
    repairWindowPositions,
    setText
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
