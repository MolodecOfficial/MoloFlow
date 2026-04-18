import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const { search, format, tag, sortBy = 'downloads', order = 'desc', page = 1, limit = 20 } = query

    const filter: any = { isPublic: true, isActive: true }
    if (search && typeof search === 'string') filter.$text = { $search: search }
    if (format && ['js', 'ts', 'vue'].includes(format as string)) filter.format = format
    if (tag && typeof tag === 'string') filter.tags = tag

    let sortField: string
    switch (sortBy) {
        case 'downloads': sortField = 'stats.downloads'; break
        case 'rating': sortField = 'stats.ratings.average'; break
        case 'createdAt': sortField = 'createdAt'; break
        default: sortField = 'stats.downloads'
    }
    const sortDirection = order === 'asc' ? 1 : -1
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(100, parseInt(limit as string))
    const skip = (pageNum - 1) * limitNum

    const [modules, total] = await Promise.all([
        DynamicModule.find(filter).sort({ [sortField]: sortDirection }).skip(skip).limit(limitNum).lean(),
        DynamicModule.countDocuments(filter)
    ])

    return { modules, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } }
})