(function (root) {
  "use strict";

  if (root.UntilFridayMarketplaceParody) return;
  const Browser = root.UntilFridayPersonalBrowser;
  const Runtime = root.UntilFridayRuntimeEngine;
  if (!Browser || !Runtime) return;

  const ICON_HOST = "https://img.icons8.com";
  const icon = (name, size = 32, style = "fluency") => `${ICON_HOST}/${style}/${size}/${name}.png`;

  const CATEGORIES = [
    { id: "women", label: "Женщинам", icon: "dress-front-view" },
    { id: "men", label: "Мужчинам", icon: "t-shirt" },
    { id: "kids", label: "Детям", icon: "children" },
    { id: "shoes", label: "Обувь", icon: "trainers" },
    { id: "home", label: "Дом", icon: "sofa" },
    { id: "beauty", label: "Красота", icon: "lipstick" },
    { id: "electronics", label: "Электроника", icon: "smartphone-tablet" },
    { id: "auto", label: "Авто", icon: "car" },
    { id: "sport", label: "Спорт", icon: "dumbbell" },
    { id: "pets", label: "Зоотовары", icon: "dog-paw-print" },
    { id: "office", label: "Канцтовары", icon: "stationery" },
    { id: "food", label: "Продукты", icon: "ingredients" }
  ];

  const ROWS = {
    women: [
      ["w-dress-call", "Платье «Созвон отменили»", "Lenta Moda", 2190, 6290, 4.8, 912, "dress-front-view", "Хит"],
      ["w-hoodie-remote", "Худи оверсайз «Я на удалёнке»", "Office Ghost", 1890, 4890, 4.7, 1460, "hoodie", "-61%"],
      ["w-jacket-weather", "Куртка демисезонная «Не продувает, но обсуждает»", "Severka", 3990, 9990, 4.6, 733, "winter-jacket", "До -60%"],
      ["w-bag-docs", "Сумка для документов и случайных чеков", "Carry On", 1490, 3590, 4.9, 2018, "handbag", "Выбор офиса"],
      ["w-socks-monday", "Носки 5 пар «Каждый день понедельник»", "Пятка Плюс", 590, 1290, 4.8, 4381, "socks", "5 пар"]
    ],
    men: [
      ["m-shirt-deadline", "Футболка «Дедлайн был вчера»", "Task Failed", 990, 2490, 4.8, 3210, "t-shirt", "Хит"],
      ["m-jeans-pocket", "Джинсы с карманом для пропуска", "Blue Access", 2490, 5990, 4.6, 812, "jeans", "Удобно"],
      ["m-shirt-friday", "Рубашка «До пятницы доживём»", "Bureau Man", 1790, 4290, 4.7, 1288, "mens-shirt", "Новинка"],
      ["m-belt-security", "Ремень строгий, как служба безопасности", "Hold It", 890, 1990, 4.5, 601, "belt", "-55%"],
      ["m-jacket-boss", "Пиджак для внезапной встречи с директором", "Formal Panic", 4590, 11990, 4.9, 442, "suit", "Премиум" ]
    ],
    kids: [
      ["k-constructor-office", "Конструктор «Офис на 300 деталей»", "Brick Work", 1290, 2890, 4.9, 1770, "lego", "Развивает терпение"],
      ["k-backpack-dino", "Рюкзак с динозавром и отделом для справок", "RexPack", 1190, 2690, 4.8, 1321, "school-backpack", "В школу"],
      ["k-pencils", "Набор карандашей «Не грызи на совещании»", "ColorKid", 390, 790, 4.7, 4022, "colored-pencils", "24 цвета"],
      ["k-pajama", "Пижама «Ещё пять минут»", "Sleepy Club", 990, 2290, 4.9, 2190, "pajama", "Мягкая"],
      ["k-lamp", "Ночник «Монстр под отчётом»", "Little Light", 790, 1890, 4.6, 901, "night-light", "USB"]
    ],
    shoes: [
      ["s-sneakers-run", "Кроссовки «Убежать с планёрки»", "Fast Exit", 2890, 6990, 4.8, 2821, "trainers", "Хит"],
      ["s-slippers-home", "Тапочки домашние «Официально занят»", "Soft Status", 690, 1590, 4.9, 7112, "slippers", "Тёплые"],
      ["s-boots-puddle", "Ботинки непромокаемые для дороги на работу", "Monday Road", 3490, 7990, 4.7, 1008, "boots", "Осень"],
      ["s-shoes-meeting", "Туфли «Срочно в переговорную»", "Quiet Step", 2690, 6490, 4.6, 778, "mens-shoe", "Тихая подошва"],
      ["s-socks-slides", "Шлёпанцы с носками, комплект смелого сотрудника", "Dress Code?", 990, 2290, 4.5, 503, "flip-flops", "Скандал"]
    ],
    home: [
      ["h-chair", "Кресло офисное «Спина ещё пригодится»", "Linea Compact", 7390, 12990, 4.7, 938, "office-chair-2", "Бестселлер"],
      ["h-lamp", "Лампа настольная «Свет в конце отчёта»", "Aurora", 1890, 3990, 4.9, 2441, "desk-lamp", "3 режима"],
      ["h-mug", "Кружка 450 мл «Это не третий кофе»", "Mugshot", 490, 990, 4.8, 10012, "coffee-cup", "Хит"],
      ["h-blanket", "Плед для удалёнки и отрицания реальности", "Warm Deadline", 1590, 3490, 4.9, 3310, "blanket", "Мягкий"],
      ["h-organizer", "Органайзер «Положил и забыл где»", "Order-ish", 890, 1890, 4.6, 1876, "organizer", "12 секций"]
    ],
    beauty: [
      ["b-eye", "Патчи под глаза «Я просто рано встал»", "Morning Lie", 390, 890, 4.7, 8120, "eye-makeup", "60 шт."],
      ["b-cream", "Крем для рук после восьми часов клавиатуры", "Soft Keys", 290, 690, 4.8, 6411, "cream-tube", "Быстро впитывается"],
      ["b-perfume", "Парфюм «Запах квартальной премии»", "Bonus Dream", 1290, 3990, 4.5, 1308, "perfume-bottle", "Туалетная вода"],
      ["b-shampoo", "Шампунь против последствий понедельника", "Clean Start", 490, 1090, 4.8, 5590, "shampoo", "500 мл"],
      ["b-mask", "Маска для лица «Камера выключена»", "No Video", 350, 790, 4.9, 7201, "face-mask", "Увлажнение"]
    ],
    electronics: [
      ["e-headphones", "Беспроводные наушники Volna H3", "Volna", 4990, 8990, 4.8, 5421, "headphones", "38 часов"],
      ["e-keyboard", "Клавиатура тихая, чтобы начальник не слышал", "Silent Type", 2190, 4890, 4.7, 2011, "keyboard", "Тихая"],
      ["e-mouse", "Мышь беспроводная «Закрыть вкладку вовремя»", "Quick Alt", 1190, 2490, 4.8, 6280, "mouse", "2.4 ГГц"],
      ["e-powerbank", "Пауэрбанк 20000 мАч «До пятницы хватит»", "Last Percent", 1990, 4290, 4.9, 8470, "power-bank", "Быстрая зарядка"],
      ["e-drive", "Флешка 64 ГБ «Точно рабочие файлы»", "No Evidence", 790, 1690, 4.6, 999, "usb-memory-stick", "USB 3.0"]
    ],
    auto: [
      ["a-holder", "Держатель телефона «Навигатор не осуждает»", "Road Clip", 690, 1490, 4.8, 6810, "phone-holder", "Магнитный"],
      ["a-compressor", "Компрессор автомобильный «Давление как на работе»", "Pressure Pro", 2190, 4890, 4.7, 1510, "air-pump", "12 В"],
      ["a-vacuum", "Пылесос автомобильный для крошек и надежд", "Clean Route", 1690, 3490, 4.6, 2108, "vacuum-cleaner", "Компактный"],
      ["a-cover", "Чехол на руль «Держись»", "Grip Day", 790, 1590, 4.8, 4300, "steering-wheel", "Экокожа"],
      ["a-kit", "Набор инструмента Master 46", "Master", 3290, 5990, 4.9, 6104, "toolbox", "46 предметов"]
    ],
    sport: [
      ["sp-mat", "Коврик для йоги и лежания после смены", "Horizontal", 1190, 2490, 4.8, 3901, "yoga-mat", "Не скользит"],
      ["sp-dumbbell", "Гантели 2×5 кг «Поднять показатели»", "KPI Fit", 1990, 3990, 4.7, 1880, "dumbbell", "10 кг"],
      ["sp-bottle", "Бутылка для воды «Совещание переживу»", "Hydrate Now", 590, 1290, 4.9, 8104, "water-bottle", "1 литр"],
      ["sp-band", "Фитнес-резинки для сопротивления системе", "Resistance", 690, 1490, 4.8, 5170, "resistance-band", "5 уровней"],
      ["sp-bag", "Спортивная сумка «После работы точно пойду»", "Maybe Gym", 1490, 3290, 4.6, 942, "duffel-bag", "35 литров"]
    ],
    pets: [
      ["p-bed", "Лежанка для кота, который работает удалённо", "Boss Cat", 1290, 2790, 4.9, 7022, "cat-bed", "50 см"],
      ["p-toy", "Игрушка для собаки «Сожри дедлайн»", "Good Boy", 390, 890, 4.8, 5130, "dog-bone", "Пищит"],
      ["p-bowl", "Миска двойная «Обед по расписанию»", "Pet Lunch", 590, 1290, 4.7, 2110, "dog-bowl", "Нержавейка"],
      ["p-scratcher", "Когтеточка вместо офисного кресла", "Save Chair", 1590, 3390, 4.8, 3099, "cat", "Высокая"],
      ["p-carrier", "Переноска «К ветеринару, не на планёрку»", "Safe Trip", 1990, 4290, 4.7, 1108, "pet-carrier", "До 8 кг"]
    ],
    office: [
      ["o-notebook", "Блокнот «Записал, значит не забыл»", "Paper Memory", 390, 790, 4.9, 9102, "notebook", "А5"],
      ["o-pens", "Ручки 10 шт. «Исчезнут к среде»", "Office Migration", 290, 690, 4.8, 12004, "pen", "Синие"],
      ["o-stickers", "Стикеры «Срочно», «Очень срочно», «Вчера»", "Priority Pack", 250, 590, 4.9, 7330, "sticky-notes", "300 листов"],
      ["o-folder", "Папка-регистратор «Не открывать без кофе»", "Archive Mood", 490, 990, 4.7, 2701, "binder", "75 мм"],
      ["o-shredder", "Мини-шредер для черновиков и сомнений", "Quiet Delete", 2490, 5290, 4.6, 612, "paper-shredder", "6 листов"]
    ],
    food: [
      ["f-coffee", "Кофе молотый «Рабочая необходимость»", "Wake Dept", 590, 1090, 4.9, 15201, "coffee-beans", "500 г"],
      ["f-noodles", "Лапша быстрого приготовления «Обед закрыт»", "Deadline Food", 79, 149, 4.7, 22110, "noodles", "Острая"],
      ["f-cookies", "Печенье «Для посетителей, но можно одно»", "Meeting Snack", 249, 490, 4.8, 9100, "cookie", "400 г"],
      ["f-tea", "Чай чёрный «Пять минут тишины»", "Pause", 320, 690, 4.9, 8301, "tea-cup", "100 пакетов"],
      ["f-bars", "Батончики протеиновые «Сделаю после обеда»", "Later Bar", 690, 1390, 4.6, 2401, "chocolate-bar", "12 шт."]
    ]
  };

  const PRODUCTS = CATEGORIES.flatMap((category, categoryIndex) => (ROWS[category.id] || []).map((row, index) => ({
    id: row[0], title: row[1], brand: row[2], price: row[3], oldPrice: row[4], rating: row[5], reviews: row[6], icon: row[7], badge: row[8],
    category: category.id, categoryLabel: category.label, day: 0, note: `${category.label} · доставка ${index % 3 === 0 ? "сегодня" : index % 3 === 1 ? "завтра" : "послезавтра"}`,
    delivery: index % 3 === 0 ? "Сегодня" : index % 3 === 1 ? "Завтра" : "Послезавтра",
    image: icon(row[7], 144), article: `KT-${categoryIndex + 1}${String(index + 1).padStart(2, "0")}`,
    colors: ["Фиолетовый", "Чёрный", "Серый"], sizes: category.id === "women" || category.id === "men" || category.id === "shoes" ? ["S", "M", "L", "XL"] : []
  })));

  Browser.PRODUCTS.splice(0, Browser.PRODUCTS.length, ...PRODUCTS);

  let category = "all";
  let query = "";
  let sort = "popular";
  let visibleCount = 20;
  let catalogOpen = false;
  let cartOpen = false;
  let favoritesOnly = false;
  let quickProductId = null;
  let queued = false;

  function stateNow() { return Runtime.getEngine?.()?.getState?.() || null; }
  function personal(state = stateNow()) { return Browser.personalState?.(state) || {}; }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function money(value) { return `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} ₽`; }
  function discount(product) { return Math.max(1, Math.round((1 - product.price / product.oldPrice) * 100)); }
  function isMarketOpen() {
    const address = document.querySelector(".personal-browser-window .rb-address input")?.value || "";
    return address.includes("kupitut.local");
  }

  function filteredProducts(user) {
    let list = PRODUCTS.filter((product) => category === "all" || product.category === category);
    if (favoritesOnly) list = list.filter((product) => user.favorites?.includes(product.id));
    if (query) {
      const needle = query.toLowerCase();
      list = list.filter((product) => `${product.title} ${product.brand} ${product.categoryLabel}`.toLowerCase().includes(needle));
    }
    return list.slice().sort((a, b) => {
      if (sort === "cheap") return a.price - b.price;
      if (sort === "expensive") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating || b.reviews - a.reviews;
      if (sort === "discount") return discount(b) - discount(a);
      return b.reviews - a.reviews;
    });
  }

  function renderMarketplace() {
    queued = false;
    const windowElement = document.querySelector(".personal-browser-window");
    if (!windowElement) return;
    if (!isMarketOpen()) {
      delete windowElement.dataset.marketplaceActive;
      return;
    }

    const state = stateNow();
    if (!state) return;
    const user = personal(state);
    const page = windowElement.querySelector(".rb-page");
    if (!page) return;

    windowElement.dataset.marketplaceActive = "true";
    windowElement.querySelector(".window-title").textContent = "КупиТут — KONTUR Web";
    windowElement.querySelector(".window-status").textContent = "Защищённое соединение · kupitut.local";

    const all = filteredProducts(user);
    const shown = all.slice(0, visibleCount);
    page.innerHTML = `<section class="kp-app">
      ${header(user)}
      ${categoryBar()}
      ${hero()}
      <main class="kp-main">
        <div class="kp-breadcrumbs">Главная　/　${category === "all" ? "Все товары" : esc(CATEGORIES.find((item) => item.id === category)?.label || "Каталог")}</div>
        <section class="kp-heading"><div><h1>${favoritesOnly ? "Избранное" : category === "all" ? "Хиты КупиТут" : esc(CATEGORIES.find((item) => item.id === category)?.label)}</h1><p>${all.length} товаров · выдача обновлена только что</p></div><div class="kp-tools"><button data-kp-filter><img src="${icon("filter", 20, "fluency-systems-regular")}" alt="">Фильтры</button><select data-kp-sort><option value="popular" ${sort === "popular" ? "selected" : ""}>По популярности</option><option value="cheap" ${sort === "cheap" ? "selected" : ""}>Сначала дешевле</option><option value="expensive" ${sort === "expensive" ? "selected" : ""}>Сначала дороже</option><option value="rating" ${sort === "rating" ? "selected" : ""}>По рейтингу</option><option value="discount" ${sort === "discount" ? "selected" : ""}>По скидке</option></select></div></section>
        ${shown.length ? `<div class="kp-grid">${shown.map((product) => productCard(product, user)).join("")}</div>` : emptyState()}
        ${shown.length < all.length ? `<button class="kp-more" data-kp-more>Показать ещё ${Math.min(20, all.length - shown.length)}</button>` : ""}
        <footer class="kp-footer"><div><b>КупиТут</b><span>ягодно выгодно, местами странно</span></div><p>Иконки интерфейса и товаров предоставлены Icons8.</p></footer>
      </main>
      ${catalogOpen ? catalogPanel() : ""}
      ${cartOpen ? cartDrawer(user) : ""}
      ${quickProductId ? productModal(PRODUCTS.find((item) => item.id === quickProductId), user) : ""}
    </section>`;
    bindMarketplace(page, user);
  }

  function header(user) {
    return `<header class="kp-header"><div class="kp-head-top"><button class="kp-catalog-button" data-kp-catalog><img src="${icon("menu", 24, "fluency-systems-regular")}" alt=""><span>Каталог</span></button><button class="kp-logo" data-kp-home><strong>КУПИТУТ</strong><small>ягодно выгодно</small></button><form class="kp-search" data-kp-search><img src="${icon("search", 22, "fluency-systems-regular")}" alt=""><input value="${esc(query)}" placeholder="Найти ноутбук, носки или смысл жизни"><button type="submit"><img src="${icon("camera", 21, "fluency-systems-regular")}" alt="Поиск"></button></form><nav class="kp-actions"><button data-kp-location><img src="${icon("marker", 25, "fluency-systems-regular")}" alt=""><span>Воронеж</span></button><button data-kp-profile><img src="${icon("user", 25, "fluency-systems-regular")}" alt=""><span>Войти</span></button><button data-kp-favorites class="${favoritesOnly ? "active" : ""}"><img src="${icon("heart", 25, "fluency-systems-regular")}" alt=""><span>Избранное</span><i>${user.favorites?.length || 0}</i></button><button data-kp-cart><img src="${icon("shopping-cart", 25, "fluency-systems-regular")}" alt=""><span>Корзина</span><i>${user.cart?.length || 0}</i></button></nav></div></header>`;
  }

  function categoryBar() {
    return `<nav class="kp-category-bar"><button data-kp-category="all" class="${category === "all" ? "active" : ""}"><span class="kp-all-icon"><img src="${icon("squared-menu", 25, "fluency-systems-regular")}" alt=""></span><b>Все</b></button>${CATEGORIES.map((item) => `<button data-kp-category="${item.id}" class="${category === item.id ? "active" : ""}"><span><img src="${icon(item.icon, 34)}" alt=""></span><b>${item.label}</b></button>`).join("")}</nav>`;
  }

  function hero() {
    return `<section class="kp-hero"><div><small>РАСПРОДАЖА ДО ПЯТНИЦЫ</small><h2>Скидки до 83%</h2><p>Потом начальник всё равно попросит переделать.</p><button data-kp-category="all">Смотреть товары</button></div><div class="kp-hero-orbs"><span>-70%</span><span>-55%</span><span>-83%</span></div></section>`;
  }

  function productCard(product, user) {
    const favorite = user.favorites?.includes(product.id);
    const inCart = user.cart?.includes(product.id);
    return `<article class="kp-card"><div class="kp-picture" data-kp-quick="${product.id}"><img src="${product.image}" alt="${esc(product.title)}"><span class="kp-discount">-${discount(product)}%</span><span class="kp-badge">${esc(product.badge)}</span><button class="kp-heart ${favorite ? "active" : ""}" data-kp-favorite="${product.id}" aria-label="Избранное"><img src="${icon(favorite ? "heart-with-pulse" : "heart", 24, "fluency-systems-regular")}" alt=""></button></div><div class="kp-price"><strong>${money(product.price)}</strong><del>${money(product.oldPrice)}</del></div><h3><b>${esc(product.brand)}</b> / ${esc(product.title)}</h3><div class="kp-rating"><span>★ ${product.rating}</span><em>${product.reviews.toLocaleString("ru-RU")} отзывов</em></div><p class="kp-delivery"><img src="${icon("delivery", 18, "fluency-systems-regular")}" alt="">${product.delivery} в пункт выдачи</p><button class="kp-cart-button ${inCart ? "in-cart" : ""}" data-kp-cart-item="${product.id}">${inCart ? "В корзине" : "В корзину"}</button></article>`;
  }

  function emptyState() {
    return `<div class="kp-empty"><img src="${icon("nothing-found", 96)}" alt=""><h2>Ничего не нашлось</h2><p>Попробуйте другой запрос или загляните в каталог.</p><button data-kp-reset>Сбросить фильтры</button></div>`;
  }

  function catalogPanel() {
    return `<div class="kp-overlay" data-kp-overlay><aside class="kp-catalog"><header><strong>Каталог</strong><button data-kp-close><img src="${icon("delete-sign", 22, "fluency-systems-regular")}" alt="Закрыть"></button></header><button data-kp-category="all" class="${category === "all" ? "active" : ""}"><img src="${icon("squared-menu", 30)}" alt="">Все товары</button>${CATEGORIES.map((item) => `<button data-kp-category="${item.id}" class="${category === item.id ? "active" : ""}"><img src="${icon(item.icon, 32)}" alt=""><span><b>${item.label}</b><small>${PRODUCTS.filter((product) => product.category === item.id).length} товаров</small></span><img class="kp-chevron" src="${icon("chevron-right", 18, "fluency-systems-regular")}" alt=""></button>`).join("")}</aside></div>`;
  }

  function cartDrawer(user) {
    const items = PRODUCTS.filter((product) => user.cart?.includes(product.id));
    const total = items.reduce((sum, product) => sum + product.price, 0);
    return `<div class="kp-overlay" data-kp-overlay><aside class="kp-drawer"><header><div><strong>Корзина</strong><small>${items.length} товаров</small></div><button data-kp-close><img src="${icon("delete-sign", 22, "fluency-systems-regular")}" alt="Закрыть"></button></header><main>${items.length ? items.map((product) => `<article><img src="${product.image}" alt=""><div><b>${esc(product.title)}</b><small>${esc(product.brand)}</small><strong>${money(product.price)}</strong></div><button data-kp-cart-item="${product.id}"><img src="${icon("trash", 20, "fluency-systems-regular")}" alt="Удалить"></button></article>`).join("") : `<div class="kp-empty"><img src="${icon("shopping-cart", 80)}" alt=""><h2>В корзине пусто</h2><p>Это ненадолго.</p></div>`}</main>${items.length ? `<footer><div><span>Итого без учёта здравого смысла</span><strong>${money(total)}</strong></div><button data-kp-checkout>Перейти к оформлению</button></footer>` : ""}</aside></div>`;
  }

  function productModal(product, user) {
    if (!product) return "";
    const favorite = user.favorites?.includes(product.id);
    const inCart = user.cart?.includes(product.id);
    return `<div class="kp-modal-overlay" data-kp-overlay><article class="kp-modal"><button class="kp-modal-close" data-kp-close><img src="${icon("delete-sign", 24, "fluency-systems-regular")}" alt="Закрыть"></button><div class="kp-modal-image"><img src="${product.image}" alt="${esc(product.title)}"><span>-${discount(product)}%</span></div><section><small>Артикул ${product.article}</small><h2>${esc(product.title)}</h2><p class="kp-modal-brand">${esc(product.brand)} · ${product.categoryLabel}</p><div class="kp-modal-rating">★ ${product.rating}　 ${product.reviews.toLocaleString("ru-RU")} отзывов</div><div class="kp-modal-price"><strong>${money(product.price)}</strong><del>${money(product.oldPrice)}</del></div>${product.sizes.length ? `<div class="kp-sizes"><b>Размер</b>${product.sizes.map((size) => `<button>${size}</button>`).join("")}</div>` : ""}<ul><li>Доставка: ${product.delivery.toLowerCase()}</li><li>Возврат в течение 14 дней</li><li>Продавец обещает, что всё нормально</li></ul><div class="kp-modal-actions"><button data-kp-favorite="${product.id}"><img src="${icon("heart", 22, "fluency-systems-regular")}" alt="">${favorite ? "В избранном" : "В избранное"}</button><button class="primary" data-kp-cart-item="${product.id}">${inCart ? "Убрать из корзины" : "Добавить в корзину"}</button></div></section></article></div>`;
  }

  function bindMarketplace(page, user) {
    page.querySelector("[data-kp-search]")?.addEventListener("submit", (event) => { event.preventDefault(); query = event.currentTarget.querySelector("input").value.trim(); visibleCount = 20; favoritesOnly = false; renderMarketplace(); });
    page.querySelectorAll("[data-kp-category]").forEach((button) => button.addEventListener("click", () => { category = button.dataset.kpCategory; query = ""; favoritesOnly = false; visibleCount = 20; catalogOpen = false; renderMarketplace(); }));
    page.querySelector("[data-kp-sort]")?.addEventListener("change", (event) => { sort = event.currentTarget.value; renderMarketplace(); });
    page.querySelector("[data-kp-more]")?.addEventListener("click", () => { visibleCount += 20; renderMarketplace(); });
    page.querySelector("[data-kp-catalog]")?.addEventListener("click", () => { catalogOpen = true; renderMarketplace(); });
    page.querySelector("[data-kp-cart]")?.addEventListener("click", () => { cartOpen = true; renderMarketplace(); });
    page.querySelector("[data-kp-favorites]")?.addEventListener("click", () => { favoritesOnly = !favoritesOnly; category = "all"; visibleCount = 20; renderMarketplace(); });
    page.querySelector("[data-kp-home]")?.addEventListener("click", () => { category = "all"; query = ""; favoritesOnly = false; visibleCount = 20; renderMarketplace(); });
    page.querySelectorAll("[data-kp-close]").forEach((button) => button.addEventListener("click", () => { catalogOpen = false; cartOpen = false; quickProductId = null; renderMarketplace(); }));
    page.querySelectorAll("[data-kp-overlay]").forEach((overlay) => overlay.addEventListener("click", (event) => { if (event.target === overlay) { catalogOpen = false; cartOpen = false; quickProductId = null; renderMarketplace(); } }));
    page.querySelectorAll("[data-kp-quick]").forEach((element) => element.addEventListener("click", (event) => { if (event.target.closest("button")) return; quickProductId = element.dataset.kpQuick; renderMarketplace(); }));
    page.querySelectorAll("[data-kp-favorite]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); toggleFavorite(button.dataset.kpFavorite, user); }));
    page.querySelectorAll("[data-kp-cart-item]").forEach((button) => button.addEventListener("click", () => toggleCart(button.dataset.kpCartItem, user)));
    page.querySelector("[data-kp-reset]")?.addEventListener("click", () => { category = "all"; query = ""; favoritesOnly = false; sort = "popular"; visibleCount = 20; renderMarketplace(); });
    page.querySelector("[data-kp-checkout]")?.addEventListener("click", () => Runtime.notify?.("КупиТут", "Оформление заказа временно недоступно: курьер ушёл на обед."));
  }

  function toggleFavorite(productId, user) {
    const product = PRODUCTS.find((item) => item.id === productId);
    if (!product) return;
    const exists = user.favorites?.includes(productId);
    Browser.performActivity({ id: `market-favorite-${productId}-${Date.now()}`, once: false, minutes: 1, label: exists ? `Удалено из избранного: ${product.title}` : `Добавлено в избранное: ${product.title}`, category: "market", site: "КупиТут", apply(value) { value.favorites = exists ? value.favorites.filter((id) => id !== productId) : [...new Set([...(value.favorites || []), productId])]; } });
  }

  function toggleCart(productId, user) {
    const product = PRODUCTS.find((item) => item.id === productId);
    if (!product) return;
    const exists = user.cart?.includes(productId);
    Browser.performActivity({ id: `market-cart-${productId}-${Date.now()}`, once: false, minutes: 2, label: exists ? `Удалено из корзины: ${product.title}` : `Добавлено в корзину: ${product.title}`, category: "market", site: "КупиТут", apply(value) { value.cart = exists ? value.cart.filter((id) => id !== productId) : [...new Set([...(value.cart || []), productId])]; } });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(renderMarketplace);
    else root.setTimeout?.(renderMarketplace, 0);
  }

  root.addEventListener?.("until-friday-app-ready", schedule);
  root.addEventListener?.("until-friday-state-change", schedule);
  root.addEventListener?.("until-friday-ui-render", (event) => { if (event.detail?.appId === "browser") schedule(); });
  document.addEventListener("click", (event) => { if (event.target.closest?.(".personal-browser-window")) root.setTimeout?.(schedule, 0); }, true);
  document.addEventListener("submit", (event) => { if (event.target.closest?.(".personal-browser-window")) root.setTimeout?.(schedule, 0); }, true);

  root.UntilFridayMarketplaceParody = { CATEGORIES, PRODUCTS, icon, renderMarketplace, schedule };
})(typeof globalThis !== "undefined" ? globalThis : window);
