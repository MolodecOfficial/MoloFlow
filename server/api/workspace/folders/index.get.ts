import { defineEventHandler } from 'h3'
import { WorkspaceFolder } from '../../../models/workspaceFolder.model'
import { getEnterpriseId, serializeFolder } from '../../../utils/workspace'

// GET /api/workspace/folders?enterpriseId=
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const folders = await WorkspaceFolder.find({ enterpriseId }).sort({ createdAt: 1 }).lean()
    return folders.map(serializeFolder)
})
