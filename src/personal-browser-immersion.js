(function (root) {
  "use strict";

  if (root.UntilFridayPersonalBrowserImmersion) return;

  const Runtime = root.UntilFridayRuntimeEngine;
  const ORIGINAL_NOTIFY = Runtime?.notify?.bind(Runtime) || null;
  let patchQueued = false;

  function stripGameTiming(text) {
    return String(text || "")
      .replace(/\s*·\s*\d+\s*мин\.?/gi, "")
      .replace(/Просмотр займёт\s+\d+\s+игровых минут\.?/gi, "")
      .replace(/личное время сегодня:\s*\d+\s*мин\.?/gi, "")
      .replace(/\s+·\s+·/g, " · ")
      .trim();
  }

  function replaceText(element, from, to) {
    if (!element || !element.textContent.includes(from)) return;
    element.textContent = element.textContent.replace(from, to);
  }

  function patchWindowChrome(windowElement) {
    const title = windowElement.querySelector(".window-title");
    if (title) title.textContent = "KONTUR Web";

    const status = windowElement.querySelector(".window-status");
    if (status) status.textContent = "OFFICE-LAN · подключение установлено";
  }

  function patchHome(page) {
    page.querySelector(".browser-time-card")?.remove();

    const heroTitle = page.querySelector(".browser-home-hero h1");
    if (heroTitle) heroTitle.textContent = "KONTUR Web";

    const heroText = page.querySelector(".browser-home-hero p");
    if (heroText) heroText.textContent = "Быстрый доступ к часто посещаемым страницам.";

    const recommendations = page.querySelector(".browser-recommendations h2");
    if (recommendations) recommendations.textContent = "Рекомендации";
  }

  function patchPageCopy(page) {
    page.querySelectorAll("button").forEach((button) => {
      const clean = stripGameTiming(button.textContent);
      if (clean && clean !== button.textContent.trim()) button.textContent = clean;
    });

    page.querySelectorAll(".browser-video-card p").forEach((paragraph) => {
      if (/игровых минут/i.test(paragraph.textContent)) paragraph.remove();
    });

    const historyPage = Boolean(page.querySelector(".browser-history-list"));
    page.querySelectorAll(".browser-network-warning").forEach((notice) => {
      notice.textContent = historyPage
        ? "Локальная история хранится в профиле этого браузера."
        : "Соединение проходит через корпоративный шлюз OFFICE-LAN.";
    });

    page.querySelectorAll("h1").forEach((heading) => {
      replaceText(heading, "Не рабочая переписка", "Сообщения");
    });
  }

  function patchBrowser() {
    patchQueued = false;
    const windowElement = document.querySelector(".personal-browser-window");
    if (!windowElement) return;

    patchWindowChrome(windowElement);
    const page = windowElement.querySelector(".personal-browser-page");
    if (!page) return;

    patchHome(page);
    patchPageCopy(page);
    windowElement.dataset.browserImmersive = "true";
  }

  function queuePatch() {
    if (patchQueued) return;
    patchQueued = true;
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(patchBrowser);
    else root.setTimeout?.(patchBrowser, 0);
  }

  if (Runtime && ORIGINAL_NOTIFY && !Runtime.__personalBrowserImmersiveNotify) {
    Runtime.__personalBrowserImmersiveNotify = true;
    Runtime.notify = function immersiveNotify(title, text) {
      if (title === "Личное время") return;
      return ORIGINAL_NOTIFY(title, stripGameTiming(text));
    };
  }

  root.addEventListener?.("until-friday-app-ready", queuePatch);
  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "browser") queuePatch();
  });
  root.addEventListener?.("until-friday-state-change", queuePatch);

  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".personal-browser-window, [data-personal-browser-launcher]")) {
      root.setTimeout?.(queuePatch, 0);
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target.closest?.(".personal-browser-window")) root.setTimeout?.(queuePatch, 0);
  }, true);

  document.addEventListener("DOMContentLoaded", queuePatch, { once: true });

  root.UntilFridayPersonalBrowserImmersion = {
    stripGameTiming,
    patchBrowser,
    queuePatch
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
