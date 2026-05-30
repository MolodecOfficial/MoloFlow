import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const search = query.search as string || ''
    const format = query.format as string || ''
    const sortBy = query.sortBy as string || 'downloads'
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 12

    // Построение фильтра
    const filter: any = {
        isPublic: true,
        isActive: true
    }

    if (format) {
        filter.format = format
    }

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
        ]
    }

    // Построение сортировки
    let sort: any = {}
    switch (sortBy) {
        case 'downloads':
            sort = { 'stats.downloads': -1 }
            break
        case 'rating':
            sort = { 'stats.ratings.average': -1 }
            break
        case 'createdAt':
            sort = { createdAt: -1 }
            break
        default:
            sort = { 'stats.downloads': -1 }
    }

    // Подсчёт общего количества
    const total = await DynamicModule.countDocuments(filter)

    // Получение модулей с ограниченными полями (без кода для списка)
    const modules = await DynamicModule.find(filter)
        .select('name description format previewImage tags stats isOfficial createdAt files')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()

    // Для каждого модуля возвращаем только метаданные файлов (без кода)
    const modulesWithFileInfo = modules.map(module => ({
        ...module,
        files: (module.files || []).map((file: any) => ({
            name: file.name,
            path: file.path,
            format: file.format,
            isServerFile: file.isServerFile,
            size: file.size
            // НЕ возвращаем code для экономии трафика
        }))
    }))

    return {
        modules: modulesWithFileInfo,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    }
})