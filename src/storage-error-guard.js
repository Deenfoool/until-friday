(function (root) {
  "use strict";

  const Workflow = root.UntilFridayWorkflow;
  if (!Workflow || root.UntilFridayStorageErrorGuard) return;

  const originalSaveAttachment = Workflow.saveAttachment?.bind(Workflow);
  let lastNoticeAt = 0;

  function isStorageError(error) {
    const name = String(error?.name || "").toLowerCase();
    const message = String(error?.message || error || "").toLowerCase();
    return name.includes("quota") || name.includes("security") ||
      message.includes("quota") || message.includes("storage") || message.includes("localstorage");
  }

  function notify(text) {
    const now = Date.now();
    if (now - lastNoticeAt < 1000) return;
    lastNoticeAt = now;
    const container = document.querySelector("#notifications");
    if (!container) return;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification storage-error-notification";
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = "Ошибка сохранения";
    span.textContent = text;
    item.append(strong, span);
    item.addEventListener("click", () => item.remove());
    container.appendChild(item);
  }

  if (originalSaveAttachment) {
    Workflow.saveAttachment = function saveAttachmentWithErrorNotice(file) {
      try {
        return originalSaveAttachment(file);
      } catch (error) {
        notify("Документ не сохранён. Освободите место в хранилище браузера и повторите действие.");
        throw error;
      }
    };
  }

  window.addEventListener("error", (event) => {
    if (!isStorageError(event.error || event.message)) return;
    notify("Изменение не записано в браузер. Не закрывайте страницу, пока не освободите место или не разрешите локальное хранилище.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isStorageError(event.reason)) return;
    notify("Фоновое сохранение не выполнено. Проверьте доступ к хранилищу браузера.");
  });

  root.UntilFridayStorageErrorGuard = {
    isStorageError,
    notify
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
