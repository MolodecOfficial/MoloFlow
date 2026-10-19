// server/api/enterprises/[id]/dynamicModules/[moduleId]/dependencies/index.post.ts
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { runDbOp } from '~~/server/utils/moloDb/store'
import { ensureCompanyDb, COMPANY_DB, MODULES_COL } from '~~/server/utils/enterpriseDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'

export default defineEventHandler(async (event) => {
    try {
        const moduleId = getRouterParam(event, 'moduleId')
        const enterpriseId = getRouterParam(event, 'id')
        const body = await readBody(event)
        const { action, packageName, version, packageType = 'dependencies' } = body

        if (!moduleId || !enterpriseId) {
            throw createError({ statusCode: 400, message: 'Отсутствует moduleId или enterpriseId' })
        }

        const actor = await resolveActor(event, enterpriseId, 'schema')
        await ensureCompanyDb(enterpriseId)

        const { item } = await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system', id: actor.id } },
            { op: 'findOne', filter: { $or: [{ moduleId }, { fileName: moduleId }] } }
        )

        if (!item) {
            throw createError({ statusCode: 404, message: 'Модуль не найден' })
        }

        const deps = { ...(item.dependencies || {}) }
        const devDeps = { ...(item.devDependencies || {}) }
        const target = packageType === 'devDependencies' ? devDeps : deps

        if (action === 'add') {
            if (!packageName) {
                throw createError({ statusCode: 400, message: 'Имя зависимости обязательно' })
            }
            target[packageName] = version || 'latest'
        } else if (action === 'remove') {
            if (!target[packageName]) {
                throw createError({ statusCode: 404, message: 'Зависимость не найдена' })
            }
            delete target[packageName]
        } else {
            throw createError({ statusCode: 400, message: 'Неизвестное действие' })
        }

        const patch = {
            dependencies: deps,
            devDependencies: devDeps,
            updatedAt: new Date().toISOString()
        }

        // Обновляем в локальной базе предприятия
        await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system', id: actor.id } },
            { op: 'update', filter: { _id: item._id }, patch }
        )

        // Синхронизируем с общей базой
        if (item.isPublic) {
            await DynamicModule.findOneAndUpdate(
                { enterpriseId, fileName: item.fileName },
                {
                    dependencies: new Map(Object.entries(deps)),
                    devDependencies: new Map(Object.entries(devDeps)),
                    updatedAt: new Date()
                }
            )
        }

        return {
            success: true,
            [packageType]: target,
            message: `Зависимость ${packageName} успешно обработана`
        }
    } catch (e: any) {
        throw toHttpError(e)
    }
})