import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { findModule, updateModule } from '~~/server/utils/modules'

// body: { action: 'add' | 'remove', packageName, version?, packageType?: 'dependencies' | 'devDependencies' }
export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const key = getRouterParam(event, 'moduleId')
        if (!enterpriseId || !key) throw createError({ statusCode: 400, message: 'Отсутствуют параметры' })
        await resolveActor(event, enterpriseId, 'schema')

        const body = (await readBody(event)) || {}
        const { action, packageName, version } = body
        const packageType = body.packageType === 'devDependencies' ? 'devDependencies' : 'dependencies'

        const current: any = await findModule(enterpriseId, key)
        if (!current) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        const deps: Record<string, string> = { ...(current.dependencies || {}) }
        const devDeps: Record<string, string> = { ...(current.devDependencies || {}) }
        const target = packageType === 'devDependencies' ? devDeps : deps

        if (action === 'add') {
            if (!packageName) throw createError({ statusCode: 400, message: 'Имя зависимости обязательно' })
            target[packageName] = version || 'latest'
        } else if (action === 'remove') {
            if (!packageName || !(packageName in target)) {
                throw createError({ statusCode: 404, message: 'Зависимость не найдена' })
            }
            delete target[packageName]
        } else {
            throw createError({ statusCode: 400, message: 'Неизвестное действие' })
        }

        await updateModule(event, enterpriseId, String(current._id), { dependencies: deps, devDependencies: devDeps })

        return {
            success: true,
            [packageType]: target,
            message: `Зависимость ${packageName} успешно обработана`
        }
    } catch (e) {
        throw toHttpError(e)
    }
})
