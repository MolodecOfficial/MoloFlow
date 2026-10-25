// server/api/browser/modules/[id]/import.post.ts
// Копирует публичный модуль из БД предприятия-владельца в БД предприятия-получателя.
// Исходный модуль берём через глобальный каталог (ModuleCatalog), код — из его БД.
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { ModuleCatalog } from '~~/server/models/moduleCatalog.model'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { createModule, isOid, toClientModule, refreshModuleCatalog } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const moduleId = getRouterParam(event, 'id')
        const body = (await readBody(event)) || {}
        const targetId = String(body.targetEnterpriseId || '')

        if (!isOid(moduleId) || !isOid(targetId)) {
            throw createError({ statusCode: 400, message: 'Некорректный moduleId или targetEnterpriseId' })
        }

        const actor = await resolveActor(event, targetId, 'schema')

        // Перед поиском обновляем индекс: старые публикации могли не попасть в каталог.
        await refreshModuleCatalog()

        // 1. Публичный каталог определяет, из какой БД брать модуль
        const cat: any = await ModuleCatalog.findById(moduleId).lean()
        if (!cat || !cat.isPublic || cat.isActive === false) {
            throw createError({ statusCode: 404, message: 'Публичный модуль не найден или отключён' })
        }
        const sourceId = String(cat.enterpriseId)

        const src: any = await tenantModels(sourceId).DynamicModule
            .findById(moduleId)
            .select('+clientBundle')
            .lean()
        if (!src) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        // 2. Имя файла уникально внутри предприятия-получателя
        const { DynamicModule } = tenantModels(targetId)
        let fileName: string = src.fileName
        let name: string = src.name
        if (await DynamicModule.exists({ fileName })) {
            fileName = `${src.fileName}_${Date.now().toString(36)}`
            name = `${src.name} (копия)`
        }

        // 3. Создаём локально: модуль попадает в БД получателя и в каталог, приватный
        const doc = await createModule(targetId, { id: actor.id, name: actor.name }, {
            name,
            fileName,
            format: src.format,
            description: src.description || '',
            tags: src.tags || [],
            previewImage: src.previewImage || null,
            code: src.code || '',
            files: src.files || [],
            dependencies: src.dependencies || {},
            devDependencies: src.devDependencies || {},
            clientHooks: src.clientHooks || {},
            composables: src.composables || [],
            serverEntry: src.serverEntry || '',
            clientBundle: src.clientBundle || '',
            isPublic: false
        })

        await ModuleCatalog.updateOne({ _id: moduleId }, { $inc: { 'stats.downloads': 1 } })

        return {
            success: true,
            module: toClientModule(doc),
            message: `Модуль «${name}» импортирован в базу предприятия`
        }
    } catch (e) {
        throw toHttpError(e)
    }
})
