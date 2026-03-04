import Enterprise from "~~/server/models/enterprise.model";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        const { inn, keypass } = body

        if (!inn || !keypass) {
            throw createError({
                statusCode: 400,
                message: 'ИНН и код доступа обязательны'
            })
        }

        // Убираем Number(), ищем как строку
        const enterprise = await Enterprise.findOne({ inn: inn })

        if (!enterprise) {
            throw createError({
                statusCode: 404,
                message: 'Предприятие с таким ИНН не найдено'
            })
        }

        const isValidKeypass = await bcrypt.compare(keypass, enterprise.keypass)

        if (!isValidKeypass) {
            throw createError({
                statusCode: 401,
                message: 'Неверный код доступа'
            })
        }

        const token = jwt.sign(
            {
                enterpriseId: enterprise._id,
                inn: enterprise.inn,
                name: enterprise.enterpriseName
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        )

        return {
            statusCode: 200,
            message: 'Вход выполнен успешно',
            token,
            enterprise: {
                _id: enterprise._id,
                enterpriseName: enterprise.enterpriseName,
                inn: enterprise.inn,
                kpp: enterprise.kpp,
                ogrn: enterprise.ogrn,
                legalAddress: enterprise.legalAddress,
                actualAddress: enterprise.actualAddress,
                phone: enterprise.phone,
                email: enterprise.email,
                director: enterprise.director,
                okved: enterprise.okved,
                ownershipForm: enterprise.ownershipForm
            }
        }

    } catch (error: any) {
        console.error('Ошибка входа:', error)

        if (error.statusCode) {
            throw error
        }

        throw createError({
            statusCode: 500,
            message: 'Внутренняя ошибка сервера: ' + error.message
        })
    }
})