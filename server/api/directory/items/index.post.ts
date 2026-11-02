import {createError, defineEventHandler, readBody} from 'h3'
import {resolveActor, toHttpError} from '~~/server/utils/moloDb/access'
import {tenantModels} from '~~/server/utils/tenantDb'
import {requireTenantId} from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    try {
        const body = (await readBody(event)) || {}
        const enterpriseId = requireTenantId(event)
        const directorySlug = String(body.directorySlug || '').trim().toLowerCase()
        const title = String(body.title || '').trim()
        if (!/^[a-z][a-z0-9_]{0,48}$/.test(directorySlug) || !title) throw createError({
            statusCode: 400,
            message: 'Укажите корректный справочник и наименование элемента'
        })
        await resolveActor(event, enterpriseId, 'data')
        const {DirectoryItem} = tenantModels(enterpriseId)
        const code = String(body.code || '').trim()
        if (code && await DirectoryItem.exists({enterpriseId, directorySlug, code})) throw createError({
            statusCode: 409,
            message: `Код «${code}» уже используется в этом справочнике`
        })
        const attributes = body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes) ? body.attributes : {}
        return await DirectoryItem.create({
            enterpriseId, directorySlug, title, code, description: String(body.description || '').trim(), attributes
        })
    } catch (error) {
        throw toHttpError(error)
    }
})
