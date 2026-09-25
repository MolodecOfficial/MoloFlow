import { defineEventHandler, setResponseStatus } from 'h3'
import { WorkspaceDocument } from '../../../../../models/workspaceDocument.model'
import { createSnapshot, getEnterpriseId, getRouteId, httpError, serializeVersion, readJsonBody } from '../../../../../utils/workspace'

// POST /api/workspace/documents/:id/versions?enterpriseId=   body: { comment? }
// Ручной снимок текущего состояния документа
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)
    const body = await readJsonBody(event)

    const doc = await WorkspaceDocument.findOne({ _id: id, enterpriseId }).select('_id enterpriseId content').lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    const comment = typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : 'Ручное сохранение'
    const version = await createSnapshot({ _id: doc._id, enterpriseId, content: doc.content }, comment)

    setResponseStatus(event, 201)
    return serializeVersion(version)
})
