import { defineEventHandler } from 'h3'
import { WorkspaceDocument } from '../../../models/workspaceDocument.model'
import { WorkspaceDocumentVersion } from '../../../models/workspaceDocumentVersion.model'
import { getEnterpriseId, getRouteId, httpError } from '../../../utils/workspace'

// DELETE /api/workspace/documents/:id?enterpriseId=  (вместе со всеми версиями)
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)

    const result = await WorkspaceDocument.deleteOne({ _id: id, enterpriseId })
    if (!result.deletedCount) throw httpError(404, 'Документ не найден')

    await WorkspaceDocumentVersion.deleteMany({ documentId: id, enterpriseId })
    return { ok: true }
})
