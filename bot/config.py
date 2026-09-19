import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

# Ищем .env, поднимаясь от текущей рабочей директории — это тот же .env,
# что лежит в корне проекта (Nuxt его тоже читает).
load_dotenv(find_dotenv(usecwd=True))

BASE_DIR = Path(__file__).resolve().parent

# ── Telegram / Groq ──────────────────────────────────────────────
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_BASE = os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Вариант 1: обратный прокси вместо api.telegram.org (например тот же
# Cloudflare Worker, что использовался в JS-версии бота).
# Пример: TELEGRAM_API_BASE=https://empty-bar-1192.maksimkq1900.workers.dev/bot{token}/{method}
TELEGRAM_API_BASE = os.getenv("TELEGRAM_API_BASE")

# Вариант 2: обычный HTTP/SOCKS5-прокси для исходящих запросов
# (например локальный прокси на 127.0.0.1, как сейчас в .env).
TELEGRAM_PROXY = os.getenv("TELEGRAM_PROXY")

# ── Админы ────────────────────────────────────────────────────────
# Telegram user_id через запятую, например: ADMIN_IDS=123456789,987654321
ADMIN_IDS = {
    int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()
}

# ── Хранилище файлов проекта и метаданных ───────────────────────
FILES_DIR = BASE_DIR / "storage" / "files"
DATA_FILE = BASE_DIR / "storage" / "data.json"
FILES_DIR.mkdir(parents=True, exist_ok=True)

# ── Анимированные GIF-схемы (кэш по хэшу содержимого файла) ─────
ANIM_DIR = BASE_DIR / "storage" / "animations"
ANIM_DIR.mkdir(parents=True, exist_ok=True)

# Опционально: путь к .ttf-шрифту с поддержкой кириллицы для рендера анимаций.
# Если не задан — бот попробует найти DejaVu Sans по стандартным путям Linux.
# На Linux обычно достаточно: apt install fonts-dejavu-core
# Пример в .env: FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
FONT_PATH = os.getenv("FONT_PATH")

# ── Стили проекта (для подсоса в UI-демо) ────────────────────────
# Путь к главному SCSS-файлу твоего Nuxt-проекта (переменные, токены,
# --half_opacity_border и т.п.). Бот компилирует его в CSS и подмешивает
# в генерируемые демо, чтобы var(--x) реально резолвились и модель видела
# твои настоящие переменные/классы вместо выдуманных.
# Так как бот лежит в отдельной папке рядом с проектом, путь по умолчанию
# идёт на уровень выше (../app/assets/main.scss) — поправь под свою структуру
# в .env, если раскладка другая:
# STYLES_SCSS_PATH=C:/Users/you/IdeaProjects/MoloFlow/app/assets/main.scss
_styles_scss_env = os.getenv("STYLES_SCSS_PATH")
STYLES_SCSS_PATH = (
    Path(_styles_scss_env) if _styles_scss_env
    else (BASE_DIR / ".." / "app" / "assets" / "main.scss").resolve()
)
if not STYLES_SCSS_PATH.exists():
    print(
        f"⚠️  Файл стилей не найден: {STYLES_SCSS_PATH}\n"
        f"    Задай верный путь через STYLES_SCSS_PATH в .env — иначе демо "
        f"будут рендериться без переменных проекта."
    )

TEXT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".vue", ".json", ".md", ".txt",
    ".go", ".java", ".css", ".scss", ".html", ".yml", ".yaml",
    ".sql", ".php", ".rb", ".sh",
}

if not BOT_TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN не задан в .env")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY не задан в .env")
if not ADMIN_IDS:
    print("⚠️  ADMIN_IDS не задан в .env — загружать файлы никто не сможет.")