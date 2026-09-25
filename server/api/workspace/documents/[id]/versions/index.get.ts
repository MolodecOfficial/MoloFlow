import { defineEventHandler } from 'h3'
import { WorkspaceDocument } from '../../../../../models/workspaceDocument.model'
import { WorkspaceDocumentVersion } from '../../../../../models/workspaceDocumentVersion.model'
import { getEnterpriseId, getRouteId, httpError, serializeVersion } from '../../../../../utils/workspace'

// GET /api/workspace/documents/:id/versions?enterpriseId=  → список версий (без содержимого), новые сверху
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)

    if (!(await WorkspaceDocument.exists({ _id: id, enterpriseId }))) throw httpError(404, 'Документ не найден')

    const versions = await WorkspaceDocumentVersion.find({ documentId: id, enterpriseId })
        .select('-content')
        .sort({ createdAt: -1 })
        .lean()
    return versions.map(serializeVersion)
})
