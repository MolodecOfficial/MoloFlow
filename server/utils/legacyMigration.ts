// server/utils/legacyMigration.ts
// Переносит данные предприятия из старых общих коллекций в его базу (molo_ent_<id>)
// и переименовывает уже перенесённые коллекции в новые имена.
// Существующие записи не перезаписываются, можно запускать повторно. Общие коллекции не удаляются.
import mongoose from 'mongoose'
import { getTenantConnection } from './tenantDb'
import { syncCatalog } from './modules'
import { ensureCompanyDb } from './enterpriseDb'

// [старое имя в общей базе, новое имя в базе предприятия]
const SCOPED: Array<[string, string]> = [
    ['dynamicmodules', 'modules'],
    ['departments', 'directory_departments'],
    ['directoryitems', 'directory_items'],
    ['directorydefinitions', 'directory_definitions'],
    ['workspacefolders', 'workspace_folders'],
    ['workspacedocuments', 'workspace_documents'],
    ['workspacedocumentversions', 'workspace_versions'],
    ['molodatabases', 'molodatabases'],
    ['moloendpoints', 'moloendpoints'],
    ['molo_records', 'molo_records']
]

const RENAMES: Array<[string, string]> = SCOPED.filter(([from, to]) => from !== to)

export interface MigrationReport {
    collection: string
    copied: number
    skipped: number
}

const exists = async (db: any, name: string) => (await db.listCollections({ name }).toArray()).length > 0

export async function migrateLegacyData(enterpriseId: string): Promise<MigrationReport[]> {
    const id = String(enterpriseId)
    const main = mongoose.connection.db!
    const tenant = getTenantConnection(id).db!
    const oid = mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null
    const report: MigrationReport[] = []

    await ensureCompanyDb(id)

    // 1. Переименовываем старые коллекции предприятия (если новое имя свободно)
    for (const [from, to] of RENAMES) {
        if ((await exists(tenant, from)) && !(await exists(tenant, to))) {
            await tenant.collection(from).rename(to)
            report.push({ collection: `переименована ${from} → ${to}`, copied: 0, skipped: 0 })
        }
    }

    const copyDocs = async (name: string, docs: any[]) => {
        if (!docs.length) return
        let skipped = 0
        try {
            await tenant.collection(name).insertMany(docs, { ordered: false })
        } catch (e: any) {
            const errs: any[] = Array.isArray(e?.writeErrors) ? e.writeErrors : []
            if (!errs.length || errs.some((w) => w.code !== 11000)) throw e
            skipped = errs.length
        }
        report.push({ collection: name, copied: docs.length - skipped, skipped })
    }

    // 2. Данные из общих коллекций с полем enterpriseId
    for (const [legacy, target] of SCOPED) {
        const docs = await main.collection(legacy)
            .find({ enterpriseId: { $in: oid ? [id, oid] : [id] } })
            .toArray()
        await copyDocs(target, docs.map((d) => ({ ...d, enterpriseId: id })))
    }

    // 3. Меню: раньше было общим для всех предприятий
    const menus = await main.collection('menus').find({}).toArray()
    await copyDocs('menus', menus.map((d) => ({ ...d, enterpriseId: id })))

    // 4. Публичные модули — в глобальный каталог
    const publicModules = await tenant.collection('modules').find({ isPublic: true }).toArray()
    for (const m of publicModules) await syncCatalog(id, m)

    return report
}
