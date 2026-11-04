import { defineEventHandler, getRouterParam, createError } from 'h3'
import { toHttpError } from '~~/server/utils/moloDb/access'
import { resolvePublicModule } from '~~/server/utils/modules'
import { tenantModels } from '~~/server/utils/tenantDb'

export default defineEventHandler(async (event) => {
    try {
        const moduleId = getRouterParam(event, 'moduleId')
        if (!moduleId) throw createError({ statusCode: 400, message: 'moduleId обязателен' })

        const enterpriseId = await resolvePublicModule(event, moduleId)
        const mod: any = await tenantModels(enterpriseId).DynamicModule.findById(moduleId).lean()
        if (!mod) throw createError({ statusCode: 404, message: 'Module not found' })

        return {
            id: String(mod._id),
            name: mod.name,
            version: mod.version || 1,
            description: mod.description || '',
            format: mod.format,
            isPublic: mod.isPublic === true,
            tags: mod.tags || [],
            composables: mod.composables || [],
            serverEntry: mod.serverEntry || '',
            dependencies: mod.dependencies || {},
            cssUrl: null,
            clientEntry: `/api/modules/${moduleId}/client-bundle`
        }
    } catch (e) {
        throw toHttpError(e)
    }
})
