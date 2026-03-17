import User from "~~/server/models/user.model";
import { authenticator } from 'otplib';
import bcrypt from "bcrypt";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { name, password, loginType } = body;

    const user = await User.findOne({ name });
    if (!user) {
        throw createError({ statusCode: 401, message: 'Неверное имя пользователя или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        throw createError({ statusCode: 401, message: 'Неверное имя пользователя или пароль' });
    }

    // Проверяем, есть ли у пользователя 2FA секрет
    if (!user.twoFactorSecret) {
        // Если нет - генерируем новый секрет для первого входа
        const secret = authenticator.generateSecret();
        user.twoFactorSecret = secret;
        user.twoFactorEnabled = true;
        await user.save();

        return {
            requires2FA: true,
            isFirstTime: true,
            userId: user._id,
            secret: secret,
            message: 'Первый вход. Настройте Google Authenticator'
        };
    }

    return {
        requires2FA: true,
        isFirstTime: false,
        userId: user._id,
        message: 'Введите код из Google Authenticator'
    };
});