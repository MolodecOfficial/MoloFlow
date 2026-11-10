import { Plugin } from '~~/server/models/plugin.model'

// Отдельный лёгкий эндпоинт под горячий путь: DynamicModuleLoader вызывает
// его при каждой загрузке модуля, чтобы получить файлы всех активных
// и включённых плагинов, привязанных к этому модулю по fileName, и
// передать их в additionalFiles (там они просто примешиваются к files
// модуля перед компиляцией — см. DynamicModuleLoader.vue).
//
// Отдаём сразу плоский массив файлов (а не список плагинов с вложенными
// files), чтобы на клиенте не пришлось ничего разворачивать — это прямой
// вход в additionalFiles.
export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'enterpriseId')
    const fileName = getRouterParam(event, 'fileName')

    if (!enterpriseId || !fileName) {
        throw createError({ statusCode: 400, message: 'ID предприятия или fileName модуля не указан' })
    }

    const plugins = await Plugin.find({
        enterpriseId,
        targetFileName: fileName,
        isActive: true,
        isEnabled: true
    })
        .select('name fileName files')
        .lean()

    const files = plugins.flatMap((plugin: any) =>
        (plugin.files || []).map((file: any) => ({
            ...file,
            // Префиксуем путь именем плагина, чтобы файлы разных плагинов
            // (и файлы самого модуля) не конфликтовали друг с другом при
            // одинаковых относительных путях внутри additionalFiles.
            path: `plugins/${plugin.fileName}/${file.path}`,
            pluginId: plugin._id,
            pluginName: plugin.name
        }))
    )

    return { success: true, files, pluginsCount: plugins.length }
})