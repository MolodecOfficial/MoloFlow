import { defineEventHandler, getQuery } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { escapeRegex, getEnterpriseId, serializeDocument } from '~~/server/utils/workspace'

// GET /api/workspace/documents?enterpriseId=[&q=текст]
// Список БЕЗ содержимого. Содержимое — GET /documents/:id.
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const { WorkspaceDocument } = tenantModels(enterpriseId)

    const rawQ = getQuery(event).q
    const q = typeof rawQ === 'string' ? rawQ.trim().toLowerCase().slice(0, 200) : ''

    const filter: Record<string, any> = {}
    if (q) {
        const re = escapeRegex(q)
        filter.$or = [{ nameLower: { $regex: re } }, { searchText: { $regex: re } }]
    }

    const docs = await WorkspaceDocument.find(filter).select('-content').sort({ updatedAt: -1 }).lean()
    return docs.map(serializeDocument)
})
