import { versionModel, ensureDocumentCollection, dropDocumentCollection } from '~~/server/utils/workspaceCollections'
import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor } from '~~/server/utils/moloDb/access'
import {
    assertContentSize, contentSize, encodeData, extractSearchText, getEnterpriseId,
    httpError, parseDate, parseName, parseType, serializeDocument, readJsonBody
} from '~~/server/utils/workspace'

// POST /api/workspace/documents/import?enterpriseId=
//   body: { items: [{ name, type, data, createdAt?, updatedAt? }] }
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    await resolveActor(event, enterpriseId, 'data')
    const body = await readJsonBody(event)
    const { WorkspaceDocument } = tenantModels(enterpriseId)

    const items: any[] = Array.isArray(body.items) ? body.items : []
    if (!items.length) throw httpError(400, 'Нет документов для импорта')
    if (items.length > 500) throw httpError(400, 'Слишком много документов за один раз (максимум 500)')

    const prepared = items.map((item) => {
        const type = parseType(item?.type)
        const name = parseName(item?.name)
        const content = encodeData(type, item?.data)
        assertContentSize(content)
        return {
            enterpriseId,
            folderId: null,
            name,
            nameLower: name.toLowerCase(),
            type,
            content,
            searchText: extractSearchText(type, content),
            size: contentSize(content),
            createdAt: parseDate(item?.createdAt),
            updatedAt: parseDate(item?.updatedAt)
        }
    })

    const created = await WorkspaceDocument.insertMany(prepared)
    try {
        for (const d of created) await ensureDocumentCollection(enterpriseId, String((d as any)._id))
    } catch (e: any) {
        await WorkspaceDocument.deleteMany({ _id: { $in: created.map((d: any) => d._id) } })
        throw createError({ statusCode: 500, message: `Импорт отменён: ${e?.message || 'ошибка базы'}` })
    }
    setResponseStatus(event, 201)
    return created.map(serializeDocument)
})
