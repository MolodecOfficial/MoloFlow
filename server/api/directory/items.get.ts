import { defineEventHandler, getQuery, createError } from 'h3'
import { DirectoryItem } from '~~/server/models/directoryItem.model'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const enterpriseId = query.enterpriseId as string
    const directorySlug = query.directorySlug as string
    const search = query.search as string | undefined

    if (!enterpriseId) {
        throw createError({ statusCode: 400, message: 'enterpriseId обязателен' })
    }

    const filter: Record<string, any> = { enterpriseId }
    if (directorySlug) {
        filter.directorySlug = directorySlug
    }

    if (search && search.trim()) {
        const s = search.trim()
        filter.$or = [
            { title: { $regex: s, $options: 'i' } },
            { code: { $regex: s, $options: 'i' } },
            { description: { $regex: s, $options: 'i' } }
        ]
    }

    const items = await DirectoryItem.find(filter).sort({ createdAt: -1 }).lean()
    return items || []
})