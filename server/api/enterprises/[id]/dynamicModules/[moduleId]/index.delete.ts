import { defineEventHandler, getRouterParam, createError } from 'h3'
import { toHttpError } from '~~/server/utils/moloDb/access'
import { findModule, removeModule, isOid } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const key = getRouterParam(event, 'moduleId')
        if (!isOid(enterpriseId)) throw createError({ statusCode: 400, message: 'Некорректный ID предприятия' })
        if (!key) throw createError({ statusCode: 400, message: 'Не указан модуль' })

        const current: any = await findModule(enterpriseId, key)
        if (!current) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        const { fileName } = await removeModule(event, enterpriseId, String(current._id))
        return { success: true, message: `Модуль «${fileName}» удалён вместе с его ссылками в меню` }
    } catch (e) {
        throw toHttpError(e)
    }
})
