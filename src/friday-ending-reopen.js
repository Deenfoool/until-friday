(function () {
  "use strict";

  const SNAPSHOT_KEY = "until-friday-ending-snapshot-v1";
  let queued = false;
  let delayedCheck = null;

  function remember(overlay) {
    if (!overlay) return;
    try {
      sessionStorage.setItem(SNAPSHOT_KEY, overlay.outerHTML);
    } catch {
      // Session storage can be unavailable in private browser modes.
    }
  }

  function readSnapshot() {
    try {
      return sessionStorage.getItem(SNAPSHOT_KEY) || "";
    } catch {
      return "";
    }
  }

  function bindRestored(overlay) {
    if (!overlay || overlay.dataset.reopenBound === "true") return;
    overlay.dataset.reopenBound = "true";
    overlay.dataset.restoredEnding = "true";

    overlay.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        overlay.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("selected", item === button));
        overlay.querySelectorAll("[data-panel]").forEach((panel) => {
          panel.hidden = panel.dataset.panel !== button.dataset.tab;
        });
        remember(overlay);
      });
    });

    overlay.querySelector("[data-journal]")?.addEventListener("click", () => {
      remember(overlay);
      overlay.remove();
      document.querySelector('[data-app="journal"]')?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    overlay.querySelector("[data-restart]")?.addEventListener("click", () => {
      document.querySelector("#reset-button")?.click();
    });
  }

  function restoreBasicEnding() {
    const basic = document.querySelector(".ending-overlay");
    if (!basic) return false;
    const snapshot = readSnapshot();
    if (!snapshot) return false;

    const template = document.createElement("template");
    template.innerHTML = snapshot.trim();
    const restored = template.content.firstElementChild;
    if (!restored) return false;
    restored.removeAttribute("data-reopen-bound");
    basic.replaceWith(restored);
    bindRestored(restored);
    return true;
  }

  function inspectEnding() {
    const enhanced = document.querySelector(".friday-ending-overlay");
    if (enhanced) {
      remember(enhanced);
      if (enhanced.dataset.restoredEnding === "true") bindRestored(enhanced);
      return true;
    }
    return restoreBasicEnding();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      inspectEnding();
    });
  }

  function queueAfterLifecycle() {
    queue();
    if (delayedCheck !== null) window.clearTimeout(delayedCheck);
    delayedCheck = window.setTimeout(() => {
      delayedCheck = null;
      queue();
      requestAnimationFrame(queue);
    }, 0);
  }

  document.addEventListener("click", (event) => {
    queueAfterLifecycle();

    const overlay = event.target.closest(".friday-ending-overlay");
    if (!overlay) return;

    if (event.target.closest("[data-journal]")) remember(overlay);
    if (event.target.closest("[data-restart]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector("#reset-button")?.click();
    }
  }, true);

  window.addEventListener("until-friday-state-change", (event) => {
    if (event.detail?.state?.ended || event.detail?.reason === "game-ended") queueAfterLifecycle();
  });
  window.addEventListener("until-friday-ui-render", queueAfterLifecycle);
  window.addEventListener("until-friday-app-ready", queueAfterLifecycle);
  document.addEventListener("DOMContentLoaded", queueAfterLifecycle, { once: true });
  queueAfterLifecycle();

  window.UntilFridayEndingReopen = {
    remember,
    restoreBasicEnding,
    bindRestored,
    inspectEnding,
    queue
  };
})();
