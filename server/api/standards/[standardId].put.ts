import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const standardId = getRouterParam(event, 'standardId')
    const body = await readBody(event)

    const existing = await Standard.findOne({ _id: standardId, isActive: true })
    if (!existing) {
        throw createError({ statusCode: 404, message: 'Стандарт не найден' })
    }

    // Если устанавливаем isDefault: true – снимаем флаг со всех остальных
    if (body.isDefault === true) {
        await Standard.updateMany(
            {
                _id: { $ne: standardId },
                isActive: true
            },
            { $set: { isDefault: false } }
        )
    }

    const updateData = {
        name: body.name,
        description: body.description,
        type: body.type || 'table',
        isDefault: body.isDefault,
        tableRows: body.tableRows || [],
        cardSettings: body.cardSettings || {},
        listSettings: body.listSettings || {},
        styles: body.styles || {}
    }

    const standard = await Standard.findOneAndUpdate(
        { _id: standardId, isActive: true },
        { $set: updateData },
        { new: true }
    )

    return { success: true, standard }
})