import bcrypt from "bcrypt";
import User from "~~/server/models/user.model";

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { name, password } = body;

    if (!body) {
        return createError({ statusCode: 400, message: 'Ошибка: тело запроса не может быть пустым.' });
    }

    // Найти пользователя по email и выбрать пароль
    const user = await User.findOne({ name: body.name }).select('+password');

    if (!user) {
        return createError({ statusCode: 401, message: 'Неверное имя или пароль.' });
    }

    // Проверка пароля
    const isPasswordCorrect = await bcrypt.compare(body.password, user.password);

    if (!isPasswordCorrect) {
        return createError({ statusCode: 401, message: 'Неправильный пароль.' });
    }
    return {
        message: `${user.name}`,
        user: {
            _id: user._id,
            name: user.name,
            role: user.role,
        }
    }
})