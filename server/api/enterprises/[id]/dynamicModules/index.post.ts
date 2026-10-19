import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { Types } from 'mongoose'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { ensureCompanyDb, COMPANY_DB, MODULES_COL } from '~~/server/utils/enterpriseDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { runDbOp } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id') || event.context.params?.id
        if (!enterpriseId) {
            throw createError({ statusCode: 400, message: 'Не указан ID предприятия' })
        }

        const actor = await resolveActor(event, enterpriseId, 'schema')
        const body = await readBody(event)

        if (!body.name || !body.fileName || !body.format) {
            throw createError({
                statusCode: 400,
                message: 'Обязательные поля: name, fileName, format'
            })
        }

        // 1. Убеждаемся, что у предприятия есть база company с коллекцией modules
        await ensureCompanyDb(enterpriseId)

        // Генерируем валидный ObjectId, чтобы клиент и меню не ломались
        const moduleId = body._id && Types.ObjectId.isValid(body._id)
            ? String(body._id)
            : new Types.ObjectId().toString()

        const files = Array.isArray(body.files)
            ? body.files.map((file: any) => ({
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code || '',
                isServerFile: !!file.isServerFile,
                createdAt: file.createdAt || new Date(),
                updatedAt: new Date()
            }))
            : []

        // 2. ФОРМИРУЕМ ДОКУМЕНТ МОДУЛЯ С ПОЛНЫМ КОДОМ И ФАЙЛАМИ
        const moduleDoc = {
            _id: moduleId,
            moduleId,
            enterpriseId,
            name: String(body.name).trim(),
            fileName: String(body.fileName).trim(),
            format: body.format,
            code: body.code || '',
            description: body.description || '',
            isPublic: body.isPublic === true,
            tags: Array.isArray(body.tags) ? body.tags : [],
            previewImage: body.previewImage || null,
            dependencies: body.dependencies || {},
            devDependencies: body.devDependencies || {},
            serverEntry: body.serverEntry || '',
            composables: Array.isArray(body.composables) ? body.composables : [],
            files,
            hasServerCode: files.some((f: any) => f.isServerFile),
            version: 1,
            createdBy: {
                _id: actor.id || 'system',
                name: actor.name || 'System'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        // 3. СОХРАНЯЕМ В ЛОКАЛЬНУЮ БАЗУ ПРЕДПРИЯТИЯ (MoloDB -> company -> modules)
        await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system', id: actor.id } },
            {
                op: 'update',
                filter: { moduleId },
                patch: moduleDoc,
                upsert: true
            }
        )

        // 4. В ОБЩУЮ БАЗУ ПРОЕКТА (DynamicModule) ПИШЕМ ТОЛЬКО ЕСЛИ МОДУЛЬ ПУБЛИЧНЫЙ!
        if (body.isPublic === true) {
            await DynamicModule.findOneAndUpdate(
                { enterpriseId, fileName: body.fileName },
                {
                    ...moduleDoc,
                    dependencies: new Map(Object.entries(body.dependencies || {})),
                    devDependencies: new Map(Object.entries(body.devDependencies || {}))
                },
                { upsert: true, new: true }
            )
        } else {
            // Приватный модуль удаляется из глобального каталога проекта, если он там был
            await DynamicModule.deleteOne({ enterpriseId, fileName: body.fileName })
        }

        return {
            success: true,
            message: 'Модуль успешно сохранён в локальную базу данных предприятия',
            module: moduleDoc
        }
    } catch (e: any) {
        throw toHttpError(e)
    }
})