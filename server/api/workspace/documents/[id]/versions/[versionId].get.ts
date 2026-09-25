import { defineEventHandler } from 'h3'
import { WorkspaceDocument } from '../../../../../models/workspaceDocument.model'
import { WorkspaceDocumentVersion } from '../../../../../models/workspaceDocumentVersion.model'
import { decodeData, getEnterpriseId, getRouteId, httpError, serializeVersion } from '../../../../../utils/workspace'

// GET /api/workspace/documents/:id/versions/:versionId?enterpriseId=  → версия вместе с data (для предпросмотра)
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)
    const versionId = getRouteId(event, 'versionId')

    const doc = await WorkspaceDocument.findOne({ _id: id, enterpriseId }).select('type').lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    const version = await WorkspaceDocumentVersion.findOne({ _id: versionId, documentId: id, enterpriseId }).lean()
    if (!version) throw httpError(404, 'Версия не найдена')

    return { ...serializeVersion(version), data: decodeData(doc.type, version.content) }
})
