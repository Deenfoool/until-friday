(function (root, factory) {
  const story = typeof module === "object" && module.exports
    ? require("./story-v2.js")
    : root?.UNTIL_FRIDAY_STORY;
  if (typeof module === "object" && module.exports) require("./min-npc-dialogues.js");
  const api = factory(story);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UntilFridayMinNpcDialogueSchedules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Story) {
  "use strict";

  const VERSION = 1;
  const PATCH_KEY = "minNpcDialogueSchedulesVersion";
  const REPLY_SCHEDULES = {
    "mon-tell-friend": { eventId: "mon-friend-reply-truth", dayIndex: 0, minute: 535 },
    "mon-friend-hide": { eventId: "mon-friend-reply-hide", dayIndex: 0, minute: 534 },
    "mon-friend-probe": { eventId: "mon-friend-reply-probe", dayIndex: 0, minute: 535 },
    "mon-friend-ask-changes": { eventId: "mon-friend-reply-changes", dayIndex: 0, minute: 536 },
    "mon-friend-ask-who-knows": { eventId: "mon-friend-reply-who-knows", dayIndex: 0, minute: 545 },
    "mon-friend-request-silence": { eventId: "mon-friend-reply-silence", dayIndex: 0, minute: 544 },
    "mon-friend-back-off": { eventId: "mon-friend-reply-back-off", dayIndex: 0, minute: 544 },
    "tue-friend-ask-source": { eventId: "tue-friend-reply-source", dayIndex: 1, minute: 566 },
    "tue-friend-ask-cover": { eventId: "tue-friend-reply-cover", dayIndex: 1, minute: 567 },
    "tue-friend-stop-search": { eventId: "tue-friend-reply-stop", dayIndex: 1, minute: 565 },
    "tue-friend-tell-late": { eventId: "tue-friend-reply-late-truth", dayIndex: 1, minute: 564 },
    "tue-friend-dismiss-again": { eventId: "tue-friend-reply-dismiss-again", dayIndex: 1, minute: 560 },
    "tue-answer-admin-honest": { eventId: "tue-admin-reply-honest", dayIndex: 1, minute: 574 },
    "tue-answer-admin-lie": { eventId: "tue-admin-reply-lie", dayIndex: 1, minute: 572 },
    "tue-answer-admin-deflect": { eventId: "tue-admin-reply-deflect", dayIndex: 1, minute: 572 }
  };

  function patchStory(story = Story) {
    if (!story || typeof story !== "object") return story;
    story.metadata ||= {};
    if (Number(story.metadata[PATCH_KEY] || 0) >= VERSION) return story;

    for (const [actionId, reply] of Object.entries(REPLY_SCHEDULES)) {
      const action = story.actions?.[actionId];
      if (!action) continue;
      action.effects ||= {};
      action.effects.schedule ||= [];
      if (!action.effects.schedule.some((item) => item.eventId === reply.eventId)) {
        action.effects.schedule.push({ ...reply });
      }
    }

    const lateTruth = story.actions?.["tue-friend-tell-late"];
    if (lateTruth) {
      lateTruth.effects ||= {};
      lateTruth.effects.setFlags ||= {};
      lateTruth.effects.setFlags.toldFriend = true;
    }

    const morningRumor = story.events?.["tue-friend-rumor"];
    if (morningRumor) {
      morningRumor.requires = {
        all: [
          { flag: "toldFriend" },
          { notFlag: "toldFriendLate" }
        ]
      };
    }

    story.metadata[PATCH_KEY] = VERSION;
    return story;
  }

  patchStory();

  return {
    VERSION,
    REPLY_SCHEDULES,
    patchStory
  };
});