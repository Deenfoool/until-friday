(function (root) {
  "use strict";

  const Story = root.UNTIL_FRIDAY_STORY;
  if (!Story || root.UntilFridayStoryConsistencyFixes) return;

  function ending(id) {
    return (Story.endings || []).find((item) => item.id === id) || null;
  }

  function patchRequirements() {
    const monday = Story.days?.[0]?.requirements?.find((item) => item.id === "monday-core-work");
    if (monday) {
      monday.label = "Не выполнена хотя бы одна из двух основных рабочих задач";
      monday.satisfiedWhen = {
        all: [
          {
            any: [
              { actionDone: "mon-report-final" },
              { actionDone: "mon-report-old" }
            ]
          },
          {
            any: [
              { actionDone: "mon-invoice-fix" },
              { actionDone: "mon-invoice-report" }
            ]
          }
        ]
      };
    }

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

  function patchActionRequirements() {
    const complaint = Story.actions?.["thu-frame-chief"];
    if (complaint) {
      complaint.requires = {
        all: [
          { hasItem: "payment-list" },
          { statGte: ["access", 1] }
        ]
      };
    }
  }

  function patchEvents() {
    const wrongReport = Story.events?.["mon-chief-angry"];
    if (wrongReport) {
      wrongReport.text = "Ты снова отправил черновик. Я исправлю цифры сам, но неверная версия останется в истории отправки.";
    }

    const normalWednesday = Story.events?.["wed-normal-morning"];
    if (normalWednesday) {
      normalWednesday.requires = {
        all: [
          { statLt: ["suspicion", 2] },
          { notFlag: "requestedLeadershipAccess" },
          { not: { hasItem: "payment-list" } }
        ]
      };
    }
  }

  function patchEndings() {
    const voluntary = ending("voluntary-exit");
    if (voluntary) {
      voluntary.text = "Заявление подано до объявления решения. Причину встречи сотрудник всё же услышал, но окончательный шаг сделал сам.";
    }

    const savedByWork = ending("saved-by-work");
    if (savedByWork) {
      savedByWork.requires = {
        all: [
          { truthIs: "player" },
          { actionDone: "fri-meeting-work" },
          { statGte: ["work", 8] },
          { trustGte: ["chief", 1] },
          { statLt: ["suspicion", 5] },
          { notFlag: "chiefFramed" },
          { notFlag: "tamperedLogs" }
        ]
      };
    }

    const firedClean = ending("fired-clean");
    if (firedClean) {
      firedClean.text = "Кадровое решение было утверждено заранее. Рабочую неделю учтут отдельно, но теперь остаётся передать дела и получить документы.";
      firedClean.requires = {
        all: [
          { truthIs: "player" },
          {
            any: [
              { actionDone: "fri-meeting-calm" },
              { actionDone: "fri-meeting-work" }
            ]
          },
          { statLt: ["suspicion", 5] }
        ]
      };
    }

    const firedForCause = ending("fired-for-cause");
    if (firedForCause) {
      firedForCause.requires = {
        all: [
          { truthIs: "player" },
          {
            any: [
              { statGte: ["suspicion", 5] },
              { flag: "attemptedBlackmail" },
              { flag: "chiefFramed" },
              { flag: "tamperedLogs" },
              { flag: "blamedFriend" }
            ]
          }
        ]
      };
    }

    const blackmailDeal = ending("blackmail-deal");
    if (blackmailDeal) {
      blackmailDeal.requires = {
        all: [
          { actionDone: "fri-meeting-blackmail" },
          { statGte: ["evidence", 5] },
          { statLt: ["suspicion", 8] },
          { notFlag: "chiefFramed" }
        ]
      };
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
  patchActionRequirements();
  patchEvents();
  patchEndings();

  root.UntilFridayStoryConsistencyFixes = {
    patchRequirements,
    patchActionRequirements,
    patchEvents,
    patchEndings
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
