import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { toClientModule } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
        await resolveActor(event, enterpriseId, 'data')

        const minimal = ['1', 'true'].includes(String(getQuery(event).minimal))
        const select = minimal
            ? 'name fileName format description isPublic isActive tags version updatedAt'
            : '-clientBundle'

        const { DynamicModule } = tenantModels(enterpriseId)
        const docs: any[] = await DynamicModule.find({ isActive: { $ne: false } })
            .select(select)
            .sort({ name: 1 })
            .lean()

        return { success: true, modules: docs.map((d) => toClientModule(d, minimal)) }
    } catch (e) {
        throw toHttpError(e)
    }
})
