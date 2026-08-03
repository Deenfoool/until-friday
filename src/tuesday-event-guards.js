(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story?.events) return;

  const guards = {
    "tue-client-thanks": "tue-client-confirm",
    "tue-client-escalation": "tue-client-delay",
    "tue-accountant-thanks": "tue-help-accountant"
  };

  Object.entries(guards).forEach(([eventId, actionId]) => {
    const event = Story.events[eventId];
    if (!event) return;
    const condition = { actionDone: actionId };
    event.requires = event.requires ? { all: [condition, event.requires] } : condition;
  });

  root.UntilFridayTuesdayEventGuards = guards;
})(typeof globalThis !== "undefined" ? globalThis : window);
