import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId, getRouteId, httpError } from '~~/server/utils/workspace'

export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const { WorkspaceDocument, WorkspaceDocumentVersion } = tenantModels(enterpriseId)

    const result = await WorkspaceDocument.deleteOne({ _id: id })
    if (!result.deletedCount) throw httpError(404, 'Документ не найден')

    await WorkspaceDocumentVersion.deleteMany({ documentId: id })
    return { ok: true }
})
