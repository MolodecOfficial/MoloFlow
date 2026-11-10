import User from "~~/server/models/user.model";
import { verifyTotp } from "~~/server/utils/totp";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { userId, token, secret } = body;

    if (!userId || !token || !secret) {
        throw createError({ statusCode: 400, message: 'Недостаточно данных' });
    }

    const isValid = await verifyTotp(token, secret);

    if (!isValid) {
        throw createError({ statusCode: 400, message: 'Неверный код' });
    }

    await User.findByIdAndUpdate(userId, {
        twoFactorSecret: secret,
        twoFactorEnabled: true
    });

    return { success: true, message: '2FA успешно настроена' };
});