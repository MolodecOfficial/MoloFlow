// server/utils/modules.ts
// Модули предприятия живут в его БД. Глобальный ModuleCatalog — только метаданные.
import { createError, type H3Event } from 'h3'
import { tenantModels } from './tenantDb'
import { ModuleCatalog } from '~~/server/models/moduleCatalog.model'
import { Enterprise } from '~~/server/models/enterprise.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '~/types/permissions'

export const MODULE_FORMATS = ['vue', 'js', 'ts'] as const
const FILE_NAME_RE = /^[\p{L}\p{N}_-]{1,80}$/u
const MAX_FILES = 200
const MAX_PREVIEW = 2_000_000
const MAX_BUNDLE = 5_000_000
const OID_RE = /^[a-f0-9]{24}$/i

export const isOid = (v: unknown): v is string => typeof v === 'string' && OID_RE.test(v)
const bad = (message: string, statusCode = 400) => createError({ statusCode, message })
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

const normalizeFiles = (raw: unknown) => {
    if (!Array.isArray(raw)) return []
    if (raw.length > MAX_FILES) throw bad(`Не больше ${MAX_FILES} файлов`)
    const now = new Date()
    return raw.map((f: any) => {
        const path = str(f?.path || f?.name, 200)
        if (!path || path.includes('..') || path.startsWith('/')) {
            throw bad(`Некорректный путь файла: «${path}»`)
        }
        return {
            name: str(f?.name || path, 200),
            path,
            format: str(f?.format, 10),
            code: String(f?.code ?? ''),
            isServerFile: f?.isServerFile === true,
            createdAt: f?.createdAt ? new Date(f.createdAt) : now,
            updatedAt: now
        }
    })
}

// partial = true: в результат попадают только поля, которые есть в body
const buildFields = (body: Record<string, any>, partial: boolean) => {
    const has = (k: string) => !partial || Object.prototype.hasOwnProperty.call(body, k)
    const out: Record<string, any> = {}

    if (has('name')) {
        out.name = str(body.name, 120)
        if (!out.name) throw bad('Укажите название модуля')
    }
    if (has('fileName')) {
        out.fileName = str(body.fileName, 80)
        if (!FILE_NAME_RE.test(out.fileName)) throw bad('Имя файла: буквы, цифры, «_» и «-», до 80 символов')
    }
    if (has('format')) {
        if (!(MODULE_FORMATS as readonly string[]).includes(body.format)) throw bad('Формат: vue, js или ts')
        out.format = body.format
    }
    if (has('description')) out.description = str(body.description, 500)
    if (has('isPublic')) out.isPublic = body.isPublic === true
    if (has('isActive')) out.isActive = body.isActive !== false
    if (has('tags')) {
        out.tags = Array.isArray(body.tags) ? body.tags.map((t: unknown) => str(t, 40)).filter(Boolean).slice(0, 20) : []
    }
    if (has('previewImage')) {
        const p = body.previewImage ? String(body.previewImage) : null
        if (p && p.length > MAX_PREVIEW) throw bad('Превью слишком большое')
        out.previewImage = p
    }
    if (has('code')) out.code = String(body.code ?? '')
    if (has('serverEntry')) out.serverEntry = str(body.serverEntry, 200)
    if (has('composables')) {
        out.composables = Array.isArray(body.composables)
            ? body.composables.map((c: unknown) => str(c, 80)).slice(0, 50)
            : []
    }
    if (has('dependencies')) out.dependencies = obj(body.dependencies)
    if (has('devDependencies')) out.devDependencies = obj(body.devDependencies)
    if (has('clientHooks')) out.clientHooks = obj(body.clientHooks)
    if (has('files')) out.files = normalizeFiles(body.files)
    if (has('clientBundle')) {
        const b = String(body.clientBundle ?? '')
        if (b.length > MAX_BUNDLE) throw bad('Бандл слишком большой')
        out.clientBundle = b
    }
    if (out.files) out.hasServerCode = out.files.some((f: any) => f.isServerFile)
    return out
}

/** Документ (mongoose или lean) → формат, который ждёт клиент */
export const toClientModule = (raw: any, minimal = false) => {
    const d = typeof raw?.toObject === 'function' ? raw.toObject() : raw
    const base = {
        _id: String(d._id),
        moduleId: String(d._id),
        name: d.name,
        fileName: d.fileName,
        format: d.format,
        description: d.description || '',
        isPublic: d.isPublic === true,
        isActive: d.isActive !== false,
        tags: d.tags || [],
        version: d.version || 1,
        updatedAt: d.updatedAt
    }
    if (minimal) return base
    return {
        ...base,
        code: d.code || '',
        files: d.files || [],
        dependencies: d.dependencies || {},
        devDependencies: d.devDependencies || {},
        clientHooks: d.clientHooks || {},
        composables: d.composables || [],
        serverEntry: d.serverEntry || '',
        previewImage: d.previewImage || null,
        hasServerCode: d.hasServerCode === true,
        createdBy: d.createdBy || null,
        createdAt: d.createdAt
    }
}

/** Ключ может быть fileName или _id */
export const findModule = (enterpriseId: string, key: string) => {
    const { DynamicModule } = tenantModels(enterpriseId)
    const or: Record<string, unknown>[] = [{ fileName: key }]
    if (isOid(key)) or.push({ _id: key })
    return DynamicModule.findOne({ $or: or }).lean()
}

/** Глобальный каталог — только метаданные. Вызывается после каждого изменения модуля. */
export const syncCatalog = async (enterpriseId: string, raw: any) => {
    const d = typeof raw?.toObject === 'function' ? raw.toObject() : raw
    await ModuleCatalog.updateOne(
        { _id: d._id },
        {
            $set: {
                enterpriseId,
                fileName: d.fileName,
                name: d.name,
                description: d.description || '',
                format: d.format,
                tags: d.tags || [],
                version: d.version || 1,
                isPublic: d.isPublic === true,
                isActive: d.isActive !== false,
                updatedAt: new Date()
            }
        },
        { upsert: true }
    )
}

/**
 * Синхронизирует каталог браузера с реальными модулями во всех базах предприятий.
 * Код модулей остаётся в tenant-БД, а ModuleCatalog хранит только метаданные.
 * Повторный запуск безопасен; результат кэшируется на 30 секунд.
 */
let catalogRefreshAt = 0
let catalogRefreshPromise: Promise<void> | null = null
export const refreshModuleCatalog = async (force = false): Promise<void> => {
    if (!force && Date.now() - catalogRefreshAt < 30_000) return
    if (catalogRefreshPromise) return catalogRefreshPromise

    catalogRefreshPromise = (async () => {
        const enterprises: any[] = await Enterprise.find({ status: { $ne: 'deleting' } })
            .select('_id')
            .lean()

        for (const enterprise of enterprises) {
            const enterpriseId = String(enterprise._id)
            const { DynamicModule } = tenantModels(enterpriseId)
            const docs: any[] = await DynamicModule.find({})
                .select('_id name fileName description format tags version isPublic isActive updatedAt createdAt previewImage stats isOfficial')
                .lean()

            for (const doc of docs) {
                await syncCatalog(enterpriseId, doc)
            }

            // Удаляем только записи каталога этого предприятия, которых больше нет в его БД.
            const ids = docs.map((doc) => doc._id)
            await ModuleCatalog.deleteMany({
                enterpriseId,
                ...(ids.length ? { _id: { $nin: ids } } : {})
            })
        }

        catalogRefreshAt = Date.now()
    })()

    try {
        await catalogRefreshPromise
    } finally {
        catalogRefreshPromise = null
    }
}

/** Владелец или администратор/управляющий. Право MODULES_DEV проверяет checkEnterpriseAccess. */
export const assertModuleAccess = async (event: H3Event, enterpriseId: string, doc: { createdBy?: { _id?: string } }) => {
    const { currentMember, effectiveRole } = await checkEnterpriseAccess(event, enterpriseId)
    const privileged = effectiveRole === 'Администратор' || effectiveRole === 'Управляющий'
    const permissions = ROLE_DEFAULT_PERMISSIONS[effectiveRole] || []
    const authorId = doc.createdBy?._id
    const isAuthor = !authorId || String(authorId) === String(currentMember.userId)
    const canDevelop = permissions.includes(PERMISSIONS.MODULES_DEV)
    if (!privileged && !(canDevelop && isAuthor)) {
        throw bad('Изменять и удалять модуль может автор с правом разработки, управляющий или администратор', 403)
    }
}

const dupGuard = (e: any, fileName?: string): never => {
    if (e?.code === 11000) throw bad(`Модуль «${fileName ?? ''}» уже существует`, 409)
    throw e
}

export const createModule = async (
    enterpriseId: string,
    actor: { id?: string; name?: string },
    body: Record<string, any>
) => {
    const { DynamicModule } = tenantModels(enterpriseId)
    const fields = buildFields(body, false)
    try {
        const doc = await DynamicModule.create({
            ...fields,
            ...(isOid(body._id) ? { _id: body._id } : {}),
            version: 1,
            createdBy: { _id: String(actor.id || ''), name: String(actor.name || '') }
        })
        await syncCatalog(enterpriseId, doc)
        return doc
    } catch (e) {
        return dupGuard(e, fields.fileName)
    }
}

export const updateModule = async (
    event: H3Event,
    enterpriseId: string,
    moduleId: string,
    body: Record<string, any>
) => {
    const { DynamicModule } = tenantModels(enterpriseId)
    if (!isOid(moduleId)) throw bad('Некорректный ID модуля')

    const doc: any = await DynamicModule.findById(moduleId)
    if (!doc) throw bad('Модуль не найден', 404)
    await assertModuleAccess(event, enterpriseId, doc)

    const fields = buildFields(body, true)
    doc.set({ ...fields, version: (doc.version || 1) + 1 })
    try {
        await doc.save()
    } catch (e) {
        return dupGuard(e, fields.fileName)
    }
    await syncCatalog(enterpriseId, doc)
    return doc
}

/** POST с _id существующего модуля — обновление, без _id — создание */
export const saveModule = async (
    event: H3Event,
    enterpriseId: string,
    actor: { id?: string; name?: string },
    body: Record<string, any>
) => {
    if (isOid(body._id)) {
        const { DynamicModule } = tenantModels(enterpriseId)
        if (await DynamicModule.exists({ _id: body._id })) {
            return updateModule(event, enterpriseId, body._id, body)
        }
    }
    return createModule(enterpriseId, actor, body)
}

/** Порядок: меню → модуль → каталог. Сбой оставит модуль, и удаление можно повторить. */
export const removeModule = async (event: H3Event, enterpriseId: string, moduleId: string) => {
    const { DynamicModule, Menu } = tenantModels(enterpriseId)
    if (!isOid(moduleId)) throw bad('Некорректный ID модуля')

    const doc: any = await DynamicModule.findById(moduleId).select('fileName createdBy').lean()
    if (!doc) throw bad('Модуль не найден', 404)
    await assertModuleAccess(event, enterpriseId, doc)

    await Menu.updateMany({}, {
        $pull: {
            items: {
                $or: [
                    { moduleId: String(doc._id) },
                    { id: doc.fileName },
                    { placeName: doc.fileName }
                ]
            }
        }
    })
    await DynamicModule.deleteOne({ _id: doc._id })
    await ModuleCatalog.deleteOne({ _id: doc._id })
    return { fileName: doc.fileName }
}

/** Для публичных маршрутов: по глобальному каталогу определяем предприятие и проверяем доступ */
export const resolvePublicModule = async (event: H3Event, moduleId: string): Promise<string> => {
    if (!isOid(moduleId)) throw bad('Module not found', 404)
    const cat: any = await ModuleCatalog.findById(moduleId).lean()
    if (!cat || cat.isActive === false) throw bad('Module not found or inactive', 404)

    const user: any = event.context.user
    if (!cat.isPublic && String(user?.enterpriseId ?? '') !== String(cat.enterpriseId)) {
        throw bad('Access denied', 403)
    }
    return String(cat.enterpriseId)
}
