import { defineEventHandler, getQuery } from 'h3'
import { WorkspaceDocument } from '../../../models/workspaceDocument.model'
import { escapeRegex, getEnterpriseId, serializeDocument } from '../../../utils/workspace'

// GET /api/workspace/documents?enterpriseId=[&q=текст]
// Список БЕЗ содержимого (только метаданные). Содержимое — отдельным запросом GET /documents/:id.
// q — поиск по названию и по содержимому (Word: текст, Excel: значения ячеек и названия листов).
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const rawQ = getQuery(event).q
    const q = typeof rawQ === 'string' ? rawQ.trim().toLowerCase().slice(0, 200) : ''

    const filter: Record<string, any> = { enterpriseId }
    if (q) {
        const re = escapeRegex(q)
        filter.$or = [{ nameLower: { $regex: re } }, { searchText: { $regex: re } }]
    }

    const docs = await WorkspaceDocument.find(filter).select('-content').sort({ updatedAt: -1 }).lean()
    return docs.map(serializeDocument)
})
