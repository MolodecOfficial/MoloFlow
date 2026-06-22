import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    if (!body.name) {
        throw createError({ statusCode: 400, message: 'Название стандарта обязательно' })
    }

    // Если стандарт помечен как isDefault – снимаем флаг со всех остальных
    if (body.isDefault === true) {
        await Standard.updateMany(
            { isActive: true },
            { $set: { isDefault: false } }
        )
    }

    const standard = await Standard.create({
        name: body.name,
        description: body.description || '',
        type: body.type || 'table',
        isDefault: body.isDefault || false,
        tableRows: body.tableRows || [],
        cardSettings: body.cardSettings || {},
        listSettings: body.listSettings || {},
        styles: body.styles || {}
    })

    return { success: true, standard }
})