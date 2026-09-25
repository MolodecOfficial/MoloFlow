import json
import re
import config

from services.ai import _client, _trim_source, MAX_CHARS
from services.project_styles import get_css_for_prompt
from google.genai import types

SYSTEM_PROMPT_TEMPLATE = """Ты — фронтенд-инженер. По коду файла ты собираешь ЖИВОЙ HTML-макет,
имитирующий, как компонент выглядит и ведёт себя в браузере — для видео-демо
в Telegram-боте документации. Никакого реального запуска исходного кода
не происходит — ты рисуешь правдоподобную HTML/CSS/JS-имитацию по его логике.

ЗАДАЧА:
1. Определи, что это за UI (кнопка, форма, карточка, модалка, список и т.п.)
   и как он реагирует на действия пользователя (клик, ввод, сабмит, hover),
   основываясь ТОЛЬКО на том, что реально видно в коде (props, events,
   условный рендеринг, состояния loading/error/success).
2. Собери самодостаточный HTML-документ, который сам, в цикле, проигрывает
   этот сценарий (например: обычное состояние → наведение → клик →
   загрузка → результат → сброс), используя CSS-переходы/анимации и
   обычный <script> без внешних библиотек.

СТИЛИ ПРОЕКТА (реальный скомпилированный CSS из app/assets/main.scss,
уже подключён в <head> демо-страницы автоматически — НЕ дублируй его,
но ОБЯЗАТЕЛЬНО используй реальные CSS-переменные и классы отсюда,
там где они подходят под компонент, вместо выдуманных цветов/отступов):

```css
{project_css}
```

ФОРМАТ ОТВЕТА — строго так, без ```, без пояснений до/после:

Первая строка — JSON с метаданными:
{{"title": "короткое название компонента", "width": 480, "height": 320, "duration_ms": 4000}}

Дальше, с новой строки, — полный HTML-документ, обёрнутый в буквальные маркеры:
<DEMO_HTML>
<!doctype html>
<html>...</html>
</DEMO_HTML>

ПРАВИЛА HTML:
- Полный самодостаточный документ (<!doctype>, <html>, <head><style>...</style></head>,
  <body>...<script>...</script></body>).
- В <style> НЕ переопределяй заново переменные проекта (--что-то) — они уже
  придут извне через подключённый CSS. Просто используй var(--имя) как есть.
- НИКАКИХ внешних ресурсов: без CDN, шрифтов, картинок по URL, fetch, import.
  Если в стилях проекта подключён кастомный шрифт через @font-face с внешним
  URL — просто используй system-ui как фолбэк, внешний файл всё равно не
  загрузится в изолированной песочнице.
- Анимация должна автоматически стартовать при загрузке страницы и длиться
  примерно duration_ms миллисекунд, наглядно показывая именно то поведение,
  что заложено в коде файла.
- width/height (в метаданных) — разумный размер под сам компонент, не под
  всю страницу: 300–800 по ширине, 200–600 по высоте.
- Не выдумывай функциональность, которой нет в коде. Если непонятно, что
  делает компонент — сделай простую наглядную имитацию его структуры (только
  внешний вид и очевидные интерактивные элементы), без вымышленной логики.
"""

_META_RE = re.compile(r"\{.*?\}", re.DOTALL)

_MIN_W, _MAX_W = 300, 800
_MIN_H, _MAX_H = 200, 600
_MIN_MS, _MAX_MS = 1500, 8000


def _strip_fences(raw: str) -> str:
    return re.sub(r"^```(?:\w+)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE).strip()


def _parse_response(raw: str) -> tuple[dict, str]:
    raw = _strip_fences(raw)

    marker = raw.find("<DEMO_HTML>")
    if marker == -1:
        raise ValueError("Модель не вернула HTML-демо (нет маркера <DEMO_HTML>)")

    meta_part = raw[:marker]
    html_part = raw[marker + len("<DEMO_HTML>"):]

    close = html_part.rfind("</DEMO_HTML>")
    if close != -1:
        html_part = html_part[:close]
    html_part = html_part.strip()

    if "<html" not in html_part.lower():
        raise ValueError("Модель вернула невалидный HTML-документ")

    meta_match = _META_RE.search(meta_part)
    meta = {}
    if meta_match:
        try:
            meta = json.loads(meta_match.group(0))
        except json.JSONDecodeError:
            meta = {}

    return meta, html_part


def _clamp(value, lo, hi, default):
    try:
        value = int(value)
    except (TypeError, ValueError):
        return default
    return min(max(value, lo), hi)


def _inject_project_css(html: str, project_css: str) -> str:
    """Вставляет реальный скомпилированный CSS проекта в <head> демо-страницы,
    ДО стилей самой модели — чтобы var(--x) резолвились взаправду в браузере,
    а не оставались текстом 'var(--half_opacity_border)' без значения."""
    if not project_css.strip():
        return html

    block = f"<style id=\"project-styles\">\n{project_css}\n</style>\n"

    head_match = re.search(r"<head[^>]*>", html, flags=re.IGNORECASE)
    if head_match:
        idx = head_match.end()
        return html[:idx] + "\n" + block + html[idx:]

    # если модель забыла <head> — вставляем перед первым </html> как есть
    return block + html


def _validate(meta: dict, html: str, project_css: str) -> dict:
    return {
        "title": str(meta.get("title", "")).strip()[:60] or "Демо компонента",
        "html": _inject_project_css(html, project_css),
        "width": _clamp(meta.get("width"), _MIN_W, _MAX_W, 480),
        "height": _clamp(meta.get("height"), _MIN_H, _MAX_H, 320),
        "duration_ms": _clamp(meta.get("duration_ms"), _MIN_MS, _MAX_MS, 4000),
    }


def generate_ui_storyboard(rel_path: str, content: str) -> dict:
    content = _trim_source(content)
    if len(content) > MAX_CHARS:
        content = content[:MAX_CHARS] + "\n...(файл обрезан)"

    project_css = get_css_for_prompt()
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        project_css=project_css or "/* стили проекта не настроены/не найдены */"
    )

    response = _client.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=f"Файл: {rel_path}\n\n```\n{content}\n```",
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.3,
        ),
    )
    raw = response.text or ""
    meta, html = _parse_response(raw)
    return _validate(meta, html, project_css)