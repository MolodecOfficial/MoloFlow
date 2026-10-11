import User from "~~/server/models/user.model";
import { verifyTotp } from "~~/server/utils/totp";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { userId, token, loginType, isFirstTime } = body;

    if (!userId || !token) {
        throw createError({ statusCode: 400, message: 'Недостаточно данных для верификации' });
    }

    const user = await User.findById(userId);
    if (!user || !user.twoFactorSecret) {
        throw createError({ statusCode: 401, message: '2FA не сконфигурирована' });
    }

    const cleanToken = String(token).trim().replace(/\s+/g, '');

    // Проверка по реальному времени (не по часам ноутбука)
    const isValid = await verifyTotp(cleanToken, user.twoFactorSecret);

    if (!isValid) {
        throw createError({ statusCode: 401, message: 'Неверный код Google Authenticator' });
    }

    if (isFirstTime || !user.twoFactorEnabled) {
        user.twoFactorEnabled = true;
        await user.save();
    }

    return {
        success: true,
        user: {
            _id: String(user._id),
            name: user.name,
            role: user.role,
            phone: user.phone || '',
            email: user.email || ''
        },
        loginType,
        message: 'Вход выполнен успешно'
    };
});