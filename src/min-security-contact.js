(function (root) {
  "use strict";

  if (root.UntilFridayMinSecurityContact) return;

  const Integration = root.UntilFridayMinDesktopIntegration;
  if (!Integration?.WORK_CONTACTS) return;

  const CONTACT = Object.freeze({
    key: "security",
    userId: "work-security",
    chatId: "work-chat-security",
    name: "Виктор Сергеев",
    username: "v.sergeev",
    role: "служба безопасности",
    color: "#596a76",
    status: "внутренняя сеть"
  });
  const AVATAR = "assets/avatar-hr-men.png";
  let scheduled = false;

  function ensureContact() {
    const existing = Integration.WORK_CONTACTS.find((item) => item.key === CONTACT.key);
    if (!existing) Integration.WORK_CONTACTS.splice(Integration.WORK_CONTACTS.length - 1, 0, { ...CONTACT });
    return Integration.WORK_CONTACTS.find((item) => item.key === CONTACT.key) || CONTACT;
  }

  function applyAvatar(element, label) {
    if (!element || element.dataset.minSecurityAvatar === AVATAR) return;
    element.dataset.minSecurityAvatar = AVATAR;
    element.classList.add("min-avatar-image");
    element.textContent = "";
    const image = root.document.createElement("img");
    image.src = AVATAR;
    image.alt = label || CONTACT.name;
    element.appendChild(image);
  }

  function decorate() {
    scheduled = false;
    root.document?.querySelectorAll?.(`.min-chat-row[data-min-chat="${CONTACT.chatId}"] .min-avatar`)
      .forEach((element) => applyAvatar(element, CONTACT.name));
    root.document?.querySelectorAll?.(`[data-min-open-user="${CONTACT.userId}"] .min-avatar`)
      .forEach((element) => applyAvatar(element, CONTACT.name));
    root.document?.querySelectorAll?.(`.min-conversation[data-chat-id="${CONTACT.chatId}"]`)
      .forEach((conversation) => {
        applyAvatar(conversation.querySelector("header .min-avatar"), CONTACT.name);
        const app = conversation.closest(".min-app");
        applyAvatar(app?.querySelector(".min-info-profile .min-avatar"), CONTACT.name);
      });
  }

  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    const schedule = typeof root.requestAnimationFrame === "function"
      ? root.requestAnimationFrame.bind(root)
      : (callback) => root.setTimeout?.(callback, 0);
    schedule(decorate);
  }

  function sync() {
    ensureContact();
    Integration.syncStoryMessages?.();
    root.UntilFridayMinWorkspace?.syncWorkspace?.({ reason: "security-contact-sync" });
    scheduleDecorate();
  }

  ensureContact();
  root.addEventListener?.("until-friday-app-ready", sync);
  root.addEventListener?.("until-friday-state-change", sync);
  root.addEventListener?.("until-friday-min-state-change", scheduleDecorate);
  root.addEventListener?.("until-friday-ui-render", scheduleDecorate);

  if (typeof root.MutationObserver === "function" && root.document?.documentElement) {
    const observer = new root.MutationObserver(scheduleDecorate);
    observer.observe(root.document.documentElement, { childList: true, subtree: true });
  }

  root.UntilFridayMinSecurityContact = {
    CONTACT,
    AVATAR,
    ensureContact,
    sync,
    decorate
  };

  sync();
})(typeof globalThis !== "undefined" ? globalThis : window);
