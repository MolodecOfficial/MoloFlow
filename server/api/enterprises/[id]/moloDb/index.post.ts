// server/api/enterprises/[id]/moloDb/index.post.ts
// Создание базы (нужно право MODULES_DEV).
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { LIMITS, normalizeDatabaseDef } from '~~/server/utils/moloDb/schema'
import { invalidateDefCache } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
        const actor = await resolveActor(event, enterpriseId, 'schema')

        const def = normalizeDatabaseDef(await readBody(event))
        const { MoloDatabase } = tenantModels(enterpriseId)

        if ((await MoloDatabase.countDocuments()) >= LIMITS.databases) {
            throw createError({ statusCode: 409, message: `Можно создать не больше ${LIMITS.databases} баз` })
        }
        if (await MoloDatabase.exists({ name: def.name })) {
            throw createError({ statusCode: 409, message: `База «${def.name}» уже существует` })
        }

        await MoloDatabase.create({ enterpriseId, ...def, createdBy: { _id: actor.id, name: actor.name || '' } })
        invalidateDefCache(enterpriseId, def.name)
        return { success: true, database: def }
    } catch (e) {
        throw toHttpError(e)
    }
})
