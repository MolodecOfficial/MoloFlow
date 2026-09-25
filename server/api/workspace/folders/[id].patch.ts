import { defineEventHandler } from 'h3'
import { WorkspaceFolder } from '../../../models/workspaceFolder.model'
import {
    getEnterpriseId, getRouteId, httpError, parseName, resolveFolderId, serializeFolder, readJsonBody } from '../../../utils/workspace'

// PATCH /api/workspace/folders/:id?enterpriseId=   body: { name?, parentId? }
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)
    const body = await readJsonBody(event)

    const folder = await WorkspaceFolder.findOne({ _id: id, enterpriseId })
    if (!folder) throw httpError(404, 'Папка не найдена')

    if ('name' in body) folder.name = parseName(body.name)

    if ('parentId' in body) {
        const parentId = await resolveFolderId(enterpriseId, body.parentId)
        if (parentId) {
            if (parentId === id) throw httpError(400, 'Нельзя переместить папку саму в себя')
            // защита от цикла: поднимаемся вверх от нового родителя и не должны встретить эту папку
            let cursor: string | null = parentId
            for (let i = 0; cursor && i < 1000; i++) {
                if (cursor === id) throw httpError(400, 'Нельзя переместить папку внутрь её собственной подпапки')
                const up: { parentId?: unknown } | null = await WorkspaceFolder.findOne({ _id: cursor, enterpriseId })
                    .select('parentId')
                    .lean()
                cursor = up?.parentId ? String(up.parentId) : null
            }
        }
        folder.set('parentId', parentId)
    }

    folder.updatedAt = new Date()
    await folder.save()
    return serializeFolder(folder)
})
