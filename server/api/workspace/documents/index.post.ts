import { defineEventHandler, setResponseStatus } from 'h3'
import { WorkspaceDocument } from '../../../models/workspaceDocument.model'
import {
    assertContentSize, contentSize, encodeData, extractSearchText, getEnterpriseId,
    parseName, parseType, resolveFolderId, serializeDocument, readJsonBody } from '../../../utils/workspace'

// POST /api/workspace/documents?enterpriseId=   body: { type, name?, folderId?, data? }
export default defineEventHandler(async (event) => {
    const enterpriseId = getEnterpriseId(event)
    const body = await readJsonBody(event)

    const type = parseType(body.type)
    const name = body.name ? parseName(body.name) : (type === 'excel' ? 'Новая таблица' : 'Новый документ')
    const folderId = await resolveFolderId(enterpriseId, body.folderId)
    const content = encodeData(type, body.data)
    assertContentSize(content)

    const now = new Date()
    const doc = await WorkspaceDocument.create({
        enterpriseId,
        folderId,
        name,
        nameLower: name.toLowerCase(),
        type,
        content,
        searchText: extractSearchText(type, content),
        size: contentSize(content),
        createdAt: now,
        updatedAt: now,
    })

    setResponseStatus(event, 201)
    return serializeDocument(doc)
})
