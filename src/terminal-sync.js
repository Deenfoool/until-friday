(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayTerminalSync) return;

  const SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const STORAGE_TEST_KEY = "__until_friday_terminal_storage_test__";
  const INTERCEPTED = new Set(["status", "day", "tasks", "actions", "logs", "run", "endday"]);

  function engine() {
    return root.UntilFridayPersistentEngineGuard?.getEngine?.()
      || root.UntilFridayDayTransitionGuard?.getEngine?.()
      || root.UntilFridayPassiveClock?.getEngine?.()
      || null;
  }

  function formatTime(totalMinutes) {
    const value = Math.max(0, Number(totalMinutes) || 0);
    return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
  }

  function playerName() {
    return root.UntilFridayProfile?.playerName?.() || "Сотрудник";
  }

  function login() {
    return root.UntilFridayProfile?.terminalLogin?.(playerName()) || "employee";
  }

  function commandResult(command, currentEngine, state) {
    const day = Story.days?.[state.dayIndex] || Story.days?.[0] || { title: "Рабочий день", dateLabel: "" };
    if (command === "status") {
      return `Пользователь: ${playerName()}\nДень: ${day.title}\nВремя: ${formatTime(state.minute)}\nСеть: OFFICE-LAN\nАудит: включён`;
    }
    if (command === "day") return `${day.title}, ${day.dateLabel}`;
    if (command === "tasks") {
      const actions = [...currentEngine.listActions("tasks"), ...currentEngine.listActions("meeting")];
      return actions.map((action) => `${action.id} — ${action.label}`).join("\n") || "Нет доступных задач.";
    }
    if (command === "actions") {
      return currentEngine.listActions().map((action) => `${action.id} [${action.channel}] — ${action.label}`).join("\n") || "Нет доступных действий.";
    }
    if (command === "logs") {
      return state.journal.slice(-12).map((item) => `${formatTime(item.minute)} ${item.text}`).join("\n") || "Журнал пуст.";
    }
    return "";
  }

  function actionError(reason) {
    const messages = {
      "game-ended": "Неделя уже завершена.",
      "day-not-started": "Рабочий день ещё не начался.",
      "unknown-action": "Действие не найдено.",
      "wrong-day": "Это действие недоступно сегодня.",
      "already-completed": "Это действие уже выполнено.",
      "requirements-not-met": "Не выполнены условия этого действия.",
      "choice-locked": "Для этой ситуации уже выбран другой вариант.",
      "focus-exhausted": "На сегодня не осталось времени для ещё одного крупного действия.",
      "workday-ended": "Рабочий день уже закончился. Введите endday.",
      "save-failed": "Действие отменено: браузер не смог записать сохранение.",
      "action-exception": "Действие отменено из-за внутренней ошибки. Состояние не изменено."
    };
    return messages[reason] || "Действие недоступно.";
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

  function appendLine(output, text, className = "") {
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    output.appendChild(line);
  }

  function notify(event) {
    const container = document.querySelector("#notifications");
    if (!container || !event) return;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification terminal-sync-notification";
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = event.source || event.title || "Система";
    span.textContent = event.text || event.title || "Новое событие";
    item.append(strong, span);
    item.addEventListener("click", () => item.remove());
    container.appendChild(item);
    window.setTimeout(() => item.remove(), 6500);
  }

  function persist(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("Терминал не смог сохранить состояние", error);
      return false;
    }
  }

  function updateClock(state) {
    const time = document.querySelector("#clock-time");
    const date = document.querySelector("#clock-date");
    const dayShort = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];
    if (time) time.textContent = formatTime(state.minute);
    if (date) date.textContent = `${dayShort[state.dayIndex] || ""}, ${3 + state.dayIndex} АВГ`;
  }

  function executeRun(argument, currentEngine, output) {
    const action = Story.actions?.[argument];
    if (!action || action.channel !== "terminal") {
      appendLine(output, "Команда может запускать только доступные terminal-действия. Введите actions.", "error");
      return;
    }
    if (!storageWritable()) {
      appendLine(output, "Локальное сохранение недоступно. Действие не выполнено.", "error");
      return;
    }

    const result = currentEngine.applyAction(argument);
    if (!result.ok) {
      appendLine(output, actionError(result.reason), "error");
      return;
    }
    const state = result.state || currentEngine.getState();
    persist(state);
    updateClock(state);
    appendLine(output, result.result || action.label);
    (result.events || []).forEach(notify);
  }

  document.addEventListener("keydown", (event) => {
    const input = event.target.closest?.(".terminal-input");
    if (!input || event.key !== "Enter" || event.isComposing) return;
    const raw = input.value.trim();
    const [command = "", ...parts] = raw.split(/\s+/);
    const normalized = command.toLowerCase();
    if (!INTERCEPTED.has(normalized)) return;

    const currentEngine = engine();
    const output = input.closest(".terminal")?.querySelector(".terminal-output");
    if (!currentEngine || !output) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    input.value = "";
    appendLine(output, `${login()}@office:> ${raw}`);

    if (normalized === "endday") {
      const opened = root.UntilFridayDayEndControl?.open?.();
      if (!opened) {
        const state = currentEngine.getState();
        appendLine(output, state.dayIndex === Story.days.length - 1 && !state.ended
          ? "Пятницу можно завершить только после встречи в переговорной №1."
          : state.ended
            ? "Рабочая неделя уже завершена."
            : "Окно завершения дня сейчас недоступно.", "error");
      }
      output.scrollTop = output.scrollHeight;
      return;
    }

    if (normalized === "run") {
      executeRun(parts.join(" "), currentEngine, output);
      output.scrollTop = output.scrollHeight;
      return;
    }

    const before = currentEngine.getState();
    appendLine(output, commandResult(normalized, currentEngine, before), normalized === "logs" ? "dim" : "");
    const minutes = normalized === "actions" ? 3 : 1;
    const result = currentEngine.advanceTime(minutes);
    const after = result.state || currentEngine.getState();
    persist(after);
    updateClock(after);
    (result.events || []).forEach(notify);
    output.scrollTop = output.scrollHeight;
  }, true);

  root.UntilFridayTerminalSync = {
    INTERCEPTED,
    commandResult,
    actionError,
    executeRun,
    formatTime,
    engine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
