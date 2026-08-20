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
        // Раньше здесь был $or из трёх $regex по name/description/tags — регэксп без
        // якоря не может использовать индекс, и это гоняло полный скан коллекции на
        // каждый поисковый запрос (усугублённый тем, что текстовый индекс из-за бага
        // в модели вообще не строился). Теперь текстовый индекс рабочий (см. модель),
        // и $text использует его напрямую — быстрее на порядки на большой коллекции.
        filter.$text = { $search: search }
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

    // При текстовом поиске имеет смысл сортировать в первую очередь по релевантности,
    // а уже потом — по выбранному пользователем критерию как вторичному ключу
    const projection: any = search
        ? { score: { $meta: 'textScore' } }
        : undefined

    let cursor = search
        ? DynamicModule.find(filter, projection).sort({ score: { $meta: 'textScore' }, ...sort })
        : DynamicModule.find(filter).sort(sort)

    // Подсчёт общего количества
    const total = await DynamicModule.countDocuments(filter)

    // Получение модулей с ограниченными полями (без кода для списка)
    const modules = await cursor
        .select('name description version format previewImage tags stats isOfficial createdAt files')
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
            size: file.size,
            version: file.version
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