import { defineEventHandler, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { directoryModel, ensureDirectoryCollection } from '~~/server/utils/directoryCollections'


export default defineEventHandler(async (event) => {
    try {
        const b = (await readBody(event)) || {}
        const enterpriseId = String(b.enterpriseId || '')
        if (!enterpriseId || !String(b.directorySlug || '').trim() || !String(b.title || '').trim()) {
            throw createError({ statusCode: 400, message: 'enterpriseId, directorySlug и title обязательны' })
        }
        await resolveActor(event, enterpriseId, 'data')
        await ensureDirectoryCollection(enterpriseId, String(b.directorySlug))

        return await directoryModel(enterpriseId, String(b.directorySlug)).create({
            enterpriseId,
            directorySlug: String(b.directorySlug).trim(),
            title: String(b.title).trim(),
            code: String(b.code || ''),
            description: String(b.description || ''),
            attributes: b.attributes && typeof b.attributes === 'object' ? b.attributes : {}
        })
    } catch (e) {
        throw toHttpError(e)
    }
})
