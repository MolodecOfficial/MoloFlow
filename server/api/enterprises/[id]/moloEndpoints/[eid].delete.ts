import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const eid = getRouterParam(event, 'eid')
        if (!enterpriseId || !eid || !mongoose.Types.ObjectId.isValid(eid)) throw createError({ statusCode: 400, message: 'Некорректный эндпоинт' })
        await resolveActor(event, enterpriseId, 'schema')
        const result = await tenantModels(enterpriseId).MoloEndpoint.deleteOne({ _id: eid, enterpriseId })
        if (!result.deletedCount) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })
        return { success: true }
    } catch (e) { throw toHttpError(e) }
})
