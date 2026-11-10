import { defineEventHandler, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { requireTenantId } from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    try {
        const body = (await readBody(event)) || {}
        const enterpriseId = requireTenantId(event)
        if (!body.name || !String(body.name).trim()) {
            throw createError({ statusCode: 400, message: 'Укажите название отдела' })
        }
        await resolveActor(event, enterpriseId, 'data')

        const name = String(body.name).trim()
        const key = String(body.key || name)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9а-я_]/gi, '_')
            .replace(/_+/g, '_')

        const { Department } = tenantModels(enterpriseId)
        return await Department.findOneAndUpdate(
            { key },
            { $set: { key, name, description: String(body.description || '') } },
            { upsert: true, new: true }
        ).lean()
    } catch (e) {
        throw toHttpError(e)
    }
})
