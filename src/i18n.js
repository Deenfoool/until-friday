(function (root) {
  "use strict";
  if (root.UntilFridayI18n) return;
  const SETTINGS_KEY = "until-friday-settings-v1";
  const LANGUAGES = Object.freeze(["ru", "en"]);
  const originals = new WeakMap();
  let scheduled = false;

  function normalizeLanguage(language) {
    return language === "en" ? "en" : "ru";
  }
  function readSettings() {
    try {
      const parsed = JSON.parse(root.localStorage?.getItem(SETTINGS_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  }
  let language = normalizeLanguage(readSettings().language);
  function currentLanguage() { return language; }

  function translate(value, locale = language) {
    const input = String(value ?? "");
    if (locale !== "en" || !/[А-Яа-яЁё]/.test(input)) return input;
    const match = input.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return input;
    const body = match[2];
    const dict = root.UntilFridayEnglish || {};
    const exact = dict[body];
    if (typeof exact === "string") return match[1] + exact + match[3];

    // Dynamic counters and date prefixes are presentation-only, never identifiers.
    const dynamic = [
      [/^Рабочих поручений:\s*(\d+)\s*·\s*других действий:\s*(\d+)$/, (_, a, b) => "Work assignments: " + a + " · other actions: " + b],
      [/^Слов:\s*(\d+)$/, (_, n) => "Words: " + n],
      [/^Следующее поручение появится в\s*(.*)$/, (_, t) => "Next assignment arrives at " + t],
      [/^(\d+)\s*писем$/, (_, n) => n + " emails"],
      [/^(\d+)\s*контакта?$/, (_, n) => n + " contacts"],
      [/^(\d+)\s*доступных действий$/, (_, n) => n + " available actions"],
      [/^([Пп]онедельник|[Вв]торник|[Сс]реда|[Чч]етверг|[Пп]ятница) заверш[её]н$/, (_, day) => (dict[day] || day) + " complete"],
      [/^(ПН|ВТ|СР|ЧТ|ПТ),\s*(\d+)\s+АВГ$/, (_, day, d) => (dict[day] || day) + ", Aug " + d],
      [/^(.+)\s*·\s*(\d+)\s*мин\.$/, (_, a, n) => translate(a, "en") + " · " + n + " min"],
      [/^(\d+)\s*мин\.$/, (_, n) => n + " min"],
      [/^(.+):\s*(\d+)\s*мин\.$/, (_, a, n) => translate(a, "en") + ": " + n + " min"],
      [/^Вложение:\s*(.*)$/, (_, x) => "Attachment: " + x],
      [/^Письмо отправлено\. Вложение:\s*(.*)$/, (_, x) => "Email sent. Attachment: " + x],
      [/^Исходное сообщение:\s*(.*)$/, (_, x) => "Original message: " + x],
      [/^(.+)\s+·\s+результат сохраняется$/, (_, a) => translate(a, "en") + " · result saved"],
      [/^(.+)\s+·\s+(\d+)\s+минут\s+·\s+результат сохраняется$/, (_, a, n) => translate(a, "en") + " · " + n + " min · autosaved"]
    ];
    for (const [pattern, handler] of dynamic) {
      if (pattern.test(body)) return match[1] + body.replace(pattern, handler) + match[3];
    }

    // Multi-line letters/documents can contain independently translated paragraphs.
    if (body.includes("\n")) {
      const lines = body.split("\n");
      const translated = lines.map((line) => translate(line, "en"));
      if (translated.some((line, i) => line !== lines[i])) {
        return match[1] + translated.join("\n") + match[3];
      }
    }
    return input; // Do not guess at meaning or modify unknown gameplay data.
  }

  function shouldSkip(element) {
    if (!element || typeof element.closest !== "function") return false;
    return Boolean(element.closest("script,style,noscript,textarea,code,pre,[contenteditable],.terminal-output"));
  }
  function contextualTranslation(value, element) {
    const source = String(value ?? "").trim();
    if (language !== "en") return translate(value);
    if (source === "Корзина") {
      const label = element?.closest?.(".kp-app") ? "Cart" : "Recycle Bin";
      return String(value).replace(source, label);
    }
    if (source === "Связь") {
      const label = element?.closest?.(".office-sheet") ? "Connectivity" : "Messages";
      return String(value).replace(source, label);
    }
    return translate(value);
  }

  function translateNode(node) {
    if (!node?.nodeValue || shouldSkip(node.parentElement)) return;
    const shown = node.nodeValue;
    let original = originals.get(node);
    if (!original || (shown !== original.source && shown !== original.result)) {
      original = { source: shown, result: shown };
    }
    const next = contextualTranslation(original.source, node.parentElement);
    if (shown !== next) node.nodeValue = next;
    original.result = next;
    originals.set(node, original);
  }
  function translateAttributes(element) {
    if (!element || shouldSkip(element)) return;
    for (const attribute of ["placeholder", "title", "aria-label", "alt"]) {
      if (!element.hasAttribute?.(attribute)) continue;
      const key = "data-i18n-original-" + attribute;
      const existing = element.getAttribute(attribute);
      const cached = element.getAttribute(key);
      const source = cached || existing;
      if (!cached && source !== contextualTranslation(source, element)) element.setAttribute(key, source);
      const next = contextualTranslation(source, element);
      if (existing !== next) element.setAttribute(attribute, next);
    }
  }
  function apply(container = root.document?.body) {
    if (!container || !root.document) return;
    root.document.documentElement.lang = language;
    root.document.title = language === "en" ? "Until Friday" : "До пятницы";
    if (container.nodeType === 3) return translateNode(container);
    if (container.nodeType !== 1 && container.nodeType !== 9) return;
    if (container.nodeType === 1) translateAttributes(container);
    container.querySelectorAll?.("[placeholder],[title],[aria-label],[alt]")?.forEach(translateAttributes);
    const walker = root.document.createTreeWalker(container, root.NodeFilter?.SHOW_TEXT || 4);
    let node;
    while ((node = walker.nextNode())) translateNode(node);
  }
  function queue() {
    if (scheduled || !root.document) return;
    scheduled = true;
    // Other app decorators listen to the same lifecycle and must run before translation.
    const raf = root.requestAnimationFrame || ((callback) => root.setTimeout(callback, 0));
    raf(() => raf(() => {
      scheduled = false;
      apply(root.document.body);
    }));
  }

  function setLanguage(nextLanguage) {
    language = normalizeLanguage(nextLanguage);
    const settings = readSettings();
    if (settings.language !== language) {
      try { root.localStorage?.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, language })); }
      catch (error) { console.warn("Could not persist language preference", error); }
    }
    apply();
    root.dispatchEvent?.(new CustomEvent("until-friday-language-change", { detail: { language } }));
    return language;
  }

  root.addEventListener?.("until-friday-ui-render", queue);
  root.addEventListener?.("until-friday-state-change", queue);
  root.addEventListener?.("until-friday-app-ready", queue);
  root.addEventListener?.("until-friday-min-state-change", queue);
  root.document?.addEventListener?.("click", queue, true);
  root.document?.addEventListener?.("change", queue, true);
  root.document?.addEventListener?.("DOMContentLoaded", queue, { once: true });

  root.UntilFridayI18n = Object.freeze({
    LANGUAGES,
    currentLanguage,
    readSettings,
    translate,
    apply,
    queue,
    setLanguage
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
