import { Plugin } from '~~/server/models/plugin.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'enterpriseId')
    const pluginId = getRouterParam(event, 'pluginId')
    if (!enterpriseId || !pluginId) {
        throw createError({ statusCode: 400, message: 'ID предприятия или плагина не указан' })
    }

    const plugin = await Plugin.findOne({ _id: pluginId, enterpriseId, isActive: true })
    if (!plugin) {
        throw createError({ statusCode: 404, message: 'Плагин не найден' })
    }

    // Мягкое удаление — как и у Standard
    await Plugin.findOneAndUpdate(
        { _id: pluginId, enterpriseId },
        { $set: { isActive: false } }
    )

    return { success: true }
})