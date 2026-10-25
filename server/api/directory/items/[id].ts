import { defineEventHandler, getRouterParam, getQuery, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { allDirectoryModels } from '~~/server/utils/directoryCollections'
import { isOid } from '~~/server/utils/modules'

// PATCH / DELETE /api/directory/items/:id?enterpriseId=
// Системные записи (сотрудники, своя организация) ведутся автоматически: их нельзя удалить,
// менять можно только название, код и описание.
const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/

async function findItem(enterpriseId: string, id: string) {
    for (const model of await allDirectoryModels(enterpriseId)) {
        const doc = await model.findOne({ _id: id })
        if (doc) return { model, doc: doc.toObject() as any }
    }
    return null
}

export default defineEventHandler(async (event) => {
    try {
        const id = getRouterParam(event, 'id')
        const enterpriseId = String(getQuery(event).enterpriseId || '')
        if (!isOid(id)) throw createError({ statusCode: 400, message: 'Некорректный ID записи' })
        await resolveActor(event, enterpriseId, 'data')

        const found = await findItem(enterpriseId, id)
        if (!found) throw createError({ statusCode: 404, message: 'Запись не найдена' })
        const { model, doc } = found
        const isSystem = !!doc.attributes?.system

        if (event.node.req.method === 'PATCH') {
            const b: Record<string, any> = (await readBody(event)) || {}
            const $set: Record<string, any> = {}
            for (const k of ['title', 'code', 'description'] as const) {
                if (k in b) $set[k] = String(b[k] ?? '').trim()
            }
            if (!isSystem && b.attributes && typeof b.attributes === 'object') {
                for (const [k, v] of Object.entries(b.attributes)) {
                    if (SAFE_KEY.test(k)) $set[`attributes.${k}`] = v
                }
            }
            if (Object.keys($set).length) await model.updateOne({ _id: id }, { $set })
            return await model.findOne({ _id: id }).lean()
        }

        if (event.node.req.method === 'DELETE') {
            if (isSystem) throw createError({ statusCode: 403, message: 'Системная запись ведётся автоматически' })
            await model.deleteOne({ _id: id })
            return { success: true }
        }

        throw createError({ statusCode: 405, message: 'Метод не поддерживается' })
    } catch (e) {
        throw toHttpError(e)
    }
})
