import User from "~~/server/models/user.model";
import bcrypt from "bcrypt";
import { authenticator } from "~~/server/utils/totp";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { name, password } = body;

    if (!name || !password) {
        throw createError({ statusCode: 400, message: 'Имя и пароль обязательны' });
    }

    const user = await User.findOne({ name });
    if (!user) {
        throw createError({ statusCode: 401, message: 'Неверное имя пользователя или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        throw createError({ statusCode: 401, message: 'Неверное имя пользователя или пароль' });
    }

    // 2FA ещё не подтверждена
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        // Переиспользуем уже созданный (но не подтверждённый) секрет,
        // чтобы повторный вход не ломал QR, который пользователь уже отсканировал
        let secret = user.twoFactorSecret;
        if (!secret) {
            secret = authenticator.generateSecret();
            user.twoFactorSecret = secret;
            user.twoFactorEnabled = false;
            await user.save();
        }

        return {
            requires2FA: true,
            isFirstTime: true,
            userId: String(user._id),
            secret,
            message: 'Первый вход. Настройте Google Authenticator'
        };
    }

    return {
        requires2FA: true,
        isFirstTime: false,
        userId: String(user._id),
        message: 'Введите код из Google Authenticator'
    };
});