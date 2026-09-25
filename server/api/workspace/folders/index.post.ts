import { defineEventHandler, setResponseStatus } from 'h3'
import { WorkspaceFolder } from '../../../models/workspaceFolder.model'
import { getEnterpriseId, parseName, resolveFolderId, serializeFolder, readJsonBody } from '../../../utils/workspace'

// POST /api/workspace/folders?enterpriseId=   body: { name, parentId? }
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const body = await readJsonBody(event)

    const name = parseName(body.name)
    const parentId = await resolveFolderId(enterpriseId, body.parentId)

    const now = new Date()
    const folder = await WorkspaceFolder.create({ enterpriseId, name, parentId, createdAt: now, updatedAt: now })

    setResponseStatus(event, 201)
    return serializeFolder(folder)
})
