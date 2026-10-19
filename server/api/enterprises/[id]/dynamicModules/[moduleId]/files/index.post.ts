// server/api/enterprises/[id]/dynamicModules/[moduleId]/files/index.post.ts
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
        const { action, file, oldPath } = body

        if (!moduleId || !enterpriseId) {
            throw createError({ statusCode: 400, message: 'Отсутствуют обязательные параметры' })
        }

        const actor = await resolveActor(event, enterpriseId, 'schema')
        await ensureCompanyDb(enterpriseId)

        // 1. Читаем модуль из локальной базы предприятия
        const { item } = await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system', id: actor.id } },
            { op: 'findOne', filter: { $or: [{ moduleId }, { fileName: moduleId }] } }
        )

        if (!item) {
            throw createError({ statusCode: 404, message: 'Модуль не найден в базе предприятия' })
        }

        let files = Array.isArray(item.files) ? [...item.files] : []

        if (action === 'add') {
            files.push({
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code || '',
                isServerFile: !!file.isServerFile,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        } else if (action === 'update') {
            let index = -1
            if (oldPath) index = files.findIndex((f) => f.path === oldPath)
            if (index === -1) index = files.findIndex((f) => f.path === file.path)
            if (index === -1) index = files.findIndex((f) => f.name === file.name)

            const updatedFile = {
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code,
                isServerFile: file.isServerFile ?? (index !== -1 ? files[index].isServerFile : false),
                updatedAt: new Date().toISOString()
            }

            if (index !== -1) {
                files[index] = { ...files[index], ...updatedFile }
            } else {
                files.push({ ...updatedFile, createdAt: new Date().toISOString() })
            }
        } else if (action === 'delete') {
            files = files.filter((f) => f.path !== file.path)
        }

        const hasServerCode = files.some((f: any) => f.isServerFile)

        // 2. Обновляем локальную базу
        await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system', id: actor.id } },
            {
                op: 'update',
                filter: { _id: item._id },
                patch: { files, hasServerCode, updatedAt: new Date().toISOString() }
            }
        )

        // 3. Синхронизируем с DynamicModule, если модуль публичный
        if (item.isPublic) {
            await DynamicModule.findOneAndUpdate(
                { enterpriseId, fileName: item.fileName },
                { files, hasServerCode, updatedAt: new Date() }
            )
        }

        return { success: true, files }
    } catch (e: any) {
        throw toHttpError(e)
    }
})