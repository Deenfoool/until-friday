(function () {
  "use strict";

  const SNAPSHOT_KEY = "until-friday-ending-snapshot-v1";
  let queued = false;

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
    if (!basic) return;
    const snapshot = readSnapshot();
    if (!snapshot) return;

    const template = document.createElement("template");
    template.innerHTML = snapshot.trim();
    const restored = template.content.firstElementChild;
    if (!restored) return;
    restored.removeAttribute("data-reopen-bound");
    basic.replaceWith(restored);
    bindRestored(restored);
  }

  document.addEventListener("click", (event) => {
    const overlay = event.target.closest(".friday-ending-overlay");
    if (!overlay) return;

    if (event.target.closest("[data-journal]")) remember(overlay);
    if (event.target.closest("[data-restart]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector("#reset-button")?.click();
    }
  }, true);

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const enhanced = document.querySelector(".friday-ending-overlay");
      if (enhanced) {
        remember(enhanced);
        if (enhanced.dataset.restoredEnding === "true") bindRestored(enhanced);
      } else {
        restoreBasicEnding();
      }
    });
  }

  const observer = new MutationObserver(queue);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", queue, { once: true });
  queue();

  window.UntilFridayEndingReopen = { remember, restoreBasicEnding, bindRestored };
})();
