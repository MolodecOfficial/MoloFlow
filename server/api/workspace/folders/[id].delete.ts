import { defineEventHandler, getQuery } from 'h3'
import { WorkspaceFolder } from '../../../models/workspaceFolder.model'
import { WorkspaceDocument } from '../../../models/workspaceDocument.model'
import { WorkspaceDocumentVersion } from '../../../models/workspaceDocumentVersion.model'
import { getEnterpriseId, getRouteId, httpError } from '../../../utils/workspace'

// DELETE /api/workspace/folders/:id?enterpriseId=[&cascade=true]
//
// по умолчанию НЕ удаляет файлы: подпапки и документы переезжают в родителя удаляемой папки
// cascade=true — удаляет папку, все вложенные папки и все документы в них (безвозвратно)
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)
    const cascade = getQuery(event).cascade === 'true'

    const folder = await WorkspaceFolder.findOne({ _id: id, enterpriseId }).lean()
    if (!folder) throw httpError(404, 'Папка не найдена')

    if (!cascade) {
        const parentId = folder.parentId ?? null
        await WorkspaceFolder.updateMany({ enterpriseId, parentId: id }, { $set: { parentId, updatedAt: new Date() } })
        await WorkspaceDocument.updateMany({ enterpriseId, folderId: id }, { $set: { folderId: parentId } })
        await WorkspaceFolder.deleteOne({ _id: id, enterpriseId })
        return { ok: true, movedTo: parentId ? String(parentId) : null }
    }

    // собираем всё поддерево в памяти (папок у предприятия немного)
    const all = await WorkspaceFolder.find({ enterpriseId }).select('_id parentId').lean()
    const children = new Map<string, string[]>()
    for (const f of all) {
        const key = f.parentId ? String(f.parentId) : ''
        children.set(key, [...(children.get(key) ?? []), String(f._id)])
    }
    const folderIds = [id]
    for (let i = 0; i < folderIds.length; i++) folderIds.push(...(children.get(folderIds[i]!) ?? []))

    const docs = await WorkspaceDocument.find({ enterpriseId, folderId: { $in: folderIds } }).select('_id').lean()
    const documentIds = docs.map(d => d._id)

    await WorkspaceDocumentVersion.deleteMany({ documentId: { $in: documentIds } })
    await WorkspaceDocument.deleteMany({ _id: { $in: documentIds } })
    await WorkspaceFolder.deleteMany({ _id: { $in: folderIds }, enterpriseId })

    return { ok: true, deletedFolderIds: folderIds, deletedDocumentIds: documentIds.map(String) }
})
