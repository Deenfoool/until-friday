(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayFridayClockGuard) return;

  const SCENE_KEY = "until-friday-friday-scene-v1";
  const MEETING_ACTIONS = [
    "fri-meeting-calm",
    "fri-meeting-work",
    "fri-meeting-blackmail",
    "fri-send-resignation"
  ];
  let lastNoticeAt = 0;

  function engine() {
    return root.UntilFridayRuntimeEngine?.getEngine?.() || null;
  }

  function readScene() {
    try {
      const value = JSON.parse(localStorage.getItem(SCENE_KEY) || "null");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function meetingActionCompleted(state) {
    return MEETING_ACTIONS.some((id) => Boolean(state?.completedActions?.[id]));
  }

  function canFinishFriday(state) {
    return meetingActionCompleted(state) && readScene().completed === true;
  }

  function notify() {
    const now = Date.now();
    if (now - lastNoticeAt < 1000) return;
    lastNoticeAt = now;

    if (root.UntilFridayRuntimeEngine?.notify) {
      root.UntilFridayRuntimeEngine.notify("Пятница", "Сначала завершите встречу в переговорной №1.");
      return;
    }

    const container = document.querySelector("#notifications");
    if (!container) return;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification friday-clock-notification";
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = "Пятница";
    span.textContent = "Сначала завершите встречу в переговорной №1.";
    item.append(strong, span);
    item.addEventListener("click", () => item.remove());
    container.appendChild(item);
    window.setTimeout(() => item.remove(), 6500);
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("#clock")) return;
    const currentEngine = engine();
    const state = currentEngine?.getState?.();
    if (!state || state.ended || state.dayIndex !== Story.days.length - 1) return;
    if (canFinishFriday(state)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    notify();
    document.querySelector('.desktop-icon[data-app="tasks"]')
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  }, true);

  root.UntilFridayFridayClockGuard = {
    SCENE_KEY,
    MEETING_ACTIONS,
    meetingActionCompleted,
    canFinishFriday,
    readScene,
    engine
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
