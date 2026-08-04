(function (root) {
  "use strict";

  const Pack = root.UntilFridayVideoContentPack;
  const Browser = root.UntilFridayPersonalBrowser;
  const Runtime = root.UntilFridayRuntimeEngine;

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

  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const FALLBACK_THUMB = "https://img.icons8.com/fluency/240/video.png";
  const FALLBACK_AVATAR = "https://img.icons8.com/fluency/96/test-account.png";
  const icon = (name, size = 24) => `${ICON_ROOT}/${size}/${name}.png`;

  let selectedCategory = "all";
  let visibleCount = 24;
  let compactMenu = false;
  let playerState = null;

  function dependenciesReady() {
    return Boolean(Pack && Browser && Runtime && Array.isArray(Pack.VIDEOS));
  }

  if (dependenciesReady() && Array.isArray(Browser.VIDEOS)) {
    Browser.VIDEOS.splice(0, Browser.VIDEOS.length, ...Pack.VIDEOS);
  }

  function engine() {
    return Runtime?.getEngine?.() || null;
  }

  function stateNow() {
    return engine()?.getState?.() || null;
  }

  function unique(value) {
    return [...new Set((Array.isArray(value) ? value : []).filter(Boolean))];
  }

  function videoState(state = stateNow()) {
    const source = Browser?.personalState?.(state) || {};
    return {
      ...source,
      watched: unique(source.watched),
      subscriptions: unique(source.subscriptions),
      watchLater: unique(source.watchLater),
      likedVideos: unique(source.likedVideos),
      videoHistory: Array.isArray(source.videoHistory)
        ? source.videoHistory.filter((item) => item && Pack?.VIDEO_BY_ID?.[item.videoId]).slice(-300)
        : [],
      autoplay: source.autoplay !== false
    };
  }

  function mutateVideoState(updater, reason = "video-platform-state") {
    const current = engine();
    if (!current) return { ok: false, reason: "engine-unavailable" };
    const result = current.updateState((draft) => {
      draft.metadata ||= {};
      const value = videoState(draft);
      updater(value, draft);
      draft.metadata.personalBrowser = value;
    }, reason);
    if (result?.ok) render();
    return result;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function browserWindow() {
    return document.querySelector(".personal-browser-window");
  }

  function address() {
    return browserWindow()?.querySelector(".rb-address input")?.value || "";
  }

  function isVideoSite(value = address()) {
    return String(value).toLowerCase().includes("video.local");
  }

  function parseRoute(value = address()) {
    const url = String(value || "");
    if (url.includes("/watch/")) return { view: "watch", id: decodeURIComponent(url.split("/watch/")[1].split(/[?#]/)[0]) };
    if (url.includes("/channel/")) return { view: "channel", id: decodeURIComponent(url.split("/channel/")[1].split(/[?#]/)[0]) };
    if (url.includes("/feed/subscriptions")) return { view: "subscriptions" };
    if (url.includes("/playlist/watch-later")) return { view: "watchLater" };
    if (url.includes("/feed/history")) return { view: "history" };
    if (url.includes("/playlist/liked")) return { view: "liked" };
    if (url.includes("/feed/trending")) return { view: "trending" };
    if (url.includes("/results")) {
      try {
        return { view: "search", query: new URL(url).searchParams.get("q") || "" };
      } catch {
        return { view: "search", query: "" };
      }
    }
    return { view: "home" };
  }

  function navigate(url, title) {
    const ui = root.UntilFridayPersonalBrowserUIV2;
    if (!ui?.navigate) return false;
    ui.navigate("video", { url, title });
    return true;
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

  function routeTitle(view) {
    return {
      home: "ВидеоЛента",
      subscriptions: "Подписки — ВидеоЛента",
      watchLater: "Смотреть позже — ВидеоЛента",
      history: "История — ВидеоЛента",
      liked: "Понравившиеся — ВидеоЛента",
      trending: "В тренде — ВидеоЛента",
      search: "Поиск — ВидеоЛента",
      channel: "Канал — ВидеоЛента",
      watch: "Видео — ВидеоЛента"
    }[view] || "ВидеоЛента";
  }

  function routeButton(view, label, iconName, active, badge = "") {
    return `<button class="vl-side-link ${active ? "active" : ""}" data-vl-route="${view}"><img src="${icon(iconName)}" alt=""><span>${label}</span>${badge ? `<i>${badge}</i>` : ""}</button>`;
  }

  function subscribedChannels(user) {
    return user.subscriptions.map((id) => Pack.CHANNEL_BY_ID[id]).filter(Boolean);
  }

  function subscribedVideos(user) {
    const ids = new Set(user.subscriptions);
    return Pack.VIDEOS.filter((video) => ids.has(video.channelId)).slice().sort((a, b) => b.order - a.order);
  }

  function idsToVideos(ids) {
    return ids.map((id) => Pack.VIDEO_BY_ID[id]).filter(Boolean);
  }

  function trendingVideos() {
    return Pack.VIDEOS.slice().sort((a, b) => ((b.order * 313) % 997) - ((a.order * 313) % 997));
  }

  function recommendationFeed(user, category = "all") {
    const categoryScores = {};
    user.videoHistory.forEach((item) => {
      const categoryId = Pack.VIDEO_BY_ID[item.videoId]?.category;
      if (categoryId) categoryScores[categoryId] = (categoryScores[categoryId] || 0) + 1;
    });
    return Pack.VIDEOS
      .filter((video) => category === "all" || video.category === category)
      .slice()
      .sort((a, b) => {
        const score = (video) =>
          (user.subscriptions.includes(video.channelId) ? 30 : 0) +
          (categoryScores[video.category] || 0) * 5 +
          (user.watched.includes(video.id) ? -8 : 0) +
          ((video.order * 17) % 13);
        return score(b) - score(a) || a.order - b.order;
      });
  }

  function relatedVideos(video, user) {
    return Pack.VIDEOS
      .filter((item) => item.id !== video.id)
      .slice()
      .sort((a, b) => {
        const score = (item) =>
          (item.category === video.category ? 20 : 0) +
          (item.channelId === video.channelId ? 8 : 0) +
          (user.subscriptions.includes(item.channelId) ? 4 : 0);
        return score(b) - score(a) || a.order - b.order;
      });
  }

  function videoThumb(video, mode = "grid") {
    return `<div class="vl-thumb ${mode}" data-vl-open="${video.id}"><img src="${video.thumbnail}" data-vl-thumb alt="${esc(video.title)}"><time>${esc(video.duration)}</time><span class="vl-thumb-hover"><img src="${icon("play")}" alt=""></span></div>`;
  }

  function videoCard(video, user) {
    const channel = Pack.CHANNEL_BY_ID[video.channelId];
    if (!channel) return "";
    const later = user.watchLater.includes(video.id);
    return `<article class="vl-video-card">${videoThumb(video)}<button class="vl-card-menu" data-vl-later="${video.id}" title="${later ? "Удалить из Смотреть позже" : "Смотреть позже"}"><img src="${icon(later ? "checked-checkbox" : "clock")}" alt=""></button><div><button class="vl-avatar-button" data-vl-channel="${channel.id}"><img src="${channel.avatar}" data-vl-avatar alt=""></button><section><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><button class="vl-channel-name" data-vl-channel="${channel.id}">${esc(channel.name)} ${channel.verified ? "✓" : ""}</button><p>${esc(video.views)} · ${esc(video.published)}</p></section><button class="vl-dots"><img src="${icon("menu-2")}" alt=""></button></div></article>`;
  }

  function shortCard(video) {
    return `<article class="vl-short-card"><button data-vl-watch="${video.id}"><div class="vl-short-thumb"><img src="${video.thumbnail}" data-vl-thumb alt="${esc(video.title)}"><time>${esc(video.duration)}</time></div><h3>${esc(video.title)}</h3><p>${esc(video.views)}</p></button></article>`;
  }

  function listVideo(video, user, index) {
    return `<article class="vl-list-video"><span>${index}</span>${videoThumb(video, "list")}<section><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><p>${esc(video.channelName)} · ${esc(video.views)} · ${esc(video.published)}</p></section><button data-vl-later="${video.id}"><img src="${icon(user.watchLater.includes(video.id) ? "checked-checkbox" : "clock")}" alt=""></button><button><img src="${icon("menu-2")}" alt=""></button></article>`;
  }

  function relatedCard(video) {
    return `<article class="vl-related-card">${videoThumb(video, "related")}<section><h3><button data-vl-watch="${video.id}">${esc(video.title)}</button></h3><button data-vl-channel="${video.channelId}">${esc(video.channelName)}</button><p>${esc(video.views)} · ${esc(video.published)}</p></section></article>`;
  }

  function emptyCollection(title, text = "Здесь пока ничего нет.") {
    return `<div class="vl-empty"><img src="${icon("video", 90)}" alt=""><h2>${esc(title)}</h2><p>${esc(text)}</p><button data-vl-route="home">Перейти на главную</button></div>`;
  }

  function homePage(user) {
    const all = recommendationFeed(user, selectedCategory);
    const recommendations = all.slice(0, visibleCount);
    const shorts = Pack.VIDEOS.filter((video) => video.channelId === "short-weird");
    return `<div class="vl-feed-page"><div class="vl-chips">${Object.entries(Pack.CATEGORY_LABELS).map(([id, label]) => `<button data-vl-category="${id}" class="${selectedCategory === id ? "active" : ""}">${esc(label)}</button>`).join("")}</div><section class="vl-feed-grid">${recommendations.slice(0, 12).map((video) => videoCard(video, user)).join("")}</section><section class="vl-shorts"><header><div><img src="${icon("youtube-shorts", 28)}" alt=""><h2>Короткие</h2></div><button data-vl-dismiss-shorts><img src="${icon("delete-sign")}" alt=""></button></header><div>${shorts.map(shortCard).join("")}</div></section><section class="vl-feed-grid">${recommendations.slice(12).map((video) => videoCard(video, user)).join("")}</section>${visibleCount < all.length ? `<button class="vl-load-more" data-vl-more>Показать ещё</button>` : ""}</div>`;
  }

  function collectionPage(user, title, videos, subtitle, type) {
    const coverIcon = type === "watchLater" ? "clock" : type === "liked" ? "facebook-like" : type === "subscriptions" ? "video-playlist" : "fire-element";
    return `<section class="vl-collection"><header><div class="vl-collection-cover"><img src="${icon(coverIcon, 64)}" alt=""></div><div><small>ВидеоЛента</small><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><b>${videos.length} видео</b></div></header>${videos.length ? `<div class="vl-list-layout">${videos.map((video, index) => listVideo(video, user, index + 1)).join("")}</div>` : emptyCollection(title)}</section>`;
  }

  function historyPage(user) {
    const rows = user.videoHistory.slice().reverse();
    return `<section class="vl-history"><header><div><h1>История просмотра</h1><p>${rows.length} записей в этом профиле</p></div><button data-vl-clear-history><img src="${icon("trash")}" alt="">Очистить историю</button></header>${rows.length ? `<div>${rows.map((row) => {
      const video = Pack.VIDEO_BY_ID[row.videoId];
      if (!video) return "";
      return `<article>${videoThumb(video, "list")}<section><small>День ${Number(row.dayIndex || 0) + 1}</small><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><p>${esc(video.channelName)} · ${esc(video.views)}</p></section></article>`;
    }).join("")}</div>` : emptyCollection("История пуста")}</section>`;
  }

  function searchPage(user, query) {
    const needle = String(query || "").trim().toLowerCase();
    const videos = Pack.VIDEOS.filter((video) => `${video.title} ${video.channelName} ${Pack.CATEGORY_LABELS[video.category]}`.toLowerCase().includes(needle));
    const channels = Pack.CHANNELS.filter((channel) => `${channel.name} ${channel.description}`.toLowerCase().includes(needle));
    return `<section class="vl-results"><header><h1>Результаты поиска</h1><button><img src="${icon("filter")}" alt="">Фильтры</button></header>${channels.map((channel) => `<article class="vl-channel-result"><img src="${channel.avatar}" data-vl-avatar alt=""><section><h2><button data-vl-channel="${channel.id}">${esc(channel.name)}</button></h2><p>${esc(channel.subscribers)} подписчиков · ${channel.videos.length} видео</p><span>${esc(channel.description)}</span></section><button data-vl-subscribe="${channel.id}">${user.subscriptions.includes(channel.id) ? "Вы подписаны" : "Подписаться"}</button></article>`).join("")}${videos.map((video) => `<article class="vl-search-video">${videoThumb(video, "search")}<section><h2><button data-vl-watch="${video.id}">${esc(video.title)}</button></h2><p>${esc(video.views)} · ${esc(video.published)}</p><button data-vl-channel="${video.channelId}">${esc(video.channelName)}</button><span>${esc(video.description)}</span></section></article>`).join("") || emptyCollection(`По запросу «${query}» ничего не найдено`)}</section>`;
  }

  function channelPage(user, channelId) {
    const channel = Pack.CHANNEL_BY_ID[channelId];
    if (!channel) return emptyCollection("Канал не найден");
    const subscribed = user.subscriptions.includes(channel.id);
    return `<section class="vl-channel"><div class="vl-channel-banner"><img src="${channel.banner}" data-vl-banner alt=""></div><header><img src="${channel.avatar}" data-vl-avatar alt=""><div><h1>${esc(channel.name)} ${channel.verified ? "✓" : ""}</h1><p>@${esc(channel.id)} · ${esc(channel.subscribers)} подписчиков · ${channel.videos.length} видео</p><span>${esc(channel.description)}</span></div><button class="${subscribed ? "subscribed" : ""}" data-vl-subscribe="${channel.id}">${subscribed ? "Вы подписаны" : "Подписаться"}</button></header><nav><button class="active">Главная</button><button>Видео</button><button>Плейлисты</button><button>Сообщество</button><button>О канале</button></nav><main><h2>Последние видео</h2><div class="vl-feed-grid">${channel.videos.map((video) => videoCard(video, user)).join("")}</div></main></section>`;
  }

  function comments(video) {
    const rows = [
      ["Дежурный зритель", "Зашёл на пять минут, вышел через час."],
      ["Тот самый коллега", "Смотрю исключительно в образовательных целях."],
      ["Пользователь 4187", `Наконец-то кто-то нормально рассказал про «${video.title.toLowerCase()}».`],
      ["Человек с аватаркой кота", "Алгоритм привёл меня сюда, и я не сопротивлялся."]
    ];
    return `<section class="vl-comments"><header><h2>${126 + video.order * 7} комментариев</h2><button><img src="${icon("sorting-options")}" alt="">Упорядочить</button></header><div class="vl-comment-form"><div>Д</div><input placeholder="Оставьте комментарий"></div>${rows.map(([name, text], index) => `<article><div>${esc(name.slice(0, 1))}</div><section><b>${esc(name)} <small>${index + 1} нед. назад</small></b><p>${esc(text)}</p><footer><button><img src="${icon("facebook-like", 18)}" alt="">${14 + index * 9}</button><button>Ответить</button></footer></section></article>`).join("")}</section>`;
  }

  function watchPage(user, videoId) {
    const video = Pack.VIDEO_BY_ID[videoId];
    if (!video) return emptyCollection("Видео не найдено");
    const channel = Pack.CHANNEL_BY_ID[video.channelId];
    if (!channel) return emptyCollection("Канал видео не найден");
    const liked = user.likedVideos.includes(video.id);
    const later = user.watchLater.includes(video.id);
    const subscribed = user.subscriptions.includes(channel.id);
    const played = playerState?.videoId === video.id && playerState.played;
    const recommendations = relatedVideos(video, user).slice(0, 14);
    return `<section class="vl-watch-page"><div class="vl-watch-main"><div class="vl-player ${played ? "finished" : ""}"><img class="vl-player-image" src="${video.thumbnail}" data-vl-thumb alt="${esc(video.title)}"><button class="vl-play" data-vl-play="${video.id}"><img src="${icon(played ? "replay" : "play", 64)}" alt=""></button><div class="vl-player-controls"><button data-vl-play="${video.id}"><img src="${icon(played ? "replay" : "play", 23)}" alt=""></button><span>${played ? esc(video.duration) : "0:00"} / ${esc(video.duration)}</span><div><i style="width:${played ? 100 : 0}%"></i></div><button><img src="${icon("settings")}" alt=""></button><button><img src="${icon("full-screen")}" alt=""></button></div></div><h1>${esc(video.title)}</h1><div class="vl-video-actions"><button class="vl-channel-inline" data-vl-channel="${channel.id}"><img src="${channel.avatar}" data-vl-avatar alt=""><span><b>${esc(channel.name)}</b><small>${esc(channel.subscribers)} подписчиков</small></span></button><button class="vl-subscribe ${subscribed ? "subscribed" : ""}" data-vl-subscribe="${channel.id}">${subscribed ? "Вы подписаны" : "Подписаться"}</button><div class="vl-action-spacer"></div><button class="${liked ? "active" : ""}" data-vl-like="${video.id}"><img src="${icon("facebook-like")}" alt="">Нравится</button><button><img src="${icon("share")}" alt="">Поделиться</button><button class="${later ? "active" : ""}" data-vl-later="${video.id}"><img src="${icon("clock")}" alt="">${later ? "Сохранено" : "Сохранить"}</button></div><section class="vl-description"><b>${esc(video.views)}　${esc(video.published)}</b><p>${esc(video.description)}</p></section>${comments(video)}</div><aside class="vl-related"><header><b>Следующее</b><label>Автовоспроизведение <input type="checkbox" data-vl-autoplay ${user.autoplay ? "checked" : ""}></label></header>${recommendations.map(relatedCard).join("")}</aside></section>`;
  }

  function content(user, route) {
    if (route.view === "watch") return watchPage(user, route.id);
    if (route.view === "channel") return channelPage(user, route.id);
    if (route.view === "subscriptions") return collectionPage(user, "Подписки", subscribedVideos(user), "Новые видео каналов, на которые вы подписаны.", "subscriptions");
    if (route.view === "watchLater") return collectionPage(user, "Смотреть позже", idsToVideos(user.watchLater), "Сохранённые ролики для спокойного рабочего момента.", "watchLater");
    if (route.view === "history") return historyPage(user);
    if (route.view === "liked") return collectionPage(user, "Понравившиеся", idsToVideos(user.likedVideos), "Все ролики, которым вы поставили отметку «Нравится».", "liked");
    if (route.view === "trending") return collectionPage(user, "В тренде", trendingVideos(), "То, что сегодня обсуждают все, кроме вашего отдела.", "trending");
    if (route.view === "search") return searchPage(user, route.query);
    return homePage(user);
  }

  function shell(user, route) {
    return `<section class="vl-app ${compactMenu ? "compact-menu" : ""}"><header class="vl-topbar"><button class="vl-icon-button" data-vl-menu><img src="${icon("menu")}" alt=""></button><button class="vl-logo" data-vl-route="home"><span><img src="${icon("play-button-circled", 28)}" alt=""></span><b>ВидеоЛента</b><small>RU</small></button><form class="vl-search" data-vl-search><input value="${route.view === "search" ? esc(route.query) : ""}" placeholder="Введите запрос"><button><img src="${icon("search")}" alt=""></button></form><button class="vl-mic vl-icon-button"><img src="${icon("microphone")}" alt=""></button><div class="vl-top-actions"><button class="vl-icon-button"><img src="${icon("video-call")}" alt=""></button><button class="vl-icon-button"><img src="${icon("appointment-reminders")}" alt=""></button><button class="vl-profile">Д</button></div></header><aside class="vl-sidebar"><nav>${routeButton("home", "Главная", "home", route.view === "home")}${routeButton("trending", "В тренде", "fire-element", route.view === "trending")}${routeButton("subscriptions", "Подписки", "video-playlist", route.view === "subscriptions", user.subscriptions.length || "")}</nav><hr><nav>${routeButton("history", "История", "time-machine", route.view === "history")}${routeButton("watchLater", "Смотреть позже", "clock", route.view === "watchLater", user.watchLater.length || "")}${routeButton("liked", "Понравившиеся", "facebook-like", route.view === "liked", user.likedVideos.length || "")}</nav><hr><section class="vl-sub-list"><h3>Подписки</h3>${subscribedChannels(user).slice(0, 7).map((channel) => `<button data-vl-channel="${channel.id}"><img src="${channel.avatar}" data-vl-avatar alt=""><span>${esc(channel.name)}</span></button>`).join("") || `<p>Здесь появятся каналы, на которые вы подпишетесь.</p>`}</section><footer>О сервисе　Авторам<br>Условия　Конфиденциальность<br><small>© 2026 ВидеоЛента</small></footer></aside><main class="vl-content">${content(user, route)}</main></section>`;
  }

  function toggleList(key, videoId) {
    mutateVideoState((value) => {
      const exists = value[key].includes(videoId);
      value[key] = exists ? value[key].filter((id) => id !== videoId) : [...value[key], videoId];
    }, `video-${key}`);
  }

  function toggleSubscription(channelId) {
    mutateVideoState((value) => {
      const exists = value.subscriptions.includes(channelId);
      value.subscriptions = exists
        ? value.subscriptions.filter((id) => id !== channelId)
        : [...value.subscriptions, channelId];
    }, "video-subscription");
  }

  function clearVideoHistory() {
    mutateVideoState((value) => { value.videoHistory = []; }, "video-history-clear");
  }

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
        value.videoHistory = [...(Array.isArray(value.videoHistory) ? value.videoHistory : []), {
          videoId: video.id,
          dayIndex: draft.dayIndex,
          minute: draft.minute
        }].slice(-300);
      }
    });
    if (result?.ok) {
      playerState = { videoId, played: true };
      render();
    }
  }

  function bind(page, user) {
    page.querySelector("[data-vl-menu]")?.addEventListener("click", () => { compactMenu = !compactMenu; render(); });
    page.querySelectorAll("[data-vl-route]").forEach((button) => button.addEventListener("click", () => navigate(routeUrl(button.dataset.vlRoute), routeTitle(button.dataset.vlRoute))));
    page.querySelector("[data-vl-search]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = event.currentTarget.querySelector("input")?.value.trim() || "";
      if (query) navigate(`${ROUTES.search}?q=${encodeURIComponent(query)}`, `${query} — ВидеоЛента`);
    });
    page.querySelectorAll("[data-vl-category]").forEach((button) => button.addEventListener("click", () => { selectedCategory = button.dataset.vlCategory; visibleCount = 24; render(); }));
    page.querySelector("[data-vl-more]")?.addEventListener("click", () => { visibleCount += 24; render(); });
    page.querySelectorAll("[data-vl-watch], [data-vl-open]").forEach((element) => element.addEventListener("click", () => {
      const id = element.dataset.vlWatch || element.dataset.vlOpen;
      const video = Pack.VIDEO_BY_ID[id];
      if (video) navigate(`${ROUTES.watch}${video.id}`, `${video.title} — ВидеоЛента`);
    }));
    page.querySelectorAll("[data-vl-channel]").forEach((button) => button.addEventListener("click", () => {
      const channel = Pack.CHANNEL_BY_ID[button.dataset.vlChannel];
      if (channel) navigate(`${ROUTES.channel}${channel.id}`, `${channel.name} — ВидеоЛента`);
    }));
    page.querySelectorAll("[data-vl-subscribe]").forEach((button) => button.addEventListener("click", () => toggleSubscription(button.dataset.vlSubscribe)));
    page.querySelectorAll("[data-vl-later]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); toggleList("watchLater", button.dataset.vlLater); }));
    page.querySelectorAll("[data-vl-like]").forEach((button) => button.addEventListener("click", () => toggleList("likedVideos", button.dataset.vlLike)));
    page.querySelectorAll("[data-vl-play]").forEach((button) => button.addEventListener("click", () => playVideo(button.dataset.vlPlay)));
    page.querySelector("[data-vl-clear-history]")?.addEventListener("click", clearVideoHistory);
    page.querySelector("[data-vl-autoplay]")?.addEventListener("change", (event) => mutateVideoState((value) => { value.autoplay = event.currentTarget.checked; }, "video-autoplay"));
    page.querySelector("[data-vl-dismiss-shorts]")?.addEventListener("click", (event) => event.currentTarget.closest(".vl-shorts")?.remove());
    page.querySelectorAll("img[data-vl-thumb]").forEach((image) => image.addEventListener("error", () => { image.onerror = null; image.src = FALLBACK_THUMB; }, { once: true }));
    page.querySelectorAll("img[data-vl-avatar]").forEach((image) => image.addEventListener("error", () => { image.onerror = null; image.src = FALLBACK_AVATAR; }, { once: true }));
    page.querySelectorAll("img[data-vl-banner]").forEach((image) => image.addEventListener("error", () => image.remove(), { once: true }));
  }

  function renderFailure(page, error) {
    page.innerHTML = `<section class="vl-empty"><img src="${icon("error", 90)}" alt=""><h2>ВидеоЛента не смогла загрузиться</h2><p>${esc(error?.message || "Неизвестная ошибка")}</p><button data-vl-retry>Повторить</button></section>`;
    page.querySelector("[data-vl-retry]")?.addEventListener("click", render);
    root.console?.error?.("VideoLenta render failed", error);
  }

  function render() {
    const windowElement = browserWindow();
    if (!windowElement || !isVideoSite()) return false;
    const page = windowElement.querySelector(".rb-page");
    if (!page) return false;

    if (!dependenciesReady()) {
      renderFailure(page, new Error("Модуль контента не загружен"));
      return false;
    }

    try {
      const state = stateNow();
      if (!state) throw new Error("Состояние игры недоступно");
      const user = videoState(state);
      const route = parseRoute();
      windowElement.dataset.videoPlatformActive = "true";
      delete windowElement.dataset.marketplaceActive;
      windowElement.querySelector(".window-title").textContent = `${routeTitle(route.view)} — KONTUR Web`;
      windowElement.querySelector(".window-status").textContent = "Защищённое соединение · video.local";
      page.innerHTML = shell(user, route);
      bind(page, user);
      return true;
    } catch (error) {
      renderFailure(page, error);
      return false;
    }
  }

  function schedule() {
    return render();
  }

  root.UntilFridayVideoPlatformParody = {
    ROUTES,
    Pack,
    videoState,
    parseRoute,
    recommendationFeed,
    relatedVideos,
    render,
    schedule
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
