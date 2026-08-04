(function (root) {
  "use strict";
  if (root.UntilFridayPersonalBrowserUIV2) return;

  const Browser = root.UntilFridayPersonalBrowser;
  const Runtime = root.UntilFridayRuntimeEngine;
  if (!Browser || !Runtime) return;

  const ROUTES = {
    home: { title: "Новая вкладка", url: "kontur://newtab" },
    market: { title: "КупиТут", url: "https://kupitut.local/" },
    video: { title: "ВидеоЛента", url: "https://video.local/" },
    messages: { title: "Сообщения", url: "https://msg.local/" },
    history: { title: "История", url: "kontur://history" },
    downloads: { title: "Загрузки", url: "kontur://downloads" },
    settings: { title: "Настройки", url: "kontur://settings" },
    search: { title: "Поиск", url: "https://search.local/" }
  };
  const DEFAULT_SETTINGS = { homePage: "home", searchEngine: "KONTUR Search", showBookmarksBar: true, compactMode: false, safeSearch: true };
  const DEFAULT_BOOKMARKS = ["market", "video", "messages"];
  const DAY_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];

  let nextTab = 2;
  let activeTabId = "tab-1";
  let tabs = [makeTab("tab-1", "home")];
  let menuOpen = false;
  let selectedMessage = null;
  let patchScheduled = false;

  function engine() { return Runtime.getEngine?.() || null; }
  function stateNow() { return engine()?.getState?.() || null; }
  function personal(state = stateNow()) {
    const raw = Browser.personalState?.(state) || {};
    return {
      ...raw,
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
      bookmarks: [...new Set(Array.isArray(raw.bookmarks) ? raw.bookmarks : DEFAULT_BOOKMARKS)].filter((page) => ROUTES[page]),
      downloads: Array.isArray(raw.downloads) ? raw.downloads : []
    };
  }
  function updatePersonal(updater, reason = "personal-browser-ui") {
    const current = engine();
    if (!current) return { ok: false, reason: "engine-unavailable" };
    return current.updateState((draft) => {
      draft.metadata ||= {};
      const value = personal(draft);
      updater(value, draft);
      draft.metadata.personalBrowser = value;
    }, reason);
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
  function makeTab(id, page, data) { const item = route(page, data); return { id, history: [item], index: 0 }; }
  function activeTab() { return tabs.find((tab) => tab.id === activeTabId) || tabs[0]; }
  function entry() { const tab = activeTab(); return tab?.history?.[tab.index] || route("home"); }
  function navigate(page, data = {}, replace = false) {
    const tab = activeTab(); if (!tab) return;
    const item = route(page, data);
    if (replace) tab.history[tab.index] = item;
    else { tab.history = tab.history.slice(0, tab.index + 1); tab.history.push(item); tab.index = tab.history.length - 1; }
    menuOpen = false; render();
  }
  function navigateAddress(value) {
    const text = String(value || "").trim(); if (!text) return navigate("home");
    const lower = text.toLowerCase();
    if (lower.includes("kupitut")) return navigate("market");
    if (lower.includes("video")) return navigate("video");
    if (lower.includes("msg") || lower.includes("сообщ")) return navigate("messages");
    if (lower.includes("history") || lower.includes("истори")) return navigate("history");
    if (lower.includes("download") || lower.includes("загруз")) return navigate("downloads");
    if (lower.includes("setting") || lower.includes("настрой")) return navigate("settings");
    if (lower === "kontur://newtab") return navigate("home");
    return navigate("search", { query: text });
  }
  function newTab(page = "home") { const id = `tab-${nextTab++}`; tabs.push(makeTab(id, page)); activeTabId = id; menuOpen = false; render(); }
  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id); if (index < 0) return;
    if (tabs.length === 1) tabs[0] = makeTab(tabs[0].id, "home");
    else { tabs.splice(index, 1); if (activeTabId === id) activeTabId = tabs[Math.max(0, index - 1)].id; }
    render();
  }
  function goBack() { const tab = activeTab(); if (tab?.index > 0) { tab.index--; render(); } }
  function goForward() { const tab = activeTab(); if (tab && tab.index < tab.history.length - 1) { tab.index++; render(); } }
  function formatTime(value) { const n = Math.max(0, Number(value) || 0); return `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`; }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function money(value) { return `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} ₽`; }
  function icon(page) { return { home: "K", market: "К", video: "▶", messages: "С", history: "◷", downloads: "⇩", settings: "⚙", search: "⌕" }[page] || "◎"; }
  function productIcon(id) { return { headphones: "◖◗", chair: "▥", toolkit: "▣", coffee: "♨", gift: "✦", backpack: "▰" }[id] || "□"; }
  function matches(item, query) { return !query || Object.values(item || {}).flat().join(" ").toLowerCase().includes(query.toLowerCase()); }
  function availableProducts(state) { return Browser.PRODUCTS.filter((item) => item.day <= state.dayIndex); }
  function availableVideos(state) { return Browser.VIDEOS.filter((item) => item.day <= state.dayIndex); }
  function availableMessages(state) { return Browser.MESSAGES.filter((item) => item.day <= state.dayIndex); }

  function chrome(state, user, current) {
    const tab = activeTab();
    const bookmarked = user.bookmarks.includes(current.page);
    return `<div class="real-browser ${user.settings.compactMode ? "compact" : ""}">
      <div class="rb-tabstrip"><div class="rb-tabs">${tabs.map((item) => { const e = item.history[item.index]; return `<button class="rb-tab ${item.id === activeTabId ? "active" : ""}" data-rb-tab="${item.id}"><span>${icon(e.page)}</span><b>${esc(e.title)}</b><i data-rb-close-tab="${item.id}">×</i></button>`; }).join("")}</div><button class="rb-new-tab" data-rb-new-tab>+</button></div>
      <div class="rb-toolbar"><div class="rb-nav"><button data-rb-nav="back" ${tab.index <= 0 ? "disabled" : ""}>←</button><button data-rb-nav="forward" ${tab.index >= tab.history.length - 1 ? "disabled" : ""}>→</button><button data-rb-nav="reload">↻</button><button data-rb-nav="home">⌂</button></div>
      <form class="rb-address" data-rb-address><span>${current.url.startsWith("https://") ? "▣" : "◎"}</span><input value="${esc(current.url)}" spellcheck="false" /><button type="button" data-rb-bookmark ${!["market", "video", "messages"].includes(current.page) ? "disabled" : ""} class="${bookmarked ? "active" : ""}">☆</button></form>
      <button class="rb-menu-button ${menuOpen ? "active" : ""}" data-rb-menu>⋮</button>${menuOpen ? browserMenu() : ""}</div>
      ${user.settings.showBookmarksBar && user.bookmarks.length ? `<div class="rb-bookmarks">${user.bookmarks.map((page) => `<button data-rb-page="${page}"><span>${icon(page)}</span>${esc(ROUTES[page].title)}</button>`).join("")}</div>` : ""}
      <main class="rb-page">${page(state, user, current)}</main></div>`;
  }
  function browserMenu() { return `<div class="rb-menu"><button data-rb-menu-action="new">Новая вкладка <kbd>Ctrl+T</kbd></button><button data-rb-menu-action="history">История <kbd>Ctrl+H</kbd></button><button data-rb-menu-action="downloads">Загрузки <kbd>Ctrl+J</kbd></button><hr><button data-rb-menu-action="settings">Настройки</button><button data-rb-menu-action="about">О браузере</button></div>`; }
  function page(state, user, current) {
    return ({ home: homePage, market: marketPage, video: videoPage, messages: messagesPage, history: historyPage, downloads: downloadsPage, settings: settingsPage, search: searchPage }[current.page] || homePage)(state, user, current);
  }
  function homePage(state, user) {
    const recent = Browser.visibleHistory(user).slice(-5).reverse();
    const quick = [{ page: "market", label: "КупиТут", note: "Покупки" }, { page: "video", label: "ВидеоЛента", note: "Рекомендации" }, { page: "messages", label: "Сообщения", note: Browser.unreadMessageCount(state) ? `${Browser.unreadMessageCount(state)} новых` : "Личная переписка" }, { page: "history", label: "История", note: "Недавние страницы" }];
    return `<section class="rb-newtab"><div class="rb-search-brand"><span>K</span><strong>${esc(user.settings.searchEngine)}</strong></div><form class="rb-main-search" data-rb-search><span>⌕</span><input placeholder="Введите запрос или адрес" /><button>Найти</button></form><div class="rb-quick">${quick.map((item) => `<button data-rb-page="${item.page}"><span>${icon(item.page)}</span><b>${item.label}</b><small>${item.note}</small></button>`).join("")}</div><div class="rb-home-grid"><section><header><h2>Недавние страницы</h2><button data-rb-page="history">Вся история</button></header>${recent.length ? recent.map((item) => `<button class="rb-recent" data-rb-address-value="${esc(item.url || "")}"><span>${icon(item.category === "market" ? "market" : item.category === "video" ? "video" : item.category === "messages" ? "messages" : "home")}</span><div><b>${esc(item.title)}</b><small>${esc(item.site || item.url || "")}</small></div><time>${DAY_SHORT[item.dayIndex] || ""} ${formatTime(item.minute)}</time></button>`).join("") : `<p class="rb-empty">Здесь появятся недавно посещённые страницы.</p>`}</section><section><header><h2>Быстрый доступ</h2></header>${homeSuggestions(state, user)}</section></div></section>`;
  }
  function homeSuggestions(state, user) {
    const product = availableProducts(state).find((item) => user.cart.includes(item.id)) || availableProducts(state).at(-1);
    const video = availableVideos(state).find((item) => !user.watched.includes(item.id));
    return `<div class="rb-suggestions">${product ? `<button data-rb-page="market"><span>${productIcon(product.id)}</span><div><small>КупиТут</small><b>${esc(product.title)}</b><em>${money(product.price)}</em></div></button>` : ""}${video ? `<button data-rb-page="video"><span class="video">▶</span><div><small>ВидеоЛента</small><b>${esc(video.title)}</b><em>${esc(video.duration)}</em></div></button>` : ""}</div>`;
  }
  function marketPage(state, user, current) {
    const products = availableProducts(state).filter((item) => matches(item, current.query));
    return `<section class="rb-site"><header class="rb-sitebar"><div class="rb-site-logo"><span>К</span><b>КупиТут</b></div><form data-rb-site-search="market"><input value="${esc(current.query)}" placeholder="Найти товары"><button>Найти</button></form><button class="rb-account">Корзина <i>${user.cart.length}</i></button></header><nav class="rb-categories">Электроника　 Дом　 Инструменты　 Аксессуары</nav><div class="rb-site-content"><header class="rb-heading"><div><small>Доставка по городу</small><h1>${current.query ? `Результаты: «${esc(current.query)}»` : "Рекомендуем сегодня"}</h1></div><span>Баланс: <b>${money(user.balance)}</b></span></header><div class="rb-products">${products.map((product) => productCard(product, user)).join("") || `<p class="rb-empty">Товары не найдены.</p>`}</div></div></section>`;
  }
  function productCard(product, user) {
    const favorite = user.favorites.includes(product.id), inCart = user.cart.includes(product.id), purchased = user.purchases.includes(product.id), compared = user.compared.includes(product.id);
    return `<article class="rb-product"><button class="rb-heart ${favorite ? "active" : ""}" data-rb-product="favorite" data-id="${product.id}">♡</button><div class="rb-product-image">${productIcon(product.id)}</div><small>Товары для дома</small><h2>${esc(product.title)}</h2><p>${esc(product.note)}</p><div class="rb-rating">★ ${esc(product.rating)} <span>· 128 отзывов</span></div><strong>${money(product.price)}</strong><div><button data-rb-product="compare" data-id="${product.id}" ${compared ? "disabled" : ""}>${compared ? "В сравнении" : "Сравнить"}</button><button class="primary" data-rb-product="${inCart ? "buy" : "cart"}" data-id="${product.id}" ${purchased || user.balance < product.price ? "disabled" : ""}>${purchased ? "Заказ оформлен" : inCart ? "Оформить" : "В корзину"}</button></div></article>`;
  }
  function videoPage(state, user, current) {
    const videos = availableVideos(state).filter((item) => matches(item, current.query));
    return `<section class="rb-site"><header class="rb-sitebar"><div class="rb-site-logo video"><span>▶</span><b>ВидеоЛента</b></div><form data-rb-site-search="video"><input value="${esc(current.query)}" placeholder="Поиск видео"><button>⌕</button></form><button class="rb-account">Мой профиль</button></header><div class="rb-video-layout"><aside><button class="active">Главная</button><button>Подписки</button><button>Смотреть позже</button></aside><main><header class="rb-heading"><div><small>Рекомендации</small><h1>${current.query ? `Поиск: «${esc(current.query)}»` : "Для вас"}</h1></div></header><div class="rb-videos">${videos.map((video) => `<article><button class="rb-thumb" data-rb-video="${video.id}" ${user.watched.includes(video.id) ? "disabled" : ""}><span>▶</span><time>${esc(video.duration)}</time></button><div><i>${esc(video.channel.slice(0, 1))}</i><section><h2>${esc(video.title)}</h2><p>${esc(video.channel)}</p><small>${user.watched.includes(video.id) ? "Просмотрено" : "184 тыс. просмотров"}</small></section></div></article>`).join("") || `<p class="rb-empty">Ничего не найдено.</p>`}</div></main></div></section>`;
  }
  function messagesPage(state, user, current) {
    const messages = availableMessages(state).filter((item) => matches(item, current.query));
    if (!selectedMessage || !messages.some((item) => item.id === selectedMessage)) selectedMessage = messages[0]?.id || null;
    const chosen = messages.find((item) => item.id === selectedMessage);
    return `<section class="rb-site"><header class="rb-sitebar"><div class="rb-site-logo messages"><span>С</span><b>Сообщения</b></div><form data-rb-site-search="messages"><input value="${esc(current.query)}" placeholder="Поиск в сообщениях"></form><button class="rb-account">Профиль</button></header><div class="rb-messages"><aside><button class="compose">Новое сообщение</button><button class="active">Входящие <span>${Browser.unreadMessageCount(state)}</span></button><button>Избранные</button><button>Архив</button></aside><div class="rb-message-list">${messages.map((message) => `<button class="${message.id === selectedMessage ? "active" : ""}" data-rb-message="${message.id}"><i>${esc(message.contact.slice(0, 1))}</i><div><b>${esc(message.contact)}</b><p>${esc(message.text)}</p></div><time>${DAY_SHORT[message.day] || ""}</time></button>`).join("")}</div><main class="rb-conversation">${chosen ? conversation(chosen, user) : `<p class="rb-empty">Выберите сообщение.</p>`}</main></div></section>`;
  }
  function conversation(message, user) {
    const reply = message.replies.find((item) => item.id === user.replies[message.id]);
    return `<header><i>${esc(message.contact.slice(0, 1))}</i><div><b>${esc(message.contact)}</b><small>личный контакт</small></div></header><section><p class="incoming">${esc(message.text)}</p>${reply ? `<p class="outgoing">${esc(reply.text)}</p><p class="incoming">${esc(reply.result)}</p>` : ""}</section>${reply ? `<footer><input value="Сообщение отправлено" disabled><button disabled>Отправить</button></footer>` : `<footer class="choices">${message.replies.map((item) => `<button data-rb-reply="${message.id}" data-reply-id="${item.id}">${esc(item.text)}</button>`).join("")}</footer>`}`;
  }
  function historyPage(state, user) {
    const items = Browser.visibleHistory(user).slice().reverse();
    return internalPage("history", `<header><div><h1>История</h1><p>Страницы, открытые в этом профиле.</p></div><button data-rb-clear-history ${user.clearedBefore?.dayIndex === state.dayIndex ? "disabled" : ""}>Очистить данные</button></header><form class="rb-internal-search"><span>⌕</span><input placeholder="Поиск в истории"></form><div class="rb-history">${items.length ? items.map((item) => `<article><time>${DAY_SHORT[item.dayIndex] || ""} ${formatTime(item.minute)}</time><span>${icon(item.category === "market" ? "market" : item.category === "video" ? "video" : item.category === "messages" ? "messages" : "home")}</span><button data-rb-address-value="${esc(item.url || "")}"><b>${esc(item.title)}</b><small>${esc(item.site || item.url || "")}</small></button></article>`).join("") : `<p class="rb-empty">История пуста.</p>`}</div>`);
  }
  function downloadsPage(state, user) {
    return internalPage("downloads", `<header><div><h1>Загрузки</h1><p>Файлы, сохранённые через браузер.</p></div></header>${user.downloads.length ? user.downloads.map((item) => `<article class="rb-download"><span>⇩</span><div><b>${esc(item.name)}</b><small>${esc(item.source || "KONTUR Web")}</small></div><button>Показать в папке</button></article>`).join("") : `<div class="rb-empty large"><span>⇩</span><h2>Загрузок пока нет</h2><p>Скачанные файлы появятся здесь.</p></div>`}`);
  }
  function settingsPage(state, user) {
    const s = user.settings;
    return internalPage("settings", `<header><div><h1>Настройки</h1><p>Параметры этого профиля браузера.</p></div></header><section class="rb-settings"><h2>При запуске</h2>${settingSelect("homePage", "Домашняя страница", "Страница по кнопке «Домой».", [["home", "Новая вкладка"], ["market", "КупиТут"], ["video", "ВидеоЛента"]], s.homePage)}</section><section class="rb-settings"><h2>Внешний вид</h2>${settingToggle("showBookmarksBar", "Показывать панель закладок", "Сохранённые сайты под адресной строкой.", s.showBookmarksBar)}${settingToggle("compactMode", "Компактный интерфейс", "Уменьшить высоту панелей и отступы.", s.compactMode)}</section><section class="rb-settings"><h2>Поиск и безопасность</h2>${settingSelect("searchEngine", "Поисковая система", "Используется в адресной строке.", [["KONTUR Search", "KONTUR Search"], ["Спутник", "Спутник"]], s.searchEngine)}${settingToggle("safeSearch", "Безопасный поиск", "Скрывать нежелательные материалы.", s.safeSearch)}</section><section class="rb-settings"><h2>Конфиденциальность</h2><label><div><b>Данные браузера</b><small>История и локальные данные профиля.</small></div><button data-rb-clear-history>Очистить данные</button></label></section><div class="rb-about"><span>K</span><div><b>KONTUR Web 12.4</b><p>Корпоративная сборка. Обновления устанавливаются администратором.</p></div></div>`);
  }
  function settingToggle(key, title, note, checked) { return `<label><div><b>${title}</b><small>${note}</small></div><input type="checkbox" data-rb-setting="${key}" ${checked ? "checked" : ""}></label>`; }
  function settingSelect(key, title, note, options, value) { return `<label><div><b>${title}</b><small>${note}</small></div><select data-rb-setting="${key}">${options.map(([id, label]) => `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`; }
  function internalPage(active, content) { return `<section class="rb-internal"><aside><b>KONTUR Web</b><button data-rb-page="history" class="${active === "history" ? "active" : ""}">История</button><button data-rb-page="downloads" class="${active === "downloads" ? "active" : ""}">Загрузки</button><button data-rb-page="settings" class="${active === "settings" ? "active" : ""}">Настройки</button></aside><main>${content}</main></section>`; }
  function searchPage(state, user, current) {
    const products = availableProducts(state).filter((item) => matches(item, current.query)), videos = availableVideos(state).filter((item) => matches(item, current.query)), messages = availableMessages(state).filter((item) => matches(item, current.query));
    return `<section class="rb-search-results"><header><div><span>K</span><b>${esc(user.settings.searchEngine)}</b></div><form data-rb-search><input value="${esc(current.query)}"><button>Найти</button></form></header><nav><button class="active">Все</button><button>Товары</button><button>Видео</button></nav><main><p>Найдено результатов: ${products.length + videos.length + messages.length}</p>${products.map((item) => result("kupitut.local", item.title, `${item.note} · ${money(item.price)}`, "market")).join("")}${videos.map((item) => result("video.local", item.title, `${item.channel} · ${item.duration}`, "video")).join("")}${messages.map((item) => result("msg.local", item.contact, item.text, "messages")).join("")}${!products.length && !videos.length && !messages.length ? `<div class="rb-empty large"><h2>Ничего не найдено</h2><p>Проверьте написание запроса.</p></div>` : ""}</main></section>`;
  }
  function result(site, title, text, pageId) { return `<article><small>${site}</small><button data-rb-page="${pageId}"><h2>${esc(title)}</h2></button><p>${esc(text)}</p></article>`; }

  function render() {
    patchScheduled = false;
    const win = document.querySelector(".personal-browser-window");
    if (!win) return;
    const state = stateNow(); if (!state) return;
    const user = personal(state), current = entry();
    win.dataset.browserV2 = "true";
    win.querySelector(".window-title").textContent = `${current.title} — KONTUR Web`;
    win.querySelector(".window-status").textContent = current.url.startsWith("https://") ? "Защищённое соединение" : "Готово";
    const content = win.querySelector(".window-content");
    content.innerHTML = chrome(state, user, current);
    bind(content, state, user);
  }
  function schedule() { if (patchScheduled) return; patchScheduled = true; if (root.requestAnimationFrame) root.requestAnimationFrame(render); else root.setTimeout(render, 0); }

  function bind(content, state, user) {
    content.querySelectorAll("[data-rb-tab]").forEach((button) => button.addEventListener("click", (event) => { if (event.target.closest("[data-rb-close-tab]")) return; activeTabId = button.dataset.rbTab; menuOpen = false; render(); }));
    content.querySelectorAll("[data-rb-close-tab]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); closeTab(button.dataset.rbCloseTab); }));
    content.querySelector("[data-rb-new-tab]")?.addEventListener("click", () => newTab("home"));
    content.querySelectorAll("[data-rb-nav]").forEach((button) => button.addEventListener("click", () => { const a = button.dataset.rbNav; if (a === "back") goBack(); if (a === "forward") goForward(); if (a === "reload") render(); if (a === "home") navigate(user.settings.homePage || "home"); }));
    content.querySelector("[data-rb-address]")?.addEventListener("submit", (event) => { event.preventDefault(); navigateAddress(event.currentTarget.querySelector("input").value); });
    content.querySelector("[data-rb-address] input")?.addEventListener("focus", (event) => event.currentTarget.select());
    content.querySelector("[data-rb-bookmark]")?.addEventListener("click", toggleBookmark);
    content.querySelector("[data-rb-menu]")?.addEventListener("click", () => { menuOpen = !menuOpen; render(); });
    content.querySelectorAll("[data-rb-menu-action]").forEach((button) => button.addEventListener("click", () => { const a = button.dataset.rbMenuAction; if (a === "new") newTab(); if (a === "history") navigate("history"); if (a === "downloads") navigate("downloads"); if (a === "settings" || a === "about") navigate("settings"); }));
    content.querySelectorAll("[data-rb-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.rbPage)));
    content.querySelectorAll("[data-rb-address-value]").forEach((button) => button.addEventListener("click", () => navigateAddress(button.dataset.rbAddressValue)));
    content.querySelectorAll("[data-rb-search]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); const q = event.currentTarget.querySelector("input").value.trim(); if (q) navigate("search", { query: q }); }));
    content.querySelectorAll("[data-rb-site-search]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); navigate(form.dataset.rbSiteSearch, { query: event.currentTarget.querySelector("input").value.trim() }); }));
    content.querySelectorAll("[data-rb-product]").forEach((button) => button.addEventListener("click", () => productAction(button.dataset.rbProduct, button.dataset.id)));
    content.querySelectorAll("[data-rb-video]").forEach((button) => button.addEventListener("click", () => videoAction(button.dataset.rbVideo)));
    content.querySelectorAll("[data-rb-message]").forEach((button) => button.addEventListener("click", () => { selectedMessage = button.dataset.rbMessage; render(); }));
    content.querySelectorAll("[data-rb-reply]").forEach((button) => button.addEventListener("click", () => replyAction(button.dataset.rbReply, button.dataset.replyId)));
    content.querySelectorAll("[data-rb-setting]").forEach((control) => control.addEventListener("change", () => settingAction(control)));
    content.querySelectorAll("[data-rb-clear-history]").forEach((button) => button.addEventListener("click", clearHistory));
  }

  function toggleBookmark() {
    const current = entry(); if (!["market", "video", "messages"].includes(current.page)) return;
    updatePersonal((value) => { value.bookmarks = value.bookmarks.includes(current.page) ? value.bookmarks.filter((page) => page !== current.page) : [...value.bookmarks, current.page]; }, "personal-browser-bookmark"); render();
  }
  function productAction(action, id) {
    const product = Browser.PRODUCTS.find((item) => item.id === id); if (!product) return;
    const map = {
      favorite: { minutes: 2, label: `Добавлено в избранное: ${product.title}`, apply(value) { value.favorites.push(id); } },
      compare: { minutes: 3, label: `Сравнение товара: ${product.title}`, apply(value) { value.compared.push(id); } },
      cart: { minutes: 3, label: `Добавлено в корзину: ${product.title}`, apply(value) { value.cart.push(id); } },
      buy: { minutes: 8, label: `Оформлен заказ: ${product.title}`, apply(value) { if (value.balance < product.price) throw new Error("insufficient-balance"); value.balance -= product.price; value.purchases.push(id); value.cart = value.cart.filter((item) => item !== id); } }
    };
    if (map[action]) Browser.performActivity({ id: `market-${action}-${id}`, category: "market", site: "КупиТут", url: ROUTES.market.url, ...map[action] });
  }
  function videoAction(id) {
    const video = Browser.VIDEOS.find((item) => item.id === id); if (!video) return;
    Browser.performActivity({ id: `video-watch-${id}`, minutes: video.minutes, label: `Просмотрено видео: ${video.title}`, category: "video", site: "ВидеоЛента", url: `${ROUTES.video.url}watch/${id}`, apply(value) { value.watched.push(id); } });
  }
  function replyAction(messageId, replyId) {
    const message = Browser.MESSAGES.find((item) => item.id === messageId), reply = message?.replies.find((item) => item.id === replyId); if (!message || !reply) return;
    Browser.performActivity({ id: `message-${messageId}-${replyId}`, minutes: 3, label: `Ответ отправлен: ${message.contact}`, category: "messages", site: "Сообщения", url: `${ROUTES.messages.url}chat/${messageId}`, apply(value) { value.replies[messageId] = replyId; } });
  }
  function settingAction(control) {
    const key = control.dataset.rbSetting, value = control.type === "checkbox" ? control.checked : control.value;
    updatePersonal((user) => { user.settings[key] = value; }, "personal-browser-setting"); render();
  }
  function clearHistory() {
    const state = stateNow(); if (!state) return;
    Browser.performActivity({ id: `history-clear-${state.dayIndex}`, minutes: 5, label: "Очищена история браузера", category: "history", site: "KONTUR Web", url: ROUTES.history.url, apply(value, draft) { value.clearedBefore = { dayIndex: draft.dayIndex, minute: draft.minute }; draft.stats ||= {}; draft.stats.suspicion = Number(draft.stats.suspicion || 0) + 1; draft.flags ||= {}; draft.flags.personalHistoryCleared = true; } });
  }

  root.addEventListener?.("until-friday-app-ready", schedule);
  root.addEventListener?.("until-friday-state-change", schedule);
  root.addEventListener?.("until-friday-ui-render", (event) => { if (event.detail?.appId === "browser") schedule(); });
  root.addEventListener?.("keydown", (event) => {
    const win = document.querySelector(".personal-browser-window"); if (!win || win.classList.contains("minimized")) return;
    if (event.ctrlKey && event.key.toLowerCase() === "t") { event.preventDefault(); newTab(); }
    if (event.ctrlKey && event.key.toLowerCase() === "w") { event.preventDefault(); closeTab(activeTabId); }
    if (event.ctrlKey && event.key.toLowerCase() === "l") { event.preventDefault(); win.querySelector(".rb-address input")?.focus(); }
    if (event.ctrlKey && event.key.toLowerCase() === "h") { event.preventDefault(); navigate("history"); }
    if (event.ctrlKey && event.key.toLowerCase() === "j") { event.preventDefault(); navigate("downloads"); }
  });
  document.addEventListener("click", (event) => { if (event.target.closest?.(".personal-browser-window, [data-personal-browser-launcher]")) root.setTimeout(schedule, 0); }, true);
  document.addEventListener("DOMContentLoaded", schedule, { once: true });

  root.UntilFridayPersonalBrowserUIV2 = { ROUTES, DEFAULT_SETTINGS, navigate, navigateAddress, newTab, closeTab, render, schedule };
})(typeof globalThis !== "undefined" ? globalThis : window);
