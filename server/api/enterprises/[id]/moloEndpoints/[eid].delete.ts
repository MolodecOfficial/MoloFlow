// server/api/enterprises/[id]/moloEndpoints/[eid].delete.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'
import { MoloEndpoint } from '~~/server/models/moloEndpoint.model'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const eid = getRouterParam(event, 'eid')
        if (!enterpriseId || !eid || !mongoose.Types.ObjectId.isValid(eid)) {
            throw createError({ statusCode: 400, message: 'Некорректный эндпоинт' })
        }
        await resolveActor(event, enterpriseId, 'schema')

        const res = await MoloEndpoint.deleteOne({ _id: eid, enterpriseId })
        if (!res.deletedCount) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })
        return { success: true }
    } catch (e) {
        throw toHttpError(e)
    }
})