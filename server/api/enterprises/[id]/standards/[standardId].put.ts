// server/api/enterprises/[id]/standards/[standardId].put.ts
import { Standard } from '~~/server/models/standard.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const standardId = getRouterParam(event, 'standardId')
    const body = await readBody(event)

    // Если устанавливаем как default, снимаем флаг с других
    if (body.isDefault) {
        const standard = await Standard.findById(standardId)
        if (standard) {
            await Standard.updateMany(
                {
                    enterpriseId,
                    tabId: body.tabId || standard.tabId,
                    type: body.type || standard.type,
                    _id: { $ne: standardId }
                },
                { isDefault: false }
            )
        }
    }

    const standard = await Standard.findOneAndUpdate(
        { _id: standardId, enterpriseId },
        body,
        { new: true }
    )

    if (!standard) {
        throw createError({
            statusCode: 404,
            message: 'Стандарт не найден'
        })
    }

    return {
        success: true,
        standard
    }
})