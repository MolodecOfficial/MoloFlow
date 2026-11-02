import { tenantModels } from './tenantDb'
import { runDbOp, invalidateDefCache } from './moloDb/store'

export const COMPANY_DB = 'company'
export const PROFILE_COL = 'profile'
export const SYSTEM_ACTOR = { kind: 'system' as const, id: 'system' }

const PROFILE_DEF = {
    name: PROFILE_COL, title: 'Реквизиты организации', strict: false,
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

const WORKSPACE_DB = 'workspace'
const DIRECTORIES_DB = 'directories'

const WORKSPACE_DEFS = [
    { name: 'workspace_documents', title: 'Файлы пространства', strict: false, system: 'workspaceDocuments',
      fields: [
        { name: 'name', label: 'Название', type: 'string', required: true },
        { name: 'type', label: 'Тип', type: 'string' }, { name: 'folderId', label: 'Папка', type: 'string' },
        { name: 'size', label: 'Размер', type: 'number' }, { name: 'createdAt', label: 'Создан', type: 'date' },
        { name: 'updatedAt', label: 'Изменён', type: 'date' }
      ] },
    { name: 'workspace_folders', title: 'Папки пространства', strict: false, system: 'workspaceFolders',
      fields: [
        { name: 'name', label: 'Название', type: 'string', required: true },
        { name: 'parentId', label: 'Родительская папка', type: 'string' },
        { name: 'createdAt', label: 'Создана', type: 'date' }, { name: 'updatedAt', label: 'Изменена', type: 'date' }
      ] },
    { name: 'workspace_versions', title: 'История версий пространства', strict: false, system: 'workspaceVersions',
      fields: [
        { name: 'documentId', label: 'ID документа', type: 'string' }, { name: 'size', label: 'Размер', type: 'number' },
        { name: 'comment', label: 'Комментарий', type: 'string' }, { name: 'createdAt', label: 'Создана', type: 'date' }
      ] }
]

const MODULES_DEF = {
    name: 'modules', title: 'Модули предприятия', strict: false, system: 'dynamicModules',
    fields: [
        { name: 'name', label: 'Название', type: 'string' }, { name: 'fileName', label: 'Имя файла', type: 'string' },
        { name: 'format', label: 'Формат', type: 'string' }, { name: 'description', label: 'Описание', type: 'text' },
        { name: 'isPublic', label: 'Публичный', type: 'boolean' }, { name: 'isActive', label: 'Активен', type: 'boolean' },
        { name: 'version', label: 'Версия', type: 'number' }, { name: 'hasServerCode', label: 'Есть серверный код', type: 'boolean' },
        { name: 'tags', label: 'Теги', type: 'json' }, { name: 'createdAt', label: 'Создан', type: 'date' },
        { name: 'updatedAt', label: 'Изменён', type: 'date' }
    ]
}

/**
 * Ровно пять стандартных справочников. bank_accounts намеренно включён:
 * его можно удалить из интерфейса/реестра позже, но базовая синхронизация
 * должна создавать одинаковый набор из пяти записей на каждом предприятии.
 */
export const BASE_DIRECTORY_DEFS = [
    { slug: 'departments', title: 'Сотрудники', codeLabel: 'Табельный номер / ID', titleLabel: 'ФИО сотрудника' },
    { slug: 'counterparties', title: 'Контрагенты', codeLabel: 'ИНН', titleLabel: 'Наименование / ФИО' },
    { slug: 'bank_accounts', title: 'Банковские реквизиты', codeLabel: 'БИК банка', titleLabel: 'Наименование банка' },
    { slug: 'nomenclature', title: 'Номенклатура', codeLabel: 'Артикул / SKU', titleLabel: 'Наименование' },
    { slug: 'glossary', title: 'Глоссарий', codeLabel: 'Аббревиатура', titleLabel: 'Термин' }
] as const

const slugAliases: Record<string, string> = {
    employees: 'departments', staff: 'departments', 'сотрудники': 'departments', 'сотрудники_и_отделы': 'departments',
    'контрагенты': 'counterparties',
    'банковские_счета': 'bank_accounts', 'банковские_реквизиты': 'bank_accounts', bankaccounts: 'bank_accounts',
    'номенклатура': 'nomenclature', 'глоссарий': 'glossary'
}
const titleToSlug: Record<string, string> = {
    'сотрудники': 'departments', 'сотрудники и отделы': 'departments',
    'контрагенты': 'counterparties',
    'банковские счета': 'bank_accounts', 'банковские реквизиты': 'bank_accounts',
    'номенклатура': 'nomenclature', 'глоссарий': 'glossary'
}
const norm = (v: any) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
function canonicalBaseSlug(name: any, title?: any): string | null {
    const raw = norm(name).replace(/^dir_/, '')
    if (BASE_DIRECTORY_DEFS.some(x => x.slug === raw)) return raw
    if (slugAliases[raw]) return slugAliases[raw]
    return titleToSlug[norm(title)] || null
}

function directoryCollection(def: any) {
    return {
        name: String(def.slug),
        title: String(def.title || def.slug),
        strict: false,
        system: 'directoryItems',
        fields: [
            { name: 'title', label: def.titleLabel || 'Наименование', type: 'string', required: true },
            { name: 'code', label: def.codeLabel || 'Код', type: 'string' },
            { name: 'description', label: 'Описание', type: 'text' },
            { name: 'attributes', label: 'Дополнительные поля', type: 'json' },
            { name: 'createdAt', label: 'Создано', type: 'date' },
            { name: 'updatedAt', label: 'Изменено', type: 'date' }
        ]
    }
}

function dedupeCollections(existing: any[], incoming: any[], databaseName: string): any[] {
    const map = new Map<string, any>()
    for (const raw of Array.isArray(existing) ? existing : []) {
        if (!raw?.name) continue
        const name = String(raw.name).trim()
        if (databaseName === DIRECTORIES_DB) {
            // directory_definitions — служебная схема приложения, не пользовательская коллекция Studio.
            if (name === 'directory_definitions' || raw.system === 'directoryDefinitions') continue
            const base = canonicalBaseSlug(name, raw.title)
            const key = base || name.replace(/^dir_/, '')
            if (!key || key === 'directory_definitions') continue
            const prior = map.get(key)
            map.set(key, { ...(prior || {}), ...raw, name: key })
        } else {
            map.set(name, { ...(map.get(name) || {}), ...raw, name })
        }
    }
    for (const raw of incoming) {
        if (!raw?.name) continue
        const name = String(raw.name)
        if (databaseName === DIRECTORIES_DB && (name === 'directory_definitions' || raw.system === 'directoryDefinitions')) continue
        const base = databaseName === DIRECTORIES_DB ? canonicalBaseSlug(name, raw.title) : null
        const key = base || name
        map.set(key, { ...(map.get(key) || {}), ...raw, name: key })
    }
    return [...map.values()]
}

async function ensureStudioDatabase(enterpriseId: string, name: string, title: string, description: string, definitions: any[]): Promise<void> {
    const { MoloDatabase } = tenantModels(enterpriseId)
    const existing: any = await MoloDatabase.findOne({ name }).lean()
    const collections = dedupeCollections(existing?.collections || [], definitions, name)
    if (!existing) {
        await MoloDatabase.create({ enterpriseId, name, title, description, collections, createdBy: { _id: 'system', name: 'system' } })
    } else {
        await MoloDatabase.updateOne(
            { _id: existing._id },
            { $set: { title, description, collections, updatedAt: new Date() } }
        )
    }
    invalidateDefCache(enterpriseId, name)
}

/** Регистрирует один пользовательский справочник как виртуальную коллекцию directories.<slug>. */
export async function ensureDirectoryStudioCollection(enterpriseId: string, slug: string, title?: string, _customFields: any[] = []): Promise<void> {
    const cleanSlug = String(slug || '').trim().toLowerCase()
    if (!/^[a-z][a-z0-9_]{0,48}$/.test(cleanSlug)) return
    // Не позволяем пользовательскому определению создать дубль системного справочника.
    const canonical = canonicalBaseSlug(cleanSlug, title)
    const actualSlug = canonical || cleanSlug
    const base = BASE_DIRECTORY_DEFS.find(x => x.slug === actualSlug)
    await ensureStudioDatabase(
        enterpriseId, DIRECTORIES_DB, 'Справочники', 'Справочники предприятия',
        [directoryCollection({ slug: actualSlug, title: base?.title || title || actualSlug, codeLabel: base?.codeLabel, titleLabel: base?.titleLabel })]
    )
}

export const ensureCompanyDb = async (enterpriseId: string): Promise<void> => {
    const { MoloDatabase, DirectoryDefinition } = tenantModels(enterpriseId)

    const company: any = await MoloDatabase.findOne({ name: COMPANY_DB }).lean()
    if (!company) {
        await MoloDatabase.create({
            enterpriseId, name: COMPANY_DB, title: 'Данные предприятия', description: 'Реквизиты организации',
            collections: [PROFILE_DEF, MODULES_DEF], createdBy: { _id: 'system', name: 'system' }
        })
    } else {
        const cols = new Map<string, any>()
        for (const item of Array.isArray(company.collections) ? company.collections : []) if (item?.name) cols.set(String(item.name), item)
        cols.set(PROFILE_COL, PROFILE_DEF)
        cols.set('modules', MODULES_DEF)
        await MoloDatabase.updateOne({ _id: company._id }, { $set: { collections: [...cols.values()], updatedAt: new Date() } })
    }
    invalidateDefCache(enterpriseId, COMPANY_DB)

    await ensureStudioDatabase(enterpriseId, WORKSPACE_DB, 'Пространство', 'Файлы, папки и история версий документов предприятия', WORKSPACE_DEFS)

    const defs: any[] = await DirectoryDefinition.find().lean()
    const bySlug = new Map<string, any>()
    for (const item of BASE_DIRECTORY_DEFS) bySlug.set(item.slug, item)
    for (const d of defs) {
        const slug = String(d.slug || '').trim().toLowerCase()
        if (!/^[a-z][a-z0-9_]{0,48}$/.test(slug)) continue
        const canonical = canonicalBaseSlug(slug, d.title)
        const key = canonical || slug
        const base = BASE_DIRECTORY_DEFS.find(x => x.slug === key)
        bySlug.set(key, {
            slug: key, title: base?.title || d.title || key,
            codeLabel: base?.codeLabel || d.codeLabel || 'Код',
            titleLabel: base?.titleLabel || d.titleLabel || 'Наименование'
        })
    }

    const directoryDefs = [...bySlug.values()].map(directoryCollection)
    await ensureStudioDatabase(enterpriseId, DIRECTORIES_DB, 'Справочники', 'Справочники предприятия', directoryDefs)
}

export const removeLegacyBankCollection = async (_enterpriseId: string): Promise<number> => 0

const opts = (enterpriseId: string, col: string) => ({ enterpriseId, db: COMPANY_DB, col, actor: SYSTEM_ACTOR })
export const getSelfProfile = async (enterpriseId: string): Promise<any | null> => {
    const res: any = await runDbOp(opts(enterpriseId, PROFILE_COL), { op: 'findOne', filter: { isSelfCompany: true } })
    return res?.item ?? null
}
export const writeSelfProfile = async (enterpriseId: string, profile: Record<string, any>): Promise<void> => {
    const existing = await getSelfProfile(enterpriseId)
    const now = new Date().toISOString()
    if (existing) await runDbOp(opts(enterpriseId, PROFILE_COL), { op: 'update', filter: { _id: existing._id }, patch: { ...profile, isSelfCompany: true, updatedAt: now } })
    else await runDbOp(opts(enterpriseId, PROFILE_COL), { op: 'insert', doc: { ...profile, isSelfCompany: true, createdAt: now } })
}
