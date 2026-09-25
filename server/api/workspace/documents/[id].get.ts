import { defineEventHandler } from 'h3'
import { WorkspaceDocument } from '../../../models/workspaceDocument.model'
import { decodeData, getEnterpriseId, getRouteId, httpError, serializeDocument } from '../../../utils/workspace'

// GET /api/workspace/documents/:id?enterpriseId=  → метаданные + data
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)

    const doc = await WorkspaceDocument.findOne({ _id: id, enterpriseId }).lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    return { ...serializeDocument(doc), data: decodeData(doc.type, doc.content) }
})
