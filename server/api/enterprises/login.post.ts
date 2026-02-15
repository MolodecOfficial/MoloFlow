import Enterprise from "~~/server/models/enterprise.model";
import bcrypt from "bcrypt";

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { enterpriseId, keypass } = body

    if (!enterpriseId || !keypass) {
        return createError({ statusCode: 400, message: 'Не указан ID предприятия или ключ доступа' })
    }

    const enterprise = await Enterprise.findById(enterpriseId)

    if (!enterprise) {
        return createError({ statusCode: 404, message: 'Предприятие не найдено' })
    }

    const isValid = await bcrypt.compare(keypass, enterprise.keypass)

    if (!isValid) {
        return createError({ statusCode: 401, message: 'Неверный ключ доступа' })
    }

    return {
        success: true,
        message: 'Успешный вход',
        enterprise: {
            id: enterprise._id,
            name: enterprise.enterpriseName,
            ownershipForm: enterprise.ownershipForm
        }
    }
})