import { defineEventHandler } from 'h3'
import { WorkspaceDocument } from '../../../models/workspaceDocument.model'
import {
    assertContentSize, contentSize, encodeData, extractSearchText, getEnterpriseId, getRouteId,
    httpError, maybeAutoSnapshot, parseName, resolveFolderId, serializeDocument, readJsonBody } from '../../../utils/workspace'

// PATCH /api/workspace/documents/:id?enterpriseId=   body: { name?, folderId?, data? }
// Любое подмножество полей. Ответ — только метаданные (data назад не отправляем).
// Если data не изменилась — ничего не пишется и версия не создаётся.
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const id = getRouteId(event)
    const body = await readJsonBody(event)

    const hasName = 'name' in body
    const hasFolder = 'folderId' in body
    const hasData = 'data' in body
    if (!hasName && !hasFolder && !hasData) throw httpError(400, 'Нечего обновлять')

    const query = WorkspaceDocument.findOne({ _id: id, enterpriseId })
    if (!hasData) query.select('-content')
    const doc = await query.lean()
    if (!doc) throw httpError(404, 'Документ не найден')

    const set: Record<string, any> = {}

    if (hasName) {
        const name = parseName(body.name)
        if (name !== doc.name) {
            set.name = name
            set.nameLower = name.toLowerCase()
        }
    }

    if (hasFolder) {
        const folderId = await resolveFolderId(enterpriseId, body.folderId)
        if (String(doc.folderId ?? '') !== String(folderId ?? '')) set.folderId = folderId
    }

    if (hasData) {
        const content = encodeData(doc.type, body.data)
        assertContentSize(content)
        if (content !== doc.content) {
            await maybeAutoSnapshot({ _id: doc._id, enterpriseId, content: doc.content })
            set.content = content
            set.searchText = extractSearchText(doc.type, content)
            set.size = contentSize(content)
        }
    }

    if (Object.keys(set).length) {
        set.updatedAt = new Date()
        await WorkspaceDocument.updateOne({ _id: id, enterpriseId }, { $set: set })
    }

    const fresh = await WorkspaceDocument.findOne({ _id: id, enterpriseId }).select('-content').lean()
    if (!fresh) throw httpError(404, 'Документ не найден')
    return serializeDocument(fresh)
})
