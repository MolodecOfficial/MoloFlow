import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { runDbOp } from '~~/server/utils/moloDb/store'
import { ensureCompanyDb, COMPANY_DB, MODULES_COL } from '~~/server/utils/enterpriseDb'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id') || event.context.params?.id
        const moduleId = getRouterParam(event, 'moduleId') || event.context.params?.moduleId
        const body = await readBody(event)

        if (!enterpriseId || !moduleId) {
            throw createError({ statusCode: 400, message: 'Отсутствует enterpriseId или moduleId' })
        }

        const actor = await resolveActor(event, enterpriseId, 'schema')
        await ensureCompanyDb(enterpriseId)

        // 1. Ищем модуль в локальной базе предприятия
        const existing = await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system', id: actor.id } },
            { op: 'findOne', filter: { $or: [{ moduleId }, { fileName: moduleId }] } }
        )

        if (!existing.item) {
            throw createError({ statusCode: 404, message: 'Модуль не найден в локальной базе предприятия' })
        }

        const files = Array.isArray(body.files)
            ? body.files.map((file: any) => ({
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code || '',
                isServerFile: !!file.isServerFile,
                updatedAt: new Date()
            }))
            : existing.item.files || []

        const patch = {
            ...body,
            files,
            hasServerCode: files.some((f: any) => f.isServerFile),
            updatedAt: new Date().toISOString(),
            version: (existing.item.version || 1) + 1
        }

        // 2. ОБНОВЛЯЕМ В ЛОКАЛЬНОЙ БАЗЕ ПРЕДПРИЯТИЯ
        await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system', id: actor.id } },
            {
                op: 'update',
                filter: { _id: existing.item._id },
                patch
            }
        )

        // 3. ЕСЛИ МОДУЛЬ ПУБЛИЧНЫЙ — СИНХРОНИЗИРУЕМ С БАЗОЙ ПРОЕКТА
        if (patch.isPublic === true) {
            await DynamicModule.findOneAndUpdate(
                { enterpriseId, fileName: existing.item.fileName },
                {
                    ...patch,
                    dependencies: new Map(Object.entries(patch.dependencies || {})),
                    devDependencies: new Map(Object.entries(patch.devDependencies || {}))
                },
                { upsert: true }
            )
        } else {
            await DynamicModule.deleteOne({ enterpriseId, fileName: existing.item.fileName })
        }

        return {
            success: true,
            message: 'Модуль обновлён в локальной базе предприятия',
            module: { ...existing.item, ...patch }
        }
    } catch (e: any) {
        throw toHttpError(e)
    }
})