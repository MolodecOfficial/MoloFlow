import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.client.telegram import TelegramAPIServer
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

import config
from handlers import admin, common, user, animate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bot")

# убрать спам httpx/openai про каждую ретрай-попытку
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai._base_client").setLevel(logging.WARNING)


def build_session() -> AiohttpSession:
    kwargs = {}

    # !!! ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ !!!
    # Мы используем TELEGRAM_API_BASE из вашего config.py
    # Убедитесь, что в .env переменная TELEGRAM_API_BASE указывает на ваш Worker,
    # а TELEGRAM_PROXY пуста или удалена.
    if config.TELEGRAM_API_BASE:
        # ВАЖНО: Aiogram ожидает, что base URL будет без /bot{token}
        # Ваш Worker должен принимать запросы вида https://your-worker.workers.dev/bot{token}/{method}
        # Поэтому мы просто передаем базовый URL воркера.
        kwargs["api"] = TelegramAPIServer.from_base(config.TELEGRAM_API_BASE)
        logger.info("Telegram API через кастомный base (Cloudflare Worker): %s", config.TELEGRAM_API_BASE)

    # Если вдруг вы захотите использовать локальный прокси, раскомментируйте это,
    # но для работы через Worker он НЕ НУЖЕН.
    # if config.TELEGRAM_PROXY:
    #     kwargs["proxy"] = config.TELEGRAM_PROXY
    #     logger.info("Исходящие запросы идут через прокси: %s", config.TELEGRAM_PROXY)

    return AiohttpSession(**kwargs)


async def main():
    bot = Bot(
        token=config.BOT_TOKEN,
        session=build_session(),
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    dp.include_router(admin.router)
    dp.include_router(user.router)
    dp.include_router(animate.router)
    dp.include_router(common.router)

    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("Бот запущен (polling)")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())