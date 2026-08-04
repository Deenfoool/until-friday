(function (root) {
  "use strict";

  if (root.UntilFridayOfficeWorkRequirements) return;

  const Story = root.UNTIL_FRIDAY_STORY;
  const Pack = root.UntilFridayOfficeWorkPack;
  const Runtime = root.UntilFridayRuntimeEngine;
  if (!Story || !Pack || !Array.isArray(Story.days)) return;

  const FLAG_PREFIX = "officeWorkQuotaDay";
  let pending = false;

  function flagForDay(dayIndex) {
    return `${FLAG_PREFIX}${Number(dayIndex)}`;
  }

  function installRequirements() {
    Story.days.forEach((day, dayIndex) => {
      day.requirements ||= [];
      const id = `office-work-quota-${day.id || dayIndex}`;
      if (day.requirements.some((item) => item.id === id)) return;
      day.requirements.push({
        id,
        label: `Не выполнена дневная норма: минимум ${Pack.DAILY_QUOTA} офисных поручений`,
        satisfiedWhen: { flag: flagForDay(dayIndex) },
        missedEffects: { stats: { work: -2, anxiety: 1 } }
      });
    });
  }

  function completedCount(state, dayIndex = state?.dayIndex) {
    const completed = state?.metadata?.officeWork?.completed || {};
    return Pack.tasksForDay(dayIndex).filter((task) => completed[task.id]).length;
  }

  function syncQuota(state) {
    if (!state || state.ended || !state.dayStarted) return;
    const dayIndex = Number(state.dayIndex);
    const flag = flagForDay(dayIndex);
    if (state.flags?.[flag] || completedCount(state, dayIndex) < Pack.DAILY_QUOTA || pending) return;

    pending = true;
    root.setTimeout?.(() => {
      pending = false;
      const current = Runtime?.getEngine?.();
      const latest = current?.getState?.();
      if (!latest || latest.dayIndex !== dayIndex || latest.flags?.[flag] || completedCount(latest, dayIndex) < Pack.DAILY_QUOTA) return;
      current.updateState((draft) => {
        draft.flags ||= {};
        draft.flags[flag] = true;
        draft.journal ||= [];
        draft.journal.push({
          id: `office-quota-${dayIndex}-${draft.minute}`,
          dayIndex,
          minute: draft.minute,
          type: "office-work",
          text: `Дневная норма офисных поручений выполнена: ${Pack.DAILY_QUOTA}`
        });
      }, "office-work-quota");
    }, 0);
  }

  installRequirements();
  root.addEventListener?.("until-friday-state-change", (event) => syncQuota(event.detail?.state));

  root.UntilFridayOfficeWorkRequirements = {
    FLAG_PREFIX,
    flagForDay,
    installRequirements,
    completedCount,
    syncQuota
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
