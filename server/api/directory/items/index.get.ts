import { defineEventHandler, getQuery } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { requireTenantId } from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    try {
        const q = getQuery(event)
        const enterpriseId = requireTenantId(event)
        await resolveActor(event, enterpriseId, 'data')

        const { DirectoryItem } = tenantModels(enterpriseId)

        const filter: Record<string, any> = { enterpriseId }
        const search = typeof q.search === 'string' ? q.search.trim().slice(0, 100) : ''
        if (search) {
            const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
            filter.$or = [{ title: rx }, { code: rx }, { description: rx }, { 'attributes.inn': rx }, { 'attributes.phone': rx }]
        }

        if (typeof q.directorySlug === 'string' && q.directorySlug) {
            filter.directorySlug = q.directorySlug.trim()
        }

        return await DirectoryItem.find(filter).sort({ createdAt: -1 }).lean()
    } catch (e) {
        throw toHttpError(e)
    }
})
