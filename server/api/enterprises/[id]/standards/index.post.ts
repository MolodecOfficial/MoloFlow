import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!body.name || !body.type) {
        throw createError({
            statusCode: 400,
            message: 'Название и тип стандарта обязательны'
        })
    }

    if (!body.tabId) {
        throw createError({
            statusCode: 400,
            message: 'Необходимо указать вкладку'
        })
    }

    // Создаём стандарт
    const standard = await Standard.create({
        enterpriseId,
        ...body
    })

    return {
        success: true,
        standard
    }
})