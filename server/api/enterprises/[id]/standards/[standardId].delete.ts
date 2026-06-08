// server/api/enterprises/[id]/standards/[standardId].delete.ts
import { Standard } from '~~/server/models/standard.model'
import { Tab } from '~~/server/models/tab.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const standardId = getRouterParam(event, 'standardId')

    const standard = await Standard.findOne({ _id: standardId, enterpriseId, isActive: true })
    if (!standard) {
        throw createError({ statusCode: 404, message: 'Стандарт не найден' })
    }

    const tabId = standard.tabId

    if (standard.isDefault) {
        await Tab.findOneAndUpdate(
            { _id: tabId, enterpriseId },
            { $set: { defaultStandardId: null } }
        )
    }

    // Мягкое удаление
    await Standard.findOneAndUpdate(
        { _id: standardId, enterpriseId },
        { $set: { isActive: false } }
    )

    return { success: true }
})