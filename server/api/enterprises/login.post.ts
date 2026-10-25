// server/api/enterprises/login.post.ts
// Вход предприятия по ИНН и ключу доступа. Токен описывает ПРЕДПРИЯТИЕ, личность пользователя он не задаёт.
import Enterprise from '~~/server/models/enterprise.model'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '~~/server/utils/sessionToken'

export default defineEventHandler(async (event) => {
    try {
        const { inn, keypass } = (await readBody(event)) || {}
        if (!inn || !keypass) {
            throw createError({ statusCode: 400, message: 'ИНН и код доступа обязательны' })
        }

        const enterprise: any = await Enterprise.findOne({ inn: String(inn).trim() })
        if (!enterprise) {
            throw createError({ statusCode: 404, message: 'Предприятие с таким ИНН не найдено' })
        }
        if (enterprise.status && enterprise.status !== 'active') {
            throw createError({ statusCode: 409, message: 'Предприятие ещё не готово к работе' })
        }

        const ok = await bcrypt.compare(String(keypass), enterprise.keypass)
        if (!ok) throw createError({ statusCode: 401, message: 'Неверный код доступа' })

        const token = jwt.sign(
            { type: 'enterprise', enterpriseId: String(enterprise._id) },
            getJwtSecret(),
            { expiresIn: '24h' }
        )

        return {
            statusCode: 200,
            message: 'Вход выполнен успешно',
            token,
            enterprise: {
                _id: String(enterprise._id),
                enterpriseName: enterprise.enterpriseName,
                inn: enterprise.inn,
                ownershipForm: enterprise.ownershipForm
            }
        }
    } catch (error: any) {
        if (error.statusCode) throw error
        console.error('Ошибка входа:', error)
        throw createError({ statusCode: 500, message: 'Внутренняя ошибка сервера' })
    }
})
