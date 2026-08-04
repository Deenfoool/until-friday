(function (root) {
  "use strict";

  if (root.UntilFridayPersonalBrowserUIV3) return;

  const Browser = root.UntilFridayPersonalBrowser;
  const Runtime = root.UntilFridayRuntimeEngine;
  if (!Browser || !Runtime) return;

  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const uiIcon = (name, size = 20) => `<img src="${ICON_ROOT}/${size}/${name}.png" alt="">`;
  const ROUTES = {
    home: { title: "Новая вкладка", url: "kontur://newtab" },
    market: { title: "КупиТут", url: "https://kupitut.local/" },
    videotok: { title: "Видеоток", url: "https://videotok.local/" },
    messages: { title: "Сообщения", url: "https://msg.local/" },
    history: { title: "История", url: "kontur://history" },
    downloads: { title: "Загрузки", url: "kontur://downloads" },
    settings: { title: "Настройки", url: "kontur://settings" },
    search: { title: "Поиск", url: "https://search.local/" }
  };
  const DEFAULT_SETTINGS = { homePage: "home", searchEngine: "KONTUR Search", showBookmarksBar: true, compactMode: false, safeSearch: true };
  const DEFAULT_BOOKMARKS = ["market", "videotok", "messages"];
  const DAY_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];

  let tabs = [makeTab("tab-1", "home")];
  let activeTabId = "tab-1";
  let nextTab = 2;
  let menuOpen = false;
  let selectedMessage = null;
  let category = "all";
  let queued = false;
  let lastUrl = "";

  function engine() { return Runtime.getEngine?.() || null; }
  function stateNow() { return engine()?.getState?.() || null; }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function formatTime(value) { const n = Math.max(0, Number(value) || 0); return `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`; }

  function personal(state = stateNow()) {
    const raw = Browser.personalState?.(state) || {};
    const incoming = Array.isArray(raw.bookmarks) ? raw.bookmarks : DEFAULT_BOOKMARKS;
    const bookmarks = incoming.map((item) => item === "video" ? "videotok" : item).filter((item) => ROUTES[item]);
    return {
      ...raw,
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
      bookmarks: [...new Set(bookmarks.length ? bookmarks : DEFAULT_BOOKMARKS)],
      downloads: Array.isArray(raw.downloads) ? raw.downloads : []
    };
  }

  function updatePersonal(updater, reason = "personal-browser-ui") {
    const current = engine();
    if (!current) return { ok: false, reason: "engine-unavailable" };
    const result = current.updateState((draft) => {
      draft.metadata ||= {};
      const value = personal(draft);
      updater(value, draft);
      draft.metadata.personalBrowser = value;
    }, reason);
    if (result?.ok) render();
    return result;
  }

  function route(page, data = {}) {
    const base = ROUTES[page] || ROUTES.home;
    const query = data.query || "";
    return {
      page: ROUTES[page] ? page : "home",
      title: data.title || (page === "search" && query ? `${query} — Поиск` : base.title),
      url: data.url || (page === "search" && query ? `${base.url}?q=${encodeURIComponent(query)}` : base.url),
      query
    };
  }

  function makeTab(id, page, data) { return { id, history: [route(page, data)], index: 0 }; }
  function activeTab() { return tabs.find((tab) => tab.id === activeTabId) || tabs[0]; }
  function entry() { const tab = activeTab(); return tab?.history?.[tab.index] || route("home"); }

  function navigate(page, data = {}, replace = false) {
    const tab = activeTab();
    if (!tab) return;
    const item = route(page, data);
    if (replace) tab.history[tab.index] = item;
    else {
      tab.history = tab.history.slice(0, tab.index + 1);
      tab.history.push(item);
      tab.index = tab.history.length - 1;
    }
    menuOpen = false;
    render();
  }

  function pageFromAddress(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text.includes("kupitut.local") || text.includes("купитут")) return "market";
    if (text.includes("videotok.local") || text.includes("видеоток")) return "videotok";
    if (text.includes("msg.local") || text.includes("сообщ")) return "messages";
    if (text.includes("history") || text.includes("истори")) return "history";
    if (text.includes("download") || text.includes("загруз")) return "downloads";
    if (text.includes("setting") || text.includes("настрой")) return "settings";
    if (text === "kontur://newtab") return "home";
    return null;
  }

  function navigateAddress(value) {
    const text = String(value || "").trim();
    if (!text) return navigate("home");
    const page = pageFromAddress(text);
    if (page) {
      const base = ROUTES[page];
      const url = page === "market" || page === "videotok" || page === "messages" ? text : base.url;
      return navigate(page, { url: url.includes(".") || url.startsWith("kontur://") ? url : base.url });
    }
    return navigate("search", { query: text });
  }

  function newTab(page = "home") { const id = `tab-${nextTab++}`; tabs.push(makeTab(id, page)); activeTabId = id; menuOpen = false; render(); }
  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    if (tabs.length === 1) tabs[0] = makeTab(tabs[0].id, "home");
    else {
      tabs.splice(index, 1);
      if (activeTabId === id) activeTabId = tabs[Math.max(0, index - 1)].id;
    }
    render();
  }
  function goBack() { const tab = activeTab(); if (tab?.index > 0) { tab.index -= 1; render(); } }
  function goForward() { const tab = activeTab(); if (tab && tab.index < tab.history.length - 1) { tab.index += 1; render(); } }

  function appIcon(page) {
    const names = { home: "home", market: "shopping-bag", videotok: "play-button-circled", messages: "chat-message", history: "time-machine", downloads: "download", settings: "settings", search: "search" };
    return uiIcon(names[page] || "internet", 16);
  }

  function chrome(user, current) {
    const tab = activeTab();
    const bookmarked = user.bookmarks.includes(current.page);
    return `<div class="real-browser ${user.settings.compactMode ? "compact" : ""}" data-browser-v3-shell>
      <div class="rb-tabstrip"><div class="rb-tabs">${tabs.map((item) => { const value = item.history[item.index]; return `<button class="rb-tab ${item.id === activeTabId ? "active" : ""}" data-rb-tab="${item.id}"><span>${appIcon(value.page)}</span><b>${esc(value.title)}</b><i data-rb-close-tab="${item.id}">${uiIcon("delete-sign", 13)}</i></button>`; }).join("")}</div><button class="rb-new-tab" data-rb-new-tab>${uiIcon("plus-math", 18)}</button></div>
      <div class="rb-toolbar"><div class="rb-nav"><button data-rb-nav="back" ${tab.index <= 0 ? "disabled" : ""}>${uiIcon("back", 20)}</button><button data-rb-nav="forward" ${tab.index >= tab.history.length - 1 ? "disabled" : ""}>${uiIcon("forward", 20)}</button><button data-rb-nav="reload">${uiIcon("refresh", 20)}</button><button data-rb-nav="home">${uiIcon("home", 20)}</button></div>
      <form class="rb-address" data-rb-address><span>${current.url.startsWith("https://") ? uiIcon("lock", 16) : uiIcon("internet", 16)}</span><input value="${esc(current.url)}" spellcheck="false"><button type="button" data-rb-bookmark ${!["market", "videotok", "messages"].includes(current.page) ? "disabled" : ""} class="${bookmarked ? "active" : ""}">${uiIcon(bookmarked ? "star-filled" : "star", 18)}</button></form>
      <button class="rb-menu-button ${menuOpen ? "active" : ""}" data-rb-menu>${uiIcon("menu-2", 21)}</button>${menuOpen ? browserMenu() : ""}</div>
      ${user.settings.showBookmarksBar && user.bookmarks.length ? `<div class="rb-bookmarks">${user.bookmarks.map((page) => `<button data-rb-page="${page}"><span>${appIcon(page)}</span>${esc(ROUTES[page].title)}</button>`).join("")}</div>` : ""}
      <main class="rb-page"></main></div>`;
  }

  function browserMenu() {
    return `<div class="rb-menu"><button data-rb-menu-action="new">Новая вкладка <kbd>Ctrl+T</kbd></button><button data-rb-menu-action="history">История <kbd>Ctrl+H</kbd></button><button data-rb-menu-action="downloads">Загрузки <kbd>Ctrl+J</kbd></button><hr><button data-rb-menu-action="settings">Настройки</button><button data-rb-menu-action="about">О браузере</button></div>`;
  }

  function homePage(state, user) {
    const recent = Browser.visibleHistory(user).slice(-5).reverse();
    const quick = [
      ["market", "КупиТут", "Покупки"],
      ["videotok", "Видеоток", "Видео и подписки"],
      ["messages", "Сообщения", Browser.unreadMessageCount(state) ? `${Browser.unreadMessageCount(state)} новых` : "Личная переписка"],
      ["history", "История", "Недавние страницы"]
    ];
    return `<section class="rb-newtab"><div class="rb-search-brand"><span>K</span><strong>${esc(user.settings.searchEngine)}</strong></div><form class="rb-main-search" data-rb-search><span>${uiIcon("search", 22)}</span><input placeholder="Введите запрос или адрес"><button>Найти</button></form><div class="rb-quick">${quick.map(([page, label, note]) => `<button data-rb-page="${page}"><span>${appIcon(page)}</span><b>${label}</b><small>${note}</small></button>`).join("")}</div><div class="rb-home-grid"><section><header><h2>Недавние страницы</h2><button data-rb-page="history">Вся история</button></header>${recent.length ? recent.map((item) => `<button class="rb-recent" data-rb-address-value="${esc(item.url || "")}"><span>${appIcon(item.category === "market" ? "market" : item.category === "videotok" ? "videotok" : item.category === "messages" ? "messages" : "home")}</span><div><b>${esc(item.title)}</b><small>${esc(item.site || item.url || "")}</small></div><time>${DAY_SHORT[item.dayIndex] || ""} ${formatTime(item.minute)}</time></button>`).join("") : `<p class="rb-empty">Здесь появятся недавно посещённые страницы.</p>`}</section><section><header><h2>Быстрый доступ</h2></header><div class="rb-suggestions"><button data-rb-page="market"><span>${appIcon("market")}</span><div><small>КупиТут</small><b>Продолжить просмотр каталога</b><em>Маркетплейс</em></div></button><button data-rb-page="videotok"><span class="video">${appIcon("videotok")}</span><div><small>Видеоток</small><b>Рекомендации на сегодня</b><em>72 ролика</em></div></button></div></section></div></section>`;
  }

  function messagesPage(state, user, query = "") {
    const messages = Browser.MESSAGES.filter((item) => item.day <= state.dayIndex && (!query || `${item.contact} ${item.text}`.toLowerCase().includes(query.toLowerCase())));
    if (!selectedMessage || !messages.some((item) => item.id === selectedMessage)) selectedMessage = messages[0]?.id || null;
    const chosen = messages.find((item) => item.id === selectedMessage);
    return `<section class="rb-site"><header class="rb-sitebar"><div class="rb-site-logo messages"><span>С</span><b>Сообщения</b></div><form data-rb-site-search="messages"><input value="${esc(query)}" placeholder="Поиск в сообщениях"></form><button class="rb-account">Профиль</button></header><div class="rb-messages"><aside><button class="compose">Новое сообщение</button><button class="active">Входящие <span>${Browser.unreadMessageCount(state)}</span></button><button>Избранные</button><button>Архив</button></aside><div class="rb-message-list">${messages.map((message) => `<button class="${message.id === selectedMessage ? "active" : ""}" data-rb-message="${message.id}"><i>${esc(message.contact.slice(0, 1))}</i><div><b>${esc(message.contact)}</b><p>${esc(message.text)}</p></div><time>${DAY_SHORT[message.day] || ""}</time></button>`).join("")}</div><main class="rb-conversation">${chosen ? conversation(chosen, user) : `<p class="rb-empty">Выберите сообщение.</p>`}</main></div></section>`;
  }

  function conversation(message, user) {
    const reply = message.replies.find((item) => item.id === user.replies[message.id]);
    return `<header><i>${esc(message.contact.slice(0, 1))}</i><div><b>${esc(message.contact)}</b><small>личный контакт</small></div></header><section><p class="incoming">${esc(message.text)}</p>${reply ? `<p class="outgoing">${esc(reply.text)}</p><p class="incoming">${esc(reply.result)}</p>` : ""}</section>${reply ? `<footer><input value="Сообщение отправлено" disabled><button disabled>Отправить</button></footer>` : `<footer class="choices">${message.replies.map((item) => `<button data-rb-reply="${message.id}" data-reply-id="${item.id}">${esc(item.text)}</button>`).join("")}</footer>`}`;
  }

  function internalPage(active, body) {
    return `<section class="rb-internal"><aside><b>KONTUR Web</b><button data-rb-page="history" class="${active === "history" ? "active" : ""}>История</button><button data-rb-page="downloads" class="${active === "downloads" ? "active" : ""}>Загрузки</button><button data-rb-page="settings" class="${active === "settings" ? "active" : ""}>Настройки</button></aside><main>${body}</main></section>`;
  }

  function historyPage(state, user) {
    const items = Browser.visibleHistory(user).slice().reverse();
    return internalPage("history", `<header><div><h1>История</h1><p>Страницы этого профиля.</p></div><button data-rb-clear-history>Очистить данные</button></header><div class="rb-history">${items.length ? items.map((item) => `<article><time>${DAY_SHORT[item.dayIndex] || ""} ${formatTime(item.minute)}</time><span>${appIcon(item.category === "market" ? "market" : item.category === "videotok" ? "videotok" : "home")}</span><button data-rb-address-value="${esc(item.url || "")}"><b>${esc(item.title)}</b><small>${esc(item.site || item.url || "")}</small></button></article>`).join("") : `<p class="rb-empty">История пуста.</p>`}</div>`);
  }

  function downloadsPage(user) {
    return internalPage("downloads", `<header><div><h1>Загрузки</h1><p>Файлы, сохранённые через браузер.</p></div></header>${user.downloads.length ? user.downloads.map((item) => `<article class="rb-download"><span>${uiIcon("download", 22)}</span><div><b>${esc(item.name)}</b><small>${esc(item.source || "KONTUR Web")}</small></div><button>Показать в папке</button></article>`).join("") : `<div class="rb-empty large"><h2>Загрузок пока нет</h2><p>Скачанные файлы появятся здесь.</p></div>`}`);
  }

  function settingsPage(user) {
    const settings = user.settings;
    const toggle = (key, title, note) => `<label><div><b>${title}</b><small>${note}</small></div><input type="checkbox" data-rb-setting="${key}" ${settings[key] ? "checked" : ""}></label>`;
    return internalPage("settings", `<header><div><h1>Настройки</h1><p>Параметры профиля браузера.</p></div></header><section class="rb-settings"><h2>При запуске</h2><label><div><b>Домашняя страница</b><small>Открывается по кнопке «Домой».</small></div><select data-rb-setting="homePage"><option value="home" ${settings.homePage === "home" ? "selected" : ""}>Новая вкладка</option><option value="market" ${settings.homePage === "market" ? "selected" : ""}>КупиТут</option><option value="videotok" ${settings.homePage === "videotok" ? "selected" : ""}>Видеоток</option></select></label></section><section class="rb-settings"><h2>Внешний вид</h2>${toggle("showBookmarksBar", "Показывать панель закладок", "Сохранённые сайты под адресной строкой.")}${toggle("compactMode", "Компактный интерфейс", "Уменьшить высоту панелей.")}</section><section class="rb-settings"><h2>Безопасность</h2>${toggle("safeSearch", "Безопасный поиск", "Скрывать нежелательные материалы.")}</section>`);
  }

  function searchPage(state, user, query) {
    const needle = query.toLowerCase();
    const products = Browser.PRODUCTS.filter((item) => `${item.title} ${item.note}`.toLowerCase().includes(needle)).slice(0, 8);
    const videos = root.UntilFridayVideotok?.VIDEOS?.filter((item) => `${item.title} ${item.channelName}`.toLowerCase().includes(needle)).slice(0, 12) || [];
    const messages = Browser.MESSAGES.filter((item) => `${item.contact} ${item.text}`.toLowerCase().includes(needle)).slice(0, 6);
    const count = products.length + videos.length + messages.length;
    return `<section class="rb-search-results"><header><div><span>K</span><b>${esc(user.settings.searchEngine)}</b></div><form data-rb-search><input value="${esc(query)}"><button>Найти</button></form></header><main><p>Найдено результатов: ${count}</p>${products.map((item) => result("kupitut.local", item.title, item.note, "market")).join("")}${videos.map((item) => result("videotok.local", item.title, `${item.channelName} · ${item.duration}`, "videotok", `${root.UntilFridayVideotok.ROUTES.watch}${item.id}`)).join("")}${messages.map((item) => result("msg.local", item.contact, item.text, "messages")).join("")}${count ? "" : `<div class="rb-empty large"><h2>Ничего не найдено</h2></div>`}</main></section>`;
  }

  function result(site, title, text, page, url = "") {
    return `<article><small>${site}</small><button ${url ? `data-rb-address-value="${esc(url)}"` : `data-rb-page="${page}"`}><h2>${esc(title)}</h2></button><p>${esc(text)}</p></article>`;
  }

  function renderPage(page, state, user, current) {
    if (current.page === "market") {
      page.innerHTML = `<div class="rb-empty">Загрузка каталога…</div>`;
      root.UntilFridayMarketplaceParody?.renderMarketplace?.();
      return;
    }
    if (current.page === "videotok") {
      const api = root.UntilFridayVideotok;
      if (!api) { page.innerHTML = `<div class="rb-empty"><h2>Видеоток не загружен</h2></div>`; return; }
      api.render(page, {
        url: current.url,
        personal: user,
        selectedCategory: category,
        navigate(url, title) { navigate("videotok", { url, title }); },
        setCategory(value) { category = value; render(); },
        updatePersonal
      });
      return;
    }
    if (current.page === "messages") page.innerHTML = messagesPage(state, user, current.query);
    else if (current.page === "history") page.innerHTML = historyPage(state, user);
    else if (current.page === "downloads") page.innerHTML = downloadsPage(user);
    else if (current.page === "settings") page.innerHTML = settingsPage(user);
    else if (current.page === "search") page.innerHTML = searchPage(state, user, current.query);
    else page.innerHTML = homePage(state, user);
    bindPage(page, state, user);
  }

  function render() {
    queued = false;
    const win = document.querySelector(".personal-browser-window");
    const state = stateNow();
    if (!win || !state) return false;
    const oldPage = win.querySelector(".rb-page");
    const oldScroll = oldPage ? { top: oldPage.scrollTop, left: oldPage.scrollLeft } : { top: 0, left: 0 };
    const user = personal(state);
    const current = entry();
    win.dataset.browserV3 = "true";
    delete win.dataset.browserV2;
    win.querySelector(".window-title").textContent = `${current.title} — KONTUR Web`;
    win.querySelector(".window-status").textContent = current.url.startsWith("https://") ? "Защищённое соединение" : "Готово";
    win.querySelector(".window-content").innerHTML = chrome(user, current);
    bindChrome(win.querySelector(".window-content"), user);
    const page = win.querySelector(".rb-page");
    renderPage(page, state, user, current);
    if (current.url === lastUrl) { page.scrollTop = oldScroll.top; page.scrollLeft = oldScroll.left; }
    else page.scrollTop = 0;
    lastUrl = current.url;
    return true;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(render);
    else root.setTimeout?.(render, 0);
  }

  function bindChrome(content, user) {
    content.querySelectorAll("[data-rb-tab]").forEach((button) => button.addEventListener("click", (event) => { if (event.target.closest("[data-rb-close-tab]")) return; activeTabId = button.dataset.rbTab; menuOpen = false; render(); }));
    content.querySelectorAll("[data-rb-close-tab]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); closeTab(button.dataset.rbCloseTab); }));
    content.querySelector("[data-rb-new-tab]")?.addEventListener("click", () => newTab());
    content.querySelectorAll("[data-rb-nav]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.rbNav; if (action === "back") goBack(); if (action === "forward") goForward(); if (action === "reload") render(); if (action === "home") navigate(user.settings.homePage || "home"); }));
    content.querySelector("[data-rb-address]")?.addEventListener("submit", (event) => { event.preventDefault(); navigateAddress(event.currentTarget.querySelector("input").value); });
    content.querySelector("[data-rb-address] input")?.addEventListener("focus", (event) => event.currentTarget.select());
    content.querySelector("[data-rb-bookmark]")?.addEventListener("click", toggleBookmark);
    content.querySelector("[data-rb-menu]")?.addEventListener("click", () => { menuOpen = !menuOpen; render(); });
    content.querySelectorAll("[data-rb-menu-action]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.rbMenuAction; if (action === "new") newTab(); if (action === "history") navigate("history"); if (action === "downloads") navigate("downloads"); if (action === "settings" || action === "about") navigate("settings"); }));
    bindPage(content, stateNow(), user);
  }

  function bindPage(container, state, user) {
    container.querySelectorAll("[data-rb-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.rbPage)));
    container.querySelectorAll("[data-rb-address-value]").forEach((button) => button.addEventListener("click", () => navigateAddress(button.dataset.rbAddressValue)));
    container.querySelectorAll("[data-rb-search]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); const query = event.currentTarget.querySelector("input").value.trim(); if (query) navigate("search", { query }); }));
    container.querySelectorAll("[data-rb-site-search]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); navigate(form.dataset.rbSiteSearch, { query: event.currentTarget.querySelector("input").value.trim() }); }));
    container.querySelectorAll("[data-rb-message]").forEach((button) => button.addEventListener("click", () => { selectedMessage = button.dataset.rbMessage; render(); }));
    container.querySelectorAll("[data-rb-reply]").forEach((button) => button.addEventListener("click", () => replyAction(button.dataset.rbReply, button.dataset.replyId)));
    container.querySelectorAll("[data-rb-setting]").forEach((control) => control.addEventListener("change", () => settingAction(control)));
    container.querySelectorAll("[data-rb-clear-history]").forEach((button) => button.addEventListener("click", clearHistory));
  }

  function toggleBookmark() {
    const current = entry();
    if (!["market", "videotok", "messages"].includes(current.page)) return;
    updatePersonal((value) => { value.bookmarks = value.bookmarks.includes(current.page) ? value.bookmarks.filter((page) => page !== current.page) : [...value.bookmarks, current.page]; }, "personal-browser-bookmark");
  }

  function replyAction(messageId, replyId) {
    const message = Browser.MESSAGES.find((item) => item.id === messageId);
    const reply = message?.replies.find((item) => item.id === replyId);
    if (!message || !reply) return;
    Browser.performActivity({ id: `message-${messageId}-${replyId}`, minutes: 3, label: `Ответ отправлен: ${message.contact}`, category: "messages", site: "Сообщения", url: `${ROUTES.messages.url}chat/${messageId}`, apply(value) { value.replies[messageId] = replyId; } });
  }

  function settingAction(control) {
    const key = control.dataset.rbSetting;
    const value = control.type === "checkbox" ? control.checked : control.value;
    updatePersonal((personal) => { personal.settings[key] = value; }, "personal-browser-setting");
  }

  function clearHistory() {
    const state = stateNow();
    if (!state) return;
    Browser.performActivity({ id: `history-clear-${state.dayIndex}`, minutes: 5, label: "Очищена история браузера", category: "history", site: "KONTUR Web", url: ROUTES.history.url, apply(value, draft) { value.clearedBefore = { dayIndex: draft.dayIndex, minute: draft.minute }; draft.stats ||= {}; draft.stats.suspicion = Number(draft.stats.suspicion || 0) + 1; } });
  }

  root.addEventListener?.("until-friday-app-ready", schedule);
  root.addEventListener?.("until-friday-state-change", schedule);
  root.addEventListener?.("until-friday-ui-render", (event) => { if (event.detail?.appId === "browser") schedule(); });
  root.addEventListener?.("keydown", (event) => {
    const win = document.querySelector(".personal-browser-window");
    if (!win || win.classList.contains("minimized")) return;
    if (event.ctrlKey && event.key.toLowerCase() === "t") { event.preventDefault(); newTab(); }
    if (event.ctrlKey && event.key.toLowerCase() === "w") { event.preventDefault(); closeTab(activeTabId); }
    if (event.ctrlKey && event.key.toLowerCase() === "l") { event.preventDefault(); win.querySelector(".rb-address input")?.focus(); }
    if (event.ctrlKey && event.key.toLowerCase() === "h") { event.preventDefault(); navigate("history"); }
    if (event.ctrlKey && event.key.toLowerCase() === "j") { event.preventDefault(); navigate("downloads"); }
  });
  document.addEventListener("DOMContentLoaded", schedule, { once: true });

  root.UntilFridayPersonalBrowserUIV3 = {
    ROUTES,
    DEFAULT_SETTINGS,
    navigate,
    navigateAddress,
    pageFromAddress,
    newTab,
    closeTab,
    render,
    schedule
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
