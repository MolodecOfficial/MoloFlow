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

    if config.TELEGRAM_API_BASE:
        base = config.TELEGRAM_API_BASE.rstrip("/")
        kwargs["api"] = TelegramAPIServer(
            base=f"{base}/bot{{token}}/{{method}}",
            file=f"{base}/file/bot{{token}}/{{path}}",
        )
        logger.info("Telegram API base: %s", base)

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