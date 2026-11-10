import bcrypt from 'bcrypt'
import User from "~~/server/models/user.model";

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { name, password, phone } = body;

    const existingUser = await User.findOne({ name })

    if (existingUser) {
        throw createError({ statusCode: 400, message: "Пользователь уже существует" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = new User({ name, password: hashedPassword, phone })
    try {
        await newUser.save()
        return {
            statusCode: 200,
            message: "Пользователь успешно создан",
            user: {
                _id: newUser._id,
                name: newUser.name,
                role: newUser.role,
                phone: newUser.phone
            }
        }
    } catch (error: any) {
        console.error('Ошибка при сохранении пользователя:', error)
        if (error.code === 11000) {
            throw createError({ statusCode: 400, message: "Данный пользователь уже существует" });
        }
        throw createError({ statusCode: 500, message: error.message || "Произошла ошибка при регистрации" });
    }
})