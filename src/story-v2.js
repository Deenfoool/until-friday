(function (root, factory) {
  const story = factory();
  if (typeof module === "object" && module.exports) module.exports = story;
  if (root) root.UNTIL_FRIDAY_STORY = story;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  return {
    id: "until-friday-main",
    version: 2,
    title: "До пятницы",
    initialAccess: ["personal", "shared", "support"],
    initialTrust: { friend: 0, gossip: 0, admin: 0, chief: 0, accountant: 0, hr: 0 },
    initialFlags: { heardConversation: true },

    truths: [
      { id: "player", weight: 3, description: "К увольнению изначально готовили Илью." },
      { id: "newcomer", weight: 2, description: "К увольнению готовили молодого сотрудника Кирилла." },
      { id: "department", weight: 2, description: "Компания планировала сокращение всего отдела." },
      { id: "contractor", weight: 2, description: "Разговор относился к подрядчику, а не к сотруднику." }
    ],

    days: [
      {
        id: "monday",
        title: "Понедельник",
        dateLabel: "3 августа",
        startMinute: 527,
        requirements: [
          {
            id: "monday-core-work",
            label: "Не выполнены обе основные рабочие задачи",
            satisfiedWhen: {
              any: [
                { actionDone: "mon-report-final" },
                { actionDone: "mon-invoice-fix" },
                { actionDone: "mon-invoice-report" }
              ]
            },
            missedEffects: { stats: { work: -2, anxiety: 1 } }
          }
        ]
      },
      {
        id: "tuesday",
        title: "Вторник",
        dateLabel: "4 августа",
        startMinute: 535,
        startEffects: { stats: { anxiety: 1 } },
        requirements: [
          {
            id: "tuesday-client",
            label: "Клиент остался без ответа",
            satisfiedWhen: { any: [{ actionDone: "tue-client-confirm" }, { actionDone: "tue-client-delay" }] },
            missedEffects: { stats: { work: -2 }, setFlags: { clientEscalated: true } }
          }
        ]
      },
      {
        id: "wednesday",
        title: "Среда",
        dateLabel: "5 августа",
        startMinute: 530,
        requirements: [
          {
            id: "wednesday-audit",
            label: "Проверка журнала проигнорирована",
            satisfiedWhen: {
              any: [
                { actionDone: "wed-audit-explain" },
                { actionDone: "wed-audit-delete" },
                { actionDone: "wed-audit-blame" }
              ]
            },
            missedEffects: { stats: { suspicion: 2, work: -1 } }
          }
        ]
      },
      {
        id: "thursday",
        title: "Четверг",
        dateLabel: "6 августа",
        startMinute: 540,
        requirements: [
          {
            id: "thursday-choice",
            label: "Не подготовлена позиция перед пятницей",
            satisfiedWhen: {
              any: [
                { actionDone: "thu-finish-project" },
                { actionDone: "thu-build-case" },
                { actionDone: "thu-resign" }
              ]
            },
            missedEffects: { stats: { anxiety: 2 } }
          }
        ]
      },
      {
        id: "friday",
        title: "Пятница",
        dateLabel: "7 августа",
        startMinute: 545,
        requirements: []
      }
    ],

    actions: {
      "mon-report-final": {
        id: "mon-report-final",
        dayIndex: 0,
        channel: "tasks",
        label: "Отправить финальную версию отчёта",
        minutes: 18,
        once: true,
        result: "Финальная версия отчёта отправлена начальнику.",
        effects: {
          stats: { work: 2 },
          setFlags: { reportCorrect: true },
          schedule: [{ eventId: "mon-chief-thanks", dayIndex: 0, minute: 690 }]
        }
      },
      "mon-report-old": {
        id: "mon-report-old",
        dayIndex: 0,
        channel: "tasks",
        label: "Отправить старый черновик",
        minutes: 14,
        once: true,
        result: "Начальнику отправлен черновик с неверными цифрами.",
        effects: {
          stats: { work: -2, anxiety: 1 },
          setFlags: { reportWrong: true },
          schedule: [{ eventId: "mon-chief-angry", dayIndex: 0, minute: 675 }]
        }
      },
      "mon-copy-reports": {
        id: "mon-copy-reports",
        dayIndex: 0,
        channel: "explorer",
        label: "Скопировать обе версии отчёта",
        minutes: 8,
        once: true,
        result: "Копии отчётов сохранены в личной папке.",
        effects: { stats: { suspicion: 1 }, addItems: ["report-old", "report-final"] }
      },
      "mon-invoice-fix": {
        id: "mon-invoice-fix",
        dayIndex: 0,
        channel: "tasks",
        label: "Исправить лишний ноль",
        minutes: 20,
        once: true,
        result: "Ошибка в счёте исправлена и передана бухгалтеру.",
        effects: {
          stats: { work: 2 },
          trust: { accountant: 1 },
          setFlags: { invoiceFixed: true },
          schedule: [{ eventId: "tue-accountant-request", dayIndex: 1, minute: 590 }]
        }
      },
      "mon-invoice-report": {
        id: "mon-invoice-report",
        dayIndex: 0,
        channel: "tasks",
        label: "Передать счёт начальнику как нарушение",
        minutes: 22,
        once: true,
        result: "Копия счёта сохранена как возможный компромат.",
        effects: {
          stats: { work: 1, evidence: 1, anxiety: 1 },
          addItems: ["invoice-copy"],
          setFlags: { invoiceEscalated: true },
          schedule: [{ eventId: "tue-chief-invoice", dayIndex: 1, minute: 610 }]
        }
      },
      "mon-open-vacancy": {
        id: "mon-open-vacancy",
        dayIndex: 0,
        channel: "explorer",
        label: "Открыть проект вакансии",
        minutes: 4,
        once: true,
        result: "Найдена вакансия с названием должности Ильи.",
        effects: { stats: { anxiety: 2 }, setFlags: { sawVacancy: true } }
      },
      "mon-request-leadership-access": {
        id: "mon-request-leadership-access",
        dayIndex: 0,
        channel: "explorer",
        label: "Запросить доступ к папке руководства",
        minutes: 5,
        once: true,
        result: "Запрос на доступ отправлен системному администратору.",
        effects: {
          stats: { suspicion: 2, anxiety: 1 },
          trust: { admin: -1 },
          setFlags: { requestedLeadershipAccess: true },
          schedule: [{ eventId: "tue-admin-question", dayIndex: 1, minute: 565 }]
        }
      },
      "mon-tell-friend": {
        id: "mon-tell-friend",
        dayIndex: 0,
        channel: "chat",
        label: "Рассказать Диме о разговоре",
        minutes: 5,
        once: true,
        result: "Дима обещал осторожно узнать, что происходит.",
        effects: {
          stats: { anxiety: -1 },
          trust: { friend: 2 },
          setFlags: { toldFriend: true },
          schedule: [{ eventId: "tue-friend-rumor", dayIndex: 1, minute: 555 }]
        }
      },

      "tue-client-confirm": {
        id: "tue-client-confirm",
        dayIndex: 1,
        channel: "tasks",
        label: "Подтвердить профилактические работы",
        minutes: 16,
        once: true,
        result: "Клиент получил подтверждение и инструкцию.",
        effects: { stats: { work: 2 }, setFlags: { clientHandled: true } }
      },
      "tue-client-delay": {
        id: "tue-client-delay",
        dayIndex: 1,
        channel: "tasks",
        label: "Отложить ответ до среды",
        minutes: 4,
        once: true,
        result: "Ответ клиенту снова отложен.",
        effects: { stats: { work: -2, anxiety: 1 }, setFlags: { clientDelayed: true } }
      },
      "tue-help-accountant": {
        id: "tue-help-accountant",
        dayIndex: 1,
        channel: "tasks",
        label: "Помочь бухгалтеру сверить ещё три счёта",
        minutes: 28,
        once: true,
        requires: { eventDelivered: "tue-accountant-request" },
        result: "Дополнительные счета проверены без ошибок.",
        effects: { stats: { work: 2 }, trust: { accountant: 2 }, addAccess: ["finance-read"] }
      },
      "tue-copy-payment-list": {
        id: "tue-copy-payment-list",
        dayIndex: 1,
        channel: "explorer",
        label: "Скопировать список платежей",
        minutes: 12,
        once: true,
        requires: { hasAccess: "finance-read" },
        result: "Служебный список платежей сохранён в личном архиве.",
        effects: { stats: { suspicion: 2, evidence: 1 }, addItems: ["payment-list"] }
      },
      "tue-answer-admin-honest": {
        id: "tue-answer-admin-honest",
        dayIndex: 1,
        channel: "chat",
        label: "Признаться, что искал документы о пятнице",
        minutes: 6,
        once: true,
        requires: { eventDelivered: "tue-admin-question" },
        result: "Администратор посоветовал больше не лезть в закрытые папки.",
        effects: { stats: { suspicion: -1 }, trust: { admin: 1 }, setFlags: { adminConfession: true } }
      },
      "tue-answer-admin-lie": {
        id: "tue-answer-admin-lie",
        dayIndex: 1,
        channel: "chat",
        label: "Сказать, что папка открылась случайно",
        minutes: 4,
        once: true,
        requires: { eventDelivered: "tue-admin-question" },
        result: "Администратор ответил коротким «понятно».",
        effects: { stats: { suspicion: 1 }, trust: { admin: -1 }, setFlags: { liedToAdmin: true } }
      },
      "tue-check-badge-list": {
        id: "tue-check-badge-list",
        dayIndex: 1,
        channel: "terminal",
        label: "Проверить список пропусков на деактивацию",
        minutes: 10,
        once: true,
        requires: { statGte: ["access", 1] },
        result: "В списке есть одна запись без фамилии и с датой пятницы.",
        effects: { stats: { evidence: 1, suspicion: 1, anxiety: 2 }, setFlags: { sawBadgeDeactivation: true } }
      },

      "wed-audit-explain": {
        id: "wed-audit-explain",
        dayIndex: 2,
        channel: "mail",
        label: "Дать правдивое объяснение журналу доступа",
        minutes: 12,
        once: true,
        result: "Службе безопасности отправлено объяснение действий.",
        effects: { stats: { suspicion: -2, anxiety: -1 }, setFlags: { auditExplained: true } }
      },
      "wed-audit-delete": {
        id: "wed-audit-delete",
        dayIndex: 2,
        channel: "terminal",
        label: "Попытаться удалить записи журнала",
        minutes: 20,
        once: true,
        result: "Часть локального журнала скрыта, но серверная копия осталась.",
        effects: { stats: { suspicion: 3, evidence: 1 }, setFlags: { tamperedLogs: true } }
      },
      "wed-audit-blame": {
        id: "wed-audit-blame",
        dayIndex: 2,
        channel: "mail",
        label: "Указать на действия Димы",
        minutes: 10,
        once: true,
        requires: { flag: "toldFriend" },
        result: "В объяснении упомянут Дима Орлов.",
        effects: { stats: { suspicion: -1, collateral: 2 }, trust: { friend: -4 }, setFlags: { blamedFriend: true } }
      },
      "wed-finish-backlog": {
        id: "wed-finish-backlog",
        dayIndex: 2,
        channel: "tasks",
        label: "Закрыть накопившиеся обращения",
        minutes: 45,
        once: true,
        result: "Очередь обращений сокращена почти вдвое.",
        effects: { stats: { work: 3 }, trust: { chief: 1 }, setFlags: { backlogCleared: true } }
      },
      "wed-copy-hr-draft": {
        id: "wed-copy-hr-draft",
        dayIndex: 2,
        channel: "explorer",
        label: "Скопировать черновик кадрового приказа",
        minutes: 14,
        once: true,
        requires: { any: [{ hasAccess: "hr-temp" }, { statGte: ["access", 2] }] },
        result: "Получен черновик приказа без заполненной фамилии.",
        effects: { stats: { evidence: 2, suspicion: 2, anxiety: 1 }, addItems: ["hr-order-draft"] }
      },

      "thu-finish-project": {
        id: "thu-finish-project",
        dayIndex: 3,
        channel: "tasks",
        label: "Завершить автоматизацию отчётов",
        minutes: 70,
        once: true,
        result: "Рабочий прототип автоматизации передан начальнику.",
        effects: { stats: { work: 4, loyalty: 2 }, setFlags: { projectFinished: true } }
      },
      "thu-build-case": {
        id: "thu-build-case",
        dayIndex: 3,
        channel: "explorer",
        label: "Собрать компромат в один архив",
        minutes: 35,
        once: true,
        requires: { statGte: ["evidence", 2] },
        result: "Документы собраны в зашифрованный игровой архив.",
        effects: { stats: { evidence: 2, suspicion: 1 }, addItems: ["case-archive"], setFlags: { casePrepared: true } }
      },
      "thu-resign": {
        id: "thu-resign",
        dayIndex: 3,
        channel: "mail",
        label: "Подготовить заявление по собственному желанию",
        minutes: 20,
        once: true,
        result: "Черновик заявления сохранён, но ещё не отправлен.",
        effects: { stats: { anxiety: -2 }, setFlags: { resignationPrepared: true } }
      },
      "thu-frame-chief": {
        id: "thu-frame-chief",
        dayIndex: 3,
        channel: "terminal",
        label: "Подменить автора спорного платежа",
        minutes: 32,
        once: true,
        requires: { all: [{ hasItem: "payment-list" }, { statGte: ["access", 2] }] },
        result: "Игровая запись платежа теперь указывает на начальника отдела.",
        effects: { stats: { suspicion: 4, collateral: 3, evidence: 1 }, setFlags: { chiefFramed: true } }
      },

      "fri-meeting-calm": {
        id: "fri-meeting-calm",
        dayIndex: 4,
        channel: "meeting",
        label: "Спокойно выслушать директора",
        minutes: 15,
        once: true,
        result: "Илья вошёл в кабинет без угроз и оправданий.",
        effects: { setFlags: { fridayCalm: true } }
      },
      "fri-meeting-work": {
        id: "fri-meeting-work",
        dayIndex: 4,
        channel: "meeting",
        label: "Сразу показать результаты недели",
        minutes: 15,
        once: true,
        requires: { statGte: ["work", 4] },
        result: "На стол директора легли отчёты и рабочий прототип.",
        effects: { stats: { loyalty: 1 }, setFlags: { presentedWork: true } }
      },
      "fri-meeting-blackmail": {
        id: "fri-meeting-blackmail",
        dayIndex: 4,
        channel: "meeting",
        label: "Предъявить компромат",
        minutes: 15,
        once: true,
        requires: { any: [{ hasItem: "case-archive" }, { statGte: ["evidence", 4] }] },
        result: "Илья положил перед директором копии закрытых документов.",
        effects: { stats: { suspicion: 2 }, setFlags: { attemptedBlackmail: true } }
      },
      "fri-send-resignation": {
        id: "fri-send-resignation",
        dayIndex: 4,
        channel: "meeting",
        label: "Подать заявление первым",
        minutes: 10,
        once: true,
        requires: { flag: "resignationPrepared" },
        result: "Заявление отправлено до объявления решения директора.",
        effects: { setFlags: { resigned: true } }
      }
    },

    events: {
      "mon-chief-thanks": {
        id: "mon-chief-thanks",
        dayIndex: 0,
        minute: 690,
        type: "chat",
        source: "Андрей Соколов",
        title: "Отчёт принят",
        text: "В этот раз всё сходится. Спасибо.",
        effects: { trust: { chief: 1 } }
      },
      "mon-chief-angry": {
        id: "mon-chief-angry",
        dayIndex: 0,
        minute: 675,
        type: "chat",
        source: "Андрей Соколов",
        title: "Неверная версия",
        text: "Ты снова отправил черновик. Исправь до обеда.",
        effects: { trust: { chief: -1 } }
      },
      "tue-morning-mail": {
        id: "tue-morning-mail",
        dayIndex: 1,
        minute: 535,
        atStart: true,
        type: "mail",
        source: "Отдел кадров",
        title: "Проверка пропусков",
        text: "До четверга подтвердите необходимость постоянного доступа в офис.",
        effects: { stats: { anxiety: 1 }, unlockContent: ["badge-list-hint"] }
      },
      "tue-friend-rumor": {
        id: "tue-friend-rumor",
        dayIndex: 1,
        minute: 555,
        type: "chat",
        source: "Дима Орлов",
        title: "Новый слух",
        text: "Кажется, бумаги готовят не на одного человека. Но я не уверен.",
        effects: { setFlags: { heardMultiplePeopleRumor: true }, stats: { anxiety: 1 } }
      },
      "tue-admin-question": {
        id: "tue-admin-question",
        dayIndex: 1,
        minute: 565,
        type: "chat",
        source: "Роман Белов",
        title: "Вопрос администратора",
        text: "Зачем тебе вчера понадобилась папка руководства?",
        effects: { stats: { anxiety: 1 } }
      },
      "tue-accountant-request": {
        id: "tue-accountant-request",
        dayIndex: 1,
        minute: 590,
        type: "mail",
        source: "Марина Лебедева",
        title: "Нужна помощь со сверкой",
        text: "Раз уж ты заметил ошибку, посмотри ещё три счёта до обеда.",
        effects: { stats: { access: 1 } }
      },
      "tue-chief-invoice": {
        id: "tue-chief-invoice",
        dayIndex: 1,
        minute: 610,
        type: "chat",
        source: "Андрей Соколов",
        title: "Разговор о счёте",
        text: "Не называй обычную опечатку нарушением без доказательств.",
        effects: { trust: { chief: -1 }, stats: { anxiety: 1 } }
      },
      "wed-security-audit": {
        id: "wed-security-audit",
        dayIndex: 2,
        minute: 530,
        atStart: true,
        type: "mail",
        source: "Система безопасности",
        title: "Запрос пояснений",
        text: "Обнаружены обращения к нетипичным сетевым разделам. Требуется пояснение до 13:00.",
        requires: {
          any: [
            { statGte: ["suspicion", 2] },
            { flag: "requestedLeadershipAccess" },
            { hasItem: "payment-list" }
          ]
        },
        effects: { stats: { anxiety: 2 } }
      },
      "wed-normal-morning": {
        id: "wed-normal-morning",
        dayIndex: 2,
        minute: 530,
        atStart: true,
        type: "mail",
        source: "Андрей Соколов",
        title: "Очередь обращений",
        text: "Сегодня нужно закрыть хвост за прошлую неделю.",
        requires: {
          all: [
            { statLt: ["suspicion", 2] },
            { notFlag: "requestedLeadershipAccess" }
          ]
        }
      },
      "wed-hr-window": {
        id: "wed-hr-window",
        dayIndex: 2,
        minute: 780,
        type: "system",
        source: "Проводник",
        title: "Временный доступ",
        text: "Из-за ошибки синхронизации папка HR доступна до перезапуска.",
        requires: { any: [{ trustGte: ["admin", 1] }, { statGte: ["access", 1] }] },
        effects: { addAccess: ["hr-temp"], stats: { anxiety: 1 } }
      },
      "thu-director-calendar": {
        id: "thu-director-calendar",
        dayIndex: 3,
        minute: 540,
        atStart: true,
        type: "mail",
        source: "Секретарь директора",
        title: "Встреча в пятницу",
        text: "Илья, директор ждёт вас завтра в 17:00. Подготовьте материалы по текущим задачам.",
        effects: { stats: { anxiety: 2 }, setFlags: { meetingConfirmed: true } }
      },
      "thu-friend-warning": {
        id: "thu-friend-warning",
        dayIndex: 3,
        minute: 720,
        type: "chat",
        source: "Дима Орлов",
        title: "Предупреждение",
        text: "Служба безопасности спрашивала, кто копировал документы. Будь осторожнее.",
        requires: { all: [{ trustGte: ["friend", 1] }, { statGte: ["suspicion", 3] }] },
        effects: { stats: { anxiety: 1 } }
      },
      "fri-meeting": {
        id: "fri-meeting",
        dayIndex: 4,
        minute: 1020,
        type: "system",
        source: "Календарь",
        title: "Встреча с директором",
        text: "Переговорная №1. Директор и сотрудник отдела кадров уже внутри.",
        effects: { setFlags: { meetingStarted: true } }
      }
    },

    content: {
      files: [
        { id: "badge-list", dayIndex: 1, title: "deactivation_queue.dat", requires: { contentUnlocked: "badge-list-hint" } },
        { id: "hr-draft", dayIndex: 2, title: "Приказ_кадры_черновик.doc", requires: { any: [{ hasAccess: "hr-temp" }, { statGte: ["access", 2] }] } },
        { id: "project", dayIndex: 3, title: "Автоматизация_отчётов.zip" }
      ]
    },

    endings: [
      {
        id: "voluntary-exit",
        priority: 100,
        title: "Уйти первым",
        text: "Илья подал заявление до того, как директор успел объявить решение. Он так и не узнал, касался ли разговор его.",
        requires: { flag: "resigned" }
      },
      {
        id: "caught",
        priority: 95,
        title: "Журнал не врёт",
        text: "Вместо кадрового разговора встреча превратилась в разбор доступа к закрытым документам. Илью увольняют уже за действия этой недели.",
        requires: { any: [{ statGte: ["suspicion", 8] }, { all: [{ flag: "tamperedLogs" }, { statGte: ["suspicion", 5] }] }] }
      },
      {
        id: "blackmail-deal",
        priority: 90,
        title: "Служебное положение",
        text: "Компромата хватило, чтобы добиться соглашения и компенсации. Но компания теперь знает, на что способен Илья.",
        requires: { all: [{ flag: "attemptedBlackmail" }, { statGte: ["evidence", 5] }, { statLt: ["suspicion", 8] }] }
      },
      {
        id: "saved-by-work",
        priority: 85,
        title: "Оставить в штате",
        text: "Решение об увольнении пересмотрели после результатов недели. Илья остаётся, хотя теперь смотрит на офис иначе.",
        requires: { all: [{ truthIs: "player" }, { statGte: ["work", 8] }, { statLt: ["suspicion", 5] }, { flag: "presentedWork" }] }
      },
      {
        id: "fired-clean",
        priority: 80,
        title: "Решение принято раньше",
        text: "Илья хорошо отработал неделю, но кадровое решение было утверждено заранее. Ему предлагают спокойно передать дела.",
        requires: { all: [{ truthIs: "player" }, { statLt: ["suspicion", 5] }] }
      },
      {
        id: "fired-for-cause",
        priority: 82,
        title: "Сам дал причину",
        text: "Илью действительно собирались уволить. Его действия за неделю только избавили руководство от сомнений.",
        requires: { all: [{ truthIs: "player" }, { statGte: ["suspicion", 5] }] }
      },
      {
        id: "wrong-person",
        priority: 75,
        title: "Увольняли не тебя",
        text: "Кадровое решение касалось Кирилла. Илья сохраняет работу, но последствия его паники остаются в журналах и отношениях с коллегами.",
        requires: { all: [{ truthIs: "newcomer" }, { statLt: ["suspicion", 8] }] }
      },
      {
        id: "department-cut",
        priority: 75,
        title: "Закрывают отдел",
        text: "Речь шла не об одном человеке. Отдел сопровождения передают подрядчику, и личные достижения уже ничего не меняют.",
        requires: { truthIs: "department" }
      },
      {
        id: "false-alarm-clean",
        priority: 70,
        title: "Не про сотрудников",
        text: "Директор обсуждал расторжение договора с подрядчиком. Илья остаётся на работе и никому не рассказывает, как близко подошёл к ошибке.",
        requires: { all: [{ truthIs: "contractor" }, { statLt: ["suspicion", 4] }, { statLte: ["collateral", 1] }] }
      },
      {
        id: "false-alarm-damage",
        priority: 72,
        title: "Зря испугался",
        text: "Разговор вообще не касался сотрудников. Но за пять дней Илья успел разрушить доверие, подставить коллег и создать настоящую причину для увольнения.",
        requires: { all: [{ truthIs: "contractor" }, { any: [{ statGte: ["suspicion", 4] }, { statGte: ["collateral", 2] }] }] }
      }
    ],

    fallbackEnding: {
      id: "ordinary-friday",
      title: "Пятница, 17:00",
      text: "Директор объявил решение. Неделя закончилась тише, чем Илья представлял, но прежним офис уже не кажется."
    }
  };
});