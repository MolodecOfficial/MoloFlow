import { defineEventHandler, setResponseStatus } from 'h3'
import { WorkspaceDocument } from '../../../models/workspaceDocument.model'
import {
    assertContentSize, contentSize, encodeData, extractSearchText, getEnterpriseId,
    httpError, parseDate, parseName, parseType, serializeDocument, readJsonBody } from '../../../utils/workspace'

// POST /api/workspace/documents/import?enterpriseId=
//   body: { items: [{ name, type, data, createdAt?, updatedAt? }] }
// Разовый перенос документов из localStorage. Возвращает метаданные в том же порядке, что и items.
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const body = await readJsonBody(event)

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
            updatedAt: parseDate(item?.updatedAt),
        }
    })

    const created = await WorkspaceDocument.insertMany(prepared)
    setResponseStatus(event, 201)
    return created.map(serializeDocument)
})
