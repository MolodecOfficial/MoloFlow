import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { Types } from 'mongoose'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { isOid } from '~~/server/utils/modules'
import { requireTenantId } from '~~/server/utils/tenantContext'

const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/

export default defineEventHandler(async (event) => {
    try {
        const id = getRouterParam(event, 'id')
        if (!isOid(id)) {
            throw createError({ statusCode: 400, message: 'Некорректный ID записи' })
        }

        const enterpriseId = requireTenantId(event)
        await resolveActor(event, enterpriseId, 'data')

        const { DirectoryItem } = tenantModels(enterpriseId)
        const doc = await DirectoryItem.findOne({ _id: new Types.ObjectId(id), enterpriseId })
        if (!doc) {
            throw createError({ statusCode: 404, message: 'Запись не найдена' })
        }

        if (doc.attributes?.system && event.node.req.method === 'DELETE') {
            throw createError({ statusCode: 403, message: 'Системная запись не может быть удалена' })
        }

        if (event.node.req.method === 'PATCH') {
            const body = (await readBody(event).catch(() => ({}))) || {}
            const $set: Record<string, any> = {}
            for (const k of ['title', 'code', 'description'] as const) {
                if (Object.prototype.hasOwnProperty.call(body, k)) {
                    $set[k] = String(body[k] ?? '').trim()
                }
            }
            if (!doc.attributes?.system && body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes)) {
                for (const [k, v] of Object.entries(body.attributes)) {
                    if (SAFE_KEY.test(k)) $set[`attributes.${k}`] = v
                }
            }
            if (Object.keys($set).length) {
                await DirectoryItem.updateOne({ _id: new Types.ObjectId(id) }, { $set })
            }
            return await DirectoryItem.findById(id).lean()
        }

        if (event.node.req.method === 'DELETE') {
            await DirectoryItem.deleteOne({ _id: new Types.ObjectId(id) })
            return { success: true, id }
        }

        throw createError({ statusCode: 405, message: 'Метод не поддерживается' })
    } catch (e) {
        throw toHttpError(e)
    }
})
