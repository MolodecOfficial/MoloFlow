// server/api/enterprises/[id]/moloDb/[db]/index.put.ts
// Изменение базы: название, описание, схема коллекций (нужно право MODULES_DEV).
// Если среди коллекций есть удалённые, нужно явно передать confirmDelete: true — их записи будут стёрты.
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { normalizeDatabaseDef } from '~~/server/utils/moloDb/schema'
import { invalidateDefCache, purgeRecords } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const dbName = getRouterParam(event, 'db')
        if (!enterpriseId || !dbName) throw createError({ statusCode: 400, message: 'Не указана база' })
        await resolveActor(event, enterpriseId, 'schema')

        const body = (await readBody(event)) || {}
        const def = normalizeDatabaseDef({ ...body, name: dbName })

        const { MoloDatabase } = tenantModels(enterpriseId)
        const existing: any = await MoloDatabase.findOne({ name: dbName }).lean()
        if (!existing) throw createError({ statusCode: 404, message: `База «${dbName}» не найдена` })

        // Системная коллекция модулей всегда остаётся в company и не удаляет настоящие модули.
        if (dbName === 'company') {
            const systemModules = (existing.collections || []).find((c: any) => c.name === 'modules')
            if (systemModules && !def.collections.some((c: any) => c.name === 'modules')) {
                def.collections.push(systemModules)
            }
        }
        const keep = new Set(def.collections.map((c) => c.name))
        const removed = (existing.collections || []).map((c: any) => c.name).filter((n: string) => !keep.has(n))
        if (removed.length && body.confirmDelete !== true) {
            throw createError({
                statusCode: 409,
                message: `Будут удалены коллекции вместе с данными: ${removed.join(', ')}. Подтвердите удаление.`,
                data: { removed }
            })
        }

        await MoloDatabase.updateOne(
            { name: dbName },
            { $set: { title: def.title, description: def.description, collections: def.collections, updatedAt: new Date() } }
        )
        if (removed.length) await purgeRecords(enterpriseId, dbName, removed)
        invalidateDefCache(enterpriseId, dbName)
        return { success: true, database: def, removed }
    } catch (e) {
        throw toHttpError(e)
    }
})
