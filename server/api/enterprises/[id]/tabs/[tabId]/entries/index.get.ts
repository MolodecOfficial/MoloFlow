import { Entry } from '~~/server/models/entry.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const tabId = getRouterParam(event, 'tabId')

    if (!enterpriseId || !tabId) {
        throw createError({ statusCode: 400, message: 'Не указан ID предприятия или вкладки' })
    }

    const entries = await Entry.find({
        enterpriseId,
        tabId,
        isActive: true,
        isArchived: false
    }).sort({ createdAt: -1 }).lean()

    return { success: true, entries }
})