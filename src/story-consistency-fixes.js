(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayStoryConsistencyFixes) return;

  function ending(id) {
    return (Story.endings || []).find((item) => item.id === id) || null;
  }

  function patchRequirements() {
    const wednesday = Story.days?.[2]?.requirements?.find((item) => item.id === "wednesday-audit");
    if (wednesday) {
      wednesday.appliesWhen = { eventDelivered: "wed-security-audit" };
      wednesday.satisfiedWhen = {
        any: [
          { actionDone: "wed-audit-explain" },
          { actionDone: "wed-audit-delete" },
          { actionDone: "wed-audit-blame" },
          { not: { eventDelivered: "wed-security-audit" } }
        ]
      };
    }

    const thursday = Story.days?.[3]?.requirements?.find((item) => item.id === "thursday-choice");
    if (thursday) {
      thursday.satisfiedWhen = {
        any: [
          { actionDone: "thu-finish-project" },
          { actionDone: "thu-build-case" },
          { actionDone: "thu-resign" },
          { actionDone: "thu-frame-chief" }
        ]
      };
    }
  }

  function patchEvents() {
    const wrongReport = Story.events?.["mon-chief-angry"];
    if (wrongReport) {
      wrongReport.text = "Ты снова отправил черновик. Я исправлю цифры сам, но неверная версия останется в истории отправки.";
    }
  }

  function patchEndings() {
    const voluntary = ending("voluntary-exit");
    if (voluntary) {
      voluntary.text = "Заявление подано до объявления решения. Причину встречи сотрудник всё же услышал, но окончательный шаг сделал сам.";
    }

    const firedClean = ending("fired-clean");
    if (firedClean) {
      firedClean.text = "Кадровое решение было утверждено заранее. Рабочую неделю учтут отдельно, но теперь остаётся передать дела и получить документы.";
    }

    const falseAlarmClean = ending("false-alarm-clean");
    if (falseAlarmClean) {
      falseAlarmClean.requires = {
        all: [
          { truthIs: "contractor" },
          { statLt: ["suspicion", 4] },
          { statLte: ["collateral", 1] },
          { notFlag: "attemptedBlackmail" },
          { notFlag: "chiefFramed" }
        ]
      };
    }

    const falseAlarmDamage = ending("false-alarm-damage");
    if (falseAlarmDamage) {
      falseAlarmDamage.requires = {
        all: [
          { truthIs: "contractor" },
          {
            any: [
              { statGte: ["suspicion", 4] },
              { statGte: ["collateral", 2] },
              { flag: "attemptedBlackmail" },
              { flag: "chiefFramed" }
            ]
          }
        ]
      };
    }
  }

  patchRequirements();
  patchEvents();
  patchEndings();

  root.UntilFridayStoryConsistencyFixes = {
    patchRequirements,
    patchEvents,
    patchEndings
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
