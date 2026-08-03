(function (root) {
  "use strict";

  if (root.UntilFridayResetGuard) return;

  const LOCAL_RESET_KEYS = [
    "until-friday-save-v2",
    "until-friday-save-v1",
    "until-friday-intro-v2",
    "until-friday-workflow-files-v1",
    "until-friday-profile-v1",
    "until-friday-return-welcome-v1",
    "until-friday-friday-scene-v1",
    "until-friday-notification-history-v1"
  ];
  const SESSION_RESET_KEYS = [
    "until-friday-ending-snapshot-v1",
    "until-friday-auto-continue-v1"
  ];
  let resetInProgress = false;

  function remove(storage, keys) {
    for (const key of keys) {
      try { storage.removeItem(key); } catch { /* storage may be unavailable */ }
    }
  }

  function clearGameData() {
    remove(localStorage, LOCAL_RESET_KEYS);
    try { remove(sessionStorage, SESSION_RESET_KEYS); } catch { /* unavailable */ }
  }

  function clearExtendedDataForMenuNewGame() {
    remove(localStorage, [
      "until-friday-workflow-files-v1",
      "until-friday-friday-scene-v1",
      "until-friday-notification-history-v1",
      "until-friday-return-welcome-v1"
    ]);
    try { remove(sessionStorage, SESSION_RESET_KEYS); } catch { /* unavailable */ }
  }

  document.addEventListener("click", (event) => {
    const resetButton = event.target.closest?.("#reset-button");
    if (resetButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (resetInProgress) return;

      const accepted = root.confirm("Удалить сохранение и начать неделю заново?");
      if (!accepted) return;
      resetInProgress = true;
      clearGameData();
      root.location.reload();
      return;
    }

    if (event.target.closest?.("[data-new-game]")) {
      clearExtendedDataForMenuNewGame();
    }
  }, true);

  root.UntilFridayResetGuard = {
    LOCAL_RESET_KEYS,
    SESSION_RESET_KEYS,
    clearGameData,
    clearExtendedDataForMenuNewGame
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
