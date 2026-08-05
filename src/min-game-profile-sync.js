(function (root) {
  "use strict";

  if (root.UntilFridayMinGameProfileSync) return;

  const PROFILE_KEY = root.UntilFridayOnboarding?.PROFILE_KEY || "until-friday-profile-v1";
  const MIN_STORAGE_KEY = root.UntilFridayMinMessenger?.STORAGE_KEY || "until-friday-min-messenger-v1";
  let queued = false;
  let syncing = false;

  function readJson(key) {
    try {
      const value = JSON.parse(root.localStorage?.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function normalizeName(value) {
    const onboarding = root.UntilFridayOnboarding;
    const normalized = typeof onboarding?.normalizeName === "function"
      ? onboarding.normalizeName(value)
      : String(value || "").replace(/\s+/g, " ").trim().slice(0, 24);

    if (!normalized) return "";
    if (typeof onboarding?.validName === "function") {
      return onboarding.validName(normalized) ? normalized : "";
    }
    return normalized.length >= 2 ? normalized : "";
  }

  function gameProfileName() {
    return normalizeName(readJson(PROFILE_KEY)?.name);
  }

  function alreadySynchronized(state, name) {
    const self = state?.users?.find?.((user) => user?.id === "self");
    return state?.profile?.name === name && self?.name === name;
  }

  function sync(reason = "game-profile") {
    const messenger = root.UntilFridayMinMessenger;
    const name = gameProfileName();
    if (!messenger?.updateProfile || !messenger?.getState || !name || syncing) return false;

    const state = messenger.getState();
    if (alreadySynchronized(state, name)) return true;

    syncing = true;
    try {
      messenger.updateProfile({ name });
    } finally {
      syncing = false;
    }
    return true;
  }

  function queue(reason = "game-profile") {
    if (queued) return;
    queued = true;
    const schedule = typeof root.queueMicrotask === "function"
      ? root.queueMicrotask.bind(root)
      : (callback) => Promise.resolve().then(callback);
    schedule(() => {
      queued = false;
      sync(reason);
    });
  }

  function isProfileForm(target) {
    return Boolean(target?.matches?.("[data-min-profile-form]"));
  }

  function isMinReset(target) {
    return Boolean(target?.closest?.("[data-min-reset]"));
  }

  document.addEventListener("submit", (event) => {
    if (!isProfileForm(event.target)) return;
    root.setTimeout?.(() => sync("min-profile-submit"), 0);
  }, true);

  document.addEventListener("click", (event) => {
    if (!isMinReset(event.target)) return;
    root.setTimeout?.(() => sync("min-reset"), 0);
  }, true);

  root.addEventListener?.("storage", (event) => {
    if (event.key === PROFILE_KEY || event.key === MIN_STORAGE_KEY) queue("storage");
  });
  root.addEventListener?.("until-friday-app-ready", () => queue("app-ready"));
  root.addEventListener?.("until-friday-ui-render", (event) => {
    const appId = String(event.detail?.appId || "");
    if (appId === "chat" || appId === "browser") queue("ui-render");
  });

  queue("startup");

  root.UntilFridayMinGameProfileSync = {
    PROFILE_KEY,
    MIN_STORAGE_KEY,
    readJson,
    normalizeName,
    gameProfileName,
    alreadySynchronized,
    sync,
    queue,
    isProfileForm,
    isMinReset
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
