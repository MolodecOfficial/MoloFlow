import asyncio
import html
import logging
from concurrent.futures import ProcessPoolExecutor

from aiogram import Router, F, types

import config
from keyboards.menus import resolve
from services.store import store
from services.ui_ai import generate_ui_storyboard
from services.browser_animator import render_ui_video

logger = logging.getLogger("bot")
router = Router()

# Playwright (sync API) плохо уживается с чужим asyncio event loop в том же
# процессе/потоке — на Windows это даёт "Event loop is closed! Is Playwright
# already stopped?" даже через asyncio.to_thread, т.к. поток из пула может
# быть переиспользован с уже остановленным циклом Playwright внутри.
# Решение: рендерить в отдельном ПРОЦЕССЕ — там гарантированно чистый,
# свой собственный event loop, никак не связанный с циклом бота.
_render_pool = ProcessPoolExecutor(max_workers=1)


def _render_worker(storyboard: dict, video_path_str: str) -> str:
    """Выполняется в отдельном процессе. Принимает/возвращает только
    простые (picklable) типы — Path и dict с html/int спокойно проходят."""
    from pathlib import Path
    render_ui_video(storyboard, Path(video_path_str))
    return video_path_str


@router.callback_query(F.data.startswith("anim:"))
async def make_animation(callback: types.CallbackQuery):
    sid = callback.data.split(":", 1)[1]
    path = resolve(sid)
    if path is None:
        await callback.answer("Меню устарело, открой заново через /docs", show_alert=True)
        return

    entry = store.get_file(path)
    if not entry:
        await callback.answer("Файл не найден", show_alert=True)
        return

    await callback.answer("Строю живое демо в браузере, подожди немного…")

    video_path = config.ANIM_DIR / f"{entry['hash']}.mp4"

    if not video_path.exists():
        storyboard = entry.get("scheme")
        if not storyboard or "html" not in storyboard:
            raw_path = config.FILES_DIR / path
            try:
                content = raw_path.read_text(encoding="utf-8")
            except OSError:
                await callback.message.answer("Не удалось прочитать файл на диске.")
                return
            try:
                # генерация HTML-макета — блокирующий вызов к Groq (сетевой
                # I/O, не Playwright), поток тут безопасен
                storyboard = await asyncio.to_thread(generate_ui_storyboard, path, content)
            except Exception as e:
                logger.exception("Не удалось построить UI-демо для %s", path)
                await callback.message.answer(
                    f"Не получилось построить демо: {html.escape(str(e))}"
                )
                return
            store.set_scheme(path, storyboard)

        try:
            # запуск headless-браузера, запись видео и конвертация в mp4 —
            # выполняем в отдельном процессе (см. _render_pool выше)
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                _render_pool, _render_worker, storyboard, str(video_path)
            )
        except Exception as e:
            logger.exception("Не удалось отрендерить демо для %s", path)
            await callback.message.answer(
                f"Ошибка рендера демо: {html.escape(str(e))}"
            )
            return

    await callback.message.answer_animation(
        types.FSInputFile(video_path),
        caption=f"🎬 Как это выглядит и работает: <b>{path}</b>",
    )