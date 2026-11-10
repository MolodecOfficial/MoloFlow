import { Plugin } from '~~/server/models/plugin.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'enterpriseId')
    if (!enterpriseId) {
        throw createError({ statusCode: 400, message: 'ID предприятия не указан' })
    }

    const query = getQuery(event)
    const targetFileName = query.targetFileName as string || ''

    const filter: any = {
        enterpriseId,
        isActive: true
    }

    if (targetFileName) {
        filter.targetFileName = targetFileName
    }

    const plugins = await Plugin.find(filter)
        .sort({ createdAt: -1 })
        .lean()

    return { success: true, plugins, total: plugins.length }
})