import { versionModel } from '~~/server/utils/workspaceCollections'
import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { decodeData, getEnterpriseId, getRouteId, httpError, serializeVersion } from '~~/server/utils/workspace'

// GET /api/workspace/documents/:id/versions/:versionId?enterpriseId=  → версия вместе с data
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const versionId = getRouteId(event, 'versionId')
    const { WorkspaceDocument } = tenantModels(enterpriseId)
    const WorkspaceDocumentVersion = versionModel(enterpriseId, id)

    const doc: any = await WorkspaceDocument.findOne({ _id: id }).select('type').lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    const version: any = await WorkspaceDocumentVersion.findOne({ _id: versionId, documentId: id }).lean()
    if (!version) throw httpError(404, 'Версия не найдена')

    return { ...serializeVersion(version), data: decodeData(doc.type, version.content) }
})
