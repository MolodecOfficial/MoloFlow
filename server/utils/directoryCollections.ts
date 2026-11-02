import { tenantModels, getTenantConnection } from './tenantDb'

export const SYSTEM_SLUGS = ['departments', 'counterparties', 'bank_accounts', 'nomenclature', 'glossary']

export function directoryModel(enterpriseId: string, _slug?: string): any { return tenantModels(enterpriseId).DirectoryItem }
export function modelForCollection(enterpriseId: string, _colName?: string): any { return tenantModels(enterpriseId).DirectoryItem }
export async function ensureDirectoryCollection(_enterpriseId: string, _slug: string): Promise<string> { return 'directory_items' }
export async function listDirectoryCollections(_enterpriseId: string): Promise<string[]> { return ['directory_items'] }
export async function ensureAllDirectoryCollections(_enterpriseId: string): Promise<string[]> { return ['directory_items'] }
export async function allDirectoryModels(enterpriseId: string): Promise<any[]> { return [tenantModels(enterpriseId).DirectoryItem] }
export const slugToCollection = (slug: string) => String(slug || '').trim().toLowerCase()

/** Safe migration of legacy dir_* collections. The source is dropped only after all upserts succeed. */
export async function migrateDirectoryItems(enterpriseId: string): Promise<Array<{ slug: string; moved: number }>> {
    const db = getTenantConnection(enterpriseId).db
    if (!db) return []
    const oldCols = await db.listCollections({ name: /^dir_/ }).toArray()
    const target = db.collection('directory_items')
    const report: Array<{ slug: string; moved: number }> = []
    for (const c of oldCols) {
        const slug = c.name.replace(/^dir_/, '')
        const source = db.collection(c.name)
        const docs = await source.find({}).toArray()
        let moved = 0
        if (docs.length) {
            const operations = docs.map((doc: any) => {
                const clean = { ...doc, enterpriseId: doc.enterpriseId || enterpriseId, directorySlug: doc.directorySlug || slug }
                delete clean._id
                return { updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: { _id: doc._id, ...clean } }, upsert: true } }
            })
            const result = await target.bulkWrite(operations, { ordered: false })
            moved = result.upsertedCount || 0
        }
        await db.dropCollection(c.name)
        report.push({ slug, moved })
    }
    return report
}
