import { Tab } from '~~/server/models/tab.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id')
    const tabId = getRouterParam(event, 'tabId')

    const tab = await Tab.findOne({
        _id: tabId,
        enterpriseId,
        isActive: true
    })
        .select('-__v')
        .lean()

    if (!tab) {
        throw createError({
            statusCode: 404,
            message: 'Вкладка не найдена'
        })
    }

    return {
        success: true,
        tab
    }
})