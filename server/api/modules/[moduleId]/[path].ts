import { defineEventHandler, getRouterParam, getQuery, readBody, createError } from 'h3'
import { getModuleSandbox } from '~~/app/utils/moduleSandbox'
import { toHttpError } from '~~/server/utils/moloDb/access'
import { resolvePublicModule } from '~~/server/utils/modules'

const PATH_RE = /^[A-Za-z0-9_\-/]{1,100}$/

// Серверный код модуля выполняется в песочнице. Точка входа — main/handler/run или файл по пути.
// Контекст передаётся как { path, method, query, body, user }.
export default defineEventHandler(async (event) => {
    try {
        const moduleId = getRouterParam(event, 'moduleId')
        const modulePath = getRouterParam(event, 'path') || 'index'
        if (!moduleId || !PATH_RE.test(modulePath)) {
            throw createError({ statusCode: 400, message: 'Некорректный адрес модуля' })
        }

        const enterpriseId = await resolvePublicModule(event, moduleId)
        const sandbox = await getModuleSandbox(moduleId, enterpriseId)

        const body = event.method === 'GET' ? null : await readBody(event).catch(() => null)
        const context = {
            path: modulePath,
            method: event.method,
            query: getQuery(event),
            body,
            user: event.context.user ?? null
        }

        return await sandbox.executeFile(modulePath, context)
    } catch (e) {
        throw toHttpError(e)
    }
})
