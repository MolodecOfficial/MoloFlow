import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const standardId = getRouterParam(event, 'standardId')

    const standard = await Standard.findOne({ _id: standardId, isActive: true })
    if (!standard) {
        throw createError({ statusCode: 404, message: 'Стандарт не найден' })
    }

    // Мягкое удаление
    await Standard.findOneAndUpdate(
        { _id: standardId },
        { $set: { isActive: false } }
    )

    return { success: true }
})