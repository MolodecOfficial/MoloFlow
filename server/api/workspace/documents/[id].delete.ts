import { versionModel, ensureDocumentCollection, dropDocumentCollection } from '~~/server/utils/workspaceCollections'
import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId, getRouteId, httpError } from '~~/server/utils/workspace'

// DELETE /api/workspace/documents/:id?enterpriseId=  (вместе со всеми версиями)
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const { WorkspaceDocument, WorkspaceDocumentVersion } = tenantModels(enterpriseId)

    const result = await WorkspaceDocument.deleteOne({ _id: id })
    if (!result.deletedCount) throw httpError(404, 'Документ не найден')

    await dropDocumentCollection(enterpriseId, id)
    return { ok: true }
})
