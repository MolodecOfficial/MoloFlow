import { defineEventHandler } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { requireTenantId } from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = requireTenantId(event)
        await resolveActor(event, enterpriseId, 'data')
        const { DirectoryDefinition } = tenantModels(enterpriseId)
        const defs = await DirectoryDefinition.find().lean()
        return defs || []
    } catch (e) {
        throw toHttpError(e)
    }
})