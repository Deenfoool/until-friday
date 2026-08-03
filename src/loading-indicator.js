(function (root) {
  "use strict";

  const SEGMENT_COUNT = 12;
  const MIN_SCREEN_TIME = 360;
  let screen = null;
  let screenShownAt = 0;

  function createSpinner(options = {}) {
    const size = Math.max(12, Number(options.size) || 24);
    const spinner = document.createElement("span");
    spinner.className = `programmatic-spinner${options.compact ? " compact" : ""}`;
    spinner.style.setProperty("--spinner-size", `${size}px`);
    spinner.setAttribute("role", "progressbar");
    spinner.setAttribute("aria-label", options.label || "Загрузка");

    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const segment = document.createElement("span");
      segment.className = "programmatic-spinner__segment";
      segment.style.setProperty("--segment-index", String(index));
      spinner.appendChild(segment);
    }

    return spinner;
  }

  function createLoadingRow(label, options = {}) {
    const row = document.createElement("span");
    row.className = `programmatic-loading-row${options.compact ? " compact" : ""}`;
    row.appendChild(createSpinner({ size: options.size || 20, compact: options.compact, label }));

    if (label) {
      const text = document.createElement("span");
      text.className = "programmatic-loading-row__label";
      text.textContent = label;
      row.appendChild(text);
    }

    return row;
  }

  function showScreen(label = "Загрузка корпоративной системы...") {
    if (screen?.isConnected) {
      const currentLabel = screen.querySelector(".system-loading-overlay__label");
      if (currentLabel) currentLabel.textContent = label;
      return screen;
    }

    screen = document.createElement("section");
    screen.className = "system-loading-overlay";
    screen.setAttribute("aria-live", "polite");
    screen.setAttribute("aria-busy", "true");

    const panel = document.createElement("div");
    panel.className = "system-loading-overlay__panel";
    panel.appendChild(createSpinner({ size: 34, label }));

    const text = document.createElement("span");
    text.className = "system-loading-overlay__label";
    text.textContent = label;
    panel.appendChild(text);
    screen.appendChild(panel);

    document.body.appendChild(screen);
    screenShownAt = performance.now();
    return screen;
  }

  function hideScreen() {
    if (!screen?.isConnected) return;
    const elapsed = performance.now() - screenShownAt;
    const delay = Math.max(0, MIN_SCREEN_TIME - elapsed);
    const current = screen;

    window.setTimeout(() => {
      if (!current.isConnected) return;
      current.classList.add("closing");
      current.setAttribute("aria-busy", "false");
      window.setTimeout(() => current.remove(), 160);
      if (screen === current) screen = null;
    }, delay);
  }

  function pulseButton(button, label = "Обновление", duration = 520) {
    if (!button || button.dataset.programmaticLoading === "true") return;
    const wasDisabled = button.disabled;
    button.dataset.programmaticLoading = "true";
    button.classList.add("programmatic-button-loading");
    button.setAttribute("aria-busy", "true");
    button.disabled = true;

    const spinner = createSpinner({ size: 14, compact: true, label });
    spinner.classList.add("programmatic-button-loading__spinner");
    button.appendChild(spinner);

    window.setTimeout(() => {
      spinner.remove();
      button.classList.remove("programmatic-button-loading");
      button.removeAttribute("aria-busy");
      delete button.dataset.programmaticLoading;
      button.disabled = wasDisabled;
    }, Math.max(180, Number(duration) || 520));
  }

  function pulseWindow(appWindow, label = "Обновление данных...", duration = 520) {
    if (!appWindow?.isConnected) return;
    const status = appWindow.querySelector(".window-status");
    if (!status || status.dataset.programmaticLoading === "true") return;

    const previousText = status.textContent;
    status.dataset.programmaticLoading = "true";
    status.setAttribute("aria-busy", "true");
    status.replaceChildren(createLoadingRow(label, { compact: true, size: 14 }));

    window.setTimeout(() => {
      if (!status.isConnected || status.dataset.programmaticLoading !== "true") return;
      delete status.dataset.programmaticLoading;
      status.removeAttribute("aria-busy");
      status.textContent = previousText;
    }, Math.max(220, Number(duration) || 520));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-mail-refresh], [data-task-refresh], [data-explorer-refresh]"
    );
    if (!button) return;

    const appWindow = button.closest(".app-window");
    pulseButton(button);
    window.setTimeout(() => pulseWindow(appWindow), 0);
  }, true);

  root.UntilFridayLoading = {
    SEGMENT_COUNT,
    createSpinner,
    createLoadingRow,
    showScreen,
    hideScreen,
    pulseButton,
    pulseWindow
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
