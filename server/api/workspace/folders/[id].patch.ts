import { defineEventHandler } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import {
    getEnterpriseId, getRouteId, httpError, parseName, resolveFolderId, serializeFolder, readJsonBody
} from '~~/server/utils/workspace'

// PATCH /api/workspace/folders/:id?enterpriseId=   body: { name?, parentId? }
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const body = await readJsonBody(event)
    const { WorkspaceFolder } = tenantModels(enterpriseId)

    const folder: any = await WorkspaceFolder.findOne({ _id: id })
    if (!folder) throw httpError(404, 'Папка не найдена')

    if ('name' in body) folder.name = parseName(body.name)

    if ('parentId' in body) {
        const parentId = await resolveFolderId(enterpriseId, body.parentId)
        if (parentId) {
            if (parentId === id) throw httpError(400, 'Нельзя переместить папку саму в себя')
            // Дерево предприятия грузим одним запросом и идём вверх по памяти: без лимита глубины и без N+1
            const all: any[] = await WorkspaceFolder.find().select('_id parentId').lean()
            const parentOf = new Map(all.map((f) => [String(f._id), f.parentId ? String(f.parentId) : null]))
            const seen = new Set<string>()
            let cursor: string | null = parentId
            while (cursor) {
                if (cursor === id) throw httpError(400, 'Нельзя переместить папку внутрь её собственной подпапки')
                if (seen.has(cursor)) break // защита от уже испорченных данных
                seen.add(cursor)
                cursor = parentOf.get(cursor) ?? null
            }
        }
        folder.set('parentId', parentId)
    }

    folder.updatedAt = new Date()
    await folder.save()
    return serializeFolder(folder)
})
