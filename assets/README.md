# Ассеты игры «До пятницы»

Игра запускается и без внешних изображений: пока нужного файла нет, интерфейс использует временный CSS-значок.

Точные пути для всех сгенерированных изображений перечислены в [`manifest.json`](manifest.json). Загружай файлы сразу по указанным там путям, например:

- `assets/brand/company-logo.png`
- `assets/backgrounds/desktop-wallpaper.png`
- `assets/icons/apps/explorer.png`
- `assets/avatars/player.png`
- `assets/photos/office-party.jpg`
- `assets/brand/game-icon.png`

## Пункт 37 — загружать не нужно

Индикатор загрузки создаётся программно в `src/loading-indicator.js`:

- JavaScript создаёт 12 отдельных сегментов;
- CSS последовательно меняет их яркость;
- индикатор используется при запуске игры и обновлении приложений;
- файл `assets/sprites/loading.png` больше не используется.

Остальные пункты из манифеста остаются обычными изображениями.
