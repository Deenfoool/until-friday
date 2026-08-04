(function (root) {
  "use strict";
  if (root.UntilFridayVideoPlatformRuntimeFixes) return;

  const Pack = root.UntilFridayVideoContentPack;
  const BrowserUI = root.UntilFridayPersonalBrowserUIV2;
  if (!Pack || !BrowserUI) return;

  const FALLBACK_THUMB = "https://img.icons8.com/fluency/240/video.png";
  let queued = false;
  let attempts = 0;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function repairShorts() {
    const strip = document.querySelector(".personal-browser-window[data-video-platform-active='true'] .vl-shorts>div");
    if (!strip) {
      if (attempts < 4) {
        attempts += 1;
        root.setTimeout?.(repairShorts, 20);
        return;
      }
      queued = false;
      attempts = 0;
      return;
    }

    queued = false;
    attempts = 0;
    if (strip.dataset.vlShortsRepaired === "true") return;

    const videos = Pack.VIDEOS.filter((video) => video.channelId === "short-weird");
    strip.innerHTML = videos.map((video) => `<article class="vl-short-card">
      <button data-vl-short-open="${video.id}">
        <div class="vl-short-thumb"><img src="${video.thumbnail}" data-vl-short-thumb alt="${esc(video.title)}"><time>${esc(video.duration)}</time></div>
        <h3>${esc(video.title)}</h3>
        <p>${esc(video.views)}</p>
      </button>
    </article>`).join("");
    strip.dataset.vlShortsRepaired = "true";

    strip.querySelectorAll("img[data-vl-short-thumb]").forEach((image) => {
      image.addEventListener("error", () => {
        image.onerror = null;
        image.src = FALLBACK_THUMB;
        image.closest(".vl-short-thumb")?.classList.add("fallback");
      }, { once: true });
    });

    strip.querySelectorAll("[data-vl-short-open]").forEach((button) => {
      button.addEventListener("click", () => {
        const video = Pack.VIDEO_BY_ID[button.dataset.vlShortOpen];
        if (!video) return;
        BrowserUI.navigate("video", {
          url: `https://video.local/watch/${video.id}`,
          title: `${video.title} — ВидеоЛента`
        });
        root.setTimeout?.(() => root.UntilFridayVideoPlatformParody?.schedule?.(), 0);
      });
    });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    attempts = 0;
    root.setTimeout?.(repairShorts, 0);
  }

  root.addEventListener?.("until-friday-app-ready", schedule);
  root.addEventListener?.("until-friday-state-change", schedule);
  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "browser") schedule();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".personal-browser-window")) schedule();
  }, true);

  root.UntilFridayVideoPlatformRuntimeFixes = { repairShorts, schedule };
})(typeof globalThis !== "undefined" ? globalThis : window);
