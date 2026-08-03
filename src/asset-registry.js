(function (root) {
  "use strict";

  const assets = {
    brand: {
      companyLogo: "assets/logo.png",
      gameIcon: "assets/icon-until-friday.png"
    },
    backgrounds: {
      desktop: "assets/wallpaper-desktop.png",
      lockscreen: "assets/image-lock-pc.png",
      error: "assets/image-background-system-error.png"
    },
    apps: {
      explorer: "assets/icon-explorer.png",
      mail: "assets/icon-mail.png",
      chat: "assets/icon-messenger.png",
      tasks: "assets/icno-task.png",
      terminal: "assets/icon-console.png",
      finance: "assets/icon-finance.png",
      journal: "assets/icon-log-entry.png",
      trash: "assets/icon-trash-can-empty.png"
    },
    system: {
      trashEmpty: "assets/icon-trash-can-empty.png",
      trashFull: "assets/icon-trash-can-full.png",
      lockedAccess: "assets/icon-private-access.png",
      systemLog: "assets/icon-log-entry.png"
    },
    avatars: {
      player: "assets/avatar-main-character.png",
      friend: "assets/avatar-friend.png",
      gossip: "assets/avatar-tattler.png",
      secretary: "assets/avatar-secretary.png",
      chief: "assets/avatar-director.png",
      accountant: "assets/avatar-accountant.png",
      admin: "assets/avatar-sysadmin.png",
      hr: "assets/avatar-hr-men.png",
      newcomer: "assets/avatar-young-boy.png",
      default: "assets/avatar-default-user.png"
    },
    photos: {
      party: "assets/image-corporativ.jpg",
      emptyDesk: "assets/image-empty-workplace.png",
      boxes: "assets/image-boxes-hallway.png"
    },
    documents: {
      contract: "assets/image-old-agreement.png",
      memo: "assets/image-office-memo.png"
    },
    stamps: {
      confidential: "assets/image-red-seal-confidential.png",
      company: "assets/image-blue-round-seal-company.png"
    },
    signatures: {
      director: "assets/image-director-signature.png",
      accountant: "assets/image-accountant-signature.png"
    },
    sprites: {
      systemStatus: "assets/assets-system-icons.png",
      fileTypes: "assets/assets-file-icons.png",
      folders: "assets/assets-folder.png",
      employeeStatuses: "assets/assets-employee-statuses.png",
      attachments: "assets/assets-email-attachments.png"
    }
  };

  root.UNTIL_FRIDAY_ASSETS = assets;

  const loaded = new Map();
  function probe(url) {
    if (loaded.has(url)) return loaded.get(url);
    const promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
    loaded.set(url, promise);
    return promise;
  }

  function decorateImage(container, url, className) {
    if (!container || container.dataset.assetApplied === url) return;
    probe(url).then((exists) => {
      if (!exists || !container.isConnected) return;
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.className = className;
      container.replaceChildren(image);
      container.dataset.assetApplied = url;
    });
  }

  function decorateApps() {
    document.querySelectorAll(".desktop-icon[data-app]").forEach((button) => {
      const url = assets.apps[button.dataset.app];
      if (url) decorateImage(button.querySelector(".desktop-icon__glyph"), url, "asset-app-icon");
    });

    document.querySelectorAll(".start-app").forEach((button) => {
      const label = button.querySelector("span:last-child")?.textContent.trim().toLowerCase() || "";
      const appId = {
        "проводник": "explorer",
        "почта": "mail",
        "связь": "chat",
        "задачи": "tasks",
        "терминал": "terminal",
        "журнал": "journal",
        "корзина": "trash"
      }[label];
      if (appId && assets.apps[appId]) decorateImage(button.querySelector(".desktop-icon__glyph"), assets.apps[appId], "asset-app-icon");
    });
  }

  function decorateContacts() {
    const avatarByName = {
      "Дима Орлов": assets.avatars.friend,
      "Олег Казанцев": assets.avatars.gossip,
      "Роман Белов": assets.avatars.admin,
      "Андрей Соколов": assets.avatars.chief,
      "Марина Лебедева": assets.avatars.accountant
    };

    document.querySelectorAll(".contact").forEach((button) => {
      if (button.querySelector(".contact-avatar")) return;
      const name = button.querySelector("strong")?.textContent.trim();
      const url = avatarByName[name] || assets.avatars.default;
      probe(url).then((exists) => {
        if (!exists || !button.isConnected || button.querySelector(".contact-avatar")) return;
        const image = document.createElement("img");
        image.src = url;
        image.alt = "";
        image.className = "contact-avatar";
        button.prepend(image);
      });
    });
  }

  function decorateShell() {
    probe(assets.backgrounds.desktop).then((exists) => {
      if (exists) document.documentElement.style.setProperty("--until-friday-wallpaper", `url("${assets.backgrounds.desktop}")`);
    });
    decorateImage(document.querySelector(".desktop-brand__mark"), assets.brand.companyLogo, "asset-company-logo");
    decorateImage(document.querySelector(".user-avatar"), assets.avatars.player, "asset-user-avatar");
    probe(assets.brand.gameIcon).then((exists) => {
      if (!exists) return;
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = assets.brand.gameIcon;
    });
  }

  function decorate() {
    decorateShell();
    decorateApps();
    decorateContacts();
  }

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decorate, { once: true });
  else decorate();
})(typeof globalThis !== "undefined" ? globalThis : window);
