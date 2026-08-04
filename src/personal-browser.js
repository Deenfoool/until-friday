(function (root) {
  "use strict";

  if (root.UntilFridayPersonalBrowser) return;

  const APP_ID = "browser";
  const APP_TITLE = "Браузер";
  const DAILY_WARNING_MINUTES = 45;
  const DAY_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ"];

  const PRODUCTS = [
    { id: "headphones", day: 0, title: "Беспроводные наушники Volna H3", price: 4990, rating: "4,7", note: "Радиоканал, 38 часов работы" },
    { id: "chair", day: 0, title: "Офисное кресло Linea Compact", price: 7390, rating: "4,4", note: "Сетчатая спинка, без подголовника" },
    { id: "toolkit", day: 1, title: "Набор инструмента Master 46", price: 3290, rating: "4,8", note: "Трещотка, головки и биты" },
    { id: "coffee", day: 2, title: "Кофеварка капельная Start 600", price: 2790, rating: "4,5", note: "Колба 0,6 л, автоотключение" },
    { id: "gift", day: 3, title: "Настольная лампа Aurora", price: 1890, rating: "4,9", note: "Тёплый свет, регулировка яркости" },
    { id: "backpack", day: 4, title: "Городской рюкзак Route 18", price: 2490, rating: "4,6", note: "Отделение для ноутбука 15,6″" }
  ];

  const VIDEOS = [
    { id: "laptop-heat", day: 0, title: "Почему ноутбук греется даже без игр", duration: "08:14", minutes: 10, channel: "Техноразбор" },
    { id: "door-repair", day: 0, title: "Как отрегулировать входную дверь за 15 минут", duration: "12:03", minutes: 12, channel: "Дом своими руками" },
    { id: "office-fails", day: 1, title: "Самые странные офисные переписки", duration: "06:48", minutes: 8, channel: "Рабочий перерыв" },
    { id: "used-phone", day: 2, title: "Проверяем подержанный телефон перед покупкой", duration: "14:20", minutes: 15, channel: "Без переплаты" },
    { id: "quick-dinner", day: 3, title: "Ужин после работы из четырёх продуктов", duration: "09:31", minutes: 10, channel: "Просто кухня" },
    { id: "friday-mix", day: 4, title: "Музыка для последнего часа рабочей недели", duration: "27:00", minutes: 20, channel: "Фоновый шум" }
  ];

  const MESSAGES = [
    {
      id: "partner-bread",
      day: 0,
      contact: "Лена",
      text: "Не забудь вечером купить хлеб и молоко. Я буду поздно.",
      replies: [
        { id: "remember", text: "Хорошо, запомнил.", result: "Лена: Спасибо." },
        { id: "remind", text: "Напомни ближе к вечеру.", result: "Лена: Ладно, напишу ещё раз." }
      ]
    },
    {
      id: "friend-video",
      day: 0,
      contact: "Лёха",
      text: "Скинул тебе ролик про ремонт двери. Глянь, там ровно твоя проблема.",
      replies: [
        { id: "watch", text: "Сейчас посмотрю.", result: "Лёха: Только звук потише на работе." },
        { id: "later", text: "После работы посмотрю.", result: "Лёха: Как обычно." }
      ]
    },
    {
      id: "landlord-meter",
      day: 1,
      contact: "Хозяин квартиры",
      text: "Сегодня до вечера пришлите показания счётчиков.",
      replies: [
        { id: "send-evening", text: "Вечером отправлю.", result: "Хозяин квартиры: Хорошо, жду." },
        { id: "forgot", text: "Я не дома, отправлю завтра.", result: "Хозяин квартиры: Завтра уже поздно для передачи." }
      ]
    },
    {
      id: "partner-shelf",
      day: 2,
      contact: "Лена",
      text: "Посмотри на маркетплейсе лампу на стол. Только не очень дорогую.",
      replies: [
        { id: "choose", text: "Посмотрю варианты.", result: "Лена: До двух тысяч желательно." },
        { id: "weekend", text: "Давай выберем вместе в выходные.", result: "Лена: Договорились." }
      ]
    },
    {
      id: "friend-game",
      day: 3,
      contact: "Лёха",
      text: "Вечером зайдёшь? Мы новую карту начинаем.",
      replies: [
        { id: "join", text: "После девяти зайду.", result: "Лёха: Забронировал тебе место." },
        { id: "skip", text: "Сегодня без меня.", result: "Лёха: Понял." }
      ]
    },
    {
      id: "partner-weekend",
      day: 4,
      contact: "Лена",
      text: "Ты сегодня вовремя освободишься? Надо решить, что делаем в выходные.",
      replies: [
        { id: "on-time", text: "Постараюсь выйти вовремя.", result: "Лена: Тогда жду сообщения." },
        { id: "unknown", text: "Пока не знаю, день странный.", result: "Лена: Хорошо. Просто не пропадай." }
      ]
    }
  ];

  let browserWindow = null;
  let taskButton = null;
  let currentTab = "home";
  let searchQuery = "";
  let topZ = 1800;

  function runtime() {
    return root.UntilFridayRuntimeEngine || null;
  }

  function engine() {
    return runtime()?.getEngine?.() || null;
  }

  function createDefaultPersonalState() {
    return {
      version: 1,
      balance: 8420,
      favorites: [],
      cart: [],
      purchases: [],
      compared: [],
      watched: [],
      replies: {},
      completed: [],
      history: [],
      dailyMinutes: {},
      excessiveDays: [],
      clearedBefore: null
    };
  }

  function uniqueStrings(value) {
    return [...new Set((Array.isArray(value) ? value : []).filter((item) => typeof item === "string" && item))];
  }

  function normalizePersonalState(value) {
    const base = createDefaultPersonalState();
    const source = value && typeof value === "object" ? value : {};
    return {
      ...base,
      ...source,
      balance: Number.isFinite(Number(source.balance)) ? Math.max(0, Number(source.balance)) : base.balance,
      favorites: uniqueStrings(source.favorites),
      cart: uniqueStrings(source.cart),
      purchases: uniqueStrings(source.purchases),
      compared: uniqueStrings(source.compared),
      watched: uniqueStrings(source.watched),
      completed: uniqueStrings(source.completed),
      excessiveDays: uniqueStrings((source.excessiveDays || []).map(String)).map(Number),
      replies: source.replies && typeof source.replies === "object" ? { ...source.replies } : {},
      dailyMinutes: source.dailyMinutes && typeof source.dailyMinutes === "object" ? { ...source.dailyMinutes } : {},
      history: Array.isArray(source.history) ? source.history.filter((item) => item && typeof item === "object").slice(-250) : [],
      clearedBefore: source.clearedBefore && typeof source.clearedBefore === "object" ? { ...source.clearedBefore } : null
    };
  }

  function personalState(state = engine()?.getState?.()) {
    return normalizePersonalState(state?.metadata?.personalBrowser);
  }

  function stateNow() {
    return engine()?.getState?.() || null;
  }

  function formatTime(totalMinutes) {
    const value = Math.max(0, Number(totalMinutes) || 0);
    return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
  }

  function notify(title, text) {
    runtime()?.notify?.(title, text);
  }

  function rollback(before) {
    const currentEngine = engine();
    if (!currentEngine || !before) return;
    currentEngine.replaceState?.(before, "personal-browser-rollback");
    runtime()?.persist?.(before);
  }

  function deliverEvents(events) {
    (events || []).forEach((event) => {
      notify(event.source || event.title || "Система", event.text || event.title || "Новое событие");
    });
  }

  function performActivity(options) {
    const currentEngine = engine();
    const before = currentEngine?.getState?.();
    if (!currentEngine || !before) return { ok: false, reason: "engine-unavailable" };
    if (before.ended) {
      notify("Браузер", "Рабочая неделя уже завершена.");
      return { ok: false, reason: "game-ended" };
    }
    if (!before.dayStarted) {
      notify("Браузер", "Сначала нужно открыть рабочий сеанс.");
      return { ok: false, reason: "day-not-started" };
    }

    const minutes = Math.max(0, Number(options.minutes) || 0);
    const existing = personalState(before);
    if (options.once !== false && existing.completed.includes(options.id)) {
      notify("Браузер", "Это действие уже выполнено.");
      return { ok: false, reason: "already-completed" };
    }

    const timeResult = currentEngine.advanceTime(minutes);
    if (!timeResult?.ok) {
      notify("Браузер", "Сейчас не удалось потратить время на это действие.");
      return timeResult || { ok: false, reason: "time-failed" };
    }
    if (Number(timeResult.advancedMinutes) < minutes) {
      rollback(before);
      notify("Браузер", "До конца рабочего дня недостаточно времени.");
      return { ok: false, reason: "not-enough-time", state: before };
    }

    const update = currentEngine.updateState((draft) => {
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
        site: options.site || "KONTUR Web"
      });

      if (typeof options.apply === "function") options.apply(personal, draft);

      const dailyTotal = Number(personal.dailyMinutes[dayKey] || 0);
      if (dailyTotal >= DAILY_WARNING_MINUTES && !personal.excessiveDays.includes(draft.dayIndex)) {
        personal.excessiveDays.push(draft.dayIndex);
        draft.stats ||= {};
        draft.stats.suspicion = Number(draft.stats.suspicion || 0) + 1;
        draft.flags ||= {};
        draft.flags.personalBrowsingExcessive = true;
      }

      draft.metadata.personalBrowser = normalizePersonalState(personal);
    }, "personal-browser-activity");

    if (!update?.ok) {
      rollback(before);
      notify("Браузер", "Личное действие отменено: сохранение не записалось.");
      return { ...update, rolledBack: true, state: before };
    }

    deliverEvents(timeResult.events || []);
    notify("Личное время", `${options.label} · ${minutes} мин.`);
    renderBrowser();
    updateLaunchers();
    return {
      ok: true,
      persisted: true,
      minutes,
      events: timeResult.events || [],
      state: update.state
    };
  }

  function availableProducts(dayIndex) {
    return PRODUCTS.filter((item) => item.day <= dayIndex);
  }

  function availableVideos(dayIndex) {
    return VIDEOS.filter((item) => item.day <= dayIndex);
  }

  function availableMessages(dayIndex) {
    return MESSAGES.filter((item) => item.day <= dayIndex);
  }

  function unreadMessageCount(state = stateNow()) {
    if (!state) return 0;
    const personal = personalState(state);
    return availableMessages(state.dayIndex).filter((item) => !personal.replies[item.id]).length;
  }

  function visibleHistory(personal) {
    const cleared = personal.clearedBefore;
    if (!cleared) return personal.history;
    return personal.history.filter((item) => {
      if (Number(item.dayIndex) > Number(cleared.dayIndex)) return true;
      return Number(item.dayIndex) === Number(cleared.dayIndex) && Number(item.minute) > Number(cleared.minute);
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
      button.addEventListener("click", (event) => {
        document.querySelectorAll(".desktop-icon").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        if (event.pointerType === "touch") openBrowser();
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openBrowser();
        }
      });
      desktopIcons.appendChild(button);
    }

    if (!startApps.querySelector("[data-personal-browser-launcher]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "start-app personal-browser-start";
      button.dataset.app = APP_ID;
      button.dataset.personalBrowserLauncher = "true";
      button.innerHTML = `<span class="desktop-icon__glyph personal-browser-glyph" aria-hidden="true">◎</span><span>${APP_TITLE}</span><span class="personal-browser-badge" data-browser-badge hidden></span>`;
      button.addEventListener("click", () => {
        document.querySelector("#start-menu")?.classList.add("hidden");
        document.querySelector("#start-button")?.classList.remove("active");
        openBrowser();
      });
      startApps.appendChild(button);
    }

    updateLaunchers();
  }

  function updateLaunchers() {
    const count = unreadMessageCount();
    document.querySelectorAll("[data-browser-badge]").forEach((badge) => {
      badge.hidden = count <= 0;
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.setAttribute("aria-label", `Непрочитанных личных сообщений: ${count}`);
    });
  }

  function createTaskButton() {
    const taskbar = document.querySelector("#task-buttons");
    if (!taskbar || taskButton?.isConnected) return;
    taskButton = document.createElement("button");
    taskButton.type = "button";
    taskButton.className = "task-button personal-browser-task active";
    taskButton.dataset.personalBrowserTask = "true";
    taskButton.textContent = APP_TITLE;
    taskButton.addEventListener("click", () => {
      if (!browserWindow?.isConnected) return;
      const minimized = browserWindow.classList.toggle("minimized");
      taskButton.classList.toggle("active", !minimized);
      if (!minimized) focusBrowser();
    });
    taskbar.appendChild(taskButton);
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

  function closeBrowser() {
    browserWindow?.remove();
    taskButton?.remove();
    browserWindow = null;
    taskButton = null;
  }

  function makeDraggable(element, handle) {
    let drag = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button") || element.dataset.windowMaximized === "true") return;
      const rect = element.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const layer = document.querySelector("#windows-layer");
      const area = layer?.getBoundingClientRect?.() || { width: root.innerWidth, height: root.innerHeight - 42 };
      const maxX = Math.max(0, area.width - element.offsetWidth);
      const maxY = Math.max(0, area.height - element.offsetHeight);
      element.style.left = `${Math.max(0, Math.min(maxX, event.clientX - drag.x))}px`;
      element.style.top = `${Math.max(0, Math.min(maxY, event.clientY - drag.y))}px`;
    });
    handle.addEventListener("pointerup", () => { drag = null; });
    handle.addEventListener("pointercancel", () => { drag = null; });
  }

  function openBrowser() {
    if (browserWindow?.isConnected) {
      focusBrowser();
      renderBrowser();
      return;
    }

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
    browserWindow.querySelector(".window-title").textContent = "KONTUR Web — личная вкладка";
    browserWindow.querySelector(".window-status").textContent = "OFFICE-LAN · история посещений включена";

    browserWindow.addEventListener("pointerdown", focusBrowser);
    browserWindow.addEventListener("click", (event) => {
      const action = event.target.closest("[data-window-action]")?.dataset.windowAction;
      if (action === "close") closeBrowser();
      if (action === "minimize") {
        browserWindow.classList.add("minimized");
        taskButton?.classList.remove("active");
      }
    });
    makeDraggable(browserWindow, browserWindow.querySelector(".window-titlebar"));

    layer.appendChild(browserWindow);
    createTaskButton();
    renderBrowser();
    focusBrowser();

    root.dispatchEvent(new CustomEvent("until-friday-ui-render", {
      detail: { appId: APP_ID, element: browserWindow }
    }));
    root.UntilFridayWindowLayout?.enhance?.(browserWindow, APP_ID);
    root.UntilFridayWindowLayout?.maximize?.(browserWindow);
  }

  function browserShell(pageHtml) {
    const tabs = [
      ["home", "Главная"],
      ["market", "Маркет"],
      ["video", "Видео"],
      ["messages", "Сообщения"],
      ["history", "История"]
    ];
    return `
      <div class="personal-browser">
        <div class="personal-browser-toolbar">
          <button type="button" data-browser-home aria-label="Домой">⌂</button>
          <form data-browser-search>
            <span class="personal-browser-lock" title="Корпоративная сеть">▣</span>
            <input type="search" value="${escapeAttribute(searchQuery)}" placeholder="Поиск в KONTUR Web" aria-label="Поиск" />
            <button type="submit">Найти</button>
          </form>
        </div>
        <nav class="personal-browser-tabs" aria-label="Разделы браузера">
          ${tabs.map(([id, label]) => `<button type="button" data-browser-tab="${id}" class="${currentTab === id ? "active" : ""}">${label}${id === "messages" ? `<span class="browser-tab-count">${unreadMessageCount()}</span>` : ""}</button>`).join("")}
        </nav>
        <main class="personal-browser-page" data-browser-page>${pageHtml}</main>
      </div>`;
  }

  function renderBrowser() {
    if (!browserWindow?.isConnected) return;
    const state = stateNow();
    if (!state) return;
    const personal = personalState(state);
    const renderers = {
      home: () => renderHome(state, personal),
      market: () => renderMarket(state, personal),
      video: () => renderVideos(state, personal),
      messages: () => renderMessages(state, personal),
      history: () => renderHistory(state, personal),
      search: () => renderSearch(state, personal)
    };
    const content = browserWindow.querySelector(".window-content");
    content.innerHTML = browserShell((renderers[currentTab] || renderers.home)());
    bindBrowserControls(content, state, personal);
    const today = Number(personal.dailyMinutes[String(state.dayIndex)] || 0);
    browserWindow.querySelector(".window-status").textContent = `OFFICE-LAN · личное время сегодня: ${today} мин. · посещения регистрируются`;
  }

  function renderHome(state, personal) {
    const unread = unreadMessageCount(state);
    const today = Number(personal.dailyMinutes[String(state.dayIndex)] || 0);
    const product = availableProducts(state.dayIndex).at(-1);
    const video = availableVideos(state.dayIndex).at(-1);
    return `
      <section class="browser-home-hero">
        <div><span>${DAY_SHORT[state.dayIndex] || ""} · ${formatTime(state.minute)}</span><h1>Личная вкладка</h1><p>Небольшой перерыв между рабочими задачами.</p></div>
        <div class="browser-time-card"><strong>${today} мин.</strong><span>личного интернета сегодня</span></div>
      </section>
      <section class="browser-home-grid">
        <button type="button" class="browser-quick-card" data-browser-tab="messages"><strong>${unread}</strong><span>личных сообщений без ответа</span></button>
        <button type="button" class="browser-quick-card" data-browser-tab="market"><strong>${personal.cart.length}</strong><span>товаров в корзине</span></button>
        <button type="button" class="browser-quick-card" data-browser-tab="video"><strong>${personal.watched.length}</strong><span>просмотренных роликов</span></button>
      </section>
      <section class="browser-recommendations">
        <h2>На перерыве</h2>
        <div class="browser-recommendation-row">
          ${product ? `<article><span class="browser-site-label">КупиТут</span><h3>${escapeHtml(product.title)}</h3><p>${formatMoney(product.price)}</p><button type="button" data-browser-tab="market">Открыть маркетплейс</button></article>` : ""}
          ${video ? `<article><span class="browser-site-label">ВидеоЛента</span><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.duration)} · ${escapeHtml(video.channel)}</p><button type="button" data-browser-tab="video">Открыть видео</button></article>` : ""}
        </div>
      </section>
      <p class="browser-network-warning">Системный администратор может видеть адреса посещённых страниц и время подключения.</p>`;
  }

  function renderMarket(state, personal) {
    const products = availableProducts(state.dayIndex).filter(matchesSearch);
    return `
      <header class="browser-section-header"><div><span class="browser-site-label">КупиТут</span><h1>Товары для себя и дома</h1></div><div class="browser-balance">Доступно: <strong>${formatMoney(personal.balance)}</strong></div></header>
      <div class="browser-product-grid">
        ${products.map((product) => {
          const favorite = personal.favorites.includes(product.id);
          const inCart = personal.cart.includes(product.id);
          const purchased = personal.purchases.includes(product.id);
          return `<article class="browser-product-card">
            <div class="browser-product-image" aria-hidden="true">${productIcon(product.id)}</div>
            <span class="browser-product-rating">★ ${escapeHtml(product.rating)}</span>
            <h2>${escapeHtml(product.title)}</h2>
            <p>${escapeHtml(product.note)}</p>
            <strong class="browser-product-price">${formatMoney(product.price)}</strong>
            <div class="browser-product-actions">
              <button type="button" data-product-action="favorite" data-product-id="${product.id}" ${favorite ? "disabled" : ""}>${favorite ? "В избранном" : "В избранное · 2 мин."}</button>
              <button type="button" data-product-action="compare" data-product-id="${product.id}" ${personal.compared.includes(product.id) ? "disabled" : ""}>${personal.compared.includes(product.id) ? "Сравнено" : "Сравнить · 3 мин."}</button>
              <button type="button" data-product-action="cart" data-product-id="${product.id}" ${inCart || purchased ? "disabled" : ""}>${purchased ? "Куплено" : inCart ? "В корзине" : "В корзину · 3 мин."}</button>
              <button type="button" class="primary" data-product-action="buy" data-product-id="${product.id}" ${purchased || personal.balance < product.price ? "disabled" : ""}>${purchased ? "Заказ оформлен" : "Купить · 8 мин."}</button>
            </div>
          </article>`;
        }).join("") || `<div class="browser-empty">По запросу ничего не найдено.</div>`}
      </div>`;
  }

  function renderVideos(state, personal) {
    const videos = availableVideos(state.dayIndex).filter(matchesSearch);
    return `
      <header class="browser-section-header"><div><span class="browser-site-label">ВидеоЛента</span><h1>Рекомендации на сегодня</h1></div><span>${personal.watched.length} просмотрено</span></header>
      <div class="browser-video-list">
        ${videos.map((video) => {
          const watched = personal.watched.includes(video.id);
          return `<article class="browser-video-card">
            <div class="browser-video-preview"><span>▶</span><time>${escapeHtml(video.duration)}</time></div>
            <div><small>${escapeHtml(video.channel)}</small><h2>${escapeHtml(video.title)}</h2><p>Просмотр займёт ${video.minutes} игровых минут.</p><button type="button" data-video-id="${video.id}" ${watched ? "disabled" : ""}>${watched ? "Просмотрено" : `Смотреть · ${video.minutes} мин.`}</button></div>
          </article>`;
        }).join("") || `<div class="browser-empty">Ролики не найдены.</div>`}
      </div>`;
  }

  function renderMessages(state, personal) {
    const messages = availableMessages(state.dayIndex).filter(matchesSearch);
    return `
      <header class="browser-section-header"><div><span class="browser-site-label">Личные сообщения</span><h1>Не рабочая переписка</h1></div><span>${unreadMessageCount(state)} без ответа</span></header>
      <div class="browser-message-list">
        ${messages.map((message) => {
          const replyId = personal.replies[message.id];
          const selected = message.replies.find((item) => item.id === replyId);
          return `<article class="browser-message-card ${selected ? "answered" : ""}">
            <header><span class="browser-contact-avatar">${escapeHtml(message.contact.slice(0, 1))}</span><div><strong>${escapeHtml(message.contact)}</strong><small>${DAY_SHORT[message.day] || ""}</small></div></header>
            <p>${escapeHtml(message.text)}</p>
            ${selected ? `<div class="browser-sent-reply"><span>Вы:</span> ${escapeHtml(selected.text)}</div><div class="browser-reply-result">${escapeHtml(selected.result)}</div>` : `<div class="browser-reply-actions">${message.replies.map((reply) => `<button type="button" data-message-id="${message.id}" data-reply-id="${reply.id}">${escapeHtml(reply.text)} · 3 мин.</button>`).join("")}</div>`}
          </article>`;
        }).join("") || `<div class="browser-empty">Сообщения не найдены.</div>`}
      </div>`;
  }

  function renderHistory(state, personal) {
    const history = visibleHistory(personal).slice().reverse().filter(matchesSearch);
    const clearedToday = personal.clearedBefore?.dayIndex === state.dayIndex;
    return `
      <header class="browser-section-header"><div><span class="browser-site-label">KONTUR Web</span><h1>История посещений</h1></div><button type="button" data-clear-history ${clearedToday ? "disabled" : ""}>${clearedToday ? "История уже очищена" : "Очистить историю · 5 мин."}</button></header>
      <div class="browser-history-list">
        ${history.map((item) => `<article><time>${DAY_SHORT[item.dayIndex] || ""} ${formatTime(item.minute)}</time><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.site || "KONTUR Web")}</span></div></article>`).join("") || `<div class="browser-empty">История посещений пуста.</div>`}
      </div>
      <p class="browser-network-warning">Очистка локальной истории не удаляет записи сетевого шлюза.</p>`;
  }

  function renderSearch(state, personal) {
    const products = availableProducts(state.dayIndex).filter(matchesSearch);
    const videos = availableVideos(state.dayIndex).filter(matchesSearch);
    const messages = availableMessages(state.dayIndex).filter(matchesSearch);
    return `
      <header class="browser-section-header"><div><span class="browser-site-label">Поиск</span><h1>Результаты: «${escapeHtml(searchQuery)}»</h1></div></header>
      <div class="browser-search-results">
        ${products.map((item) => `<button type="button" data-browser-tab="market"><strong>${escapeHtml(item.title)}</strong><span>Маркетплейс · ${formatMoney(item.price)}</span></button>`).join("")}
        ${videos.map((item) => `<button type="button" data-browser-tab="video"><strong>${escapeHtml(item.title)}</strong><span>Видео · ${escapeHtml(item.duration)}</span></button>`).join("")}
        ${messages.map((item) => `<button type="button" data-browser-tab="messages"><strong>${escapeHtml(item.contact)}</strong><span>${escapeHtml(item.text)}</span></button>`).join("")}
        ${!products.length && !videos.length && !messages.length ? `<div class="browser-empty">Ничего не найдено.</div>` : ""}
      </div>`;
  }

  function matchesSearch(item) {
    if (!searchQuery) return true;
    const text = Object.values(item || {}).flat().join(" ").toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  }

  function bindBrowserControls(content, state, personal) {
    content.querySelector("[data-browser-home]")?.addEventListener("click", () => {
      currentTab = "home";
      searchQuery = "";
      renderBrowser();
    });

    content.querySelectorAll("[data-browser-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        currentTab = button.dataset.browserTab;
        if (currentTab !== "search") searchQuery = "";
        renderBrowser();
      });
    });

    content.querySelector("[data-browser-search]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      searchQuery = event.currentTarget.querySelector("input")?.value.trim() || "";
      currentTab = searchQuery ? "search" : "home";
      renderBrowser();
    });

    content.querySelectorAll("[data-product-action]").forEach((button) => {
      button.addEventListener("click", () => handleProductAction(button.dataset.productAction, button.dataset.productId));
    });
    content.querySelectorAll("[data-video-id]").forEach((button) => {
      button.addEventListener("click", () => handleVideo(button.dataset.videoId));
    });
    content.querySelectorAll("[data-message-id][data-reply-id]").forEach((button) => {
      button.addEventListener("click", () => handleReply(button.dataset.messageId, button.dataset.replyId));
    });
    content.querySelector("[data-clear-history]")?.addEventListener("click", clearHistory);
  }

  function handleProductAction(actionName, productId) {
    const product = PRODUCTS.find((item) => item.id === productId);
    if (!product) return;
    const actions = {
      favorite: {
        minutes: 2,
        label: `Добавлено в избранное: ${product.title}`,
        apply(personal) { personal.favorites.push(product.id); }
      },
      compare: {
        minutes: 3,
        label: `Сравнение товара: ${product.title}`,
        apply(personal) { personal.compared.push(product.id); }
      },
      cart: {
        minutes: 3,
        label: `Добавлено в корзину: ${product.title}`,
        apply(personal) { personal.cart.push(product.id); }
      },
      buy: {
        minutes: 8,
        label: `Оформлен заказ: ${product.title}`,
        apply(personal) {
          if (personal.balance < product.price) throw new Error("insufficient-balance");
          personal.balance -= product.price;
          personal.purchases.push(product.id);
          personal.cart = personal.cart.filter((id) => id !== product.id);
        }
      }
    };
    const selected = actions[actionName];
    if (!selected) return;
    performActivity({
      id: `market-${actionName}-${product.id}`,
      category: "market",
      site: "КупиТут",
      ...selected
    });
  }

  function handleVideo(videoId) {
    const video = VIDEOS.find((item) => item.id === videoId);
    if (!video) return;
    performActivity({
      id: `video-watch-${video.id}`,
      minutes: video.minutes,
      label: `Просмотрено видео: ${video.title}`,
      category: "video",
      site: "ВидеоЛента",
      apply(personal) { personal.watched.push(video.id); }
    });
  }

  function handleReply(messageId, replyId) {
    const message = MESSAGES.find((item) => item.id === messageId);
    const reply = message?.replies.find((item) => item.id === replyId);
    if (!message || !reply) return;
    performActivity({
      id: `message-${message.id}-${reply.id}`,
      minutes: 3,
      label: `Ответ отправлен: ${message.contact}`,
      category: "messages",
      site: "Личные сообщения",
      apply(personal) { personal.replies[message.id] = reply.id; }
    });
  }

  function clearHistory() {
    const state = stateNow();
    if (!state) return;
    performActivity({
      id: `history-clear-${state.dayIndex}`,
      minutes: 5,
      label: "Очищена история браузера",
      category: "history",
      site: "KONTUR Web",
      apply(personal, draft) {
        personal.clearedBefore = { dayIndex: draft.dayIndex, minute: draft.minute };
        draft.stats ||= {};
        draft.stats.suspicion = Number(draft.stats.suspicion || 0) + 1;
        draft.flags ||= {};
        draft.flags.personalHistoryCleared = true;
      }
    });
  }

  function productIcon(id) {
    return {
      headphones: "◖◗",
      chair: "▥",
      toolkit: "▣",
      coffee: "♨",
      gift: "✦",
      backpack: "▰"
    }[id] || "□";
  }

  function formatMoney(value) {
    return `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} ₽`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  root.addEventListener?.("until-friday-app-ready", () => {
    installLaunchers();
    updateLaunchers();
  });
  root.addEventListener?.("until-friday-state-change", () => {
    updateLaunchers();
    if (browserWindow?.isConnected) renderBrowser();
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (root.__UNTIL_FRIDAY_V2_READY__) installLaunchers();
  }, { once: true });

  root.UntilFridayPersonalBrowser = {
    APP_ID,
    DAILY_WARNING_MINUTES,
    PRODUCTS,
    VIDEOS,
    MESSAGES,
    createDefaultPersonalState,
    normalizePersonalState,
    personalState,
    visibleHistory,
    unreadMessageCount,
    performActivity,
    installLaunchers,
    openBrowser,
    closeBrowser,
    renderBrowser
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
