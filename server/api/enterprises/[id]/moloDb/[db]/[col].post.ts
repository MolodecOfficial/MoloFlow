// server/api/enterprises/[id]/moloDb/[db]/[col].post.ts
// Единый эндпоинт данных коллекции. Тело запроса: { op, ...параметры }.
// Системные коллекции (например, modules) работают с реальными данными предприятия.
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { runDbOp } from '~~/server/utils/moloDb/store'
import { runModulesOp } from '~~/server/utils/moloDb/systemModules'
import { tenantModels } from '~~/server/utils/tenantDb'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const db = getRouterParam(event, 'db')
        const col = getRouterParam(event, 'col')
        if (!enterpriseId || !db || !col) throw createError({ statusCode: 400, message: 'Не указана коллекция' })

        const actor = await resolveActor(event, enterpriseId, 'data')
        const body = (await readBody(event)) || {}

        const def: any = await tenantModels(enterpriseId).MoloDatabase.findOne({ name: db }).select('collections').lean()
        const colDef = (def?.collections || []).find((c: any) => c.name === col)

        if (colDef?.system === 'dynamicModules') {
            if (actor.kind === 'module') {
                throw createError({ statusCode: 403, message: 'Серверный код модуля не управляет модулями предприятия' })
            }
            return { success: true, ...(await runModulesOp(event, enterpriseId, body)) }
        }

        return { success: true, ...(await runDbOp({ enterpriseId, db, col, actor }, body)) }
    } catch (e) {
        throw toHttpError(e)
    }
})
