(function (root) {
  "use strict";

  const assets = {
    brand: {
      companyLogo: "assets/brand/company-logo.png",
      gameIcon: "assets/brand/game-icon.png"
    },
    backgrounds: {
      desktop: "assets/backgrounds/desktop-wallpaper.png",
      lockscreen: "assets/backgrounds/lockscreen-background.png",
      error: "assets/backgrounds/error-background.png"
    },
    apps: {
      explorer: "assets/icons/apps/explorer.png",
      mail: "assets/icons/apps/mail.png",
      chat: "assets/icons/apps/chat.png",
      tasks: "assets/icons/apps/tasks.png",
      terminal: "assets/icons/apps/terminal.png",
      finance: "assets/icons/apps/finance.png",
      journal: "assets/icons/system/system-log.png",
      trash: "assets/icons/system/trash-empty.png"
    },
    system: {
      trashEmpty: "assets/icons/system/trash-empty.png",
      trashFull: "assets/icons/system/trash-full.png",
      lockedAccess: "assets/icons/system/locked-access.png",
      systemLog: "assets/icons/system/system-log.png"
    },
    avatars: {
      player: "assets/avatars/player.png",
      friend: "assets/avatars/friend.png",
      gossip: "assets/avatars/gossip.png",
      secretary: "assets/avatars/secretary.png",
      chief: "assets/avatars/chief.png",
      accountant: "assets/avatars/accountant.png",
      admin: "assets/avatars/admin.png",
      hr: "assets/avatars/hr.png",
      newcomer: "assets/avatars/newcomer.png",
      default: "assets/avatars/default.png"
    },
    photos: {
      party: "assets/photos/office-party.jpg",
      emptyDesk: "assets/photos/empty-desk.jpg",
      boxes: "assets/photos/boxes-corridor.jpg"
    },
    documents: {
      contract: "assets/documents/contract-scan.png",
      memo: "assets/documents/memo-scan.png"
    },
    stamps: {
      confidential: "assets/stamps/confidential.png",
      company: "assets/stamps/company.png"
    },
    signatures: {
      director: "assets/signatures/director.png",
      accountant: "assets/signatures/accountant.png"
    },
    sprites: {
      systemStatus: "assets/sprites/system-status.png",
      fileTypes: "assets/sprites/file-types.png",
      folders: "assets/sprites/folders.png",
      employeeStatuses: "assets/sprites/employee-statuses.png",
      attachments: "assets/sprites/attachments.png",
      loading: "assets/sprites/loading.png"
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
      const label = button.textContent.trim().toLowerCase();
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
  }

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decorate, { once: true });
  else decorate();
})(typeof globalThis !== "undefined" ? globalThis : window);
