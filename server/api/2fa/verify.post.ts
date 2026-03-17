import { authenticator } from 'otplib';
import User from "~~/server/models/user.model";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { userId, token, secret } = body;

    if (!userId || !token || !secret) {
        throw createError({ statusCode: 400, message: 'Недостаточно данных' });
    }

    // Проверяем код
    const isValid = authenticator.verify({
        token,
        secret
    });

    if (!isValid) {
        throw createError({ statusCode: 400, message: 'Неверный код' });
    }

    // Сохраняем секрет в БД пользователя (после подтверждения)
    await User.findByIdAndUpdate(userId, {
        twoFactorSecret: secret,
        twoFactorEnabled: true
    });

    return {
        success: true,
        message: '2FA успешно настроена'
    };
});