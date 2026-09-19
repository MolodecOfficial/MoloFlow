"""Компилирует пользовательский SCSS-файл проекта (переменные, миксины,
дизайн-токены) в чистый CSS, чтобы его можно было:
1) вставить как <style> в генерируемый HTML-макет (тогда var(--x) реально
   резолвится в браузере при рендере видео);
2) отдать модели в промпте как контекст, чтобы она использовала реальные
   имена переменных/классов проекта, а не выдумывала свои.

Требует: pip install libsass  (пакет называется "libsass", импортируется как `sass`)
"""
import logging

import sass

import config

logger = logging.getLogger("bot")

_cache: dict[str, str] = {"mtime": None, "css": ""}


def _read_mtime() -> float | None:
    path = config.STYLES_SCSS_PATH
    if not path or not path.exists():
        return None
    return path.stat().st_mtime


def get_compiled_css() -> str:
    """Возвращает скомпилированный CSS проекта (с кэшем по mtime файла).
    Если файл стилей не настроен/не найден/не компилируется — возвращает
    пустую строку и пишет в лог, но не роняет генерацию демо.
    """
    path = config.STYLES_SCSS_PATH
    if not path:
        return ""

    mtime = _read_mtime()
    if mtime is None:
        logger.warning("Файл стилей не найден: %s", path)
        return ""

    if _cache["mtime"] == mtime:
        return _cache["css"]

    try:
        css = sass.compile(
            filename=str(path),
            output_style="expanded",
            include_paths=[str(path.parent)],
        )
    except sass.CompileError as e:
        logger.warning("Не удалось скомпилировать %s: %s", path, e)
        return _cache["css"]  # отдаём последнюю рабочую версию, если была

    _cache["mtime"] = mtime
    _cache["css"] = css
    return css


def get_css_for_prompt(max_chars: int = 6_000) -> str:
    """Урезанная версия CSS для промпта модели — полный файл может быть
    огромным (реальные Nuxt-проекты), а нам достаточно, чтобы модель видела
    имена переменных/токенов, а не весь CSS целиком."""
    css = get_compiled_css()
    if len(css) > max_chars:
        return css[:max_chars] + "\n/* ...(стили обрезаны) */"
    return css