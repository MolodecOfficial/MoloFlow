"""Записывает демо UI-компонента как видео (mp4), реально прогоняя
сгенерированный HTML в headless Chromium (Playwright).

В отличие от старого browser_animator.py (ручная сборка GIF из отдельных
скриншотов через PIL — 8 кадров/сек, палитра 256 цветов, рывками),
здесь Playwright сам пишет видеопоток во время рендера страницы —
получается по-настоящему плавное видео с нормальным количеством кадров
в секунду, а не покадровая имитация.

Playwright умеет писать только .webm, поэтому дальше прогоняем через
ffmpeg в .mp4 (H.264 без звука) — именно в таком виде Telegram
проигрывает файл как гифку через answer_animation.

Требует:
    pip install playwright
    playwright install chromium
    ffmpeg должен быть в PATH (https://ffmpeg.org/download.html,
    на Windows — просто распаковать и добавить bin/ в PATH).
"""
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

logger = logging.getLogger("bot")

# рамка окна браузера рисуется прямо в HTML через _wrap_page_with_chrome,
# а не поверх готового видео — так рамка тоже попадает в плавную запись
CHROME_BAR_HEIGHT = 40


def _wrap_page_with_chrome(html: str, width: int, height: int) -> str:
    """Оборачивает демо-страницу в имитацию окна браузера (три кружка +
    адресная строка) прямо средствами HTML/CSS, чтобы это тоже попало
    в видеозапись как единая плавная картинка, а не накладывалось потом."""
    escaped = html.replace("&", "&amp;").replace('"', "&quot;")
    chrome_html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {{ margin: 0; padding: 0; }}
  #__chrome_bar {{
    height: {CHROME_BAR_HEIGHT}px;
    background: #e6e6eb;
    display: flex;
    align-items: center;
    padding: 0 12px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, sans-serif;
  }}
  #__chrome_bar .__dot {{
    width: 12px; height: 12px; border-radius: 50%; margin-right: 8px;
  }}
  #__chrome_bar .__addr {{
    flex: 1; height: 24px; margin-left: 8px; border-radius: 10px;
    background: #fff; border: 1px solid #d2d2d7;
  }}
  #__demo_frame {{
    width: {width}px; height: {height}px; border: none; display: block;
  }}
</style>
</head>
<body>
  <div id="__chrome_bar">
    <div class="__dot" style="background:#ed6a5e"></div>
    <div class="__dot" style="background:#f5bf4f"></div>
    <div class="__dot" style="background:#61c550"></div>
    <div class="__addr"></div>
  </div>
  <iframe id="__demo_frame" srcdoc="{escaped}"></iframe>
</body>
</html>"""
    return chrome_html


def _record_video(html: str, width: int, height: int, duration_ms: int, tmp_dir: Path) -> Path:
    full_height = height + CHROME_BAR_HEIGHT
    wrapped = _wrap_page_with_chrome(html, width, height)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            context = browser.new_context(
                viewport={"width": width, "height": full_height},
                record_video_dir=str(tmp_dir),
                record_video_size={"width": width, "height": full_height},
            )
            page = context.new_page()
            page.set_content(wrapped, wait_until="load")
            # ждём длительность анимации + небольшой запас, чтобы не обрезать хвост
            page.wait_for_timeout(duration_ms + 300)
            video = page.video
            # ВАЖНО: закрываем контекст (это дописывает файл на диск) и сразу
            # же, пока Playwright ещё жив (мы внутри `with sync_playwright()`),
            # забираем путь к файлу — video.path() после выхода из `with`
            # падает с "Event loop is closed! Is Playwright already stopped?"
            context.close()
            if video is None:
                raise RuntimeError("Playwright не вернул объект видео (record_video не сработал)")
            webm_path = Path(video.path())
        finally:
            browser.close()

    return webm_path


def _find_ffmpeg() -> str:
    """Сначала пробуем системный ffmpeg из PATH (если пользователь сам его
    ставил), иначе используем бинарник, который сам скачался при
    `pip install imageio-ffmpeg` — так ffmpeg не нужно ставить и добавлять
    в PATH вручную вообще, особенно удобно на Windows."""
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:
        raise RuntimeError(
            "ffmpeg не найден. Либо установи его и добавь в PATH "
            "(https://ffmpeg.org/download.html), либо просто выполни "
            "`pip install imageio-ffmpeg` — он сам подтянет готовый бинарник "
            f"без ручной настройки PATH. (Исходная ошибка: {e})"
        ) from e


def _webm_to_mp4(webm_path: Path, out_path: Path) -> None:
    ffmpeg_exe = _find_ffmpeg()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_exe, "-y",
        "-i", str(webm_path),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",   # совместимость с плеером Telegram
        "-movflags", "+faststart",
        "-an",                    # без звука, как обычная "гифка"
        "-vf", "fps=30",          # плавные 30 fps в выходном видео
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("ffmpeg stderr: %s", result.stderr[-2000:])
        raise RuntimeError("ffmpeg не смог сконвертировать видео в mp4")


def render_ui_video(storyboard: dict, out_path: Path) -> Path:
    """storyboard — результат ui_ai.generate_ui_storyboard():
    {"title", "html", "width", "height", "duration_ms"}.
    out_path — путь для итогового .mp4.
    """
    with tempfile.TemporaryDirectory(prefix="ui_demo_") as tmp:
        tmp_dir = Path(tmp)
        webm_path = _record_video(
            storyboard["html"],
            storyboard["width"],
            storyboard["height"],
            storyboard["duration_ms"],
            tmp_dir,
        )
        _webm_to_mp4(webm_path, out_path)

    return out_path