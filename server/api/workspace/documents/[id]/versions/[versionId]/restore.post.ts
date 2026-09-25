import { defineEventHandler } from 'h3'
import { WorkspaceDocument } from '../../../../../../models/workspaceDocument.model'
import { WorkspaceDocumentVersion } from '../../../../../../models/workspaceDocumentVersion.model'
import {
    contentSize, createSnapshot, decodeData, extractSearchText, getEnterpriseId, getRouteId,
    httpError, serializeDocument,
} from '../../../../../../utils/workspace'

// POST /api/workspace/documents/:id/versions/:versionId/restore?enterpriseId=
// Перед восстановлением текущее состояние само сохраняется как версия «Перед восстановлением».
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)
    const versionId = getRouteId(event, 'versionId')

    const doc = await WorkspaceDocument.findOne({ _id: id, enterpriseId }).lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    const version = await WorkspaceDocumentVersion.findOne({ _id: versionId, documentId: id, enterpriseId }).lean()
    if (!version) throw httpError(404, 'Версия не найдена')

    if (doc.content !== version.content) {
        await createSnapshot({ _id: doc._id, enterpriseId, content: doc.content }, 'Перед восстановлением')
    }

    await WorkspaceDocument.updateOne({ _id: id, enterpriseId }, {
        $set: {
            content: version.content,
            searchText: extractSearchText(doc.type, version.content),
            size: contentSize(version.content),
            updatedAt: new Date(),
        },
    })

    const fresh = await WorkspaceDocument.findOne({ _id: id, enterpriseId }).select('-content').lean()
    if (!fresh) throw httpError(404, 'Документ не найден')
    return { ...serializeDocument(fresh), data: decodeData(doc.type, version.content) }
})
