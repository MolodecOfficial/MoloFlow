import { defineEventHandler, setResponseStatus } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId, parseName, resolveFolderId, serializeFolder, readJsonBody } from '~~/server/utils/workspace'

// POST /api/workspace/folders?enterpriseId=   body: { name, parentId? }
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const body = await readJsonBody(event)
    const { WorkspaceFolder } = tenantModels(enterpriseId)

    const name = parseName(body.name)
    const parentId = await resolveFolderId(enterpriseId, body.parentId)

    const now = new Date()
    const folder = await WorkspaceFolder.create({ enterpriseId, name, parentId, createdAt: now, updatedAt: now })

    setResponseStatus(event, 201)
    return serializeFolder(folder)
})
