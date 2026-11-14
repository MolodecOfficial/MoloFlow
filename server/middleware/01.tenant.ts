import { defineEventHandler } from 'h3'
import { getTenantId } from '~~/server/utils/tenant/tenantContext'

export default defineEventHandler((event) => {
    const tenantId = getTenantId(event)
    if (tenantId) {
        event.context.enterpriseId = tenantId
    }
})
