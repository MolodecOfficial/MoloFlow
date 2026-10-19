// server/api/enterprises/[id]/moloDb/[db]/[col].post.ts
//
// Единый эндпоинт данных коллекции. Тело запроса: { op, ...параметры }.
//   op: find | findOne | get | count | insert | insertMany | update | delete
// Им пользуются интерфейс MoloDB, клиентские модули (useMoloDb), Python-боты и внешние системы.
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { runDbOp } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const db = getRouterParam(event, 'db')
        const col = getRouterParam(event, 'col')
        if (!enterpriseId || !db || !col) throw createError({ statusCode: 400, message: 'Не указана коллекция' })

        const actor = await resolveActor(event, enterpriseId, 'data')
        const body = (await readBody(event)) || {}
        return { success: true, ...(await runDbOp({ enterpriseId, db, col, actor }, body)) }
    } catch (e) {
        throw toHttpError(e)
    }
})