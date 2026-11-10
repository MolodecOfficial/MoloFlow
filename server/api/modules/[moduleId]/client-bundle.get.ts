import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { toHttpError } from '~~/server/utils/moloDb/access'
import { resolvePublicModule } from '~~/server/utils/modules'
import { tenantModels } from '~~/server/utils/tenantDb'

export default defineEventHandler(async (event) => {
    try {
        const moduleId = getRouterParam(event, 'moduleId')
        if (!moduleId) throw createError({ statusCode: 400, message: 'moduleId обязателен' })

        const enterpriseId = await resolvePublicModule(event, moduleId)
        const mod: any = await tenantModels(enterpriseId).DynamicModule
            .findById(moduleId)
            .select('+clientBundle')
            .lean()

        if (!mod?.clientBundle) throw createError({ statusCode: 404, message: 'Client bundle not found' })

        setResponseHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
        setResponseHeader(event, 'Cache-Control', 'private, max-age=60')
        return mod.clientBundle
    } catch (e) {
        throw toHttpError(e)
    }
})
