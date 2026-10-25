import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { saveModule, toClientModule } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })

        const actor = await resolveActor(event, enterpriseId, 'schema')
        const body = (await readBody(event)) || {}

        const doc = await saveModule(event, enterpriseId, actor, body)
        return {
            success: true,
            message: 'Модуль сохранён в базе предприятия',
            module: toClientModule(doc)
        }
    } catch (e) {
        throw toHttpError(e)
    }
})
