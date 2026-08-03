(function (root) {
  "use strict";

  let queued = false;
  let activeGame = null;
  let zIndex = 1700;

  const REPORT_FINAL = "Отправить финальную версию отчёта";
  const REPORT_OLD = "Отправить старый черновик";
  const INVOICE_FIX = "Исправить лишний ноль";
  const INVOICE_REPORT = "Передать счёт начальнику как нарушение";

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorateTaskLists();
    });
  }

  function decorateTaskLists() {
    document.querySelectorAll(".task-list").forEach((list) => {
      decorateReportTask(list);
      decorateInvoiceTask(list);
    });
  }

  function cardByTitle(list, title) {
    return Array.from(list.querySelectorAll(":scope > .task-card")).find((card) =>
      card.querySelector("h3")?.textContent.trim() === title
    ) || null;
  }

  function actionButton(card) {
    return card?.querySelector(".action-button") || null;
  }

  function decorateReportTask(list) {
    const finalCard = cardByTitle(list, REPORT_FINAL);
    const oldCard = cardByTitle(list, REPORT_OLD);
    if (!finalCard || !oldCard) return;

    finalCard.hidden = true;
    oldCard.hidden = true;
    if (list.querySelector('[data-minigame-card="report"]')) return;

    const card = createTaskCard(
      "report",
      "Подготовить отчёт за июль",
      "В общей папке находятся несколько похожих версий. Проверьте содержимое и отправьте нужный файл начальнику.",
      "Открыть задание"
    );
    card.querySelector("button").addEventListener("click", () => openReportGame({
      correct: actionButton(finalCard),
      wrong: actionButton(oldCard)
    }));
    list.insertBefore(card, finalCard);
  }

  function decorateInvoiceTask(list) {
    const fixCard = cardByTitle(list, INVOICE_FIX);
    const reportCard = cardByTitle(list, INVOICE_REPORT);
    if (!fixCard || !reportCard) return;

    fixCard.hidden = true;
    reportCard.hidden = true;
    if (list.querySelector('[data-minigame-card="invoice"]')) return;

    const card = createTaskCard(
      "invoice",
      "Проверить счёт №7814",
      "Сопоставьте счёт с договором, найдите ошибочное значение и решите, что делать с обнаруженным расхождением.",
      "Начать проверку"
    );
    card.querySelector("button").addEventListener("click", () => openInvoiceGame({
      fix: actionButton(fixCard),
      report: actionButton(reportCard)
    }));
    list.insertBefore(card, fixCard);
  }

  function createTaskCard(id, title, description, buttonLabel) {
    const card = document.createElement("article");
    card.className = "task-card work-minigame-card";
    card.dataset.minigameCard = id;
    card.innerHTML = `
      <header><h3></h3><span>рабочее задание</span></header>
      <div class="task-body">
        <p></p>
        <div class="action-row"><button class="action-button" type="button"></button></div>
      </div>`;
    card.querySelector("h3").textContent = title;
    card.querySelector("p").textContent = description;
    card.querySelector("button").textContent = buttonLabel;
    return card;
  }

  function createWindow(title, id) {
    closeActiveGame();
    const layer = document.querySelector("#windows-layer");
    if (!layer) return null;

    const windowElement = document.createElement("section");
    windowElement.className = "app-window focused work-minigame-window";
    windowElement.dataset.workMinigame = id;
    windowElement.style.zIndex = String(++zIndex);
    windowElement.innerHTML = `
      <header class="window-titlebar">
        <div class="window-title"></div>
        <div class="window-controls"><button type="button" data-close aria-label="Закрыть">×</button></div>
      </header>
      <div class="window-content work-minigame-content"></div>
      <footer class="window-status">Учебный режим отключён · результат будет записан в журнал</footer>`;
    windowElement.querySelector(".window-title").textContent = title;
    windowElement.querySelector("[data-close]").addEventListener("click", closeActiveGame);
    windowElement.addEventListener("mousedown", () => {
      windowElement.style.zIndex = String(++zIndex);
      document.querySelectorAll(".app-window").forEach((item) => item.classList.toggle("focused", item === windowElement));
    });
    makeDraggable(windowElement, windowElement.querySelector(".window-titlebar"));
    layer.appendChild(windowElement);
    activeGame = windowElement;
    return windowElement;
  }

  function closeActiveGame() {
    activeGame?.remove();
    activeGame = null;
  }

  function openReportGame(actions) {
    const windowElement = createWindow("Задачи — отчёт за июль", "report");
    if (!windowElement) return;
    const content = windowElement.querySelector(".work-minigame-content");
    const files = [
      {
        id: "draft",
        name: "Отчёт_июль_черновик.xlsx",
        modified: "Пт, 18:22",
        size: "42 КБ",
        author: "Илья Воронов",
        status: "Не сверены три строки. Итоговые значения помечены как предварительные.",
        rows: ["Обращений: 418", "Закрыто: 374", "Просрочено: 31", "Статус: ЧЕРНОВИК"]
      },
      {
        id: "autosave",
        name: "Отчёт_июль_финал_копия.xlsx",
        modified: "Пт, 18:58",
        size: "44 КБ",
        author: "Автосохранение",
        status: "Файл создан автоматически до последней проверки. Подпись автора отсутствует.",
        rows: ["Обращений: 421", "Закрыто: 389", "Просрочено: 18", "Статус: НЕ ПОДПИСАН"]
      },
      {
        id: "final",
        name: "Отчёт_июль_финал.xlsx",
        modified: "Пт, 19:04",
        size: "45 КБ",
        author: "Илья Воронов",
        status: "Данные сверены с журналом обращений. Проверка завершена перед отпуском.",
        rows: ["Обращений: 421", "Закрыто: 392", "Просрочено: 16", "Статус: ПРОВЕРЕНО"]
      }
    ];

    content.innerHTML = `
      <div class="work-task-heading">
        <strong>Поручение от Андрея Соколова</strong>
        <p>До 11:30 отправьте финальную версию июльского отчёта. В папке остались похожие файлы.</p>
      </div>
      <div class="report-picker">
        <aside class="report-file-list" data-file-list></aside>
        <section class="report-preview" data-preview><div class="work-empty-preview">Выберите файл для просмотра.</div></section>
      </div>
      <div class="work-task-footer">
        <span class="work-task-error" data-error></span>
        <button type="button" class="action-button" data-submit disabled>Отправить выбранный файл</button>
      </div>`;

    const list = content.querySelector("[data-file-list]");
    const preview = content.querySelector("[data-preview]");
    const submit = content.querySelector("[data-submit]");
    const error = content.querySelector("[data-error]");
    let selected = null;

    files.forEach((file) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "report-file";
      button.innerHTML = `<span class="report-file__icon"></span><span><strong></strong><small></small></span>`;
      button.querySelector("strong").textContent = file.name;
      button.querySelector("small").textContent = `${file.modified} · ${file.size}`;
      if (root.UntilFridaySprites) button.querySelector(".report-file__icon").appendChild(root.UntilFridaySprites.createIcon("files", "spreadsheet", 30));
      button.addEventListener("click", () => {
        selected = file;
        list.querySelectorAll("button").forEach((item) => item.classList.toggle("selected", item === button));
        renderReportPreview(preview, file);
        submit.disabled = false;
        error.textContent = "";
      });
      list.appendChild(button);
    });

    submit.addEventListener("click", () => {
      if (!selected) return;
      const target = selected.id === "final" ? actions.correct : actions.wrong;
      if (!target) {
        error.textContent = "Действие больше недоступно. Обновите список задач.";
        return;
      }
      closeActiveGame();
      target.click();
    });
  }

  function renderReportPreview(preview, file) {
    preview.innerHTML = `
      <header><h3></h3><span></span></header>
      <dl class="report-meta"><div><dt>Изменён</dt><dd></dd></div><div><dt>Автор</dt><dd></dd></div></dl>
      <div class="report-sheet" data-rows></div>
      <p class="report-file-note"></p>`;
    preview.querySelector("h3").textContent = file.name;
    preview.querySelector("header span").textContent = file.size;
    const values = preview.querySelectorAll("dd");
    values[0].textContent = file.modified;
    values[1].textContent = file.author;
    const rows = preview.querySelector("[data-rows]");
    file.rows.forEach((value) => {
      const row = document.createElement("div");
      row.textContent = value;
      rows.appendChild(row);
    });
    preview.querySelector(".report-file-note").textContent = file.status;
  }

  function openInvoiceGame(actions) {
    const windowElement = createWindow("Задачи — проверка счёта №7814", "invoice");
    if (!windowElement) return;
    const content = windowElement.querySelector(".work-minigame-content");
    const fields = [
      ["contract", "Договор", "Стоимость работ", "84 200 ₽", false],
      ["service", "Счёт", "Стоимость услуг", "84 200 ₽", false],
      ["payment", "Счёт", "Итого к оплате", "842 000 ₽", true],
      ["tax", "Счёт", "НДС", "Без НДС", false]
    ];

    content.innerHTML = `
      <div class="work-task-heading">
        <strong>Сверка финансового документа</strong>
        <p>Выберите значение, которое противоречит договору. После проверки решите, как поступить.</p>
      </div>
      <div class="invoice-compare">
        <section class="invoice-document">
          <header><strong>Договор КС-41/26</strong><span>утверждён</span></header>
          <p>Предмет: сопровождение программного комплекса</p>
          <p>Стоимость работ: <b>84 200 ₽</b></p>
        </section>
        <section class="invoice-document">
          <header><strong>Счёт №7814</strong><span>к оплате</span></header>
          <div class="invoice-fields" data-invoice-fields></div>
        </section>
      </div>
      <div class="invoice-resolution hidden" data-resolution>
        <strong>Расхождение найдено. Выберите действие:</strong>
        <div>
          <button type="button" class="action-button" data-fix>Исправить и передать бухгалтеру</button>
          <button type="button" class="action-button danger" data-report>Сохранить копию и передать начальнику</button>
        </div>
      </div>
      <div class="work-task-footer"><span class="work-task-error" data-error></span></div>`;

    const fieldList = content.querySelector("[data-invoice-fields]");
    const error = content.querySelector("[data-error]");
    const resolution = content.querySelector("[data-resolution]");

    fields.filter((field) => field[1] === "Счёт").forEach(([id, source, label, value, incorrect]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "invoice-field";
      button.dataset.field = id;
      button.innerHTML = `<span></span><strong></strong>`;
      button.querySelector("span").textContent = label;
      button.querySelector("strong").textContent = value;
      button.addEventListener("click", () => {
        fieldList.querySelectorAll("button").forEach((item) => item.classList.toggle("selected", item === button));
        if (!incorrect) {
          error.textContent = "Выбранное значение не противоречит договору. Проверьте итоговую сумму.";
          resolution.classList.add("hidden");
          button.classList.add("incorrect-choice");
          window.setTimeout(() => button.classList.remove("incorrect-choice"), 320);
          return;
        }
        error.textContent = "";
        resolution.classList.remove("hidden");
      });
      fieldList.appendChild(button);
    });

    content.querySelector("[data-fix]").addEventListener("click", () => completeByButton(actions.fix, error));
    content.querySelector("[data-report]").addEventListener("click", () => completeByButton(actions.report, error));
  }

  function completeByButton(button, errorElement) {
    if (!button) {
      errorElement.textContent = "Действие больше недоступно. Обновите список задач.";
      return;
    }
    closeActiveGame();
    button.click();
  }

  function makeDraggable(element, handle) {
    let drag = null;
    handle.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) return;
      const rect = element.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      event.preventDefault();
    });
    document.addEventListener("mousemove", (event) => {
      if (!drag) return;
      const maxX = Math.max(0, window.innerWidth - element.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - element.offsetHeight - 44);
      element.style.left = `${Math.max(0, Math.min(event.clientX - drag.x, maxX))}px`;
      element.style.top = `${Math.max(0, Math.min(event.clientY - drag.y, maxY))}px`;
    });
    document.addEventListener("mouseup", () => { drag = null; });
  }

  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", queueDecorate, { once: true });
  window.addEventListener("until-friday-app-ready", queueDecorate);
  queueDecorate();

  root.UntilFridayWorkMinigames = {
    openReportGame,
    openInvoiceGame
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
