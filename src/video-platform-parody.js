(function (root) {
  "use strict";
  if (root.UntilFridayVideoPlatformParody) return;

  const Pack = root.UntilFridayVideoContentPack;
  const Browser = root.UntilFridayPersonalBrowser;
  const Runtime = root.UntilFridayRuntimeEngine;
  const BrowserUI = root.UntilFridayPersonalBrowserUIV2;
  if (!Pack || !Browser || !Runtime || !BrowserUI) return;

  Browser.VIDEOS.splice(0, Browser.VIDEOS.length, ...Pack.VIDEOS);

  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const icon = (name, size = 24) => `${ICON_ROOT}/${size}/${name}.png`;
  const FALLBACK_THUMB = "https://img.icons8.com/fluency/240/video.png";
  const FALLBACK_AVATAR = "https://img.icons8.com/fluency/96/test-account.png";
  const ROUTES = {
    home: "https://video.local/",
    subscriptions: "https://video.local/feed/subscriptions",
    watchLater: "https://video.local/playlist/watch-later",
    history: "https://video.local/feed/history",
    liked: "https://video.local/playlist/liked",
    trending: "https://video.local/feed/trending",
    search: "https://video.local/results",
    channel: "https://video.local/channel/",
    watch: "https://video.local/watch/"
  };

  let selectedCategory = "all";
  let visibleCount = 24;
  let menuCompact = false;
  let queued = false;
  let playerState = null;

  function stateNow() { return Runtime.getEngine?.()?.getState?.() || null; }
  function unique(value) { return [...new Set(Array.isArray(value) ? value.filter(Boolean) : [])]; }
  function videoState(state = stateNow()) {
    const personal = Browser.personalState?.(state) || {};
    return {
      ...personal,
      subscriptions: unique(personal.subscriptions),
      watchLater: unique(personal.watchLater),
      likedVideos: unique(personal.likedVideos),
      videoHistory: Array.isArray(personal.videoHistory) ? personal.videoHistory.filter((item) => item && Pack.VIDEO_BY_ID[item.videoId]).slice(-300) : [],
      autoplay: personal.autoplay !== false
    };
  }
  function mutateVideoState(updater, reason = "video-platform-state") {
    const engine = Runtime.getEngine?.();
    if (!engine) return { ok: false, reason: "engine-unavailable" };
    return engine.updateState((draft) => {
      draft.metadata ||= {};
      const value = videoState(draft);
      updater(value, draft);
      draft.metadata.personalBrowser = value;
    }, reason);
  }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function address() { return document.querySelector(".personal-browser-window .rb-address input")?.value || ""; }
  function isVideoSite() { return address().includes("video.local"); }
  function parseRoute() {
    const url = address();
    if (url.includes("/watch/")) return { view: "watch", id: decodeURIComponent(url.split("/watch/")[1].split(/[?#]/)[0]) };
    if (url.includes("/channel/")) return { view: "channel", id: decodeURIComponent(url.split("/channel/")[1].split(/[?#]/)[0]) };
    if (url.includes("/feed/subscriptions")) return { view: "subscriptions" };
    if (url.includes("/playlist/watch-later")) return { view: "watchLater" };
    if (url.includes("/feed/history")) return { view: "history" };
    if (url.includes("/playlist/liked")) return { view: "liked" };
    if (url.includes("/feed/trending")) return { view: "trending" };
    if (url.includes("/results")) {
      try { return { view: "search", query: new URL(url).searchParams.get("q") || "" }; }
      catch { return { view: "search", query: "" }; }
    }
    return { view: "home" };
  }
  function navigate(url, title) {
    BrowserUI.navigate("video", { url, title });
    root.setTimeout?.(schedule, 0);
  }
  function routeButton(view, label, iconName, active, badge = "") {
    return `<button class="vl-side-link ${active ? "active" : ""}" data-vl-route="${view}"><img src="${icon(iconName)}" alt=""><span>${label}</span>${badge ? `<i>${badge}</i>` : ""}</button>`;
  }
  function routeUrl(view) {
    return {
      home: ROUTES.home,
      subscriptions: ROUTES.subscriptions,
      watchLater: ROUTES.watchLater,
      history: ROUTES.history,
      liked: ROUTES.liked,
      trending: ROUTES.trending
    }[view] || ROUTES.home;
  }

  function shell(state, user, route) {
    const channelCount = user.subscriptions.length;
    return `<section class="vl-app ${menuCompact ? "compact-menu" : ""}">
      <header class="vl-topbar">
        <button class="vl-icon-button" data-vl-menu title="Меню"><img src="${icon("menu")}" alt=""></button>
        <button class="vl-logo" data-vl-route="home"><span><img src="${icon("play-button-circled", 28)}" alt=""></span><b>ВидеоЛента</b><small>RU</small></button>
        <form class="vl-search" data-vl-search><input value="${route.view === "search" ? esc(route.query) : ""}" placeholder="Введите запрос" autocomplete="off"><button title="Найти"><img src="${icon("search")}" alt=""></button></form>
        <button class="vl-mic vl-icon-button" title="Голосовой поиск"><img src="${icon("microphone")}" alt=""></button>
        <div class="vl-top-actions"><button class="vl-icon-button" title="Создать"><img src="${icon("video-call")}" alt=""></button><button class="vl-icon-button" title="Уведомления"><img src="${icon("appointment-reminders")}" alt=""><i>3</i></button><button class="vl-profile" title="Профиль">Д</button></div>
      </header>
      <aside class="vl-sidebar">
        <nav>${routeButton("home", "Главная", "home", route.view === "home")}${routeButton("trending", "В тренде", "fire-element", route.view === "trending")}${routeButton("subscriptions", "Подписки", "video-playlist", route.view === "subscriptions", channelCount || "")}</nav>
        <hr><nav>${routeButton("history", "История", "time-machine", route.view === "history")}${routeButton("watchLater", "Смотреть позже", "clock", route.view === "watchLater", user.watchLater.length || "")}${routeButton("liked", "Понравившиеся", "facebook-like", route.view === "liked", user.likedVideos.length || "")}</nav>
        <hr><section class="vl-sub-list"><h3>Подписки</h3>${subscribedChannels(user).slice(0, 7).map((channel) => `<button data-vl-channel="${channel.id}"><img src="${channel.avatar}" data-vl-avatar alt=""><span>${esc(channel.name)}</span><i></i></button>`).join("") || `<p>Здесь появятся каналы, на которые вы подпишетесь.</p>`}</section>
        <footer>О сервисе　Авторам<br>Условия　Конфиденциальность<br><small>© 2026 ВидеоЛента</small></footer>
      </aside>
      <main class="vl-content">${content(state, user, route)}</main>
    </section>`;
  }

  function content(state, user, route) {
    if (route.view === "watch") return watchPage(state, user, route.id);
    if (route.view === "channel") return channelPage(state, user, route.id);
    if (route.view === "subscriptions") return collectionPage(user, "Подписки", subscribedVideos(user), "Новые видео каналов, на которые вы подписаны.", "subscriptions");
    if (route.view === "watchLater") return collectionPage(user, "Смотреть позже", idsToVideos(user.watchLater), "Сохранённые ролики для спокойного рабочего момента.", "watchLater");
    if (route.view === "history") return historyPage(user);
    if (route.view === "liked") return collectionPage(user, "Понравившиеся", idsToVideos(user.likedVideos), "Все ролики, которым вы поставили отметку «Нравится».", "liked");
    if (route.view === "trending") return collectionPage(user, "В тренде", trendingVideos(), "То, что сегодня обсуждают все, кроме вашего отдела.", "trending");
    if (route.view === "search") return searchPage(user, route.query);
    return homePage(user);
  }

  function homePage(user) {
    const recommendations = recommendationFeed(user, selectedCategory).slice(0, visibleCount);
    const shorts = Pack.VIDEOS.filter((video) => video.channelId === "short-weird");
    return `<div class="vl-feed-page">
      <div class="vl-chips">${Object.entries(Pack.CATEGORY_LABELS).map(([id, label]) => `<button data-vl-category="${id}" class="${selectedCategory === id ? "active" : ""}">${label}</button>`).join("")}</div>
      <section class="vl-feed-grid">${recommendations.slice(0, 12).map((video) => videoCard(video, user)).join("")}</section>
      <section class="vl-shorts"><header><div><img src="${icon("youtube-shorts", 28)}" alt=""><h2>Короткие</h2></div><button data-vl-dismiss-shorts title="Скрыть"><img src="${icon("delete-sign")}" alt=""></button></header><div>${shorts.map((video) => shortCard(video, user)).join("")}</div></section>
      <section class="vl-feed-grid">${recommendations.slice(12).map((video) => videoCard(video, user)).join("")}</section>
      ${visibleCount < recommendationFeed(user, selectedCategory).length ? `<button class="vl-load-more" data-vl-more>Показать ещё</button>` : ""}
    </div>`;
  }

  function collectionPage(user, title, videos, subtitle, type) {
    return `<section class="vl-collection"><header><div class="vl-collection-cover"><img src="${icon(type === "watchLater" ? "clock" : type === "liked" ? "facebook-like" : type === "subscriptions" ? "video-playlist" : "fire-element", 64)}" alt=""></div><div><small>ВидеоЛента</small><h1>${title}</h1><p>${subtitle}</p><b>${videos.length} видео</b></div></header>${videos.length ? `<div class="vl-list-layout">${videos.map((video, index) => listVideo(video, user, index + 1)).join("")}</div>` : emptyCollection(title)}</section>`;
  }

  function historyPage(user) {
    const seen = user.videoHistory.slice().reverse();
    return `<section class="vl-history"><header><div><h1>История просмотра</h1><p>${seen.length} записей в этом профиле</p></div><button data-vl-clear-history><img src="${icon("trash")}" alt="">Очистить историю</button></header>${seen.length ? `<div>${seen.map((entry) => { const video = Pack.VIDEO_BY_ID[entry.videoId]; return video ? `<article>${videoThumb(video, "list")}<section><small>${entry.dayIndex != null ? `День ${entry.dayIndex + 1}` : ""}</small><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><p>${esc(video.channelName)} · ${esc(video.views)}</p></section><button class="vl-row-menu"><img src="${icon("menu-2")}" alt=""></button></article>` : ""; }).join("")}</div>` : emptyCollection("История пуста")}</section>`;
  }

  function searchPage(user, query) {
    const needle = String(query || "").trim().toLowerCase();
    const videos = Pack.VIDEOS.filter((video) => `${video.title} ${video.channelName} ${Pack.CATEGORY_LABELS[video.category]}`.toLowerCase().includes(needle));
    const channels = Pack.CHANNELS.filter((channel) => `${channel.name} ${channel.description}`.toLowerCase().includes(needle));
    return `<section class="vl-results"><header><h1>Результаты поиска</h1><button><img src="${icon("filter")}" alt="">Фильтры</button></header>${channels.map((channel) => channelSearchCard(channel, user)).join("")}${videos.length ? videos.map((video) => searchVideoCard(video, user)).join("") : `<div class="vl-empty"><img src="${icon("search", 80)}" alt=""><h2>По запросу «${esc(query)}» ничего не найдено</h2><p>Попробуйте «ремонт», «игры», «офис», «машина» или «музыка».</p></div>`}</section>`;
  }

  function channelPage(state, user, channelId) {
    const channel = Pack.CHANNEL_BY_ID[channelId];
    if (!channel) return emptyCollection("Канал не найден");
    const subscribed = user.subscriptions.includes(channel.id);
    return `<section class="vl-channel"><div class="vl-channel-banner"><img src="${channel.banner}" data-vl-banner alt=""></div><header><img src="${channel.avatar}" data-vl-avatar alt=""><div><h1>${esc(channel.name)} ${channel.verified ? `<img src="${icon("verified-account", 18)}" alt="Подтверждён">` : ""}</h1><p>@${esc(channel.id)} · ${channel.subscribers} подписчиков · ${channel.videos.length} видео</p><span>${esc(channel.description)}</span></div><button class="${subscribed ? "subscribed" : ""}" data-vl-subscribe="${channel.id}">${subscribed ? "Вы подписаны" : "Подписаться"}</button></header><nav><button class="active">Главная</button><button>Видео</button><button>Плейлисты</button><button>Сообщество</button><button>О канале</button></nav><main><h2>Последние видео</h2><div class="vl-feed-grid">${channel.videos.map((video) => videoCard(video, user)).join("")}</div></main></section>`;
  }

  function watchPage(state, user, videoId) {
    const video = Pack.VIDEO_BY_ID[videoId];
    if (!video) return emptyCollection("Видео не найдено");
    const channel = Pack.CHANNEL_BY_ID[video.channelId];
    const liked = user.likedVideos.includes(video.id);
    const later = user.watchLater.includes(video.id);
    const subscribed = user.subscriptions.includes(channel.id);
    const watched = user.watched.includes(video.id);
    const recommendations = relatedVideos(video, user).slice(0, 14);
    const playing = playerState?.videoId === video.id && playerState.played;
    return `<section class="vl-watch-page">
      <div class="vl-watch-main">
        <div class="vl-player ${playing ? "finished" : ""}">${videoThumb(video, "player")}<button class="vl-play" data-vl-play="${video.id}"><img src="${icon(playing ? "replay" : "play", 64)}" alt="">${playing ? `<span>Посмотреть ещё раз</span>` : ""}</button><div class="vl-player-controls"><button data-vl-play="${video.id}"><img src="${icon(playing ? "replay" : "play", 23)}" alt=""></button><button><img src="${icon("speaker")}" alt=""></button><span>${playing ? video.duration : "0:00"} / ${video.duration}</span><div><i style="width:${playing ? 100 : 0}%"></i></div><button><img src="${icon("subtitles")}" alt=""></button><button><img src="${icon("settings")}" alt=""></button><button><img src="${icon("full-screen")}" alt=""></button></div></div>
        <h1>${esc(video.title)}</h1>
        <div class="vl-video-actions"><button class="vl-channel-inline" data-vl-channel="${channel.id}"><img src="${channel.avatar}" data-vl-avatar alt=""><span><b>${esc(channel.name)} ${channel.verified ? "✓" : ""}</b><small>${channel.subscribers} подписчиков</small></span></button><button class="vl-subscribe ${subscribed ? "subscribed" : ""}" data-vl-subscribe="${channel.id}">${subscribed ? "Вы подписаны" : "Подписаться"}</button><div class="vl-action-spacer"></div><button class="${liked ? "active" : ""}" data-vl-like="${video.id}"><img src="${icon("facebook-like")}" alt="">${liked ? "Нравится" : randomLikes(video)}</button><button><img src="${icon("dislike")}" alt=""></button><button><img src="${icon("share")}" alt="">Поделиться</button><button class="${later ? "active" : ""}" data-vl-later="${video.id}"><img src="${icon("clock")}" alt="">${later ? "Сохранено" : "Сохранить"}</button><button><img src="${icon("menu-2")}" alt=""></button></div>
        <section class="vl-description"><b>${esc(video.views)}　${esc(video.published)}</b><p>${esc(video.description)}</p><button>Ещё</button></section>
        ${comments(video)}
      </div>
      <aside class="vl-related"><header><b>Следующее</b><label>Автовоспроизведение <input type="checkbox" data-vl-autoplay ${user.autoplay ? "checked" : ""}></label></header>${recommendations.map((item) => relatedCard(item, user)).join("")}</aside>
    </section>`;
  }

  function videoCard(video, user) {
    const channel = Pack.CHANNEL_BY_ID[video.channelId];
    const later = user.watchLater.includes(video.id);
    return `<article class="vl-video-card">${videoThumb(video, "grid")}<button class="vl-card-menu" data-vl-later="${video.id}" title="${later ? "Удалить из Смотреть позже" : "Смотреть позже"}"><img src="${icon(later ? "checked-checkbox" : "clock")}" alt=""></button><div><button class="vl-avatar-button" data-vl-channel="${channel.id}"><img src="${channel.avatar}" data-vl-avatar alt=""></button><section><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><button class="vl-channel-name" data-vl-channel="${channel.id}">${esc(channel.name)} ${channel.verified ? "✓" : ""}</button><p>${esc(video.views)} · ${esc(video.published)}</p></section><button class="vl-dots"><img src="${icon("menu-2")}" alt=""></button></div></article>`;
  }
  function shortCard(video, user) {
    return `<article class="vl-short-card"><button data-vl-watch="${video.id}">${videoThumb(video, "short")}<h3>${esc(video.title)}</h3><p>${esc(video.views)}</p></button></article>`;
  }
  function listVideo(video, user, index) {
    return `<article class="vl-list-video"><span>${index}</span>${videoThumb(video, "list")}<section><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><p>${esc(video.channelName)} · ${esc(video.views)} · ${esc(video.published)}</p></section><button data-vl-later="${video.id}"><img src="${icon(user.watchLater.includes(video.id) ? "checked-checkbox" : "clock")}" alt=""></button><button><img src="${icon("menu-2")}" alt=""></button></article>`;
  }
  function searchVideoCard(video, user) {
    const channel = Pack.CHANNEL_BY_ID[video.channelId];
    return `<article class="vl-search-video">${videoThumb(video, "search")}<section><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><p>${esc(video.views)} · ${esc(video.published)}</p><button class="vl-search-channel" data-vl-channel="${channel.id}"><img src="${channel.avatar}" data-vl-avatar alt="">${esc(channel.name)}</button><span>${esc(video.description)}</span></section><button class="vl-dots"><img src="${icon("menu-2")}" alt=""></button></article>`;
  }
  function channelSearchCard(channel, user) {
    const subscribed = user.subscriptions.includes(channel.id);
    return `<article class="vl-channel-result"><img src="${channel.avatar}" data-vl-avatar alt=""><section><h2><button data-vl-channel="${channel.id}">${esc(channel.name)}</button></h2><p>${channel.subscribers} подписчиков · ${channel.videos.length} видео</p><span>${esc(channel.description)}</span></section><button class="${subscribed ? "subscribed" : ""}" data-vl-subscribe="${channel.id}">${subscribed ? "Вы подписаны" : "Подписаться"}</button></article>`;
  }
  function relatedCard(video, user) {
    return `<article class="vl-related-card">${videoThumb(video, "related")}<section><h3><button data-vl-watch="${video.id}">${esc(video.title)}</button></h3><button data-vl-channel="${video.channelId}">${esc(video.channelName)}</button><p>${esc(video.views)} · ${esc(video.published)}</p></section><button><img src="${icon("menu-2")}" alt=""></button></article>`;
  }
  function videoThumb(video, mode) {
    return `<button class="vl-thumb ${mode}" data-vl-watch="${video.id}"><img src="${video.thumbnail}" data-vl-thumb data-fallback-icon="${video.fallbackIcon}" alt="${esc(video.title)}"><time>${esc(video.duration)}</time>${mode === "grid" || mode === "search" || mode === "related" || mode === "list" ? `<span class="vl-thumb-hover"><img src="${icon("play")}" alt=""></span>` : ""}</button>`;
  }
  function emptyCollection(title) { return `<div class="vl-empty"><img src="${icon("video", 90)}" alt=""><h2>${esc(title)}</h2><p>Здесь пока ничего нет. Самое время отвлечься на рекомендации.</p><button data-vl-route="home">Перейти на главную</button></div>`; }
  function comments(video) {
    const rows = [
      ["Дежурный зритель", "Зашёл на пять минут, вышел через час."],
      ["Тот самый коллега", "Смотрю исключительно в образовательных целях."],
      ["Пользователь 4187", `Наконец-то кто-то нормально рассказал про «${video.title.toLowerCase()}».`],
      ["Человек с аватаркой кота", "Алгоритм привёл меня сюда, и я не сопротивлялся."],
      ["Старый подписчик", "Раньше ролики были короче, но чай всё равно остывал."],
      ["Безымянный аккаунт", "Кто тоже смотрит это на работе?" ]
    ];
    return `<section class="vl-comments"><header><h2>${126 + video.order * 7} комментариев</h2><button><img src="${icon("sorting-options")}" alt="">Упорядочить</button></header><div class="vl-comment-form"><div>Д</div><input placeholder="Оставьте комментарий"></div>${rows.map((row, index) => `<article><div>${row[0].slice(0, 1)}</div><section><b>${esc(row[0])} <small>${index + 1} нед. назад</small></b><p>${esc(row[1])}</p><footer><button><img src="${icon("facebook-like", 18)}" alt="">${14 + index * 9}</button><button><img src="${icon("dislike", 18)}" alt=""></button><button>Ответить</button></footer></section></article>`).join("")}</section>`;
  }

  function recommendationFeed(user, category = "all") {
    const watchedCategories = user.videoHistory.map((item) => Pack.VIDEO_BY_ID[item.videoId]?.category).filter(Boolean);
    const categoryScores = watchedCategories.reduce((map, item) => (map[item] = (map[item] || 0) + 1, map), {});
    return Pack.VIDEOS.filter((video) => category === "all" || video.category === category).slice().sort((a, b) => {
      const aScore = (user.subscriptions.includes(a.channelId) ? 20 : 0) + (categoryScores[a.category] || 0) * 3 + (user.likedVideos.includes(a.id) ? -5 : 0) + ((a.order * 17) % 11);
      const bScore = (user.subscriptions.includes(b.channelId) ? 20 : 0) + (categoryScores[b.category] || 0) * 3 + (user.likedVideos.includes(b.id) ? -5 : 0) + ((b.order * 17) % 11);
      return bScore - aScore || a.order - b.order;
    });
  }
  function relatedVideos(video, user) { return Pack.VIDEOS.filter((item) => item.id !== video.id).slice().sort((a, b) => (b.category === video.category ? 10 : 0) + (user.subscriptions.includes(b.channelId) ? 4 : 0) - ((a.category === video.category ? 10 : 0) + (user.subscriptions.includes(a.channelId) ? 4 : 0)) || a.order - b.order); }
  function subscribedChannels(user) { return user.subscriptions.map((id) => Pack.CHANNEL_BY_ID[id]).filter(Boolean); }
  function subscribedVideos(user) { const set = new Set(user.subscriptions); return Pack.VIDEOS.filter((video) => set.has(video.channelId)).slice().sort((a, b) => b.order - a.order); }
  function idsToVideos(ids) { return ids.map((id) => Pack.VIDEO_BY_ID[id]).filter(Boolean); }
  function trendingVideos() { return Pack.VIDEOS.slice().sort((a, b) => ((b.order * 313) % 997) - ((a.order * 313) % 997)); }
  function randomLikes(video) { return `${12 + ((video.order * 37) % 980)} тыс.`; }

  function bind(page, user, route) {
    page.querySelector("[data-vl-menu]")?.addEventListener("click", () => { menuCompact = !menuCompact; render(); });
    page.querySelectorAll("[data-vl-route]").forEach((button) => button.addEventListener("click", () => navigate(routeUrl(button.dataset.vlRoute), routeTitle(button.dataset.vlRoute))));
    page.querySelector("[data-vl-search]")?.addEventListener("submit", (event) => { event.preventDefault(); const q = event.currentTarget.querySelector("input").value.trim(); if (q) navigate(`${ROUTES.search}?q=${encodeURIComponent(q)}`, `${q} — ВидеоЛента`); });
    page.querySelectorAll("[data-vl-category]").forEach((button) => button.addEventListener("click", () => { selectedCategory = button.dataset.vlCategory; visibleCount = 24; render(); }));
    page.querySelector("[data-vl-more]")?.addEventListener("click", () => { visibleCount += 24; render(); });
    page.querySelectorAll("[data-vl-watch]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); openVideo(button.dataset.vlWatch); }));
    page.querySelectorAll("[data-vl-channel]").forEach((button) => button.addEventListener("click", () => openChannel(button.dataset.vlChannel)));
    page.querySelectorAll("[data-vl-subscribe]").forEach((button) => button.addEventListener("click", () => toggleSubscription(button.dataset.vlSubscribe, user)));
    page.querySelectorAll("[data-vl-later]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); toggleList("watchLater", button.dataset.vlLater); }));
    page.querySelectorAll("[data-vl-like]").forEach((button) => button.addEventListener("click", () => toggleList("likedVideos", button.dataset.vlLike)));
    page.querySelectorAll("[data-vl-play]").forEach((button) => button.addEventListener("click", () => playVideo(button.dataset.vlPlay)));
    page.querySelector("[data-vl-autoplay]")?.addEventListener("change", (event) => mutateVideoState((value) => { value.autoplay = event.currentTarget.checked; }, "video-autoplay"));
    page.querySelector("[data-vl-clear-history]")?.addEventListener("click", clearVideoHistory);
    page.querySelector("[data-vl-dismiss-shorts]")?.addEventListener("click", (event) => event.currentTarget.closest(".vl-shorts")?.remove());
    bindImageFallbacks(page);
  }
  function routeTitle(view) { return ({ home: "ВидеоЛента", subscriptions: "Подписки — ВидеоЛента", watchLater: "Смотреть позже — ВидеоЛента", history: "История — ВидеоЛента", liked: "Понравившиеся — ВидеоЛента", trending: "В тренде — ВидеоЛента" })[view] || "ВидеоЛента"; }
  function openVideo(id) { const video = Pack.VIDEO_BY_ID[id]; if (video) { playerState = { videoId: id, played: false }; navigate(`${ROUTES.watch}${id}`, `${video.title} — ВидеоЛента`); } }
  function openChannel(id) { const channel = Pack.CHANNEL_BY_ID[id]; if (channel) navigate(`${ROUTES.channel}${id}`, `${channel.name} — ВидеоЛента`); }
  function toggleSubscription(channelId, user) {
    const exists = user.subscriptions.includes(channelId);
    mutateVideoState((value) => { value.subscriptions = exists ? value.subscriptions.filter((id) => id !== channelId) : [...value.subscriptions, channelId]; }, "video-subscription");
  }
  function toggleList(key, videoId) {
    mutateVideoState((value) => { const exists = value[key].includes(videoId); value[key] = exists ? value[key].filter((id) => id !== videoId) : [...value[key], videoId]; }, `video-${key}`);
  }
  function clearVideoHistory() { mutateVideoState((value) => { value.videoHistory = []; }, "video-history-clear"); }
  function playVideo(videoId) {
    const video = Pack.VIDEO_BY_ID[videoId];
    const state = stateNow();
    if (!video || !state) return;
    const result = Browser.performActivity({
      id: `video-watch-${video.id}-${state.dayIndex}-${state.minute}`,
      once: false,
      minutes: video.minutes,
      label: `Просмотрено видео: ${video.title}`,
      category: "video",
      site: "ВидеоЛента",
      url: `${ROUTES.watch}${video.id}`,
      apply(value, draft) {
        value.watched = unique([...(value.watched || []), video.id]);
        value.videoHistory = [...(Array.isArray(value.videoHistory) ? value.videoHistory : []), { videoId: video.id, dayIndex: draft.dayIndex, minute: draft.minute }].slice(-300);
      }
    });
    if (result?.ok) { playerState = { videoId, played: true }; render(); }
  }
  function bindImageFallbacks(page) {
    page.querySelectorAll("img[data-vl-thumb]").forEach((image) => image.addEventListener("error", () => { image.onerror = null; image.src = FALLBACK_THUMB; image.closest(".vl-thumb")?.classList.add("fallback"); }, { once: true }));
    page.querySelectorAll("img[data-vl-avatar]").forEach((image) => image.addEventListener("error", () => { image.onerror = null; image.src = FALLBACK_AVATAR; }, { once: true }));
    page.querySelectorAll("img[data-vl-banner]").forEach((image) => image.addEventListener("error", () => { image.onerror = null; image.remove(); }, { once: true }));
  }

  function render() {
    queued = false;
    const windowElement = document.querySelector(".personal-browser-window");
    if (!windowElement || !isVideoSite()) {
      if (windowElement) delete windowElement.dataset.videoPlatformActive;
      return;
    }
    const state = stateNow();
    if (!state) return;
    const user = videoState(state);
    const route = parseRoute();
    const page = windowElement.querySelector(".rb-page");
    if (!page) return;
    windowElement.dataset.videoPlatformActive = "true";
    windowElement.querySelector(".window-title").textContent = `${routeTitle(route.view)} — KONTUR Web`;
    windowElement.querySelector(".window-status").textContent = "Защищённое соединение · video.local";
    page.innerHTML = shell(state, user, route);
    bind(page, user, route);
  }
  function schedule() { if (queued) return; queued = true; if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(render); else root.setTimeout?.(render, 0); }

  root.addEventListener?.("until-friday-app-ready", schedule);
  root.addEventListener?.("until-friday-state-change", schedule);
  root.addEventListener?.("until-friday-ui-render", (event) => { if (event.detail?.appId === "browser") schedule(); });
  document.addEventListener("click", (event) => { if (event.target.closest?.(".personal-browser-window")) root.setTimeout?.(schedule, 0); }, true);
  document.addEventListener("submit", (event) => { if (event.target.closest?.(".personal-browser-window")) root.setTimeout?.(schedule, 0); }, true);

  root.UntilFridayVideoPlatformParody = { ROUTES, Pack, videoState, parseRoute, recommendationFeed, relatedVideos, render, schedule };
})(typeof globalThis !== "undefined" ? globalThis : window);
