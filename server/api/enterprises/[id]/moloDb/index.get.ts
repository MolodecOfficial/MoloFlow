// server/api/enterprises/[id]/moloDb/index.get.ts
// Список баз предприятия со схемами коллекций (доступно любому участнику).
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { LIMITS } from '~~/server/utils/moloDb/schema'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
        await resolveActor(event, enterpriseId, 'data')

        const { MoloDatabase } = tenantModels(enterpriseId)
        const docs: any[] = await MoloDatabase.find().sort({ name: 1 }).lean()
        return {
            success: true,
            databases: docs.map((d) => ({
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
