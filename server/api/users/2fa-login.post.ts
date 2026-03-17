import { authenticator } from 'otplib';
import User from "~~/server/models/user.model";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { userId, token, loginType, isFirstTime } = body;

    if (!userId || !token) {
        throw createError({ statusCode: 400, message: 'Недостаточно данных' });
    }

    const user = await User.findById(userId);
    if (!user || !user.twoFactorSecret) {
        throw createError({ statusCode: 401, message: '2FA не настроена' });
    }

    // Проверяем код из Google Authenticator
    const isValid = authenticator.verify({
        token,
        secret: user.twoFactorSecret
    });

    if (!isValid) {
        throw createError({ statusCode: 401, message: 'Неверный код' });
    }

    // Если это первый вход и секрет уже сохранен, просто продолжаем
    return {
        success: true,
        user: {
            id: user._id,
            name: user.name,
            role: user.role
        },
        loginType,
        message: 'Вход выполнен успешно'
    };
});