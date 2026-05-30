import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'ID не указан' })

    const module = await DynamicModule.findOne({
        _id: id,
        isPublic: true,
        isActive: true
    }).lean()

    if (!module) {
        throw createError({ statusCode: 404, message: 'Модуль не найден или недоступен' })
    }

    // Для детального просмотра возвращаем больше информации
    return {
        module: {
            ...module,
            // Для файлов возвращаем только метаданные, код запрашивается отдельно при необходимости
            files: (module.files || []).map((file: any) => ({
                name: file.name,
                path: file.path,
                format: file.format,
                isServerFile: file.isServerFile,
                size: file.size
            }))
        }
    }
})