import { defineEventHandler, getQuery } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId, getRouteId, httpError } from '~~/server/utils/workspace'

// DELETE /api/workspace/folders/:id?enterpriseId=[&cascade=true]
// По умолчанию файлы не удаляются: подпапки и документы переезжают в родителя.
// cascade=true — удаляет папку, все вложенные папки и документы в них (безвозвратно).
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const id = getRouteId(event)
    const cascade = getQuery(event).cascade === 'true'
    const { WorkspaceFolder, WorkspaceDocument, WorkspaceDocumentVersion } = tenantModels(enterpriseId)

    const folder: any = await WorkspaceFolder.findOne({ _id: id }).lean()
    if (!folder) throw httpError(404, 'Папка не найдена')

    if (!cascade) {
        const parentId = folder.parentId ?? null
        await WorkspaceFolder.updateMany({ parentId: id }, { $set: { parentId, updatedAt: new Date() } })
        await WorkspaceDocument.updateMany({ folderId: id }, { $set: { folderId: parentId } })
        await WorkspaceFolder.deleteOne({ _id: id })
        return { ok: true, movedTo: parentId ? String(parentId) : null }
    }

    // Поддерево собираем в памяти (папок у предприятия немного)
    const all: any[] = await WorkspaceFolder.find().select('_id parentId').lean()
    const children = new Map<string, string[]>()
    for (const f of all) {
        const key = f.parentId ? String(f.parentId) : ''
        children.set(key, [...(children.get(key) ?? []), String(f._id)])
    }
    const folderIds: string[] = [id]
    for (let i = 0; i < folderIds.length; i++) folderIds.push(...(children.get(folderIds[i]!) ?? []))

    const docs: any[] = await WorkspaceDocument.find({ folderId: { $in: folderIds } }).select('_id').lean()
    const documentIds = docs.map((d) => d._id)

    // Порядок: версии → документы → папки. Сбой посередине даёт сироты в версиях, а не потерю папок.
    await WorkspaceDocumentVersion.deleteMany({ documentId: { $in: documentIds } })
    await WorkspaceDocument.deleteMany({ _id: { $in: documentIds } })
    await WorkspaceFolder.deleteMany({ _id: { $in: folderIds } })

    return { ok: true, deletedFolderIds: folderIds, deletedDocumentIds: documentIds.map(String) }
})
