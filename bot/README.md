# Telegram-бот документации (Python / aiogram)

Что было доделано поверх ваших `admin.py`, `user.py`, `common.py`:

- `config.py` — читает общий `.env` проекта (переменные `TELEGRAM_BOT_TOKEN`,
  `GROQ_API_KEY`, `ADMIN_IDS`, `TEXT_EXTENSIONS` и т.д.)
- `handlers/filters.py` — `IsAdmin` / `IsNotAdmin` по списку `ADMIN_IDS`
- `services/store.py` — хранит присланные файлы на диске
  (`storage/files/...`) + метаданные (хэш, summary) в `storage/data.json`,
  умеет определять, что изменилось (`pending_files()`)
- `services/ai.py` — генерация описания файла через Groq
  (тот же принцип, что был в `bot.js`, но на `openai` python-пакете)
- `keyboards/menus.py` — строит папки/файлы меню из списка путей в `store`,
  короткие id для `callback_data` (Telegram ограничивает его 64 байтами)
- `main.py` — точка входа: создаёт бота, поднимает polling, подключает
  роутеры в правильном порядке (`admin` → `user` → `common`, чтобы админ
  тоже попадал в общие `/docs`, `nav:`, `file:` хендлеры из `common.py`)

## Установка

```bash
cd telegram-bot
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Настройка `.env`

Бот читает **общий `.env` в корне проекта** (тот же, что использует Nuxt).
Добавьте туда переменную из `.env.example`:

```
ADMIN_IDS=ваш_telegram_id
```

Свой ID можно узнать, написав `@userinfobot` в Telegram.

Если `api.telegram.org` у вас не открывается напрямую — выберите один способ:
- `TELEGRAM_API_BASE` — обратный прокси (Cloudflare Worker, как в старом JS-боте)
- `TELEGRAM_PROXY` — обычный локальный HTTP/SOCKS5-прокси (сейчас в .env
  уже стоит `http://127.0.0.1:10809` — используется, если поднят локально)

Оба варианта реализованы в `main.py`, включится тот, для которого задана
переменная.

## Запуск отдельно

```bash
python main.py
```

## Запуск вместе с проектом (Nuxt + бот одной командой)

1. Поставьте `concurrently` в корне проекта:

```bash
npm i -D concurrently
```

2. Добавьте в `package.json` в корне проекта:

```json
{
  "scripts": {
    "bot": "python telegram-bot/main.py",
    "dev:all": "concurrently -n nuxt,bot -c blue,green \"npm run dev\" \"npm run bot\""
  }
}
```

(если venv не активирован глобально, замените `python` на
`telegram-bot/.venv/bin/python`, либо на Windows —
`telegram-bot\\.venv\\Scripts\\python.exe`)

3. Запускать так:

```bash
npm run dev:all
```

Nuxt-дев-сервер и бот поднимутся параллельно в одном терминале, с
цветными префиксами `nuxt` / `bot` в логах.

## Как это работает

- Админ (ID из `ADMIN_IDS`) присылает файлы проекта или `.zip` — они
  сохраняются в `storage/files/...`, статус — «изменён/без изменений».
- `/generate` — прогоняет через Groq только файлы без готового summary
  (новые или изменившиеся), остальные не трогает.
- Обычные пользователи видят `/docs` — папки/файлы кнопками, без загрузки.
- `/reset_docs` — полностью очищает `storage/`.

`storage/` стоит добавить в `.gitignore` — там лежат исходники файлов
проекта и сгенерированные описания, это runtime-данные бота, не код.
