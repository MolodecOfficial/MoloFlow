import { defineEventHandler, getRouterParam, getQuery, readBody, createError } from 'h3'
import { Types } from 'mongoose'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { allDirectoryModels } from '~~/server/utils/directoryCollections'
import { isOid } from '~~/server/utils/modules'

const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/

async function findItem(enterpriseId: string, id: string) {
    const oid = new Types.ObjectId(id)
    for (const model of await allDirectoryModels(enterpriseId)) {
        const doc = await model.findOne({ _id: oid })
        if (doc) return { model, doc: doc.toObject() as any }
    }
    return null
}

export default defineEventHandler(async (event) => {
    try {
        const id = getRouterParam(event, 'id')
        if (!isOid(id)) throw createError({ statusCode: 400, message: 'Некорректный ID записи: ожидается ObjectId из 24 hex-символов' })

        // Некоторые клиенты передают enterpriseId в query, другие — в JSON body.
        const query = getQuery(event)
        let body: Record<string, any> = {}
        if (event.node.req.method === 'PATCH' || event.node.req.method === 'DELETE') {
            try { body = (await readBody(event)) || {} } catch { body = {} }
        }
        const enterpriseId = String(query.enterpriseId || body.enterpriseId || '')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указан enterpriseId предприятия' })
        await resolveActor(event, enterpriseId, 'data')

        const found = await findItem(enterpriseId, id)
        if (!found) throw createError({ statusCode: 404, message: 'Запись не найдена в справочниках этого предприятия' })
        const { model, doc } = found
        if (doc.attributes?.system) {
            if (event.node.req.method === 'DELETE') {
                throw createError({ statusCode: 403, message: 'Системная запись ведётся автоматически и не может быть удалена' })
            }
        }

        if (event.node.req.method === 'PATCH') {
            const $set: Record<string, any> = {}
            for (const k of ['title', 'code', 'description'] as const) {
                if (Object.prototype.hasOwnProperty.call(body, k)) $set[k] = String(body[k] ?? '').trim()
            }
            if (!doc.attributes?.system && body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes)) {
                for (const [k, v] of Object.entries(body.attributes)) {
                    if (SAFE_KEY.test(k)) $set[`attributes.${k}`] = v
                }
            }
            if (Object.keys($set).length) await model.updateOne({ _id: new Types.ObjectId(id) }, { $set })
            return await model.findOne({ _id: new Types.ObjectId(id) }).lean()
        }

        if (event.node.req.method === 'DELETE') {
            await model.deleteOne({ _id: new Types.ObjectId(id) })
            return { success: true, id }
        }

        throw createError({ statusCode: 405, message: 'Метод не поддерживается' })
    } catch (e) {
        throw toHttpError(e)
    }
})
