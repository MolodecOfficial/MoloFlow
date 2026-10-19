// server/utils/enterpriseDb.ts
// Локальная база предприятия «company»: в ней лежат реквизиты (profile) и модули предприятия (modules).
// Все места, которые пишут или читают эти данные, работают через этот файл.
import { MoloDatabase } from '~~/server/models/moloDatabase.model'
import { invalidateDefCache } from '~~/server/utils/moloDb/store'

export const COMPANY_DB = 'company'
export const PROFILE_COL = 'profile'
export const MODULES_COL = 'modules'

// Раньше модули лежали в отдельных базах 'modules' и 'modules_store'. Их переносим в company/modules.
const LEGACY_MODULE_DBS = ['modules', 'modules_store']

export const PROFILE_COLLECTION = {
    name: PROFILE_COL,
    title: 'Реквизиты',
    strict: false,
    fields: [
        { name: 'inn', label: 'ИНН', type: 'string', required: true },
        { name: 'enterpriseName', label: 'Наименование', type: 'string', required: true },
        { name: 'director', label: 'Руководитель', type: 'string' },
        { name: 'legalAddress', label: 'Юридический адрес', type: 'string' }
    ]
}

export const MODULES_COLLECTION = {
    name: MODULES_COL,
    title: 'Модули предприятия',
    strict: false,
    fields: [
        { name: 'name', label: 'Название', type: 'string', required: true },
        { name: 'fileName', label: 'Имя файла', type: 'string', required: true },
        { name: 'format', label: 'Формат', type: 'string', required: true },
        { name: 'code', label: 'Код', type: 'text' }
    ]
}

const migrated = new Set<string>()

/** Переносит модули из старых баз в company/modules. Выполняется один раз на процесс, повторно безопасно. */
async function migrateLegacyModules(enterpriseId: string) {
    if (migrated.has(enterpriseId)) return
    migrated.add(enterpriseId)

    const { default: mongoose } = await import('mongoose')
    const db = mongoose.connection.db
    if (!db) return

    await db.collection('molo_records').updateMany(
        { enterpriseId, db: { $in: LEGACY_MODULE_DBS }, col: 'installed' },
        { $set: { db: COMPANY_DB, col: MODULES_COL } }
    )
    await MoloDatabase.deleteMany({ enterpriseId, name: { $in: LEGACY_MODULE_DBS } })
    invalidateDefCache(enterpriseId)
}

/**
 * Гарантирует, что у предприятия есть база company с коллекциями profile и modules.
 * Создаёт базу, если её нет, и добавляет недостающие коллекции в старые базы.
 */
export async function ensureCompanyDb(enterpriseId: string) {
    const db: any = await MoloDatabase.findOne({ enterpriseId, name: COMPANY_DB })

    if (!db) {
        await MoloDatabase.create({
            enterpriseId,
            name: COMPANY_DB,
            title: 'Данные предприятия',
            description: 'Реквизиты, модули и прочие данные предприятия',
            collections: [PROFILE_COLLECTION, MODULES_COLLECTION],
            createdBy: { _id: 'system', name: 'System Auto-provision' }
        })
    } else {
        const have = new Set((db.collections || []).map((c: any) => c.name))
        const missing = [PROFILE_COLLECTION, MODULES_COLLECTION].filter((c) => !have.has(c.name))
        if (missing.length) {
            db.collections = [...(db.collections || []), ...missing]
            db.markModified('collections')
            await db.save()
        }
    }

    invalidateDefCache(enterpriseId, COMPANY_DB)
    await migrateLegacyModules(enterpriseId)
}