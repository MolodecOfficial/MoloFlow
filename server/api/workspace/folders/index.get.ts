import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenant/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId, serializeFolder } from '~~/server/utils/workspace/workspace'

// GET /api/workspace/folders?enterpriseId=
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const { WorkspaceFolder } = tenantModels(enterpriseId)

    const folders = await WorkspaceFolder.find().sort({ createdAt: 1 }).lean()
    return folders.map(serializeFolder)
})
