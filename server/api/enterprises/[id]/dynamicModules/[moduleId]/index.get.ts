import { defineEventHandler, getRouterParam, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { findModule, toClientModule } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const key = getRouterParam(event, 'moduleId')
        if (!enterpriseId || !key) throw createError({ statusCode: 400, message: 'Не указан модуль' })
        await resolveActor(event, enterpriseId, 'data')

        const doc = await findModule(enterpriseId, key)
        if (!doc) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        return { success: true, module: toClientModule(doc) }
    } catch (e) {
        throw toHttpError(e)
    }
})
