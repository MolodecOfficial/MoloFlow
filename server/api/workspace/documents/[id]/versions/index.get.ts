import { versionModel } from '~~/server/utils/workspaceCollections'
import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId, getRouteId, httpError, serializeVersion } from '~~/server/utils/workspace'

// GET /api/workspace/documents/:id/versions?enterpriseId=  → список версий, новые сверху
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const { WorkspaceDocument } = tenantModels(enterpriseId)
    const WorkspaceDocumentVersion = versionModel(enterpriseId, id)

    if (!(await WorkspaceDocument.exists({ _id: id }))) throw httpError(404, 'Документ не найден')

    const versions: any[] = await WorkspaceDocumentVersion.find({ documentId: id })
        .select('-content')
        .sort({ createdAt: -1 })
        .lean()
    return versions.map(serializeVersion)
})
