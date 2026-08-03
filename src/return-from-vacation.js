(function (root) {
  "use strict";

  const Onboarding = root.UntilFridayOnboarding;
  if (!Onboarding) return;

  const WELCOME_KEY = Onboarding.WELCOME_KEY;
  const LEGACY_FULL_NAME = "\u0418\u043b\u044c\u044f \u0412\u043e\u0440\u043e\u043d\u043e\u0432";
  const LEGACY_FIRST_NAME = "\u0418\u043b\u044c\u044f";
  const LEGACY_ACCUSATIVE = "\u0418\u043b\u044c\u044e";
  const LEGACY_GENITIVE = "\u0418\u043b\u044c\u0438";
  let queued = false;
  let notificationShown = false;

  function readWelcome() {
    try {
      const value = JSON.parse(localStorage.getItem(WELCOME_KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function writeWelcome(value) {
    try {
      localStorage.setItem(WELCOME_KEY, JSON.stringify(value));
    } catch {
      return false;
    }
    queueDecorate();
    return true;
  }

  function playerName() {
    return Onboarding.readProfile()?.name || "Сотрудник";
  }

  function shortName() {
    return playerName().split(/\s+/)[0] || playerName();
  }

  function initials(name = playerName()) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    const value = parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    return value || "С";
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorate();
    });
  }

  function decorate() {
    decorateProfile();
    const state = readWelcome();
    if (!state?.active) return;
    decorateUnread(state);
    decorateWelcomeNotification(state);
    decorateDimaConversation(state);
  }

  function decorateProfile() {
    const profile = Onboarding.readProfile();
    if (!profile?.name) return;

    const login = terminalLogin(profile.name);
    const startName = document.querySelector("#start-menu header strong");
    if (startName && startName.textContent !== profile.name) startName.textContent = profile.name;

    const avatar = document.querySelector("#start-menu .user-avatar");
    const avatarText = initials(profile.name);
    if (avatar && avatar.textContent !== avatarText) avatar.textContent = avatarText;

    const substitutions = [
      [LEGACY_FULL_NAME, profile.name],
      [LEGACY_ACCUSATIVE, "сотрудника"],
      [LEGACY_GENITIVE, "сотрудника"],
      [LEGACY_FIRST_NAME, shortName()],
      ["ivoronov", login]
    ];
    const roots = document.querySelectorAll(
      ".mail-view, .document-paper, .message-bubble, .ending-card, .friday-ending-overlay, .day-transition-card, .terminal-output, .journal-list, .work-minigame-content"
    );
    roots.forEach((element) => replaceTextNodes(element, substitutions));

    document.querySelectorAll(".terminal-prompt").forEach((prompt) => {
      const value = `${login}@office:>`;
      if (prompt.textContent !== value) prompt.textContent = value;
    });
  }

  function replaceTextNodes(rootElement, substitutions) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let value = node.nodeValue;
      substitutions.forEach(([from, to]) => { value = value.split(from).join(to); });
      if (value !== node.nodeValue) node.nodeValue = value;
    });
  }

  function terminalLogin(name) {
    const transliteration = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
      к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
      х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya"
    };
    const login = String(name).toLowerCase().split("").map((letter) => transliteration[letter] || letter).join("")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 20);
    return login || "employee";
  }

  function decorateUnread(state) {
    const unread = !state.read;
    document.querySelectorAll('.desktop-icon[data-app="chat"]').forEach((button) => button.classList.toggle("return-unread", unread));
    document.querySelectorAll(".start-app").forEach((button) => {
      const label = button.querySelector("span:last-child")?.textContent.trim();
      if (label === "Связь") button.classList.toggle("return-unread", unread);
    });
  }

  function decorateWelcomeNotification(state) {
    const desktop = document.querySelector("#desktop");
    if (state.read || notificationShown || !desktop || desktop.classList.contains("hidden")) return;
    const container = document.querySelector("#notifications");
    if (!container) return;

    notificationShown = true;
    window.setTimeout(() => {
      if (readWelcome()?.read) return;
      const toast = document.createElement("button");
      toast.type = "button";
      toast.className = "notification return-welcome-toast";
      toast.innerHTML = `<strong>Связь</strong><span>Новое сообщение от Димы Орлова</span>`;
      toast.addEventListener("click", openMessenger);
      container.appendChild(toast);
      window.setTimeout(() => toast.remove(), 9000);
    }, 850);
  }

  function openMessenger() {
    const icon = document.querySelector('.desktop-icon[data-app="chat"]');
    if (icon) icon.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  }

  function decorateDimaConversation(initialState) {
    document.querySelectorAll(".chat-layout").forEach((layout) => {
      const header = layout.querySelector(".chat-header strong")?.textContent.trim();
      if (header !== "Дима Орлов") return;

      let state = initialState;
      if (!state.read) {
        state = { ...state, read: true };
        writeWelcome(state);
      }

      const messages = layout.querySelector("[data-messages]");
      const replyPanel = layout.querySelector("[data-actions]");
      if (!messages || !replyPanel) return;

      const signature = `${playerName()}|${state.read}|${state.choice || "pending"}`;
      if (layout.dataset.returnGuideSignature === signature) return;
      layout.dataset.returnGuideSignature = signature;

      messages.querySelectorAll(".return-guide-message").forEach((message) => message.remove());
      const existingRumor = Array.from(messages.querySelectorAll(".message")).find((message) =>
        message.querySelector(".message-bubble")?.textContent.includes("Слышал, в пятницу опять собрание")
      );
      if (existingRumor) existingRumor.hidden = !state.choice;

      const welcomeMessages = [
        `${shortName()}, с возвращением. Рад, что ты наконец вышел из отпуска.`,
        "Если нужно освежить память, могу быстро напомнить, где что находится."
      ];
      welcomeMessages.slice().reverse().forEach((text, reverseIndex) => {
        const originalIndex = welcomeMessages.length - 1 - reverseIndex;
        prependMessage(messages, text, "them", `08:${48 + originalIndex}`);
      });

      if (state.choice) renderChoiceMessages(messages, state.choice);
      renderGuideOptions(replyPanel, state);
      messages.scrollTop = 0;
    });
  }

  function prependMessage(container, text, side, time) {
    const block = document.createElement("div");
    block.className = `message ${side} return-guide-message`;
    block.innerHTML = `<div class="message-bubble"></div><time></time>`;
    block.querySelector(".message-bubble").textContent = text;
    block.querySelector("time").textContent = time;
    container.prepend(block);
  }

  function appendGuideMessage(container, text, side, time) {
    const block = document.createElement("div");
    block.className = `message ${side} return-guide-message`;
    block.innerHTML = `<div class="message-bubble"></div><time></time>`;
    block.querySelector(".message-bubble").textContent = text;
    block.querySelector("time").textContent = time;
    container.appendChild(block);
  }

  function renderChoiceMessages(container, choice) {
    const sets = {
      refresh: [
        ["Напомни, где что находится.", "me"],
        ["Проводник — все рабочие файлы и общий диск. В Почте начальник присылает задания, а в «Задачах» видны сроки.", "them"],
        ["Через «Связь» пиши людям. Терминал нужен редко, но команда help покажет доступные служебные команды.", "them"],
        ["И не перепутай финальный отчёт с черновиком. Андрей ждёт его до 11:30.", "them"]
      ],
      self: [
        ["Я сам разберусь.", "me"],
        ["Хорошо. Тогда не отвлекаю. Только почту проверь, там уже что-то от Андрея.", "them"]
      ],
      changed: [
        ["Что именно поменялось?", "me"],
        ["Да по мелочи. Людей двигают, обязанности пересматривают. Андрей ходит мрачнее обычного.", "them"],
        ["Ничего такого. Наверное.", "them"]
      ]
    };
    (sets[choice] || []).forEach(([text, side], index) => appendGuideMessage(container, text, side, `08:${50 + index}`));
  }

  function renderGuideOptions(replyPanel, state) {
    replyPanel.querySelector(".return-guide-options")?.remove();
    replyPanel.querySelector(".return-guide-summary")?.remove();

    if (state.choice) {
      replyPanel.classList.remove("return-guide-active");
      const summary = document.createElement("span");
      summary.className = "return-guide-summary";
      summary.textContent = state.choice === "refresh" ? "Дима напомнил основы работы." : "Разговор о возвращении завершён.";
      replyPanel.prepend(summary);
      return;
    }

    replyPanel.classList.add("return-guide-active");
    const options = document.createElement("div");
    options.className = "return-guide-options";
    [
      ["refresh", "Напомни, где что находится."],
      ["self", "Я сам разберусь."],
      ["changed", "Что именно поменялось?"]
    ].forEach(([choice, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "return-guide-button";
      button.textContent = label;
      button.addEventListener("click", () => {
        const current = readWelcome() || state;
        writeWelcome({ ...current, active: true, read: true, choice, chosenAt: Date.now() });
      });
      options.appendChild(button);
    });
    replyPanel.prepend(options);
  }

  document.addEventListener("DOMContentLoaded", queueDecorate, { once: true });
  window.addEventListener("until-friday-app-ready", queueDecorate);
  window.addEventListener("until-friday-state-change", queueDecorate);
  window.addEventListener("until-friday-ui-render", queueDecorate);
  queueDecorate();

  root.UntilFridayProfile = {
    playerName,
    terminalLogin,
    initials,
    readWelcome,
    decorate,
    replaceTextNodes
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
