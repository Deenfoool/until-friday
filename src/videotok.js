(function (root) {
  "use strict";

  if (root.UntilFridayVideotok) return;

  const Browser = root.UntilFridayPersonalBrowser;
  const ICON = "https://img.icons8.com/fluency-systems-regular";
  const icon = (name, size = 24) => `${ICON}/${size}/${name}.png`;
  const FALLBACK_THUMB = "https://img.icons8.com/fluency/240/video.png";

  const CATEGORY_LABELS = {
    all: "Все",
    games: "Игры",
    auto: "Авто",
    tech: "Технологии",
    office: "Работа",
    diy: "Ремонт",
    music: "Музыка",
    food: "Кулинария",
    mystery: "Мистика",
    podcasts: "Подкасты",
    humor: "Юмор",
    life: "Люди"
  };

  const CHANNEL_SEEDS = [
    ["byte-yard", "Байт на районе", "tech", "1,18 млн", [
      ["Ноутбук шумит, хотя ничего не запущено", "09:12", 10],
      ["Собираем компьютер из списанного офиса", "21:48", 22],
      ["Пять настроек Windows, которые реально помогают", "12:07", 13],
      ["Телефон за 15 тысяч спустя год", "14:33", 15],
      ["Почему дешёвый SSD иногда быстрее дорогого", "17:02", 18],
      ["Клавиатура, которую не слышно начальнику", "08:46", 9]
    ]],
    ["garage-talk", "Гаражный разговор", "auto", "742 тыс.", [
      ["Лада после 30 тысяч: что уже попросилось в ремонт", "22:14", 23],
      ["Почему машина дёргается на холодную", "13:25", 14],
      ["Меняем масло во дворе и ничего не роняем", "19:08", 20],
      ["Самая дешёвая магнитола: месяц спустя", "16:41", 17],
      ["Что всегда лежит у меня в багажнике", "10:03", 11],
      ["Bluetooth отваливается каждые полчаса", "11:56", 12]
    ]],
    ["cube-shift", "Кубическая смена", "games", "986 тыс.", [
      ["Выкопал целый чанк и понял, что плана нет", "25:19", 26],
      ["Create, AE2 и PneumaticCraft в одной базе", "32:04", 33],
      ["Сборка на 180 модов всё-таки запустилась", "18:26", 19],
      ["Строим железнодорожное депо на семь поездов", "27:10", 28],
      ["Дрон должен был перенести вещи. Должен был", "15:07", 16],
      ["Украшаем четыре технических коридора", "20:44", 21]
    ]],
    ["office-fog", "Офисный туман", "office", "493 тыс.", [
      ["Начальник написал «зайди». Что теперь", "06:11", 7],
      ["Как смотреть в таблицу и выглядеть занятым", "08:35", 9],
      ["Пятница 16:57: пришла новая задача", "07:42", 8],
      ["Коллега снова ответил всем", "09:49", 10],
      ["Самые странные фразы из рабочей почты", "11:16", 12],
      ["Принтер выбрал нас своей жертвой", "05:58", 6]
    ]],
    ["hands-home", "Руки из дома", "diy", "1,03 млн", [
      ["Регулируем входную дверь за пятнадцать минут", "12:31", 13],
      ["Бюджетная кухня своими руками", "28:05", 29],
      ["Как клеить обои на кривые стены", "20:17", 21],
      ["Почему течёт сифон и как его победить", "10:52", 11],
      ["Собираем шкаф без инструкции", "23:46", 24],
      ["Жалюзи, вытяжка и маленькая кухня", "17:38", 18]
    ]],
    ["night-file", "Ночной файл", "mystery", "2,21 млн", [
      ["Папка вернулась после удаления", "20:42", 21],
      ["Запись с камеры, которой нет на плане", "18:55", 19],
      ["Звонок с отключённого офисного номера", "16:14", 17],
      ["Шестой рабочий день появился в журнале", "23:09", 24],
      ["Последний сотрудник покинул этаж в 19:12", "29:03", 30],
      ["Компьютер включился сам после полуночи", "14:47", 15]
    ]],
    ["loud-quiet", "Громкая тишина", "music", "3,62 млн", [
      ["Ночной город: синтвейв для дороги домой", "42:18", 36],
      ["Музыка для последнего часа смены", "27:00", 22],
      ["Дождь и старый кассетный магнитофон", "58:46", 41],
      ["Живой сет в пустом офисе", "36:29", 33],
      ["Плейлист для папки «Загрузки»", "49:12", 39],
      ["Тихий гараж после дождя", "33:54", 30]
    ]],
    ["simple-pan", "Простая сковорода", "food", "803 тыс.", [
      ["Ужин после работы из четырёх продуктов", "09:57", 10],
      ["Шаурма дома без сложного оборудования", "14:08", 15],
      ["Три завтрака для тех, кто не проснулся", "08:21", 9],
      ["Картошка, с которой невозможно поссориться", "11:49", 12],
      ["Готовим на неделю и съедаем во вторник", "18:30", 19],
      ["Кофе три в одном: слепая дегустация", "07:44", 8]
    ]],
    ["long-talk", "Длинный разговор", "podcasts", "517 тыс.", [
      ["Почему люди остаются на нелюбимой работе", "1:12:40", 44],
      ["Переезд, ремонт и свадьба одновременно", "58:22", 41],
      ["Сколько стоит своё маленькое дело", "1:26:15", 46],
      ["Можно ли отдыхать, когда всё не закончено", "47:33", 39],
      ["Как меняется дружба после двадцати", "1:03:18", 43],
      ["Почему деньги исчезают до зарплаты", "54:05", 40]
    ]],
    ["district-frame", "Кадры района", "life", "861 тыс.", [
      ["Посёлок, выросший вокруг одного завода", "26:13", 27],
      ["Последняя смена старого депо", "31:42", 32],
      ["Сельский магазин: день без монтажа", "20:11", 21],
      ["Дом культуры снова открылся", "28:36", 29],
      ["Дорога длиной в сорок лет", "34:48", 35],
      ["Один день сезонной работы", "24:27", 25]
    ]],
    ["short-circuit", "Короткое замыкание", "humor", "2,91 млн", [
      ["Кот проводит планёрку", "00:51", 2],
      ["Принтер понял, что сегодня пятница", "00:38", 2],
      ["Когда случайно включил микрофон", "00:44", 2],
      ["Курьер нашёл офис с первого раза", "00:29", 2],
      ["Таблица сама посчитала правильно", "00:33", 2],
      ["Начальник вышел из чата", "00:47", 2]
    ]],
    ["second-hand", "Без переплаты", "tech", "633 тыс.", [
      ["Проверяем подержанный телефон", "14:56", 15],
      ["Наушники до пяти тысяч", "18:03", 19],
      ["Что скрывают объявления о ноутбуках", "13:22", 14],
      ["Маркетплейс прислал не тот товар", "10:38", 11],
      ["Кресло за семь против кресла за тридцать", "22:15", 23],
      ["Как не купить убитый аккумулятор", "12:48", 13]
    ]]
  ];

  let count = 0;
  const CHANNELS = CHANNEL_SEEDS.map((seed, channelIndex) => {
    const channel = {
      id: seed[0],
      name: seed[1],
      category: seed[2],
      subscribers: seed[3],
      avatar: `assets/videotok/channels/channel-${String(channelIndex + 1).padStart(3, "0")}.webp`
    };
    channel.videos = seed[4].map((row) => {
      count += 1;
      return {
        id: `vt-${String(count).padStart(3, "0")}`,
        title: row[0],
        duration: row[1],
        minutes: row[2],
        channelId: channel.id,
        channelName: channel.name,
        category: channel.category,
        thumbnail: `assets/videotok/thumbs/video-${String(count).padStart(3, "0")}.webp`,
        views: `${91 + ((count * 137) % 890)} тыс. просмотров`,
        published: `${1 + ((count * 7) % 28)} дн. назад`
      };
    });
    return channel;
  });

  const VIDEOS = CHANNELS.flatMap((channel) => channel.videos);
  const VIDEO_BY_ID = Object.fromEntries(VIDEOS.map((video) => [video.id, video]));
  const CHANNEL_BY_ID = Object.fromEntries(CHANNELS.map((channel) => [channel.id, channel]));
  const ROUTES = {
    home: "https://videotok.local/",
    trending: "https://videotok.local/trending",
    subscriptions: "https://videotok.local/subscriptions",
    history: "https://videotok.local/history",
    later: "https://videotok.local/watch-later",
    liked: "https://videotok.local/liked",
    search: "https://videotok.local/search",
    watch: "https://videotok.local/watch/",
    channel: "https://videotok.local/channel/"
  };

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(personal) {
    const source = personal?.videotok && typeof personal.videotok === "object" ? personal.videotok : {};
    const unique = (value) => [...new Set(Array.isArray(value) ? value.filter(Boolean) : [])];
    return {
      subscriptions: unique(source.subscriptions),
      later: unique(source.later),
      liked: unique(source.liked),
      history: Array.isArray(source.history) ? source.history.filter((item) => item && VIDEO_BY_ID[item.videoId]).slice(-300) : [],
      watched: unique(source.watched)
    };
  }

  function parse(url) {
    const value = String(url || "");
    if (value.includes("/watch/")) return { view: "watch", id: value.split("/watch/")[1].split(/[?#]/)[0] };
    if (value.includes("/channel/")) return { view: "channel", id: value.split("/channel/")[1].split(/[?#]/)[0] };
    if (value.includes("/trending")) return { view: "trending" };
    if (value.includes("/subscriptions")) return { view: "subscriptions" };
    if (value.includes("/history")) return { view: "history" };
    if (value.includes("/watch-later")) return { view: "later" };
    if (value.includes("/liked")) return { view: "liked" };
    if (value.includes("/search")) {
      try { return { view: "search", query: new URL(value).searchParams.get("q") || "" }; }
      catch { return { view: "search", query: "" }; }
    }
    return { view: "home" };
  }

  function thumb(video, className = "") {
    return `<div class="vtk-thumb ${className}"><img src="${video.thumbnail}" data-vtk-thumb alt=""><span class="vtk-play"><img src="${icon("play", 42)}" alt=""></span><time>${esc(video.duration)}</time></div>`;
  }

  function videoCard(video, state) {
    const later = state.later.includes(video.id);
    return `<article class="vtk-card"><button class="vtk-card-open" data-vtk-watch="${video.id}">${thumb(video)}<section><div class="vtk-avatar-letter">${esc(video.channelName.slice(0, 1))}</div><div><h3>${esc(video.title)}</h3><span class="vtk-channel-link" data-vtk-channel="${video.channelId}">${esc(video.channelName)}</span><p>${esc(video.views)} · ${esc(video.published)}</p></div></section></button><button class="vtk-later ${later ? "active" : ""}" data-vtk-later="${video.id}" title="Смотреть позже"><img src="${icon(later ? "checked-checkbox" : "clock")}" alt=""></button></article>`;
  }

  function sidebar(route, state) {
    const link = (view, label, iconName, badge = "") => `<button data-vtk-route="${view}" class="${route.view === view ? "active" : ""}"><img src="${icon(iconName)}" alt=""><span>${label}</span>${badge ? `<i>${badge}</i>` : ""}</button>`;
    return `<aside class="vtk-sidebar"><nav>${link("home", "Главная", "home")}${link("trending", "В тренде", "fire-element")}${link("subscriptions", "Подписки", "video-playlist", state.subscriptions.length || "")}</nav><hr><nav>${link("history", "История", "time-machine", state.history.length || "")}${link("later", "Смотреть позже", "clock", state.later.length || "")}${link("liked", "Понравившиеся", "facebook-like", state.liked.length || "")}</nav><hr><h4>Подписки</h4>${state.subscriptions.slice(0, 6).map((id) => CHANNEL_BY_ID[id]).filter(Boolean).map((channel) => `<button data-vtk-channel="${channel.id}"><span class="vtk-mini-avatar">${esc(channel.name.slice(0, 1))}</span><span>${esc(channel.name)}</span></button>`).join("") || `<p>Подписки появятся здесь.</p>`}<footer>О сервисе · Авторам<br>Правила · Конфиденциальность<br><small>© 2026 Видеоток</small></footer></aside>`;
  }

  function header(route) {
    return `<header class="vtk-top"><button class="vtk-menu" data-vtk-menu><img src="${icon("menu")}" alt=""></button><button class="vtk-logo" data-vtk-route="home"><span><img src="${icon("play-button-circled", 30)}" alt=""></span><b>Видеоток</b><small>RU</small></button><form data-vtk-search><input value="${route.view === "search" ? esc(route.query) : ""}" placeholder="Введите запрос"><button><img src="${icon("search")}" alt=""></button></form><button class="vtk-mic"><img src="${icon("microphone")}" alt=""></button><div class="vtk-user-actions"><button><img src="${icon("video-call")}" alt=""></button><button><img src="${icon("appointment-reminders")}" alt=""></button><span>Д</span></div></header>`;
  }

  function feed(videos, state, title = "") {
    return `${title ? `<header class="vtk-page-title"><h1>${esc(title)}</h1><span>${videos.length} видео</span></header>` : ""}<div class="vtk-grid">${videos.map((video) => videoCard(video, state)).join("") || `<div class="vtk-empty"><h2>Здесь пока пусто</h2><p>Откройте главную и найдите что-нибудь интересное.</p><button data-vtk-route="home">На главную</button></div>`}</div>`;
  }

  function home(state, selectedCategory) {
    const list = selectedCategory === "all" ? VIDEOS : VIDEOS.filter((video) => video.category === selectedCategory);
    return `<div class="vtk-chips">${Object.entries(CATEGORY_LABELS).map(([id, label]) => `<button data-vtk-category="${id}" class="${selectedCategory === id ? "active" : ""}">${label}</button>`).join("")}</div>${feed(list, state)}`;
  }

  function watch(video, state) {
    if (!video) return `<div class="vtk-empty"><h2>Ролик не найден</h2><button data-vtk-route="home">На главную</button></div>`;
    const channel = CHANNEL_BY_ID[video.channelId];
    const related = VIDEOS.filter((item) => item.id !== video.id).sort((a, b) => Number(b.category === video.category) - Number(a.category === video.category)).slice(0, 12);
    return `<div class="vtk-watch"><main><div class="vtk-player">${thumb(video, "player")}<button data-vtk-play="${video.id}"><img src="${icon("play", 64)}" alt=""><span>Воспроизвести</span></button><div class="vtk-controls"><span></span><small>00:00 / ${esc(video.duration)}</small></div></div><h1>${esc(video.title)}</h1><div class="vtk-watch-actions"><button data-vtk-channel="${channel.id}" class="vtk-author"><span>${esc(channel.name.slice(0, 1))}</span><div><b>${esc(channel.name)}</b><small>${esc(channel.subscribers)} подписчиков</small></div></button><button data-vtk-subscribe="${channel.id}" class="${state.subscriptions.includes(channel.id) ? "active" : ""}">${state.subscriptions.includes(channel.id) ? "Вы подписаны" : "Подписаться"}</button><button data-vtk-like="${video.id}" class="${state.liked.includes(video.id) ? "active" : ""}"><img src="${icon("facebook-like")}" alt="">Нравится</button><button data-vtk-later="${video.id}" class="${state.later.includes(video.id) ? "active" : ""}"><img src="${icon("clock")}" alt="">Смотреть позже</button></div><section class="vtk-description"><b>${esc(video.views)} · ${esc(video.published)}</b><p>Новый выпуск канала «${esc(channel.name)}». Описание автор обещал дописать после работы.</p></section><section class="vtk-comments"><h2>Комментарии</h2>${["Наконец-то нормальное объяснение.", "Смотрю это вместо работы.", "Автор, сделай продолжение.", "У меня было ровно так же."].map((text, index) => `<article><span>${["А", "М", "И", "К"][index]}</span><div><b>@пользователь${index + 17}</b><p>${text}</p></div></article>`).join("")}</section></main><aside><h2>Следующие видео</h2>${related.map((item) => `<button data-vtk-watch="${item.id}">${thumb(item, "small")}<div><b>${esc(item.title)}</b><small>${esc(item.channelName)}</small><span>${esc(item.views)}</span></div></button>`).join("")}</aside></div>`;
  }

  function channelPage(channel, state) {
    if (!channel) return `<div class="vtk-empty"><h2>Канал не найден</h2></div>`;
    const subscribed = state.subscriptions.includes(channel.id);
    return `<section class="vtk-channel"><div class="vtk-banner"><span>${esc(channel.name)}</span></div><header><div class="vtk-channel-avatar">${esc(channel.name.slice(0, 1))}</div><div><h1>${esc(channel.name)}</h1><p>${esc(channel.subscribers)} подписчиков · ${channel.videos.length} видео</p></div><button data-vtk-subscribe="${channel.id}" class="${subscribed ? "active" : ""}">${subscribed ? "Вы подписаны" : "Подписаться"}</button></header><nav><button class="active">Главная</button><button>Видео</button><button>Плейлисты</button><button>О канале</button></nav>${feed(channel.videos, state, "Последние видео")}</section>`;
  }

  function searchPage(query, state) {
    const needle = String(query || "").trim().toLowerCase();
    const list = VIDEOS.filter((video) => `${video.title} ${video.channelName} ${CATEGORY_LABELS[video.category]}`.toLowerCase().includes(needle));
    return feed(list, state, `Результаты поиска: «${query}»`);
  }

  function content(route, state, selectedCategory) {
    if (route.view === "watch") return watch(VIDEO_BY_ID[route.id], state);
    if (route.view === "channel") return channelPage(CHANNEL_BY_ID[route.id], state);
    if (route.view === "trending") return feed([...VIDEOS].sort((a, b) => b.views.localeCompare(a.views)).slice(0, 36), state, "В тренде");
    if (route.view === "subscriptions") return feed(VIDEOS.filter((video) => state.subscriptions.includes(video.channelId)), state, "Подписки");
    if (route.view === "history") return feed(state.history.slice().reverse().map((item) => VIDEO_BY_ID[item.videoId]).filter(Boolean), state, "История просмотра");
    if (route.view === "later") return feed(state.later.map((id) => VIDEO_BY_ID[id]).filter(Boolean), state, "Смотреть позже");
    if (route.view === "liked") return feed(state.liked.map((id) => VIDEO_BY_ID[id]).filter(Boolean), state, "Понравившиеся");
    if (route.view === "search") return searchPage(route.query, state);
    return home(state, selectedCategory);
  }

  function routeUrl(view) {
    return ROUTES[view] || ROUTES.home;
  }

  function render(container, context) {
    if (!container || !context) return false;
    const route = parse(context.url);
    const state = normalize(context.personal);
    const selectedCategory = context.selectedCategory || "all";
    container.innerHTML = `<section class="vtk-app">${header(route)}${sidebar(route, state)}<main class="vtk-content">${content(route, state, selectedCategory)}</main></section>`;
    bind(container, context);
    return true;
  }

  function save(context, updater, reason) {
    context.updatePersonal((personal) => {
      const state = normalize(personal);
      updater(state);
      personal.videotok = state;
    }, reason);
  }

  function bind(container, context) {
    container.querySelectorAll("[data-vtk-route]").forEach((button) => button.addEventListener("click", () => context.navigate(routeUrl(button.dataset.vtkRoute), "Видеоток")));
    container.querySelectorAll("[data-vtk-watch]").forEach((button) => button.addEventListener("click", () => {
      const video = VIDEO_BY_ID[button.dataset.vtkWatch];
      if (video) context.navigate(`${ROUTES.watch}${video.id}`, `${video.title} — Видеоток`);
    }));
    container.querySelectorAll("[data-vtk-channel]").forEach((element) => element.addEventListener("click", (event) => {
      event.stopPropagation();
      const channel = CHANNEL_BY_ID[element.dataset.vtkChannel];
      if (channel) context.navigate(`${ROUTES.channel}${channel.id}`, `${channel.name} — Видеоток`);
    }));
    container.querySelector("[data-vtk-search]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = event.currentTarget.querySelector("input")?.value.trim() || "";
      if (query) context.navigate(`${ROUTES.search}?q=${encodeURIComponent(query)}`, `${query} — Видеоток`);
    });
    container.querySelectorAll("[data-vtk-category]").forEach((button) => button.addEventListener("click", () => context.setCategory(button.dataset.vtkCategory)));
    container.querySelectorAll("[data-vtk-later]").forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.vtkLater;
      save(context, (value) => { value.later = value.later.includes(id) ? value.later.filter((item) => item !== id) : [...value.later, id]; }, "videotok-later");
    }));
    container.querySelectorAll("[data-vtk-like]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.vtkLike;
      save(context, (value) => { value.liked = value.liked.includes(id) ? value.liked.filter((item) => item !== id) : [...value.liked, id]; }, "videotok-like");
    }));
    container.querySelectorAll("[data-vtk-subscribe]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.vtkSubscribe;
      save(context, (value) => { value.subscriptions = value.subscriptions.includes(id) ? value.subscriptions.filter((item) => item !== id) : [...value.subscriptions, id]; }, "videotok-subscribe");
    }));
    container.querySelectorAll("[data-vtk-play]").forEach((button) => button.addEventListener("click", () => {
      const video = VIDEO_BY_ID[button.dataset.vtkPlay];
      if (!video || !Browser?.performActivity) return;
      Browser.performActivity({
        id: `videotok-watch-${video.id}-${Date.now()}`,
        once: false,
        minutes: video.minutes,
        label: `Просмотрено видео: ${video.title}`,
        category: "videotok",
        site: "Видеоток",
        url: `${ROUTES.watch}${video.id}`,
        apply(personal, draft) {
          const value = normalize(personal);
          value.watched = [...new Set([...value.watched, video.id])];
          value.history = [...value.history, { videoId: video.id, dayIndex: draft.dayIndex, minute: draft.minute }].slice(-300);
          personal.videotok = value;
        }
      });
    }));
    container.querySelectorAll("img[data-vtk-thumb]").forEach((image) => image.addEventListener("error", () => { image.onerror = null; image.src = FALLBACK_THUMB; }, { once: true }));
  }

  root.UntilFridayVideotok = {
    CATEGORY_LABELS,
    CHANNELS,
    VIDEOS,
    VIDEO_BY_ID,
    CHANNEL_BY_ID,
    ROUTES,
    normalize,
    parse,
    render
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
