import { defineEventHandler } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { requireTenantId } from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = requireTenantId(event)
        await resolveActor(event, enterpriseId, 'data')

        const { Department } = tenantModels(enterpriseId)
        return await Department.find().sort({ name: 1 }).lean()
    } catch (e) {
        throw toHttpError(e)
    }
})
