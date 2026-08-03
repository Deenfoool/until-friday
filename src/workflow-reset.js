(function () {
  "use strict";

  const RESET_KEYS = [
    "until-friday-workflow-files-v1",
    "until-friday-profile-v1",
    "until-friday-return-welcome-v1"
  ];
  let resetRequested = false;

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#reset-button")) return;
    resetRequested = true;
    window.setTimeout(() => {
      resetRequested = false;
    }, 0);
  }, true);

  window.addEventListener("beforeunload", () => {
    if (!resetRequested) return;
    RESET_KEYS.forEach((key) => localStorage.removeItem(key));
  });
})();
