(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayTerminalSync) return;

  const INTERCEPTED = new Set([
    "help",
    "status",
    "day",
    "tasks",
    "actions",
    "files",
    "logs",
    "run",
    "clear",
    "endday"
  ]);

  function runtime() {
    return root.UntilFridayRuntimeEngine || null;
  }

  function engine() {
    return runtime()?.getEngine?.() || null;
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
    if (command === "help") {
      return [
        "help              список команд",
        "status            состояние сеанса",
        "day               текущий день",
        "tasks             доступные задачи",
        "actions           все доступные действия",
        "files             доступные служебные файлы",
        "logs              журнал действий",
        "run <id>          выполнить terminal-действие",
        "clear             очистить экран",
        "endday            завершить день"
      ].join("\n");
    }
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
    if (command === "files") {
      const content = currentEngine.listVisibleContent("files")
        .map((item) => `${item.id} — ${item.title}`);
      const explorerActions = currentEngine.listActions("explorer")
        .map((action) => `${action.id} — ${action.label}`);
      return [...content, ...explorerActions].join("\n") || "Файлы не найдены.";
    }
    if (command === "logs") {
      return state.journal.slice(-12).map((item) => `${formatTime(item.minute)} ${item.text}`).join("\n") || "Журнал пуст.";
    }
    return `Команда «${command}» не найдена. Введите help.`;
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
      "not-enough-time": "До конца рабочего дня недостаточно времени для этого действия.",
      "save-failed": "Изменение отменено: браузер не смог записать сохранение.",
      "action-exception": "Действие отменено из-за внутренней ошибки. Состояние не изменено.",
      "time-exception": "Ход времени отменён из-за внутренней ошибки."
    };
    return messages[reason] || "Действие недоступно.";
  }

  function appendLine(output, text, className = "") {
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    output.appendChild(line);
  }

  function notify(event) {
    if (!event) return;
    const title = event.source || event.title || "Система";
    const text = event.text || event.title || "Новое событие";
    if (runtime()?.notify) {
      runtime().notify(title, text);
      return;
    }

    const container = document.querySelector("#notifications");
    if (!container) return;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification terminal-sync-notification";
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = title;
    span.textContent = text;
    item.append(strong, span);
    item.addEventListener("click", () => item.remove());
    container.appendChild(item);
    window.setTimeout(() => item.remove(), 6500);
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

    const result = currentEngine.applyAction(argument);
    if (!result.ok) {
      appendLine(output, actionError(result.reason), "error");
      return;
    }

    const state = result.state || currentEngine.getState();
    updateClock(state);
    appendLine(output, result.result || action.label);
    (result.events || []).forEach(notify);
  }

  function commandMinutes(command) {
    return command === "actions" || command === "files" ? 3 : 1;
  }

  document.addEventListener("keydown", (event) => {
    const input = event.target.closest?.(".terminal-input");
    if (!input || event.key !== "Enter" || event.isComposing) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const raw = input.value.trim();
    input.value = "";
    if (!raw) return;

    const [command = "", ...parts] = raw.split(/\s+/);
    const normalized = command.toLowerCase();
    const currentEngine = engine();
    const output = input.closest(".terminal")?.querySelector(".terminal-output");
    if (!currentEngine || !output) return;

    if (normalized === "clear") {
      output.replaceChildren();
      return;
    }

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
    const known = INTERCEPTED.has(normalized);
    appendLine(
      output,
      commandResult(normalized, currentEngine, before),
      normalized === "logs" ? "dim" : known ? "" : "error"
    );

    const result = currentEngine.advanceTime(commandMinutes(normalized));
    if (!result?.ok) {
      appendLine(output, actionError(result?.reason), "error");
      output.scrollTop = output.scrollHeight;
      return;
    }

    const after = result.state || currentEngine.getState();
    updateClock(after);
    (result.events || []).forEach(notify);
    output.scrollTop = output.scrollHeight;
  }, true);

  root.UntilFridayTerminalSync = {
    INTERCEPTED,
    commandResult,
    actionError,
    executeRun,
    commandMinutes,
    formatTime,
    engine,
    login
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
