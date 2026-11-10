import { defineEventHandler, getQuery } from 'h3'
import { ModuleCatalog } from '~~/server/models/moduleCatalog.model'
import { refreshModuleCatalog } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const search = String(query.search || '').trim().slice(0, 100)
    const format = String(query.format || '').trim()
    const sortBy = String(query.sortBy || 'downloads')
    const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(query.limit || '12'), 10) || 12))

    // Восстанавливает индекс старых модулей и синхронизирует публикации.
    await refreshModuleCatalog()

    const filter: Record<string, any> = { isPublic: true, isActive: { $ne: false } }
    if (['vue', 'js', 'ts'].includes(format)) filter.format = format
    if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escaped, 'i')
        filter.$or = [{ name: regex }, { description: regex }, { tags: regex }, { fileName: regex }]
    }

    let sort: Record<string, 1 | -1> = { 'stats.downloads': -1, createdAt: -1 }
    if (sortBy === 'rating') sort = { 'stats.ratings.average': -1, createdAt: -1 }
    else if (sortBy === 'createdAt') sort = { createdAt: -1 }

    const [total, rows] = await Promise.all([
        ModuleCatalog.countDocuments(filter),
        ModuleCatalog.find(filter)
            .select('enterpriseId name fileName description format previewImage tags stats isOfficial version createdAt updatedAt')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
    ])

    const modules = rows.map((module: any) => ({
        ...module,
        _id: String(module._id),
        stats: module.stats || { downloads: 0, ratings: { average: 0, count: 0 } },
        tags: module.tags || []
    }))

    return { modules, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
})
