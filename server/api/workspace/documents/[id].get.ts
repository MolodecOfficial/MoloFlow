import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { decodeData, getEnterpriseId, getRouteId, httpError, serializeDocument } from '~~/server/utils/workspace'

// GET /api/workspace/documents/:id?enterpriseId=  → метаданные + data
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const { WorkspaceDocument } = tenantModels(enterpriseId)

    const doc: any = await WorkspaceDocument.findOne({ _id: id }).lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    return { ...serializeDocument(doc), data: decodeData(doc.type, doc.content) }
})
