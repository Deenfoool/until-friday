(function () {
  "use strict";

  const STORAGE_KEY = "until-friday-workflow-files-v1";
  let resetRequested = false;

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#reset-button")) return;
    resetRequested = true;
    window.setTimeout(() => {
      resetRequested = false;
    }, 0);
  }, true);

  window.addEventListener("beforeunload", () => {
    if (resetRequested) localStorage.removeItem(STORAGE_KEY);
  });
})();
