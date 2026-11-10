import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { findModule, updateModule, toClientModule } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const key = getRouterParam(event, 'moduleId')
        if (!enterpriseId || !key) throw createError({ statusCode: 400, message: 'Не указан модуль' })
        await resolveActor(event, enterpriseId, 'schema')

        // Ключ может быть fileName — переводим в _id
        const current: any = await findModule(enterpriseId, key)
        if (!current) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        const body = (await readBody(event)) || {}
        const doc = await updateModule(event, enterpriseId, String(current._id), body)

        return { success: true, message: 'Модуль обновлён', module: toClientModule(doc) }
    } catch (e) {
        throw toHttpError(e)
    }
})
