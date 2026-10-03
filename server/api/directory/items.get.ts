import { defineEventHandler, getQuery, createError } from 'h3'
import { DirectoryItem } from '~~/server/models/directoryItem.model'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const enterpriseId = query.enterpriseId as string
    const directorySlug = query.directorySlug as string | undefined
    const search = typeof query.search === 'string' ? query.search.trim() : undefined

    if (!enterpriseId) {
        throw createError({ statusCode: 400, message: 'Параметр enterpriseId обязателен' })
    }

    const filter: Record<string, any> = { enterpriseId }
    if (directorySlug) {
        filter.directorySlug = directorySlug
    }

    if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escaped, 'i')

        filter.$or = [
            { title: { $regex: regex } },
            { code: { $regex: regex } },
            { description: { $regex: regex } },
            { 'attributes.inn': { $regex: regex } },
            { 'attributes.phone': { $regex: regex } },
            { 'attributes.accountNumber': { $regex: regex } },
            { 'attributes.bik': { $regex: regex } }
        ]
    }

    const items = await DirectoryItem.find(filter).sort({ createdAt: -1 }).lean()
    return items || []
})