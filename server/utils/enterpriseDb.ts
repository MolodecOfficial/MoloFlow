// server/utils/enterpriseDb.ts
// Системная база «company»: только реквизиты организации (коллекция profile).
import { tenantModels } from './tenantDb'
import { runDbOp, invalidateDefCache, purgeRecords } from './moloDb/store'

export const COMPANY_DB = 'company'
export const PROFILE_COL = 'profile'
export const SYSTEM_ACTOR = { kind: 'system' as const, id: 'system' }

const LEGACY_BANK_COL = 'bank_accounts'

const PROFILE_DEF = {
    name: PROFILE_COL,
    title: 'Реквизиты организации',
    strict: false,
    fields: [
        { name: 'enterpriseName', label: 'Наименование', type: 'string', required: true },
        { name: 'inn', label: 'ИНН', type: 'string', required: true },
        { name: 'kpp', label: 'КПП', type: 'string' },
        { name: 'ogrn', label: 'ОГРН', type: 'string' },
        { name: 'ownershipForm', label: 'Форма собственности', type: 'string' },
        { name: 'director', label: 'Руководитель', type: 'string' },
        { name: 'phone', label: 'Телефон', type: 'string' },
        { name: 'email', label: 'Email', type: 'string' },
        { name: 'legalAddress', label: 'Юридический адрес', type: 'string' },
        { name: 'actualAddress', label: 'Фактический адрес', type: 'string' },
        { name: 'okved', label: 'ОКВЭД', type: 'string' },
        { name: 'isSelfCompany', label: 'Собственная организация', type: 'boolean' }
    ]
}


// Системная коллекция для просмотра модулей предприятия в MoloDB Studio.
// Данные не копируются в molo_records: чтение маршрутизируется в tenant-модель DynamicModule.
const WORKSPACE_DB = 'workspace'
const DIRECTORIES_DB = 'directories'

// Метаданные для MoloDB Studio. Физические данные этих разделов живут
// в tenant-БД в собственных MongoDB-коллекциях, а не в molo_records.
const WORKSPACE_DEFS = [
    {
        name: 'workspace_documents',
        title: 'Файлы пространства',
        strict: false,
        system: 'workspaceDocuments',
        fields: [
            { name: 'name', label: 'Название', type: 'string', required: true },
            { name: 'type', label: 'Тип', type: 'string' },
            { name: 'folderId', label: 'Папка', type: 'string' },
            { name: 'size', label: 'Размер', type: 'number' },
            { name: 'createdAt', label: 'Создан', type: 'date' },
            { name: 'updatedAt', label: 'Изменён', type: 'date' }
        ]
    },
    {
        name: 'workspace_folders',
        title: 'Папки пространства',
        strict: false,
        system: 'workspaceFolders',
        fields: [
            { name: 'name', label: 'Название', type: 'string', required: true },
            { name: 'parentId', label: 'Родительская папка', type: 'string' },
            { name: 'createdAt', label: 'Создана', type: 'date' },
            { name: 'updatedAt', label: 'Изменена', type: 'date' }
        ]
    },
    {
        name: 'workspace_versions',
        title: 'История версий пространства',
        strict: false,
        system: 'workspaceVersions',
        fields: [
            { name: 'documentId', label: 'ID документа', type: 'string' },
            { name: 'size', label: 'Размер', type: 'number' },
            { name: 'comment', label: 'Комментарий', type: 'string' },
            { name: 'createdAt', label: 'Создана', type: 'date' }
        ]
    }
]

const DIRECTORIES_DEF = {
    name: 'directory_definitions',
    title: 'Настройки справочников',
    strict: false,
    system: 'directoryDefinitions',
    fields: [
        { name: 'slug', label: 'Идентификатор', type: 'string', required: true },
        { name: 'title', label: 'Название', type: 'string', required: true },
        { name: 'description', label: 'Описание', type: 'text' },
        { name: 'isSystem', label: 'Системный', type: 'boolean' }
    ]
}

const MODULES_DEF = {
    name: 'modules',
    title: 'Модули предприятия',
    strict: false,
    system: 'dynamicModules',
    fields: [
        { name: 'name', label: 'Название', type: 'string' },
        { name: 'fileName', label: 'Имя файла', type: 'string' },
        { name: 'format', label: 'Формат', type: 'string' },
        { name: 'description', label: 'Описание', type: 'text' },
        { name: 'isPublic', label: 'Публичный', type: 'boolean' },
        { name: 'isActive', label: 'Активен', type: 'boolean' },
        { name: 'version', label: 'Версия', type: 'number' },
        { name: 'hasServerCode', label: 'Есть серверный код', type: 'boolean' },
        { name: 'tags', label: 'Теги', type: 'json' },
        { name: 'createdAt', label: 'Создан', type: 'date' },
        { name: 'updatedAt', label: 'Изменён', type: 'date' }
    ]
}

/** Создаёт/обновляет метаданные раздела в каталоге MoloDB Studio. */
async function ensureStudioDatabase(
    enterpriseId: string,
    name: string,
    title: string,
    description: string,
    definitions: any[]
): Promise<void> {
    const { MoloDatabase } = tenantModels(enterpriseId)
    const existing: any = await MoloDatabase.findOne({ name }).lean()
    if (!existing) {
        await MoloDatabase.create({
            enterpriseId, name, title, description,
            collections: definitions,
            createdBy: { _id: 'system', name: 'system' }
        })
    } else {
        const current: any[] = Array.isArray(existing.collections) ? [...existing.collections] : []
        for (const definition of definitions) {
            if (!definition?.name) continue
            const index = current.findIndex((item: any) => String(item?.name) === String(definition.name))
            if (index === -1) current.push(definition)
            else current[index] = { ...current[index], ...definition }
        }
        // Use an explicit $set of the merged registry so existing collections are kept
        // and a newly created custom dir_<slug> is visible in MoloDB Studio immediately.
        await MoloDatabase.updateOne(
            { _id: existing._id, enterpriseId },
            { $set: { enterpriseId, title, description, collections: current, updatedAt: new Date() } }
        )
    }
    invalidateDefCache(enterpriseId, name)
}

/** Регистрирует физическую коллекцию справочника в каталоге MoloDB Studio. */
export async function ensureDirectoryStudioCollection(
    enterpriseId: string,
    slug: string,
    title?: string,
    customFields: any[] = []
): Promise<void> {
    const colName = `dir_${String(slug).trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 100)}`
    const fields = [
        { name: 'directorySlug', label: 'Идентификатор справочника', type: 'string', required: true },
        { name: 'title', label: 'Наименование', type: 'string', required: true },
        { name: 'code', label: 'Код', type: 'string' },
        { name: 'description', label: 'Описание', type: 'text' },
        { name: 'attributes', label: 'Дополнительные поля', type: 'json' },
        { name: 'createdAt', label: 'Создано', type: 'date' },
        { name: 'updatedAt', label: 'Изменено', type: 'date' },
        ...customFields.filter((f: any) => f && typeof f.name === 'string' && !['enterpriseId', '_id'].includes(f.name)).map((f: any) => ({ ...f, name: `attributes.${f.name}` }))
    ]
    await ensureStudioDatabase(
        enterpriseId,
        DIRECTORIES_DB,
        'Справочники',
        'Определения и записи справочников предприятия',
        [{ name: colName, title: title || slug, strict: false, system: 'directoryItems', fields }]
    )
}

/** Создаёт базу company с коллекцией profile или дописывает profile, если её нет. */
export const ensureCompanyDb = async (enterpriseId: string): Promise<void> => {
    const { MoloDatabase } = tenantModels(enterpriseId)
    const db: any = await MoloDatabase.findOne({ name: COMPANY_DB }).lean()
    if (!db) {
        await MoloDatabase.create({
            enterpriseId,
            name: COMPANY_DB,
            title: 'Данные предприятия',
            description: 'Реквизиты организации',
            collections: [PROFILE_DEF, MODULES_DEF],
            createdBy: { _id: 'system', name: 'system' }
        })
    } else {
        const collections: any[] = db.collections || []
        const updates: Record<string, any> = {}
        if (!collections.some((c: any) => c.name === PROFILE_COL)) {
            updates.profile = PROFILE_DEF
        }
        if (!collections.some((c: any) => c.name === MODULES_DEF.name)) {
            updates.modules = MODULES_DEF
        } else {
            // Обновляем метаданные системной коллекции, не трогая пользовательские поля.
            updates.modules = MODULES_DEF
        }
        if (Object.keys(updates).length) {
            const set: Record<string, any> = {}
            for (const [name, def] of Object.entries(updates)) {
                const idx = collections.findIndex((c: any) => c.name === name)
                if (idx >= 0) collections[idx] = def
                else collections.push(def)
            }
            set.collections = collections
            await MoloDatabase.updateOne({ _id: db._id }, { $set: set })
        }
    }
    invalidateDefCache(enterpriseId, COMPANY_DB)

    // Studio должен показывать системные разделы рядом с «Данные предприятия».
    // Сами документы/папки/справочники хранятся в физических коллекциях tenant-БД.
    await ensureStudioDatabase(
        enterpriseId,
        WORKSPACE_DB,
        'Пространство',
        'Файлы, папки и история версий документов предприятия',
        WORKSPACE_DEFS
    )
    await ensureStudioDatabase(
        enterpriseId,
        DIRECTORIES_DB,
        'Справочники',
        'Определения и записи справочников предприятия',
        [DIRECTORIES_DEF, ...['departments', 'counterparties', 'nomenclature', 'glossary'].map((slug) => ({
            name: `dir_${slug}`, title: slug, strict: false, system: 'directoryItems', fields: [
                { name: 'directorySlug', label: 'Идентификатор справочника', type: 'string', required: true },
                { name: 'title', label: 'Наименование', type: 'string', required: true },
                { name: 'code', label: 'Код', type: 'string' },
                { name: 'description', label: 'Описание', type: 'text' },
                { name: 'attributes', label: 'Дополнительные поля', type: 'json' },
                { name: 'createdAt', label: 'Создано', type: 'date' },
                { name: 'updatedAt', label: 'Изменено', type: 'date' }
            ]
        }))]
    )
}

/** Удаляет старую коллекцию банковских счетов вместе с записями. Возвращает число удалённых записей. */
export const removeLegacyBankCollection = async (enterpriseId: string): Promise<number> => {
    const { MoloDatabase } = tenantModels(enterpriseId)
    const db: any = await MoloDatabase.findOne({ name: COMPANY_DB }).lean()
    if (!db || !(db.collections || []).some((c: any) => c.name === LEGACY_BANK_COL)) return 0
    const removed = await purgeRecords(enterpriseId, COMPANY_DB, [LEGACY_BANK_COL])
    await MoloDatabase.updateOne({ _id: db._id }, { $pull: { collections: { name: LEGACY_BANK_COL } } })
    invalidateDefCache(enterpriseId, COMPANY_DB)
    return removed
}

const opts = (enterpriseId: string, col: string) => ({ enterpriseId, db: COMPANY_DB, col, actor: SYSTEM_ACTOR })

export const getSelfProfile = async (enterpriseId: string): Promise<any | null> => {
    const res: any = await runDbOp(opts(enterpriseId, PROFILE_COL), { op: 'findOne', filter: { isSelfCompany: true } })
    return res?.item ?? null
}

export const writeSelfProfile = async (enterpriseId: string, profile: Record<string, any>): Promise<void> => {
    const existing = await getSelfProfile(enterpriseId)
    const now = new Date().toISOString()
    if (existing) {
        await runDbOp(opts(enterpriseId, PROFILE_COL), {
            op: 'update',
            filter: { _id: existing._id },
            patch: { ...profile, isSelfCompany: true, updatedAt: now }
        })
    } else {
        await runDbOp(opts(enterpriseId, PROFILE_COL), {
            op: 'insert',
            doc: { ...profile, isSelfCompany: true, createdAt: now }
        })
    }
}
