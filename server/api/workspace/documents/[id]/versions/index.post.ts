import { defineEventHandler, setResponseStatus } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { createSnapshot, getEnterpriseId, getRouteId, httpError, serializeVersion, readJsonBody } from '~~/server/utils/workspace'

// POST /api/workspace/documents/:id/versions?enterpriseId=   body: { comment? }
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const body = await readJsonBody(event)
    const { WorkspaceDocument } = tenantModels(enterpriseId)

    const doc: any = await WorkspaceDocument.findOne({ _id: id }).select('_id content').lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    const comment = typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : 'Ручное сохранение'
    const version = await createSnapshot({ _id: doc._id, enterpriseId, content: doc.content }, comment)

    setResponseStatus(event, 201)
    return serializeVersion(version)
})
