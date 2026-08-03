(function (root) {
  "use strict";

  const PROFILE_KEY = "until-friday-profile-v1";
  const SETTINGS_KEY = "until-friday-settings-v1";
  const WELCOME_KEY = "until-friday-return-welcome-v1";
  const INTRO_KEY = "until-friday-intro-v2";
  const WORKFLOW_KEY = "until-friday-workflow-files-v1";
  const ENGINE_SAVE_KEY = "until-friday-save-v2";
  const LEGACY_SAVE_KEY = "until-friday-save-v1";

  const defaultSettings = {
    textSpeed: "normal",
    reducedMotion: false
  };

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function readProfile() {
    return readJson(PROFILE_KEY, null);
  }

  function readSettings() {
    return { ...defaultSettings, ...readJson(SETTINGS_KEY, {}) };
  }

  function writeSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applySettings(settings);
  }

  function applySettings(settings = readSettings()) {
    document.documentElement.dataset.textSpeed = settings.textSpeed;
    document.documentElement.classList.toggle("reduced-motion", Boolean(settings.reducedMotion));
  }

  function hasSave() {
    return Boolean(localStorage.getItem(ENGINE_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
  }

  function normalizeName(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
  }

  function validName(value) {
    const name = normalizeName(value);
    return name.length >= 2 && /^[A-Za-zА-Яа-яЁё0-9 -]+$/.test(name);
  }

  function clearGameState() {
    [ENGINE_SAVE_KEY, LEGACY_SAVE_KEY, WORKFLOW_KEY, PROFILE_KEY, WELCOME_KEY].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(INTRO_KEY, "99");
  }

  function createOverlay() {
    const overlay = document.createElement("section");
    overlay.id = "opening-flow";
    overlay.className = "opening-flow";
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="opening-background" aria-hidden="true"></div>
      <div class="opening-vignette" aria-hidden="true"></div>
      <main class="opening-stage" data-opening-stage></main>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function run() {
    applySettings();
    return new Promise((resolve) => {
      const overlay = createOverlay();
      const stage = overlay.querySelector("[data-opening-stage]");
      const finish = (mode) => {
        overlay.classList.add("closing");
        window.setTimeout(() => {
          overlay.remove();
          resolve(mode);
        }, readSettings().reducedMotion ? 0 : 260);
      };
      renderMenu(stage, finish);
    });
  }

  function renderMenu(stage, finish) {
    const continueAvailable = hasSave();
    stage.className = "opening-stage menu-stage";
    stage.innerHTML = `
      <section class="opening-menu" aria-labelledby="opening-title">
        <div class="opening-menu__brand">
          <span class="opening-menu__eyebrow">Психологическая офисная история</span>
          <h1 id="opening-title">До пятницы</h1>
          <p>Пять рабочих дней. Один услышанный разговор. Ни одного точного ответа.</p>
        </div>
        <nav class="opening-menu__actions" aria-label="Главное меню">
          <button type="button" class="opening-button primary" data-new-game>Новая игра</button>
          <button type="button" class="opening-button" data-continue ${continueAvailable ? "" : "disabled"}>Продолжить</button>
          <button type="button" class="opening-button" data-settings>Настройки</button>
        </nav>
        <small class="opening-menu__save-note">${continueAvailable ? "Обнаружено локальное сохранение" : "Сохранение появится после начала игры"}</small>
      </section>`;

    stage.querySelector("[data-new-game]").addEventListener("click", () => {
      if (continueAvailable && !window.confirm("Начать новую игру и удалить текущее сохранение?")) return;
      clearGameState();
      renderNarration(stage, finish);
    });

    stage.querySelector("[data-continue]")?.addEventListener("click", () => {
      if (!continueAvailable) return;
      if (!readProfile()) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: "Илья Воронов", createdAt: Date.now(), migrated: true }));
      }
      finish("continue");
    });

    stage.querySelector("[data-settings]").addEventListener("click", () => renderSettings(stage, finish));
  }

  function renderSettings(stage, finish) {
    const settings = readSettings();
    stage.className = "opening-stage settings-stage";
    stage.innerHTML = `
      <section class="opening-panel settings-panel" aria-labelledby="settings-title">
        <header>
          <span class="opening-menu__eyebrow">Параметры</span>
          <h2 id="settings-title">Настройки</h2>
        </header>
        <label class="opening-field">
          <span>Скорость появления текста</span>
          <select data-text-speed>
            <option value="slow" ${settings.textSpeed === "slow" ? "selected" : ""}>Медленно</option>
            <option value="normal" ${settings.textSpeed === "normal" ? "selected" : ""}>Обычно</option>
            <option value="fast" ${settings.textSpeed === "fast" ? "selected" : ""}>Быстро</option>
          </select>
        </label>
        <label class="opening-check">
          <input type="checkbox" data-reduced-motion ${settings.reducedMotion ? "checked" : ""} />
          <span>Уменьшить анимации интерфейса</span>
        </label>
        <p class="opening-hint">Настройки хранятся только в этом браузере.</p>
        <footer class="opening-panel__footer">
          <button type="button" class="opening-button primary" data-save-settings>Сохранить</button>
          <button type="button" class="opening-button" data-back>Назад</button>
        </footer>
      </section>`;

    stage.querySelector("[data-save-settings]").addEventListener("click", () => {
      writeSettings({
        textSpeed: stage.querySelector("[data-text-speed]").value,
        reducedMotion: stage.querySelector("[data-reduced-motion]").checked
      });
      renderMenu(stage, finish);
    });
    stage.querySelector("[data-back]").addEventListener("click", () => renderMenu(stage, finish));
  }

  function renderNarration(stage, finish) {
    const pages = [
      "В пятницу перед отпуском сотрудник задержался в офисе, чтобы закончить отчёт.",
      "Проходя мимо кабинета директора, он услышал разговор директора и кадровика. Дверь была закрыта не до конца."
    ];
    let index = 0;

    stage.className = "opening-stage prologue-stage";
    stage.innerHTML = `
      <section class="prologue-card" aria-label="Пролог">
        <p class="prologue-text" data-prologue-text></p>
        <button type="button" class="prologue-next" data-prologue-next>Продолжить</button>
      </section>`;

    const text = stage.querySelector("[data-prologue-text]");
    const next = stage.querySelector("[data-prologue-next]");
    const show = () => {
      text.classList.remove("visible");
      text.textContent = pages[index];
      requestAnimationFrame(() => text.classList.add("visible"));
      next.textContent = index === pages.length - 1 ? "Слушать" : "Продолжить";
    };
    show();

    next.addEventListener("click", () => {
      index += 1;
      if (index < pages.length) show();
      else renderDialogue(stage, finish);
    });
  }

  function renderDialogue(stage, finish) {
    const lines = [
      "— Он пока ничего не знает?",
      "— Нет. В пятницу всё объявим.",
      "— Хорошо. Пусть пока продолжает работать как обычно.",
      "Имя не прозвучало."
    ];
    let visible = 0;

    stage.className = "opening-stage dialogue-stage";
    stage.innerHTML = `
      <section class="heard-dialogue" aria-label="Услышанный разговор">
        <div class="heard-dialogue__lines" data-dialogue-lines></div>
        <button type="button" class="prologue-next" data-dialogue-next>Продолжить</button>
      </section>`;

    const container = stage.querySelector("[data-dialogue-lines]");
    const button = stage.querySelector("[data-dialogue-next]");
    const reveal = () => {
      const line = document.createElement("p");
      line.className = visible === lines.length - 1 ? "dialogue-last" : "";
      line.textContent = lines[visible];
      container.appendChild(line);
      requestAnimationFrame(() => line.classList.add("visible"));
      visible += 1;
      button.textContent = visible >= lines.length ? "Включить компьютер" : "Продолжить";
    };
    reveal();

    button.addEventListener("click", () => {
      if (visible < lines.length) reveal();
      else renderLogin(stage, finish);
    });
  }

  function renderLogin(stage, finish) {
    stage.className = "opening-stage login-stage";
    stage.innerHTML = `
      <section class="corporate-login" aria-labelledby="corporate-login-title">
        <header class="corporate-login__header">
          <img src="assets/logo.png" alt="" />
          <div>
            <h2 id="corporate-login-title">КОНТУР-СЕРВИС</h2>
            <span>Внутренняя сеть</span>
          </div>
        </header>
        <form data-login-form novalidate>
          <label class="opening-field">
            <span>Имя сотрудника:</span>
            <input type="text" maxlength="24" autocomplete="name" autofocus data-player-name />
          </label>
          <p class="opening-hint">Имя будет использоваться во внутренней переписке и документах.</p>
          <p class="opening-error" data-login-error aria-live="polite"></p>
          <button type="submit" class="opening-button primary" data-login-submit disabled>Войти в систему</button>
        </form>
      </section>`;

    const form = stage.querySelector("[data-login-form]");
    const input = stage.querySelector("[data-player-name]");
    const submit = stage.querySelector("[data-login-submit]");
    const error = stage.querySelector("[data-login-error]");

    const validate = () => {
      const value = normalizeName(input.value);
      submit.disabled = !validName(value);
      error.textContent = value && !validName(value)
        ? "Используйте от 2 до 24 букв, цифр, пробелов или дефисов."
        : "";
    };
    input.addEventListener("input", validate);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = normalizeName(input.value);
      if (!validName(name)) {
        validate();
        input.focus();
        return;
      }

      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, createdAt: Date.now() }));
      localStorage.setItem(WELCOME_KEY, JSON.stringify({ active: true, read: false, choice: null, createdAt: Date.now() }));
      localStorage.setItem(INTRO_KEY, "99");
      renderLoginProgress(stage, name, finish);
    });
  }

  function renderLoginProgress(stage, name, finish) {
    stage.className = "opening-stage login-progress-stage";
    stage.innerHTML = `
      <section class="login-progress" aria-live="polite">
        <img src="assets/logo.png" alt="" />
        <strong>Пользователь: <span></span></strong>
        <div class="login-progress__row" data-progress-row></div>
      </section>`;
    stage.querySelector(".login-progress strong span").textContent = name;
    const row = stage.querySelector("[data-progress-row]");
    if (root.UntilFridayLoading?.createLoadingRow) {
      row.appendChild(root.UntilFridayLoading.createLoadingRow("Вход в систему...", { size: 20 }));
    } else {
      row.textContent = "Вход в систему...";
    }
    window.setTimeout(() => finish("new-game"), readSettings().reducedMotion ? 100 : 780);
  }

  root.UntilFridayOnboarding = {
    PROFILE_KEY,
    SETTINGS_KEY,
    WELCOME_KEY,
    run,
    readProfile,
    readSettings,
    applySettings,
    normalizeName,
    validName
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
