(function (root) {
  "use strict";

  const assets = root.UNTIL_FRIDAY_ASSETS;
  if (!assets?.sprites) return;

  const atlases = {
    attachments: {
      source: assets.sprites.attachments,
      icons: {
        file: [122, 255, 117, 155],
        multipleFiles: [335, 255, 147, 155],
        image: [568, 254, 123, 155],
        spreadsheet: [789, 254, 123, 155],
        archive: [121, 576, 121, 149],
        protectedArchive: [335, 576, 124, 149],
        suspicious: [568, 574, 123, 154],
        damaged: [787, 574, 125, 152]
      }
    },
    statuses: {
      source: assets.sprites.employeeStatuses,
      icons: {
        online: [148, 281, 128, 139],
        away: [449, 281, 128, 142],
        busy: [735, 281, 130, 141],
        offline: [147, 584, 130, 147],
        doNotDisturb: [445, 584, 134, 144],
        blocked: [732, 583, 138, 148]
      }
    },
    folders: {
      source: assets.sprites.folders,
      icons: {
        normal: [102, 88, 212, 172],
        open: [390, 87, 224, 173],
        shared: [688, 88, 221, 174],
        protected: [103, 363, 218, 170],
        hidden: [402, 363, 216, 169],
        stacked: [687, 363, 222, 169],
        archive: [226, 662, 218, 173],
        accessError: [561, 662, 227, 180]
      }
    },
    files: {
      source: assets.sprites.fileTypes,
      icons: {
        text: [142, 123, 122, 135],
        spreadsheet: [449, 123, 122, 137],
        pdfLike: [736, 123, 117, 135],
        image: [142, 343, 119, 138],
        archive: [449, 344, 121, 138],
        executable: [736, 342, 119, 140],
        systemLog: [142, 558, 117, 140],
        unknown: [448, 558, 118, 140],
        protected: [736, 558, 117, 140],
        deleted: [449, 770, 122, 139]
      }
    },
    system: {
      source: assets.sprites.systemStatus,
      icons: {
        information: [160, 125, 126, 139],
        warning: [443, 125, 136, 136],
        criticalError: [729, 125, 132, 139],
        security: [169, 399, 109, 138],
        accessDenied: [455, 392, 139, 155],
        newMessage: [721, 402, 151, 128],
        newMail: [140, 714, 161, 117],
        networkConnected: [440, 706, 143, 139],
        networkLost: [714, 728, 178, 87]
      }
    }
  };

  const imageCache = new Map();

  function loadImage(url) {
    if (imageCache.has(url)) return imageCache.get(url);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Не удалось загрузить спрайт-лист: ${url}`));
      image.src = url;
    });
    imageCache.set(url, promise);
    return promise;
  }

  function createIcon(group, name, size = 32, options = {}) {
    const atlas = atlases[group];
    const crop = atlas?.icons?.[name];
    if (!atlas || !crop) throw new Error(`Неизвестный спрайт: ${group}.${name}`);

    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.className = options.className || "atlas-icon";
    canvas.width = Math.round(size * pixelRatio);
    canvas.height = Math.round(size * pixelRatio);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.setAttribute("aria-hidden", "true");

    loadImage(atlas.source).then((image) => {
      if (!canvas.isConnected && options.drawDetached !== true) return;
      const [sx, sy, sw, sh] = crop;
      const padding = Math.max(0, Number(options.padding ?? size * 0.08));
      const target = size - padding * 2;
      const scale = Math.min(target / sw, target / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      const context = canvas.getContext("2d");
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, size, size);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }).catch((error) => console.warn(error.message));

    return canvas;
  }

  function replace(target, group, name, size = 32, options = {}) {
    if (!target) return null;
    const icon = createIcon(group, name, size, options);
    target.replaceChildren(icon);
    return icon;
  }

  root.UntilFridaySprites = {
    atlases,
    createIcon,
    replace,
    loadImage
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
