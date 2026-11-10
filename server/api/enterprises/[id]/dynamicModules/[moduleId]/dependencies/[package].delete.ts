import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { findModule, updateModule } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const key = getRouterParam(event, 'moduleId')
        const packageName = getRouterParam(event, 'package')
        if (!enterpriseId || !key || !packageName) throw createError({ statusCode: 400, message: 'Missing params' })
        await resolveActor(event, enterpriseId, 'schema')

        const packageType = getQuery(event).packageType === 'devDependencies' ? 'devDependencies' : 'dependencies'

        const current: any = await findModule(enterpriseId, key)
        if (!current) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        const map: Record<string, string> = { ...(current[packageType] || {}) }
        if (!(packageName in map)) throw createError({ statusCode: 404, message: 'Зависимость не найдена' })
        delete map[packageName]

        await updateModule(event, enterpriseId, String(current._id), { [packageType]: map })

        return { success: true, message: `Зависимость ${packageName} успешно удалена` }
    } catch (e) {
        throw toHttpError(e)
    }
})
