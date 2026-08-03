(function (root) {
  "use strict";

  const Onboarding = root.UntilFridayOnboarding;
  if (!Onboarding || root.UntilFridayAutoContinue) return;

  const AUTO_KEY = "until-friday-auto-continue-v1";
  const ENGINE_SAVE_KEY = root.UntilFridayMigration?.ENGINE_SAVE_KEY || "until-friday-save-v2";
  const LEGACY_SAVE_KEY = root.UntilFridayMigration?.LEGACY_SAVE_KEY || "until-friday-save-v1";
  const originalRun = Onboarding.run.bind(Onboarding);
  let expiryTimer = null;

  function clear() {
    try { sessionStorage.removeItem(AUTO_KEY); } catch { /* unavailable */ }
    if (expiryTimer) {
      window.clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  function mark() {
    try {
      sessionStorage.setItem(AUTO_KEY, "1");
      if (expiryTimer) window.clearTimeout(expiryTimer);
      expiryTimer = window.setTimeout(clear, 5000);
    } catch {
      // Automatic continuation is optional.
    }
  }

  function consume() {
    try {
      const active = sessionStorage.getItem(AUTO_KEY) === "1";
      clear();
      return active;
    } catch {
      return false;
    }
  }

  function hasSave() {
    try {
      return Boolean(localStorage.getItem(ENGINE_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
    } catch {
      return false;
    }
  }

  Onboarding.run = function runWithAutomaticContinue() {
    if (consume() && hasSave()) {
      Onboarding.applySettings?.();
      if (!Onboarding.readProfile?.()) {
        try {
          localStorage.setItem(Onboarding.PROFILE_KEY, JSON.stringify({
            name: "Сотрудник",
            createdAt: Date.now(),
            migrated: true
          }));
        } catch {
          // Profile personalization is optional for recovery.
        }
      }
      return Promise.resolve("continue-after-transition");
    }
    return originalRun();
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-start-next], [data-recovered-start]")) mark();
  }, true);

  root.UntilFridayAutoContinue = { AUTO_KEY, mark, consume, clear, hasSave };
})(typeof globalThis !== "undefined" ? globalThis : window);
