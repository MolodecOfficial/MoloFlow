import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'ID не указан' })

    const module = await DynamicModule.findOne({
        _id: id,
        isPublic: true,
    })

    if (!module) {
        throw createError({ statusCode: 404, message: 'Модуль не найден' })
    }

    await module.incrementDownloads()

    return {
        success: true,
        downloads: module.stats.downloads
    }
})