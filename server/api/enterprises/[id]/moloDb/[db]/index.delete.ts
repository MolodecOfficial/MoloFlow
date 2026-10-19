// server/api/enterprises/[id]/moloDb/[db]/index.delete.ts
// Удаление базы вместе со всеми записями (нужно право MODULES_DEV).
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { MoloDatabase } from '~~/server/models/moloDatabase.model'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { invalidateDefCache, purgeRecords } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const dbName = getRouterParam(event, 'db')
        if (!enterpriseId || !dbName) throw createError({ statusCode: 400, message: 'Не указана база' })
        await resolveActor(event, enterpriseId, 'schema')

        const res = await MoloDatabase.deleteOne({ enterpriseId, name: dbName })
        if (!res.deletedCount) throw createError({ statusCode: 404, message: `База «${dbName}» не найдена` })

        const records = await purgeRecords(enterpriseId, dbName)
        invalidateDefCache(enterpriseId, dbName)
        return { success: true, deletedRecords: records }
    } catch (e) {
        throw toHttpError(e)
    }
})