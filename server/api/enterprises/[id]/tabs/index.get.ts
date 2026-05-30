import { Tab } from '~~/server/models/tab.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')

    if (!enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Не указан ID предприятия'
        })
    }

    const tabs = await Tab.find({
        enterpriseId,
        isActive: true
    })
        .select('-__v')
        .sort({ createdAt: -1 })
        .lean()

    return {
        success: true,
        tabs
    }
})