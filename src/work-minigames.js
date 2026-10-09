(function (root) {
  "use strict";

  // Monday's documents are one shared model for Explorer, Mail and the invoice editor.
  // The story remains owned by UntilFridayRuntimeEngine; no separate engine save is written here.
  const REPORTS = Object.freeze([
    {
      id: "report-old",
      title: "Отчёт_июль_черновик.xlsx",
      modified: "Пт, 18:22",
      author: "Сотрудник отдела",
      status: "Черновик. Не сверены три строки.",
      requests: 418, closed: 374, overdue: 31
    },
    {
      id: "report-autosave",
      title: "Отчёт_июль_финал_копия.xlsx",
      modified: "Пт, 18:58",
      author: "Автосохранение",
      status: "Автоматическая копия без подписи. Сверка не завершена.",
      requests: 421, closed: 389, overdue: 18
    },
    {
      id: "report-final",
      title: "Отчёт_июль_финал.xlsx",
      modified: "Пт, 19:04",
      author: "Сотрудник отдела",
      status: "Данные сверены с журналом обращений.",
      requests: 421, closed: 392, overdue: 16
    }
  ]);
  const REPORT_ACTIONS = Object.freeze({
    "report-old": "mon-report-old",
    "report-autosave": "mon-report-old",
    "report-final": "mon-report-final"
  });
  const REPORT_LABELS = ["Отправить финальную версию отчёта", "Отправить старый черновик"];
  const INVOICE_LABELS = ["Исправить лишний ноль", "Передать счёт начальнику как нарушение"];
  const INVOICE_AMOUNT = 842000;
  const CONTRACT_AMOUNT = 84200;
  let queued = false;

  function stateNow() {
    return root.UntilFridayRuntimeEngine?.getEngine?.()?.getState?.();
  }

  function reportDone(state) {
    return Boolean(state?.completedActions?.["mon-report-final"] || state?.completedActions?.["mon-report-old"]);
  }

  function invoiceDone(state) {
    return Boolean(state?.completedActions?.["mon-invoice-fix"] || state?.completedActions?.["mon-invoice-report"]);
  }

  function parseAmount(text) {
    const raw = String(text ?? "").replace(/[\s\u00a0\u202f₽]/g, "");
    if (!/^\d+(?:[,.]00)?$/.test(raw)) return null;
    const number = Number(raw.replace(/[,.]00$/, ""));
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }

  function formatAmount(number) {
    return Number(number).toLocaleString("ru-RU") + " ₽";
  }

  function invoiceTotal(state) {
    const value = state?.metadata?.mondayInvoice?.total;
    return Number.isSafeInteger(value) && value > 0 ? value : INVOICE_AMOUNT;
  }

  function submissionText(task, record) {
    const submitted = record.submission || {};
    const config = task.config || {};
    let lines = [];
    if (task.type === "document") lines = [String(submitted.text || "")];
    else if (task.type === "sheet") {
      lines = [
        ...config.rows.map((row) => row.join(" | ")),
        "",
        "Сохранённые ячейки:",
        ...Object.entries(submitted.values || {}).map(([cell, value]) => cell + " = " + value)
      ];
    } else if (task.type === "template") {
      lines = config.fields.map((field) => field.label + ": " + (submitted.fields?.[field.id] || "не заполнено"));
    } else if (task.type === "organize") {
      lines = config.files.map((file) => file.name + " → " + (submitted.assignments?.[file.id] || "не распределён"));
    } else if (task.type === "audit") {
      lines = ["Отмеченные строки:", ...(submitted.selected || [])];
    } else if (task.type === "sort") {
      lines = ["Порядок:", ...(submitted.order || [])];
    }
    return [
      task.title,
      "Отдел: " + task.source,
      "Передано в " + Math.floor(record.minute / 60).toString().padStart(2, "0") +
        ":" + (record.minute % 60).toString().padStart(2, "0"),
      "Состояние: " + (record.quality === "needs-review" ? "передано на проверку" : "передано"),
      "",
      ...lines
    ].join("\n");
  }

  function submittedDocuments(state) {
    const completed = state?.metadata?.officeWork?.completed || {};
    const tasks = root.UntilFridayOfficeWorkPack?.TASK_BY_ID || {};
    return Object.entries(completed)
      .filter(([id, result]) => id.startsWith("office-mon-") &&
        result?.submission && result.submission.source !== "shared-invoice" && tasks[id])
      .map(([id, result]) => {
        const task = tasks[id];
        const isSheet = task.type === "sheet";
        return {
          id: "office-output-" + id,
          title: task.title.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_") + (isSheet ? ".xlsx" : ".txt"),
          type: isSheet ? "Таблица" : "Рабочий документ",
          icon: isSheet ? "XLS" : "TXT",
          content: submissionText(task, result)
        };
      });
  }

  function documents(state = stateNow()) {
    const submitted = submittedDocuments(state);
    if (state && state.dayIndex !== 0) return submitted;
    const reports = REPORTS.map((file) => ({
      ...file,
      type: "Таблица",
      icon: "XLS",
      content: [
        file.title,
        "Автор: " + file.author,
        "Изменён: " + file.modified,
        "",
        "Обращений: " + file.requests,
        "Закрыто: " + file.closed,
        "Просрочено: " + file.overdue,
        "",
        file.status
      ].join("\n")
    }));
    return [...reports, {
      id: "invoice",
      title: "Счёт_7814.xlsx",
      type: "Таблица",
      icon: "XLS",
      content: "Договор КС-41/26 · сопровождение программного комплекса\n" +
        "Стоимость по договору: " + formatAmount(CONTRACT_AMOUNT) + "\n" +
        "Итого в счёте: " + formatAmount(invoiceTotal(state)) + "\n" +
        "Состояние: " + (state?.metadata?.mondayInvoice?.saved ? "изменён пользователем" : "получен из бухгалтерии")
    }, ...submitted];
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function openApp(id) {
    const desktop = root.UntilFridayDesktop;
    if (desktop?.openApp) desktop.openApp(id);
    else root.document?.querySelector?.('[data-app="' + id + '"]')?.dispatchEvent?.(new MouseEvent("dblclick", { bubbles: true }));
  }

  function action(id) {
    if (!root.UntilFridayDesktop?.performAction) return { ok: false, reason: "Приложение ещё загружается." };
    return root.UntilFridayDesktop.performAction(id);
  }

  function cardByTitle(list, title) {
    return Array.from(list.querySelectorAll(":scope > .task-card")).find((card) =>
      card.querySelector("h3")?.textContent.trim() === title
    );
  }

  function taskCard(kind, title, description, buttonText, open) {
    const card = document.createElement("article");
    card.className = "task-card work-minigame-card monday-work-card";
    card.dataset.minigameCard = kind;
    card.innerHTML = '<header><h3></h3><span>рабочая задача</span></header>' +
      '<div class="task-body"><p></p><div class="action-row"><button class="action-button" type="button"></button></div></div>';
    card.querySelector("h3").textContent = title;
    card.querySelector("p").textContent = description;
    const button = card.querySelector("button");
    button.textContent = buttonText;
    button.addEventListener("click", open);
    return card;
  }

  function decorateTasks(element) {
    const state = stateNow();
    const list = element?.querySelector?.(".task-list");
    if (!list || !state || state.dayIndex !== 0) return;
    const reportCards = REPORT_LABELS.map((label) => cardByTitle(list, label)).filter(Boolean);
    const invoiceCards = INVOICE_LABELS.map((label) => cardByTitle(list, label)).filter(Boolean);
    reportCards.forEach((card) => { card.hidden = true; });
    invoiceCards.forEach((card) => { card.hidden = true; });
    if (reportCards.length && !reportDone(state) && !list.querySelector('[data-minigame-card="report"]')) {
      list.insertBefore(taskCard("report", "Отчёт за июль",
        "Откройте версии отчёта в Проводнике, затем ответьте на письмо Андрея Соколова и приложите выбранный файл.",
        "Перейти в Почту", () => openApp("mail")), list.querySelector(".office-work-pack") || list.firstElementChild);
    }
    if (invoiceCards.length && !invoiceDone(state) && !list.querySelector('[data-minigame-card="invoice"]')) {
      list.insertBefore(taskCard("invoice", "Счёт №7814",
        "Найдите счёт в Проводнике, сравните сумму с договором и сохраните исправление либо передайте вопрос начальнику.",
        "Открыть Проводник", () => openApp("explorer")), list.querySelector(".office-work-pack") || list.firstElementChild);
    }
  }

  function decorateMail(element) {
    const state = stateNow();
    if (!state || state.dayIndex !== 0) return;
    const view = element?.querySelector?.(".mail-view");
    if (!view || view.querySelector(".mail-meta h2")?.textContent.trim() !== "Отчёт за июль") return;
    if (view.querySelector("[data-monday-mail]")) return;
    const panel = document.createElement("section");
    panel.className = "monday-mail-panel";
    panel.dataset.mondayMail = "true";
    if (reportDone(state)) {
      const sentLabel = state.completedActions["mon-report-final"] ? REPORTS[2].title : "предварительная версия июльского отчёта";
      panel.textContent = "Ответ отправлен. Вложение: " + sentLabel + ".";
      view.appendChild(panel);
      return;
    }
    panel.innerHTML = '<header><strong>Ответить с вложением</strong><span>Для проверки версий используйте Проводник</span></header>' +
      '<label>Файл из общего каталога<select data-monday-report><option value="">Выберите вложение…</option>' +
      REPORTS.map((file) => '<option value="' + file.id + '">' + escapeHtml(file.title) + '</option>').join("") +
      '</select></label>' +
      '<div class="monday-mail-footer"><span data-monday-mail-error role="status"></span><button type="button" class="action-button" data-monday-send>Отправить Андрею</button></div>';
    const select = panel.querySelector("[data-monday-report]");
    const error = panel.querySelector("[data-monday-mail-error]");
    panel.querySelector("[data-monday-send]").addEventListener("click", () => {
      const selected = REPORTS.find((file) => file.id === select.value);
      if (!selected) { error.textContent = "Выберите файл из общего каталога."; return; }
      const result = action(REPORT_ACTIONS[selected.id]);
      if (!result?.ok) { error.textContent = "Отправка не выполнена. Проверьте доступность задания и время."; return; }
      // A sent report is reconstructed from the story action after reload.
      panel.replaceChildren(document.createTextNode("Письмо отправлено. Вложение: " + selected.title + "."));
    });
    view.appendChild(panel);
  }

  function saveInvoice(total) {
    const engine = root.UntilFridayRuntimeEngine?.getEngine?.();
    const state = engine?.getState?.();
    if (!engine || !state || state.dayIndex !== 0 || invoiceDone(state)) return { ok: false };
    return engine.updateState((draft) => {
      draft.metadata ||= {};
      draft.metadata.mondayInvoice = {
        total,
        saved: true,
        updatedMinute: draft.minute
      };
    }, "monday-invoice-edit");
  }

  function decorateInvoiceWindow(element) {
    const state = stateNow();
    if (!state || state.dayIndex !== 0) return;
    const paper = element?.querySelector?.(".document-paper");
    if (!paper || element.querySelector("[data-monday-invoice]")) return;
    const completed = invoiceDone(state);
    const container = document.createElement("section");
    container.dataset.mondayInvoice = "true";
    container.className = "monday-invoice-editor";
    container.innerHTML = '<header><strong>Счёт №7814</strong><span>Договор КС-41/26</span></header>' +
      '<div class="monday-invoice-row"><span>Стоимость работ по договору</span><strong>' + formatAmount(CONTRACT_AMOUNT) + '</strong></div>' +
      '<label class="monday-invoice-row"><span>Итого к оплате по счёту</span>' +
      '<input data-monday-invoice-total inputmode="decimal" aria-label="Итого к оплате" value="' +
      escapeHtml(String(invoiceTotal(state))) + '" ' + (completed ? "disabled" : "") + '></label>' +
      '<div class="monday-invoice-footer"><button type="button" data-monday-save ' + (completed ? "disabled" : "") + '>Сохранить сумму</button>' +
      '<span data-monday-status role="status"></span></div>' +
      '<div class="monday-invoice-actions">' +
      '<button type="button" class="action-button" data-monday-fix ' + (completed ? "disabled" : "") + '>Передать исправление бухгалтеру</button>' +
      '<button type="button" class="action-button secondary" data-monday-escalate ' + (completed ? "disabled" : "") + '>Передать расхождение начальнику</button></div>';
    paper.replaceWith(container);
    const input = container.querySelector("[data-monday-invoice-total]");
    const status = container.querySelector("[data-monday-status]");
    status.textContent = completed ? "Решение по счёту уже принято." : (state.metadata?.mondayInvoice?.saved ? "Изменения сохранены." : "Исходный счёт.");
    container.querySelector("[data-monday-save]").addEventListener("click", () => {
      const total = parseAmount(input.value);
      if (total === null) { status.textContent = "Введите положительную сумму в рублях."; return; }
      const result = saveInvoice(total);
      if (!result?.ok) { status.textContent = "Не удалось сохранить сумму."; return; }
      input.value = String(total);
      status.textContent = "Сумма сохранена. Сверьте её с договором перед передачей.";
    });
    container.querySelector("[data-monday-fix]").addEventListener("click", () => {
      const current = stateNow();
      if (parseAmount(input.value) !== CONTRACT_AMOUNT ||
          invoiceTotal(current) !== CONTRACT_AMOUNT ||
          !current?.metadata?.mondayInvoice?.saved) {
        status.textContent = "Бухгалтеру можно передать только сохранённую сумму, совпадающую с договором.";
        return;
      }
      const result = action("mon-invoice-fix");
      status.textContent = result?.ok ? "Исправленный счёт передан бухгалтеру." : "Передача недоступна.";
      if (result?.ok) container.querySelectorAll("input, button").forEach((node) => { node.disabled = true; });
    });
    container.querySelector("[data-monday-escalate]").addEventListener("click", () => {
      const result = action("mon-invoice-report");
      status.textContent = result?.ok ? "Копия исходного счёта передана начальнику." : "Передача недоступна.";
      if (result?.ok) container.querySelectorAll("input, button").forEach((node) => { node.disabled = true; });
    });
    element.querySelector(".window-status").textContent = completed ? "Решение принято" : "Локальная копия · изменения фиксируются";
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    root.requestAnimationFrame(() => {
      queued = false;
      const state = stateNow();
      if (!state || state.dayIndex !== 0) return;
      document.querySelectorAll(".app-window[data-window-id='tasks']").forEach(decorateTasks);
      document.querySelectorAll(".app-window[data-window-id='mail']").forEach(decorateMail);
      document.querySelectorAll(".app-window[data-window-id='doc-invoice']").forEach(decorateInvoiceWindow);
    });
  }

  root.addEventListener("until-friday-ui-render", queueDecorate);
  root.addEventListener("until-friday-state-change", queueDecorate);
  root.addEventListener("until-friday-app-ready", queueDecorate);
  root.document?.addEventListener("DOMContentLoaded", queueDecorate, { once: true });

  root.UntilFridayWorkMinigames = {
    REPORTS, documents, parseAmount, invoiceTotal, reportDone, invoiceDone,
    decorateTasks, decorateMail, decorateInvoiceWindow, saveInvoice,
    openReportGame: () => openApp("mail"),
    openInvoiceGame: () => openApp("explorer")
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
