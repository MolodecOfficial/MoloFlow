// server/api/enterprises/[id]/moloDb/index.get.ts
// Список баз предприятия со схемами коллекций (доступно любому участнику).
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { MoloDatabase } from '~~/server/models/moloDatabase.model'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { LIMITS } from '~~/server/utils/moloDb/schema'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
        await resolveActor(event, enterpriseId, 'data')

        const docs = await MoloDatabase.find({ enterpriseId }).sort({ name: 1 }).lean()
        return {
            success: true,
            databases: docs.map((d: any) => ({
                name: d.name,
                title: d.title || '',
                description: d.description || '',
                collections: d.collections || [],
                createdAt: d.createdAt,
                updatedAt: d.updatedAt
            })),
            limits: LIMITS
        }
    } catch (e) {
        throw toHttpError(e)
    }
})