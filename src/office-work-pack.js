(function (root) {
  "use strict";

  if (root.UntilFridayOfficeWorkPack) return;

  const Runtime = root.UntilFridayRuntimeEngine;
  const DAY_STARTS = [527, 535, 530, 540, 545];
  const UNLOCK_OFFSETS = [6, 38, 82, 132, 202, 278, 356, 434];
  const DAILY_QUOTA = 5;
  const ICON_ROOT = "https://img.icons8.com/fluency-systems-regular";
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let activeWindow = null;
  let topZ = 1950;
  const announced = new Set();

  const icon = (name, size = 28) => `${ICON_ROOT}/${size}/${name}.png`;

  function sheet(id, title, description, minutes, source, config, hint) {
    const answer = { values: {} };
    Object.entries(config.expected || {}).forEach(([cell, expected]) => {
      answer.values[cell] = Array.isArray(expected) ? expected[0] : expected;
    });
    return { id, type: "sheet", title, description, minutes, source, config, hint, answer };
  }

  function documentTask(id, title, description, minutes, source, sourceText, initialText, expectedText, hint, sourceLabel = "Исходное письмо") {
    return {
      id,
      type: "document",
      title,
      description,
      minutes,
      source,
      config: { sourceText, sourceLabel, initialText, expectedText },
      hint,
      answer: { text: expectedText }
    };
  }

  function templateTask(id, title, description, minutes, source, sourceText, fields, hint) {
    const answer = { fields: Object.fromEntries(fields.map((field) => [field.id, field.expected])) };
    return { id, type: "template", title, description, minutes, source, config: { sourceText, fields }, hint, answer };
  }

  function auditTask(id, title, description, minutes, source, headers, rows, expected, hint) {
    return { id, type: "audit", title, description, minutes, source, config: { headers, rows, expected }, hint, answer: { selected: expected } };
  }

  function sortTask(id, title, description, minutes, source, items, expected, hint) {
    return { id, type: "sort", title, description, minutes, source, config: { items, expected }, hint, answer: { order: expected } };
  }

  function organizeTask(id, title, description, minutes, source, folders, files, hint) {
    return {
      id,
      type: "organize",
      title,
      description,
      minutes,
      source,
      config: { folders, files },
      hint,
      answer: { assignments: Object.fromEntries(files.map((file) => [file.id, file.target])) }
    };
  }

  const DAY_TASKS = [
    [
      sheet("office-mon-requests-sum", "Свести обращения за утро", "Заполните итоговую ячейку таблицы обращений. Можно ввести число или формулу автосуммы.", 12, "Служба поддержки", {
        headers: ["Отдел", "Канал", "Обращения"],
        rows: [["Продажи", "Почта", "64"], ["Склад", "Телефон", "51"], ["Бухгалтерия", "Почта", "73"], ["Кадры", "Портал", "59"], ["ИТОГО", "", ""]],
        editable: ["C6"],
        expected: { C6: ["247", "=SUM(C2:C5)", "=СУММ(C2:C5)"] }
      }, "Сложите значения C2–C5 или используйте =СУММ(C2:C5)."),

      documentTask("office-mon-supplier-letter", "Перенести письмо поставщика в документ", "Перепечатайте письмо без сокращений и сохраните исходную пунктуацию.", 14, "ООО «Север Комплект»",
        "Просим подтвердить получение партии кабеля КС-18 до 12:00. В поставке 24 бухты, сопроводительные документы переданы курьеру.",
        "",
        "Просим подтвердить получение партии кабеля КС-18 до 12:00. В поставке 24 бухты, сопроводительные документы переданы курьеру.",
        "Текст должен полностью совпасть с письмом слева."),

      sheet("office-mon-missing-payment", "Восстановить сумму в платёжном реестре", "Найдите пропущенную сумму, если общий итог известен.", 13, "Бухгалтерия", {
        headers: ["Платёж", "Сумма, ₽"],
        rows: [["Хостинг", "21 600"], ["Связь", "16 800"], ["Канцелярия", ""], ["Курьер", "27 400"], ["ИТОГО", "84 200"]],
        editable: ["B4"],
        expected: { B4: ["18400", "18 400"] }
      }, "Из 84 200 вычтите 21 600, 16 800 и 27 400."),

      documentTask("office-mon-memo-proof", "Исправить служебную записку", "Исправьте орфографию и знаки препинания, не меняя смысл.", 12, "Административный отдел",
        "Редактор передал черновик записки.",
        "В связи с переездом отдела просим, предоставить два дополнительных стола и четыре кресла до пятници.",
        "В связи с переездом отдела просим предоставить два дополнительных стола и четыре кресла до пятницы.",
        "Уберите лишнюю запятую и исправьте слово «пятници».", "Черновик документа"),

      organizeTask("office-mon-sort-invoices", "Разложить счета по папкам", "Выберите для каждого файла правильный раздел общего диска.", 15, "Документооборот",
        ["Связь", "Аренда", "Канцелярия"],
        [
          { id: "m1", name: "Ростелеком_август.pdf", target: "Связь" },
          { id: "m2", name: "Офис_Заводская_12.pdf", target: "Аренда" },
          { id: "m3", name: "Бумага_и_тонер.pdf", target: "Канцелярия" },
          { id: "m4", name: "Мобильная_связь.pdf", target: "Связь" },
          { id: "m5", name: "Допсоглашение_аренда.pdf", target: "Аренда" }
        ],
        "Ориентируйтесь на название поставщика и назначение документа."),

      sheet("office-mon-invoice-fix", "Исправить итог в счёте", "В итоговой строке добавлен лишний ноль. Введите корректное значение.", 11, "Бухгалтерия", {
        headers: ["Позиция", "Сумма, ₽"],
        rows: [["Сопровождение", "60 000"], ["Настройка", "24 200"], ["ИТОГО", "842 000"]],
        editable: ["B4"],
        expected: { B4: ["84200", "84 200"] }
      }, "Сумма двух строк равна 84 200 ₽."),

      templateTask("office-mon-courier-register", "Заполнить журнал курьера", "Перенесите данные из уведомления в регистрационную форму.", 10, "Секретариат",
        "Курьер: Павел Ершов. Компания: Север Комплект. Документ: УПД №418. Время прибытия: 11:40.",
        [
          { id: "courier", label: "Курьер", expected: "Павел Ершов" },
          { id: "company", label: "Организация", expected: "Север Комплект" },
          { id: "document", label: "Документ", expected: "УПД №418" },
          { id: "time", label: "Время", expected: "11:40" }
        ],
        "Все четыре значения указаны в уведомлении."),

      documentTask("office-mon-redact-contacts", "Обезличить заметку перед отправкой", "Удалите номер телефона и паспортные данные, оставив рабочую информацию.", 13, "Отдел кадров",
        "Перед отправкой подрядчику документ необходимо обезличить.",
        "Сотрудник Илья Воронов, телефон +7 900 111-22-33, паспорт 45 08 123456. Требуется новый пропуск на второй этаж.",
        "Сотрудник Илья Воронов. Требуется новый пропуск на второй этаж.",
        "В итоговом тексте должны остаться имя и цель заявки, но не телефон и паспорт.", "Исходная заметка")
    ],

    [
      sheet("office-tue-format-dates", "Привести даты к единому формату", "Исправьте даты в формате ДД.ММ.ГГГГ.", 11, "Отдел продаж", {
        headers: ["Клиент", "Дата обращения"],
        rows: [["Альфа", "4/8/26"], ["Вектор", "2026-08-04"], ["Спектр", "04.08.2026"]],
        editable: ["B2", "B3"],
        expected: { B2: "04.08.2026", B3: "04.08.2026" }
      }, "Обе даты относятся к 4 августа 2026 года."),

      documentTask("office-tue-client-letter", "Перенести запрос клиента в документ", "Создайте текстовую копию входящего обращения.", 14, "АО «Вектор»",
        "Просим перенести профилактические работы на 18:30 и заранее направить список недоступных сервисов. Ответ ожидаем до 13:00.",
        "",
        "Просим перенести профилактические работы на 18:30 и заранее направить список недоступных сервисов. Ответ ожидаем до 13:00.",
        "Скопируйте письмо полностью, включая время."),

      sheet("office-tue-completion-percent", "Рассчитать процент выполнения", "Заполните процент закрытых заявок. Допускается число или формула.", 15, "Руководитель смены", {
        headers: ["Группа", "Всего", "Закрыто", "Выполнение, %"],
        rows: [["A", "50", "48", ""], ["B", "50", "44", ""], ["C", "40", "30", ""]],
        editable: ["D2", "D3", "D4"],
        expected: {
          D2: ["96", "96%", "=C2/B2*100"],
          D3: ["88", "88%", "=C3/B3*100"],
          D4: ["75", "75%", "=C4/B4*100"]
        }
      }, "Процент равен «Закрыто / Всего × 100»."),

      sortTask("office-tue-priority-sort", "Расставить обращения по приоритету", "Переместите задачи в порядке обработки: от критической к плановой.", 12, "Диспетчерская",
        [
          { id: "print", label: "Не печатает принтер в переговорной" },
          { id: "outage", label: "Недоступна клиентская база" },
          { id: "archive", label: "Архивировать старые отчёты" },
          { id: "payment", label: "Не проходит платёж клиента" },
          { id: "access", label: "Выдать доступ новому сотруднику" }
        ],
        ["outage", "payment", "access", "print", "archive"],
        "Сначала простой ключевой системы, затем деньги, доступ, локальная техника и плановая работа."),

      documentTask("office-tue-reply-proof", "Отредактировать ответ клиенту", "Исправьте ошибки и приведите письмо к деловому тону.", 13, "Клиентский отдел",
        "Ответ подготовлен стажёром.",
        "Добрый день мы получили ваше письмо. Работы наверно перенесём, список сервисов скинем попозже.",
        "Добрый день. Мы получили ваше письмо. Работы перенесём, список сервисов направим отдельным письмом.",
        "Нужны точки после приветствия и первого предложения; замените разговорные слова.", "Черновик ответа"),

      auditTask("office-tue-find-duplicate", "Найти дубль в реестре платежей", "Отметьте строку, которая повторяет уже внесённый платёж.", 10, "Бухгалтерия",
        ["ID", "Контрагент", "Сумма", "Дата"],
        [
          { id: "p1", values: ["P-101", "СвязьПлюс", "16 800", "04.08"] },
          { id: "p2", values: ["P-102", "Бумага-Сервис", "18 400", "04.08"] },
          { id: "p3", values: ["P-103", "Курьер Экспресс", "27 400", "04.08"] },
          { id: "p4", values: ["P-102", "Бумага-Сервис", "18 400", "04.08"] }
        ],
        ["p4"],
        "Сравните ID, контрагента, сумму и дату."),

      templateTask("office-tue-service-act", "Заполнить акт выполненных работ", "Перенесите реквизиты из письма подрядчика.", 12, "ООО «ТехКонтур»",
        "Договор ТК-19/26. Работы: настройка резервного копирования. Дата: 04.08.2026. Ответственный: Сергей Лапин.",
        [
          { id: "contract", label: "Договор", expected: "ТК-19/26" },
          { id: "work", label: "Вид работ", expected: "настройка резервного копирования" },
          { id: "date", label: "Дата", expected: "04.08.2026" },
          { id: "owner", label: "Ответственный", expected: "Сергей Лапин" }
        ],
        "Не добавляйте организационно-правовую форму в поле договора."),

      organizeTask("office-tue-client-files", "Разложить документы клиентов", "Распределите файлы по карточкам соответствующих клиентов.", 14, "CRM-отдел",
        ["Альфа", "Вектор", "Спектр"],
        [
          { id: "t1", name: "Альфа_договор.pdf", target: "Альфа" },
          { id: "t2", name: "Вектор_заявка.docx", target: "Вектор" },
          { id: "t3", name: "Спектр_акт.pdf", target: "Спектр" },
          { id: "t4", name: "Альфа_счёт.xlsx", target: "Альфа" },
          { id: "t5", name: "Вектор_переписка.txt", target: "Вектор" }
        ],
        "Название клиента указано в начале каждого файла.")
    ],

    [
      auditTask("office-wed-branch-compare", "Сверить показатели двух филиалов", "Отметьте строки, в которых итог филиала не совпадает с контрольной выгрузкой.", 13, "Аналитический отдел",
        ["Показатель", "Филиал", "Контроль"],
        [
          { id: "r1", values: ["Новые заявки", "126", "126"] },
          { id: "r2", values: ["Закрытые заявки", "111", "114"] },
          { id: "r3", values: ["Просроченные", "7", "7"] },
          { id: "r4", values: ["Повторные обращения", "18", "16"] }
        ],
        ["r2", "r4"],
        "Расхождения находятся во второй и четвёртой строках."),

      documentTask("office-wed-audit-letter", "Перенести письмо внутреннего аудита", "Перепечатайте запрос аудитора в рабочий документ.", 14, "Внутренний аудит",
        "До 15:00 предоставьте пояснение по обращениям к папке «Руководство» за последние три рабочих дня. Укажите служебную необходимость каждого открытия.",
        "",
        "До 15:00 предоставьте пояснение по обращениям к папке «Руководство» за последние три рабочих дня. Укажите служебную необходимость каждого открытия.",
        "Не пропустите название папки и срок."),

      sheet("office-wed-missing-hours", "Восстановить часы в табеле", "Заполните пропущенное количество часов, чтобы недельный итог совпал.", 11, "Отдел кадров", {
        headers: ["День", "Часы"],
        rows: [["Понедельник", "8"], ["Вторник", "8"], ["Среда", ""], ["ИТОГО", "24"]],
        editable: ["B4"],
        expected: { B4: "8" }
      }, "За три дня должно быть 24 часа."),

      sortTask("office-wed-paragraph-order", "Собрать инструкцию из абзацев", "Расположите части инструкции в логическом порядке.", 12, "Служба безопасности",
        [
          { id: "finish", label: "После завершения закройте карточку инцидента." },
          { id: "start", label: "Сначала зафиксируйте время и источник сообщения." },
          { id: "middle", label: "Затем приложите журнал и описание выполненных действий." },
          { id: "notify", label: "После проверки уведомите ответственного сотрудника." }
        ],
        ["start", "middle", "notify", "finish"],
        "Начните с фиксации, затем приложите материалы, уведомите и закройте карточку."),

      organizeTask("office-wed-log-folders", "Разложить журналы по системам", "Назначьте каждому журналу соответствующий раздел.", 13, "Системный администратор",
        ["Почта", "Файловый сервер", "Пропускная система"],
        [
          { id: "w1", name: "smtp_2026-08-05.log", target: "Почта" },
          { id: "w2", name: "shared_access.log", target: "Файловый сервер" },
          { id: "w3", name: "badge_events.csv", target: "Пропускная система" },
          { id: "w4", name: "imap_errors.log", target: "Почта" },
          { id: "w5", name: "folder_permissions.csv", target: "Файловый сервер" }
        ],
        "SMTP и IMAP относятся к почте, badge — к пропускам."),

      sheet("office-wed-overtime", "Рассчитать переработку", "Заполните количество часов сверх восьмичасовой нормы.", 13, "Отдел кадров", {
        headers: ["Сотрудник", "Отработано", "Переработка"],
        rows: [["Орлов", "9", ""], ["Казанцев", "8", ""], ["Белов", "10", ""]],
        editable: ["C2", "C3", "C4"],
        expected: { C2: ["1", "=B2-8"], C3: ["0", "=B3-8"], C4: ["2", "=B4-8"] }
      }, "Вычтите норму 8 часов из фактически отработанного времени."),

      templateTask("office-wed-incident-card", "Заполнить карточку инцидента", "Перенесите ключевые данные из сообщения мониторинга.", 11, "Мониторинг",
        "Инцидент INC-204. Система: файловый сервер. Начало: 13:17. Симптом: отказ доступа к общей папке. Ответственный: Роман Белов.",
        [
          { id: "incident", label: "Номер", expected: "INC-204" },
          { id: "system", label: "Система", expected: "файловый сервер" },
          { id: "start", label: "Начало", expected: "13:17" },
          { id: "symptom", label: "Симптом", expected: "отказ доступа к общей папке" },
          { id: "owner", label: "Ответственный", expected: "Роман Белов" }
        ],
        "Все данные находятся в одной строке сообщения мониторинга."),

      documentTask("office-wed-redact-secret", "Удалить секреты из инструкции", "Перед публикацией удалите пароль и внутренний адрес сервера.", 12, "Системный администратор",
        "Инструкция будет отправлена внешнему подрядчику.",
        "Для проверки откройте резервную панель. Внутренний адрес: 10.14.8.22. Пароль: Friday-Admin-26. После входа выберите раздел «Журналы».",
        "Для проверки откройте резервную панель. После входа выберите раздел «Журналы».",
        "Удалите предложения с внутренним адресом и паролем.", "Внутренняя инструкция")
    ],

    [
      sheet("office-thu-budget-total", "Свести бюджет отдела", "Заполните итоговые расходы отдела за месяц.", 12, "Финансовый отдел", {
        headers: ["Статья", "Сумма, ₽"],
        rows: [["Связь", "48 000"], ["Канцелярия", "31 500"], ["Подрядчики", "126 000"], ["Обучение", "44 500"], ["ИТОГО", ""]],
        editable: ["B6"],
        expected: { B6: ["250000", "250 000", "=SUM(B2:B5)", "=СУММ(B2:B5)"] }
      }, "Сложите четыре статьи расходов."),

      documentTask("office-thu-contractor-letter", "Перенести письмо подрядчика", "Создайте текстовую копию письма для внутренней карточки договора.", 13, "ООО «Автоматизация Про»",
        "Готовы передать архив проекта в четверг после 16:00. Для приёмки потребуется представитель заказчика и доступ к тестовому серверу.",
        "",
        "Готовы передать архив проекта в четверг после 16:00. Для приёмки потребуется представитель заказчика и доступ к тестовому серверу.",
        "Сохраните время и оба условия приёмки."),

      auditTask("office-thu-price-check", "Найти расхождение в коммерческих предложениях", "Отметьте предложение, где цена в таблице отличается от приложенного документа.", 11, "Закупки",
        ["Поставщик", "Таблица", "Документ"],
        [
          { id: "v1", values: ["ТехКонтур", "118 000", "118 000"] },
          { id: "v2", values: ["Север Системы", "121 500", "121 500"] },
          { id: "v3", values: ["Автоматизация Про", "124 000", "142 000"] },
          { id: "v4", values: ["ИнфоЛаб", "129 900", "129 900"] }
        ],
        ["v3"],
        "Сравните две последние колонки построчно."),

      sortTask("office-thu-vendor-sort", "Ранжировать предложения", "Расположите поставщиков от лучшего предложения к худшему с учётом оценки, затем цены.", 13, "Закупки",
        [
          { id: "a", label: "ТехКонтур — 88 баллов, 118 000 ₽" },
          { id: "b", label: "Север Системы — 92 балла, 121 500 ₽" },
          { id: "c", label: "ИнфоЛаб — 81 балл, 129 900 ₽" },
          { id: "d", label: "Автоматизация Про — 92 балла, 124 000 ₽" }
        ],
        ["b", "d", "a", "c"],
        "Сначала сортируйте по баллам по убыванию, при равных баллах — по цене по возрастанию."),

      documentTask("office-thu-contract-proof", "Исправить пояснение к договору", "Исправьте ошибки и сделайте формулировку нейтральной.", 12, "Юридический отдел",
        "В карточке договора сохранён неотредактированный комментарий.",
        "Подрядчик опять задержал документы, из за чего мы не смогли нормально всё проверить.",
        "Подрядчик задержал документы, из-за чего проверка не была завершена в срок.",
        "Исправьте «из-за» и уберите эмоциональные слова.", "Черновик комментария"),

      sheet("office-thu-contract-dates", "Нормализовать даты договоров", "Введите даты в формате ДД.ММ.ГГГГ.", 10, "Юридический отдел", {
        headers: ["Договор", "Дата окончания"],
        rows: [["КС-41", "2026/12/31"], ["АП-18", "31-10-2026"], ["ТК-19", "30.09.2026"]],
        editable: ["B2", "B3"],
        expected: { B2: "31.12.2026", B3: "31.10.2026" }
      }, "Первая дата — 31 декабря, вторая — 31 октября 2026 года."),

      templateTask("office-thu-meeting-minutes", "Заполнить протокол совещания", "Перенесите сведения из краткой записи секретаря.", 12, "Секретариат",
        "Совещание №17. Дата: 06.08.2026. Председатель: Андрей Соколов. Решение: завершить проверку проекта до 17:00. Ответственный: Илья Воронов.",
        [
          { id: "number", label: "Номер", expected: "17" },
          { id: "date", label: "Дата", expected: "06.08.2026" },
          { id: "chair", label: "Председатель", expected: "Андрей Соколов" },
          { id: "decision", label: "Решение", expected: "завершить проверку проекта до 17:00" },
          { id: "owner", label: "Ответственный", expected: "Илья Воронов" }
        ],
        "Номер можно вводить без символа №."),

      organizeTask("office-thu-project-archive", "Собрать структуру проекта", "Разложите файлы по рабочим разделам проекта.", 14, "Проектный офис",
        ["Документация", "Исходники", "Тесты"],
        [
          { id: "h1", name: "README.md", target: "Документация" },
          { id: "h2", name: "main.py", target: "Исходники" },
          { id: "h3", name: "test_report.xlsx", target: "Тесты" },
          { id: "h4", name: "architecture.pdf", target: "Документация" },
          { id: "h5", name: "migration.sql", target: "Исходники" },
          { id: "h6", name: "load_test.log", target: "Тесты" }
        ],
        "README и архитектура — документация; код и SQL — исходники; отчёт и лог — тесты.")
    ],

    [
      sheet("office-fri-week-total", "Свести недельный отчёт", "Рассчитайте итоговое число обработанных обращений за пять дней.", 12, "Руководитель отдела", {
        headers: ["День", "Обработано"],
        rows: [["Понедельник", "247"], ["Вторник", "263"], ["Среда", "238"], ["Четверг", "271"], ["Пятница", "194"], ["ИТОГО", ""]],
        editable: ["B7"],
        expected: { B7: ["1213", "=SUM(B2:B6)", "=СУММ(B2:B6)"] }
      }, "Сложите показатели пяти дней."),

      documentTask("office-fri-status-letter", "Перенести итоговое письмо в документ", "Создайте текстовую копию статуса недели.", 13, "Проектный офис",
        "Проверка проекта завершена. Критические ошибки устранены, архив и инструкция переданы в общий каталог. Открытым остаётся вопрос доступа подрядчика.",
        "",
        "Проверка проекта завершена. Критические ошибки устранены, архив и инструкция переданы в общий каталог. Открытым остаётся вопрос доступа подрядчика.",
        "Перенесите все три предложения."),

      auditTask("office-fri-duplicate-payment", "Проверить финальный платёжный реестр", "Отметьте повторную строку, которую нельзя отправлять в банк.", 10, "Бухгалтерия",
        ["Номер", "Получатель", "Сумма"],
        [
          { id: "f1", values: ["441", "ТехКонтур", "118 000"] },
          { id: "f2", values: ["442", "СвязьПлюс", "16 800"] },
          { id: "f3", values: ["443", "ИнфоЛаб", "129 900"] },
          { id: "f4", values: ["442", "СвязьПлюс", "16 800"] }
        ],
        ["f4"],
        "Повторяются номер платежа, получатель и сумма."),

      documentTask("office-fri-final-proof", "Вычитать финальный отчёт", "Исправьте грамматику и пунктуацию в итоговом абзаце.", 13, "Аналитический отдел",
        "Финальный абзац отчёта.",
        "За неделю отдел обработал 1213 обращений, из них 92 процента закрыто в срок а критические инциденты устранены.",
        "За неделю отдел обработал 1213 обращений, из них 92 процента закрыто в срок, а критические инциденты устранены.",
        "Добавьте запятую перед союзом «а».", "Черновик отчёта"),

      organizeTask("office-fri-week-archive", "Подготовить недельный архив", "Распределите итоговые файлы перед передачей руководителю.", 14, "Документооборот",
        ["Отчёты", "Финансы", "Проект", "Переписка"],
        [
          { id: "ff1", name: "Отчёт_неделя.xlsx", target: "Отчёты" },
          { id: "ff2", name: "Платежи_август.xlsx", target: "Финансы" },
          { id: "ff3", name: "Проект_автоматизация.zip", target: "Проект" },
          { id: "ff4", name: "Письмо_подрядчику.docx", target: "Переписка" },
          { id: "ff5", name: "Счета_проверенные.zip", target: "Финансы" },
          { id: "ff6", name: "Инструкция_проекта.pdf", target: "Проект" }
        ],
        "Ориентируйтесь на назначение каждого файла."),

      sheet("office-fri-forecast", "Рассчитать прогноз следующей недели", "Заполните прогноз как текущее значение плюс десять процентов.", 14, "Плановый отдел", {
        headers: ["Категория", "Текущая неделя", "Прогноз"],
        rows: [["Почта", "420", ""], ["Телефон", "315", ""], ["Портал", "180", ""]],
        editable: ["C2", "C3", "C4"],
        expected: { C2: ["462", "=B2*1.1"], C3: ["346.5", "346,5", "=B3*1.1"], C4: ["198", "=B4*1.1"] }
      }, "Умножьте каждое значение на 1,1."),

      templateTask("office-fri-handover", "Заполнить лист передачи дел", "Перенесите данные из сообщения руководителя.", 12, "Андрей Соколов",
        "Передать: архив проекта и список открытых обращений. Получатель: Дима Орлов. Срок: 17:30. Комментарий: доступ подрядчика не подтверждён.",
        [
          { id: "items", label: "Материалы", expected: "архив проекта и список открытых обращений" },
          { id: "receiver", label: "Получатель", expected: "Дима Орлов" },
          { id: "deadline", label: "Срок", expected: "17:30" },
          { id: "comment", label: "Комментарий", expected: "доступ подрядчика не подтверждён" }
        ],
        "Переносите формулировки без сокращений."),

      documentTask("office-fri-redact-note", "Обезличить кадровую заметку", "Удалите сведения о конкретном сотруднике и оставьте только организационную формулировку.", 13, "Отдел кадров",
        "Документ будет включён в общий протокол.",
        "В пятницу планируется увольнение Ильи Воронова, табельный номер EMP-1042. Основание: организационные изменения в отделе сопровождения.",
        "В пятницу планируются кадровые изменения. Основание: организационные изменения в отделе сопровождения.",
        "Удалите имя, табельный номер и прямое указание на увольнение.", "Закрытая кадровая заметка")
    ]
  ];

  const TASKS_BY_DAY = DAY_TASKS.map((tasks, dayIndex) => tasks.map((task, slot) => ({
    ...task,
    dayIndex,
    slot,
    unlockMinute: DAY_STARTS[dayIndex] + UNLOCK_OFFSETS[slot],
    score: slot < 5 ? 1 : 2
  })));
  const TASKS = TASKS_BY_DAY.flat();
  const TASK_BY_ID = Object.fromEntries(TASKS.map((task) => [task.id, task]));

  function engine() {
    return Runtime?.getEngine?.() || null;
  }

  function stateNow() {
    return engine()?.getState?.() || null;
  }

  function normalizeOfficeState(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      version: 1,
      completed: source.completed && typeof source.completed === "object" ? { ...source.completed } : {},
      attempts: source.attempts && typeof source.attempts === "object" ? { ...source.attempts } : {}
    };
  }

  function officeState(state = stateNow()) {
    return normalizeOfficeState(state?.metadata?.officeWork);
  }

  function tasksForDay(dayIndex) {
    return TASKS_BY_DAY[Number(dayIndex)] || [];
  }

  function availableTasks(state = stateNow()) {
    if (!state || state.ended || !state.dayStarted) return [];
    const saved = officeState(state);
    return tasksForDay(state.dayIndex).filter((task) => task.unlockMinute <= state.minute && !saved.completed[task.id]);
  }

  function completedForDay(state = stateNow()) {
    if (!state) return [];
    const saved = officeState(state);
    return tasksForDay(state.dayIndex).filter((task) => saved.completed[task.id]);
  }

  function formatMinute(value) {
    const minute = Math.max(0, Number(value) || 0);
    return `${Math.floor(minute / 60).toString().padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .trim()
      .toLocaleLowerCase("ru-RU");
  }

  function normalizeCell(value) {
    return String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[\s\u00a0₽%]/g, "")
      .replace(/;/g, ",")
      .replace(/,/g, ".");
  }

  function equalSet(left, right) {
    const a = [...new Set(left || [])].sort();
    const b = [...new Set(right || [])].sort();
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }

  function validateTask(taskOrId, input = {}) {
    const task = typeof taskOrId === "string" ? TASK_BY_ID[taskOrId] : taskOrId;
    if (!task) return false;

    if (task.type === "sheet") {
      const values = input.values || {};
      return Object.entries(task.config.expected).every(([cell, expected]) => {
        const accepted = Array.isArray(expected) ? expected : [expected];
        const actual = normalizeCell(values[cell]);
        return accepted.some((item) => normalizeCell(item) === actual);
      });
    }

    if (task.type === "document") {
      return normalizeText(input.text) === normalizeText(task.config.expectedText);
    }

    if (task.type === "template") {
      const fields = input.fields || {};
      return task.config.fields.every((field) => normalizeText(fields[field.id]) === normalizeText(field.expected));
    }

    if (task.type === "audit") {
      return equalSet(input.selected, task.config.expected);
    }

    if (task.type === "sort") {
      return Array.isArray(input.order) && input.order.length === task.config.expected.length && input.order.every((id, index) => id === task.config.expected[index]);
    }

    if (task.type === "organize") {
      const assignments = input.assignments || {};
      return task.config.files.every((file) => assignments[file.id] === file.target);
    }

    return false;
  }

  function typeLabel(type) {
    return ({ sheet: "Таблица", document: "Документ", template: "Форма", audit: "Сверка", sort: "Сортировка", organize: "Файлы" })[type] || "Задание";
  }

  function typeIcon(type) {
    return ({ sheet: "microsoft-excel-2019", document: "document", template: "form", audit: "inspection", sort: "sorting-answers", organize: "folder-invoices" })[type] || "task";
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function decorateTaskApp(element) {
    const list = element?.querySelector?.(".task-list");
    const state = stateNow();
    if (!list || !state) return false;

    list.querySelector(".office-work-pack")?.remove();
    const saved = officeState(state);
    const dayTasks = tasksForDay(state.dayIndex);
    const completed = dayTasks.filter((task) => saved.completed[task.id]);
    const available = dayTasks.filter((task) => task.unlockMinute <= state.minute && !saved.completed[task.id]);
    const next = dayTasks.find((task) => task.unlockMinute > state.minute && !saved.completed[task.id]);
    const section = document.createElement("section");
    section.className = "office-work-pack";
    section.dataset.officeWorkPack = "true";
    section.innerHTML = `
      <header class="office-work-summary">
        <div><span>Офисная смена</span><h2>Рабочие поручения</h2><p>Таблицы, документы, формы и файлы появляются постепенно в течение дня.</p></div>
        <div class="office-work-progress"><strong>${completed.length}/${dayTasks.length}</strong><span>дневная норма: ${DAILY_QUOTA}</span><progress max="${dayTasks.length}" value="${completed.length}"></progress></div>
      </header>
      <div class="office-work-cards" data-office-cards></div>
      ${next ? `<div class="office-work-next"><img src="${icon("clock", 20)}" alt=""><span>Следующее поручение появится в <b>${formatMinute(next.unlockMinute)}</b></span></div>` : ""}`;

    const cards = section.querySelector("[data-office-cards]");
    [...completed, ...available].forEach((task) => {
      const done = Boolean(saved.completed[task.id]);
      const card = document.createElement("article");
      card.className = `office-task-card ${done ? "done" : "available"}`;
      card.innerHTML = `
        <img class="office-task-icon" src="${icon(typeIcon(task.type), 32)}" alt="">
        <div class="office-task-copy">
          <header><span>${esc(typeLabel(task.type))} · ${esc(task.source)}</span><time>${formatMinute(task.unlockMinute)}</time></header>
          <h3>${esc(task.title)}</h3>
          <p>${esc(task.description)}</p>
        </div>
        <div class="office-task-action"><span>${task.minutes} мин.</span>${done ? `<b><img src="${icon("checked-checkbox", 18)}" alt="">Готово</b>` : `<button type="button" data-office-open="${task.id}">Открыть</button>`}</div>`;
      cards.appendChild(card);
    });

    if (!completed.length && !available.length) {
      cards.innerHTML = `<div class="office-work-empty"><img src="${icon("coffee-to-go", 44)}" alt=""><p>Первое рабочее поручение ещё не поступило.</p></div>`;
    }

    section.querySelectorAll("[data-office-open]").forEach((button) => button.addEventListener("click", () => openTask(button.dataset.officeOpen)));
    list.prepend(section);
    return true;
  }

  function createTaskWindow(task) {
    closeActiveWindow();
    const template = document.querySelector("#window-template");
    const layer = document.querySelector("#windows-layer");
    if (!template || !layer) return null;

    const win = template.content.firstElementChild.cloneNode(true);
    win.classList.add("office-work-window");
    win.dataset.windowId = `office-work-${task.id}`;
    win.style.left = "70px";
    win.style.top = "38px";
    win.style.width = "940px";
    win.style.height = "620px";
    win.style.zIndex = String(++topZ);
    win.querySelector(".window-title").textContent = `${task.title} — KONTUR Office`;
    win.querySelector(".window-status").textContent = `${typeLabel(task.type)} · ${task.minutes} минут · результат сохраняется`;
    win.querySelector(".window-content").classList.add("office-work-content");
    win.querySelector("[data-window-action='minimize']")?.remove();
    win.querySelector("[data-window-action='close']")?.addEventListener("click", closeActiveWindow);
    win.addEventListener("mousedown", () => focusWindow(win));
    layer.appendChild(win);
    root.UntilFridayWindowLayout?.enhance?.(win, win.dataset.windowId);
    activeWindow = win;
    focusWindow(win);
    return win;
  }

  function focusWindow(win) {
    if (!win?.isConnected) return;
    document.querySelectorAll(".app-window").forEach((item) => item.classList.remove("focused"));
    win.classList.add("focused");
    win.style.zIndex = String(++topZ);
  }

  function closeActiveWindow() {
    activeWindow?.remove();
    activeWindow = null;
  }

  function openTask(id) {
    const task = TASK_BY_ID[id];
    const state = stateNow();
    const saved = officeState(state);
    if (!task || !state || state.dayIndex !== task.dayIndex || task.unlockMinute > state.minute || saved.completed[id]) return false;
    const win = createTaskWindow(task);
    if (!win) return false;
    renderTask(win, task);
    return true;
  }

  function renderTask(win, task) {
    const content = win.querySelector(".office-work-content");
    content.innerHTML = `
      <div class="office-work-toolbar">
        <div><img src="${icon(typeIcon(task.type), 24)}" alt=""><span>${esc(typeLabel(task.type))}</span></div>
        <div><b>${esc(task.source)}</b><span>Поступило в ${formatMinute(task.unlockMinute)}</span></div>
      </div>
      <section class="office-task-instruction"><h2>${esc(task.title)}</h2><p>${esc(task.description)}</p></section>
      <main class="office-task-workspace" data-office-workspace></main>
      <footer class="office-task-footer"><div><span data-office-error></span><small data-office-hint></small></div><button type="button" data-office-submit>Проверить и завершить</button></footer>`;

    const workspace = content.querySelector("[data-office-workspace]");
    const readInput = renderWorkspace(workspace, task);
    const error = content.querySelector("[data-office-error]");
    const hint = content.querySelector("[data-office-hint]");
    const submit = content.querySelector("[data-office-submit]");
    let attempts = 0;

    submit.addEventListener("click", () => {
      const input = readInput();
      if (!validateTask(task, input)) {
        attempts += 1;
        error.textContent = "Проверка не пройдена. Исправьте данные и попробуйте ещё раз.";
        hint.textContent = attempts >= 2 ? `Подсказка: ${task.hint}` : "";
        workspace.classList.remove("shake");
        void workspace.offsetWidth;
        workspace.classList.add("shake");
        return;
      }
      error.textContent = "";
      hint.textContent = "";
      const result = completeTask(task, attempts);
      if (!result.ok) {
        error.textContent = result.message || "Не удалось сохранить результат задания.";
      }
    });
  }

  function renderWorkspace(workspace, task) {
    if (task.type === "sheet") return renderSheet(workspace, task);
    if (task.type === "document") return renderDocument(workspace, task);
    if (task.type === "template") return renderTemplate(workspace, task);
    if (task.type === "audit") return renderAudit(workspace, task);
    if (task.type === "sort") return renderSort(workspace, task);
    if (task.type === "organize") return renderOrganize(workspace, task);
    workspace.innerHTML = `<div class="office-work-empty"><p>Неизвестный тип задания.</p></div>`;
    return () => ({});
  }

  function renderSheet(workspace, task) {
    const config = task.config;
    workspace.innerHTML = `
      <section class="office-sheet">
        <div class="office-sheet-ribbon"><button type="button">Файл</button><button type="button" class="active">Главная</button><button type="button">Формулы</button><span></span><small>Автосохранение включено</small></div>
        <div class="office-formula-bar"><b data-active-cell>—</b><span>fx</span><input data-formula-input placeholder="Выберите редактируемую ячейку" disabled></div>
        <div class="office-sheet-scroll"><table><thead><tr><th class="corner"></th>${config.headers.map((header, index) => `<th><span>${LETTERS[index]}</span><b>${esc(header)}</b></th>`).join("")}</tr></thead><tbody>${config.rows.map((row, rowIndex) => `<tr><th>${rowIndex + 2}</th>${row.map((value, columnIndex) => { const cell = `${LETTERS[columnIndex]}${rowIndex + 2}`; const editable = config.editable.includes(cell); return `<td data-cell="${cell}" class="${editable ? "editable" : ""}">${editable ? `<input data-sheet-cell="${cell}" value="${esc(value)}">` : `<span>${esc(value)}</span>`}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      </section>`;

    const formula = workspace.querySelector("[data-formula-input]");
    const activeLabel = workspace.querySelector("[data-active-cell]");
    let activeInput = null;

    workspace.querySelectorAll("[data-sheet-cell]").forEach((input) => {
      const activate = () => {
        activeInput = input;
        activeLabel.textContent = input.dataset.sheetCell;
        formula.disabled = false;
        formula.value = input.value;
        workspace.querySelectorAll("td.active").forEach((cell) => cell.classList.remove("active"));
        input.closest("td").classList.add("active");
      };
      input.addEventListener("focus", activate);
      input.addEventListener("click", activate);
      input.addEventListener("input", () => { if (activeInput === input) formula.value = input.value; });
    });

    formula.addEventListener("input", () => { if (activeInput) activeInput.value = formula.value; });
    return () => ({ values: Object.fromEntries([...workspace.querySelectorAll("[data-sheet-cell]")].map((input) => [input.dataset.sheetCell, input.value])) });
  }

  function renderDocument(workspace, task) {
    const config = task.config;
    workspace.innerHTML = `
      <section class="office-document-editor">
        <aside class="office-source-letter"><header><img src="${icon("new-post", 22)}" alt=""><div><b>${esc(config.sourceLabel)}</b><span>${esc(task.source)}</span></div></header><article>${esc(config.sourceText)}</article></aside>
        <section class="office-editor"><div class="office-editor-ribbon"><button type="button"><b>Ж</b></button><button type="button"><i>К</i></button><button type="button"><u>Ч</u></button><span>Calibri · 11</span></div><textarea data-document-text spellcheck="true">${esc(config.initialText)}</textarea><footer><span data-word-count></span><span>Русский</span></footer></section>
      </section>`;
    const textarea = workspace.querySelector("[data-document-text]");
    const count = workspace.querySelector("[data-word-count]");
    const update = () => { count.textContent = `Слов: ${textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0}`; };
    textarea.addEventListener("input", update);
    update();
    return () => ({ text: textarea.value });
  }

  function renderTemplate(workspace, task) {
    const config = task.config;
    workspace.innerHTML = `
      <section class="office-template-layout">
        <aside class="office-source-letter"><header><img src="${icon("new-post", 22)}" alt=""><div><b>Исходное сообщение</b><span>${esc(task.source)}</span></div></header><article>${esc(config.sourceText)}</article></aside>
        <form class="office-template-form">${config.fields.map((field) => `<label><span>${esc(field.label)}</span><input data-template-field="${field.id}" autocomplete="off"></label>`).join("")}</form>
      </section>`;
    return () => ({ fields: Object.fromEntries([...workspace.querySelectorAll("[data-template-field]")].map((input) => [input.dataset.templateField, input.value])) });
  }

  function renderAudit(workspace, task) {
    const config = task.config;
    workspace.innerHTML = `
      <section class="office-audit"><header><img src="${icon("inspection", 24)}" alt=""><div><b>Контрольная сверка</b><span>Отметьте строки с ошибками или дублями</span></div></header><div class="office-audit-table"><table><thead><tr><th></th>${config.headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${config.rows.map((row) => `<tr data-audit-row="${row.id}"><td><input type="checkbox" aria-label="Выбрать строку"></td>${row.values.map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
    workspace.querySelectorAll("[data-audit-row]").forEach((row) => row.addEventListener("click", (event) => {
      if (event.target.matches("input")) return;
      const input = row.querySelector("input");
      input.checked = !input.checked;
      row.classList.toggle("selected", input.checked);
    }));
    workspace.querySelectorAll("[data-audit-row] input").forEach((input) => input.addEventListener("change", () => input.closest("tr").classList.toggle("selected", input.checked)));
    return () => ({ selected: [...workspace.querySelectorAll("[data-audit-row] input:checked")].map((input) => input.closest("tr").dataset.auditRow) });
  }

  function renderSort(workspace, task) {
    const config = task.config;
    const order = config.items.map((item) => item.id);
    workspace.innerHTML = `<section class="office-sort"><header><img src="${icon("sorting-answers", 24)}" alt=""><div><b>Порядок обработки</b><span>Используйте стрелки, чтобы переставить строки</span></div></header><ol data-sort-list></ol></section>`;
    const list = workspace.querySelector("[data-sort-list]");
    const render = () => {
      list.innerHTML = order.map((id, index) => { const item = config.items.find((entry) => entry.id === id); return `<li data-sort-id="${id}"><span>${index + 1}</span><b>${esc(item.label)}</b><div><button type="button" data-move="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="down" ${index === order.length - 1 ? "disabled" : ""}>↓</button></div></li>`; }).join("");
      list.querySelectorAll("[data-move]").forEach((button) => button.addEventListener("click", () => {
        const id = button.closest("li").dataset.sortId;
        const index = order.indexOf(id);
        const target = button.dataset.move === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= order.length) return;
        [order[index], order[target]] = [order[target], order[index]];
        render();
      }));
    };
    render();
    return () => ({ order: [...order] });
  }

  function renderOrganize(workspace, task) {
    const config = task.config;
    workspace.innerHTML = `<section class="office-organize"><header><img src="${icon("folder-invoices", 24)}" alt=""><div><b>Распределение файлов</b><span>Укажите папку назначения для каждого документа</span></div></header><div class="office-file-rows">${config.files.map((file) => `<label><img src="${icon(file.name.endsWith(".xlsx") ? "microsoft-excel-2019" : file.name.endsWith(".zip") ? "archive-folder" : "document", 28)}" alt=""><span>${esc(file.name)}</span><select data-file-assignment="${file.id}"><option value="">Выберите папку</option>${config.folders.map((folder) => `<option value="${esc(folder)}">${esc(folder)}</option>`).join("")}</select></label>`).join("")}</div></section>`;
    return () => ({ assignments: Object.fromEntries([...workspace.querySelectorAll("[data-file-assignment]")].map((select) => [select.dataset.fileAssignment, select.value])) });
  }

  function completeTask(task, attempts) {
    const current = engine();
    const before = current?.getState?.();
    if (!current || !before) return { ok: false, message: "Игровой движок недоступен." };
    const saved = officeState(before);
    if (saved.completed[task.id]) return { ok: false, message: "Задание уже выполнено." };
    if (before.dayIndex !== task.dayIndex || before.minute < task.unlockMinute) return { ok: false, message: "Задание сейчас недоступно." };

    const timeResult = current.advanceTime(task.minutes);
    if (!timeResult?.ok || Number(timeResult.advancedMinutes) < task.minutes) {
      return { ok: false, message: "До конца смены недостаточно времени для этого задания." };
    }

    const update = current.updateState((draft) => {
      draft.metadata ||= {};
      const office = normalizeOfficeState(draft.metadata.officeWork);
      office.completed[task.id] = {
        dayIndex: draft.dayIndex,
        minute: draft.minute,
        attempts: Number(attempts || 0),
        score: task.score
      };
      office.attempts[task.id] = Number(attempts || 0);
      draft.metadata.officeWork = office;
      draft.stats ||= {};
      draft.stats.work = Number(draft.stats.work || 0) + task.score;
      draft.journal ||= [];
      draft.journal.push({
        id: `office-${task.id}-${draft.dayIndex}-${draft.minute}`,
        dayIndex: draft.dayIndex,
        minute: draft.minute,
        type: "office-work",
        text: `Выполнено рабочее поручение: ${task.title}`
      });
    }, "office-work-complete");

    if (!update?.ok) {
      current.replaceState?.(before, "office-work-rollback");
      Runtime?.persist?.(before);
      return { ok: false, message: "Результат не сохранился. Изменение времени отменено." };
    }

    const completed = tasksForDay(task.dayIndex).filter((item) => officeState(update.state).completed[item.id]).length;
    Runtime?.notify?.("Рабочее поручение выполнено", `${task.title}. Затрачено ${task.minutes} минут.`);
    if (completed === DAILY_QUOTA) Runtime?.notify?.("Дневная норма закрыта", `Выполнено ${DAILY_QUOTA} офисных поручений. Остальные задачи дают дополнительный рабочий рейтинг.`);
    closeActiveWindow();
    return { ok: true, state: update.state };
  }

  function announceUnlocked(state, reason) {
    if (!state || state.ended || !state.dayStarted || reason === "engine-created") return;
    availableTasks(state).forEach((task) => {
      const key = `${state.dayIndex}:${task.id}`;
      if (announced.has(key)) return;
      announced.add(key);
      Runtime?.notify?.("Новое рабочее поручение", `${task.title} · ${task.minutes} мин.`);
    });
  }

  root.addEventListener?.("until-friday-ui-render", (event) => {
    if (event.detail?.appId === "tasks") decorateTaskApp(event.detail.element);
  });

  root.addEventListener?.("until-friday-state-change", (event) => {
    announceUnlocked(event.detail?.state, event.detail?.reason);
    const taskWindow = document.querySelector(".app-window[data-window-id='tasks']");
    if (taskWindow) decorateTaskApp(taskWindow);
  });

  root.UntilFridayOfficeWorkPack = {
    DAY_STARTS,
    UNLOCK_OFFSETS,
    DAILY_QUOTA,
    TASKS,
    TASKS_BY_DAY,
    TASK_BY_ID,
    normalizeOfficeState,
    officeState,
    tasksForDay,
    availableTasks,
    completedForDay,
    validateTask,
    formatMinute,
    decorateTaskApp,
    openTask,
    completeTask
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
