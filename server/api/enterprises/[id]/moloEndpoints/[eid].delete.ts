import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { stopDaemon } from '~~/server/utils/daemonManager'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const eid = getRouterParam(event, 'eid')
        if (!enterpriseId || !eid || !mongoose.Types.ObjectId.isValid(eid)) {
            throw createError({ statusCode: 400, message: 'Некорректный эндпоинт' })
        }
        await resolveActor(event, enterpriseId, 'schema')
        const Endpoint = tenantModels(enterpriseId).MoloEndpoint
        const endpoint: any = await Endpoint.findOne({ _id: eid, enterpriseId }).lean()
        if (!endpoint) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })

        // Если это был запущенный Python-бот — гасим процесс
        if (endpoint.moduleId) {
            await stopDaemon(String(endpoint.moduleId))
        }

        await Endpoint.deleteOne({ _id: eid, enterpriseId })
        return { success: true }
    } catch (e) {
        throw toHttpError(e)
    }
})