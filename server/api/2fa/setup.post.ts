import { authenticator } from 'otplib';
import User from "~~/server/models/user.model";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { userId } = body;

    if (!userId) {
        throw createError({ statusCode: 400, message: 'ID пользователя обязателен' });
    }

    const user = await User.findById(userId);
    if (!user) {
        throw createError({ statusCode: 404, message: 'Пользователь не найден' });
    }

    // Генерируем секрет для пользователя
    const secret = authenticator.generateSecret();

    // Создаем ссылку для QR-кода
    const serviceName = 'MoloFlow';
    const otpauth = authenticator.keyuri(user.name, serviceName, secret);

    return {
        secret,
        otpauth,
        message: 'Отсканируйте QR-код в Google Authenticator'
    };
});