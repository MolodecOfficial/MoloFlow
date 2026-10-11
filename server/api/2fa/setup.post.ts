import User from "~~/server/models/user.model";
import { authenticator } from "~~/server/utils/totp";

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

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.name, 'MoloFlow', secret);

    return {
        secret,
        otpauth,
        message: 'Отсканируйте QR-код в Google Authenticator'
    };
});