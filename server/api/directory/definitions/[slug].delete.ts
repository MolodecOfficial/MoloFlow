import { defineEventHandler, getRouterParam } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { requireTenantId } from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = requireTenantId(event)
        await resolveActor(event, enterpriseId, 'data')

        const slug = getRouterParam(event, 'slug')

        if (!slug) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Не указан справочник'
            })
        }

        const { DirectoryDefinition, DirectoryItem } = tenantModels(enterpriseId)

        const definition = await DirectoryDefinition.findOneAndDelete({ slug })

        if (!definition) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Справочник не найден'
            })
        }

        const result = await DirectoryItem.deleteMany({
            enterpriseId,
            directorySlug: slug
        })

        return {
            success: true,
            deletedItems: result.deletedCount,
            deletedSlug: slug
        }
    } catch (e) {
        throw toHttpError(e)
    }
})