import { versionModel } from '~~/server/utils/workspaceCollections'
import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import {
    contentSize, createSnapshot, decodeData, extractSearchText, getEnterpriseId, getRouteId,
    httpError, serializeDocument
} from '~~/server/utils/workspace'

// POST /api/workspace/documents/:id/versions/:versionId/restore?enterpriseId=
// Перед восстановлением текущее состояние сохраняется как версия «Перед восстановлением».
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const versionId = getRouteId(event, 'versionId')
    const { WorkspaceDocument } = tenantModels(enterpriseId)
    const WorkspaceDocumentVersion = versionModel(enterpriseId, id)

    const doc: any = await WorkspaceDocument.findOne({ _id: id }).lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    const version: any = await WorkspaceDocumentVersion.findOne({ _id: versionId, documentId: id }).lean()
    if (!version) throw httpError(404, 'Версия не найдена')

    if (doc.content !== version.content) {
        await createSnapshot({ _id: doc._id, enterpriseId, content: doc.content }, 'Перед восстановлением')
    }

    await WorkspaceDocument.updateOne({ _id: id }, {
        $set: {
            content: version.content,
            searchText: extractSearchText(doc.type, version.content),
            size: contentSize(version.content),
            updatedAt: new Date()
        }
    })

    const fresh: any = await WorkspaceDocument.findOne({ _id: id }).select('-content').lean()
    if (!fresh) throw httpError(404, 'Документ не найден')
    return { ...serializeDocument(fresh), data: decodeData(doc.type, version.content) }
})
