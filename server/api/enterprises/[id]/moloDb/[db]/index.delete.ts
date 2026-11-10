// server/api/enterprises/[id]/moloDb/[db]/index.delete.ts
// Удаление базы вместе со всеми записями (нужно право MODULES_DEV, ?confirm=true обязателен).
import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { COMPANY_DB } from '~~/server/utils/enterpriseDb'
import { invalidateDefCache, purgeRecords } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const dbName = getRouterParam(event, 'db')
        if (!enterpriseId || !dbName) throw createError({ statusCode: 400, message: 'Не указана база' })
        await resolveActor(event, enterpriseId, 'schema')

        if (dbName === COMPANY_DB) {
            throw createError({ statusCode: 403, message: 'Системную базу «company» нельзя удалить' })
        }
        if (getQuery(event).confirm !== 'true') {
            throw createError({ statusCode: 409, message: `Удаление базы «${dbName}» необратимо. Подтвердите удаление.` })
        }

        const { MoloDatabase } = tenantModels(enterpriseId)
        if (!(await MoloDatabase.exists({ name: dbName }))) {
            throw createError({ statusCode: 404, message: `База «${dbName}» не найдена` })
        }

        // Сначала записи, потом определение: при сбое базу можно удалить повторно
        const deletedRecords = await purgeRecords(enterpriseId, dbName)
        await MoloDatabase.deleteOne({ name: dbName })
        invalidateDefCache(enterpriseId, dbName)

        return { success: true, deletedRecords }
    } catch (e) {
        throw toHttpError(e)
    }
})
