(function (root) {
  "use strict";

  if (root.UntilFridayPersonalBrowser) return;

  const APP_ID = "browser";
  const APP_TITLE = "Браузер";
  const DAILY_WARNING_MINUTES = 45;

  let browserWindow = null;
  let taskButton = null;
  let topZ = 1800;

  function runtime() { return root.UntilFridayRuntimeEngine || null; }
  function engine() { return runtime()?.getEngine?.() || null; }
  function stateNow() { return engine()?.getState?.() || null; }
  function uniqueStrings(value) { return [...new Set((Array.isArray(value) ? value : []).filter((item) => typeof item === "string" && item))]; }

  function createDefaultPersonalState() {
    return {
      version: 3,
      balance: 8420,
      favorites: [],
      cart: [],
      purchases: [],
      compared: [],
      completed: [],
      history: [],
      dailyMinutes: {},
      excessiveDays: [],
      clearedBefore: null,
      bookmarks: ["market", "videotok", "min"],
      settings: {},
      downloads: [],
      videotok: {}
    };
  }

  function normalizePersonalState(value) {
    const base = createDefaultPersonalState();
    const source = value && typeof value === "object" ? value : {};
    return {
      ...base,
      ...source,
      version: 3,
      balance: Number.isFinite(Number(source.balance)) ? Math.max(0, Number(source.balance)) : base.balance,
      favorites: uniqueStrings(source.favorites),
      cart: uniqueStrings(source.cart),
      purchases: uniqueStrings(source.purchases),
      compared: uniqueStrings(source.compared),
      completed: uniqueStrings(source.completed),
      bookmarks: uniqueStrings(source.bookmarks)
        .map((item) => item === "video" ? "videotok" : item === "messages" ? "min" : item)
        .filter((item) => ["market", "videotok", "min"].includes(item)),
      excessiveDays: uniqueStrings((source.excessiveDays || []).map(String)).map(Number),
      dailyMinutes: source.dailyMinutes && typeof source.dailyMinutes === "object" ? { ...source.dailyMinutes } : {},
      history: Array.isArray(source.history) ? source.history.filter((item) => item && typeof item === "object").slice(-300) : [],
      downloads: Array.isArray(source.downloads) ? source.downloads.slice(-100) : [],
      settings: source.settings && typeof source.settings === "object" ? { ...source.settings } : {},
      videotok: source.videotok && typeof source.videotok === "object" ? { ...source.videotok } : {},
      clearedBefore: source.clearedBefore && typeof source.clearedBefore === "object" ? { ...source.clearedBefore } : null
    };
  }

  function personalState(state = stateNow()) { return normalizePersonalState(state?.metadata?.personalBrowser); }
  function notify(title, text) { runtime()?.notify?.(title, text); }
  function rollback(before) { const current = engine(); if (!current || !before) return; current.replaceState?.(before, "personal-browser-rollback"); runtime()?.persist?.(before); }

  function performActivity(options) {
    const current = engine();
    const before = current?.getState?.();
    if (!current || !before) return { ok: false, reason: "engine-unavailable" };
    if (before.ended) return { ok: false, reason: "game-ended" };
    if (!before.dayStarted) { notify("Браузер", "Сначала нужно открыть рабочий сеанс."); return { ok: false, reason: "day-not-started" }; }

    const minutes = Math.max(0, Number(options.minutes) || 0);
    const existing = personalState(before);
    if (options.once !== false && existing.completed.includes(options.id)) return { ok: false, reason: "already-completed" };

    const timeResult = current.advanceTime(minutes);
    if (!timeResult?.ok || Number(timeResult.advancedMinutes) < minutes) {
      if (timeResult?.ok) rollback(before);
      return { ok: false, reason: "not-enough-time", state: before };
    }

    const update = current.updateState((draft) => {
      draft.metadata ||= {};
      const personal = normalizePersonalState(draft.metadata.personalBrowser);
      const dayKey = String(draft.dayIndex);
      if (options.once !== false) personal.completed.push(options.id);
      personal.dailyMinutes[dayKey] = Number(personal.dailyMinutes[dayKey] || 0) + minutes;
      personal.history.push({
        id: `${options.id}:${draft.dayIndex}:${draft.minute}`,
        actionId: options.id,
        dayIndex: draft.dayIndex,
        minute: draft.minute,
        category: options.category || "personal",
        title: options.label || options.id,
        site: options.site || "KONTUR Web",
        url: options.url || ""
      });
      if (typeof options.apply === "function") options.apply(personal, draft);
      if (Number(personal.dailyMinutes[dayKey]) >= DAILY_WARNING_MINUTES && !personal.excessiveDays.includes(draft.dayIndex)) {
        personal.excessiveDays.push(draft.dayIndex);
        draft.stats ||= {};
        draft.stats.suspicion = Number(draft.stats.suspicion || 0) + 1;
        draft.flags ||= {};
        draft.flags.personalBrowsingExcessive = true;
      }
      draft.metadata.personalBrowser = normalizePersonalState(personal);
    }, "personal-browser-activity");

    if (!update?.ok) { rollback(before); return { ...update, rolledBack: true, state: before }; }
    (timeResult.events || []).forEach((event) => notify(event.source || event.title || "Система", event.text || event.title || "Новое событие"));
    updateLaunchers();
    return { ok: true, persisted: true, minutes, events: timeResult.events || [], state: update.state };
  }

  function visibleHistory(personal) {
    const value = normalizePersonalState(personal);
    const cleared = value.clearedBefore;
    if (!cleared) return value.history;
    return value.history.filter((item) => Number(item.dayIndex) > Number(cleared.dayIndex) || (Number(item.dayIndex) === Number(cleared.dayIndex) && Number(item.minute) > Number(cleared.minute)));
  }

  function unreadMessageCount() {
    return Number(root.UntilFridayMinMessenger?.unreadCount?.() || 0);
  }

  function updateLaunchers() {
    const count = unreadMessageCount();
    document.querySelectorAll("[data-browser-badge]").forEach((badge) => {
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.setAttribute("aria-label", `Непрочитанных сообщений МИН: ${count}`);
    });
  }

  function installLaunchers() {
    const desktopIcons = document.querySelector("#desktop-icons");
    const startApps = document.querySelector("#start-apps");
    if (!desktopIcons || !startApps) return;
    if (!desktopIcons.querySelector("[data-personal-browser-launcher]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "desktop-icon personal-browser-launcher";
      button.dataset.app = APP_ID;
      button.dataset.personalBrowserLauncher = "true";
      button.innerHTML = `<span class="desktop-icon__glyph personal-browser-glyph" aria-hidden="true">◎</span><span class="desktop-icon__label">${APP_TITLE}</span><span class="personal-browser-badge" data-browser-badge hidden></span>`;
      button.addEventListener("dblclick", openBrowser);
      button.addEventListener("click", (event) => { document.querySelectorAll(".desktop-icon").forEach((item) => item.classList.remove("selected")); button.classList.add("selected"); if (event.pointerType === "touch") openBrowser(); });
      button.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openBrowser(); } });
      desktopIcons.appendChild(button);
    }
    if (!startApps.querySelector("[data-personal-browser-launcher]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "start-app personal-browser-start";
      button.dataset.app = APP_ID;
      button.dataset.personalBrowserLauncher = "true";
      button.innerHTML = `<span class="desktop-icon__glyph personal-browser-glyph" aria-hidden="true">◎</span><span>${APP_TITLE}</span><span class="personal-browser-badge" data-browser-badge hidden></span>`;
      button.addEventListener("click", () => { document.querySelector("#start-menu")?.classList.add("hidden"); document.querySelector("#start-button")?.classList.remove("active"); openBrowser(); });
      startApps.appendChild(button);
    }
    updateLaunchers();
  }

  function focusBrowser() {
    if (!browserWindow?.isConnected) return;
    document.querySelectorAll(".app-window").forEach((element) => element.classList.remove("focused"));
    document.querySelectorAll(".task-button").forEach((button) => button.classList.remove("active"));
    browserWindow.classList.remove("minimized");
    browserWindow.classList.add("focused");
    browserWindow.style.zIndex = String(++topZ);
    taskButton?.classList.add("active");
  }

  function closeBrowser() { browserWindow?.remove(); taskButton?.remove(); browserWindow = null; taskButton = null; }

  function createTaskButton() {
    const taskbar = document.querySelector("#task-buttons");
    if (!taskbar || taskButton?.isConnected) return;
    taskButton = document.createElement("button");
    taskButton.type = "button";
    taskButton.className = "task-button personal-browser-task active";
    taskButton.textContent = APP_TITLE;
    taskButton.addEventListener("click", () => { if (!browserWindow?.isConnected) return; const minimized = browserWindow.classList.toggle("minimized"); taskButton.classList.toggle("active", !minimized); if (!minimized) focusBrowser(); });
    taskbar.appendChild(taskButton);
  }

  function openBrowser() {
    if (browserWindow?.isConnected) { focusBrowser(); root.UntilFridayPersonalBrowserUIV4?.render?.(); return; }
    const template = document.querySelector("#window-template");
    const layer = document.querySelector("#windows-layer");
    if (!template || !layer) return;
    browserWindow = template.content.firstElementChild.cloneNode(true);
    browserWindow.dataset.windowId = APP_ID;
    browserWindow.classList.add("personal-browser-window", "desktop-app-window");
    browserWindow.style.left = "36px";
    browserWindow.style.top = "24px";
    browserWindow.style.width = "900px";
    browserWindow.style.height = "600px";
    browserWindow.querySelector(".window-title").textContent = "KONTUR Web";
    browserWindow.querySelector(".window-status").textContent = "OFFICE-LAN";
    browserWindow.querySelector(".window-content").innerHTML = `<div class="browser-core-loading">Запуск браузера…</div>`;
    browserWindow.addEventListener("pointerdown", focusBrowser);
    browserWindow.addEventListener("click", (event) => {
      const action = event.target.closest("[data-window-action]")?.dataset.windowAction;
      if (action === "close") closeBrowser();
      if (action === "minimize") { browserWindow.classList.add("minimized"); taskButton?.classList.remove("active"); }
    });
    layer.appendChild(browserWindow);
    createTaskButton();
    focusBrowser();
    root.dispatchEvent(new CustomEvent("until-friday-ui-render", { detail: { appId: APP_ID, element: browserWindow } }));
    root.UntilFridayWindowLayout?.enhance?.(browserWindow, APP_ID);
    root.UntilFridayWindowLayout?.maximize?.(browserWindow);
  }

  root.addEventListener?.("until-friday-app-ready", () => { installLaunchers(); updateLaunchers(); });
  root.addEventListener?.("until-friday-state-change", updateLaunchers);
  root.addEventListener?.("until-friday-min-state-change", updateLaunchers);
  document.addEventListener("DOMContentLoaded", () => { if (root.__UNTIL_FRIDAY_V2_READY__) installLaunchers(); }, { once: true });

  root.UntilFridayPersonalBrowser = {
    APP_ID,
    DAILY_WARNING_MINUTES,
    PRODUCTS: [],
    createDefaultPersonalState,
    normalizePersonalState,
    personalState,
    visibleHistory,
    unreadMessageCount,
    performActivity,
    installLaunchers,
    updateLaunchers,
    openBrowser,
    closeBrowser
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
