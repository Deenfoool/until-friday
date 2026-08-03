(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayThursdayEventGuards) return;

  const reactionMinutes = {
    "thu-finish-project": { "thu-project-reviewed": 610 },
    "thu-build-case": { "thu-case-archive-traced": 575 },
    "thu-resign": { "thu-resignation-draft-saved": 560 },
    "thu-frame-chief": { "thu-complaint-registered": 572 }
  };

  Object.entries(reactionMinutes).forEach(([actionId, events]) => {
    const schedule = Story.actions?.[actionId]?.effects?.schedule || [];
    schedule.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(events, item.eventId)) item.minute = events[item.eventId];
    });
  });

  const workflow = root.UntilFridayWorkflow;
  if (workflow?.saveAttachment && !workflow.__thursdayIconGuard) {
    const originalSaveAttachment = workflow.saveAttachment.bind(workflow);
    workflow.saveAttachment = function saveThursdayAttachment(file) {
      const safeFile = file?.icon === "protectedArchive" ? { ...file, icon: "protected" } : file;
      return originalSaveAttachment(safeFile);
    };
    workflow.__thursdayIconGuard = true;
  }

  root.UntilFridayThursdayEventGuards = reactionMinutes;
})(typeof globalThis !== "undefined" ? globalThis : window);
