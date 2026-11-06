// Список эндпоинтов из MoloDB конкретного предприятия.
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
        await resolveActor(event, enterpriseId, 'schema')

        const Endpoint = tenantModels(enterpriseId).MoloEndpoint
        const docs = await Endpoint.find({ enterpriseId }).sort({ slug: 1 }).lean()
        return {
            success: true,
            endpoints: docs.map((d: any) => ({
                _id: String(d._id), slug: d.slug, description: d.description || '',
                methods: d.methods, moduleId: d.moduleId, file: d.file || '',
                access: d.access, secret: d.access === 'key' ? d.secret : '',
                enabled: d.enabled, stats: d.stats || {}, updatedAt: d.updatedAt
            }))
        }
    } catch (e) { throw toHttpError(e) }
})
