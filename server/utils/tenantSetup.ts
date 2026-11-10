// server/utils/tenantSetup.ts
// Проверяет и создаёт ВСЕ коллекции предприятия: модули, справочники, пространство, меню, реквизиты.
import { TENANT_MODELS, type TenantModelName } from '~~/server/models/tenantSchemas'
import { tenantModels, getTenantConnection } from './tenantDb'
import { ensureCompanyDb, removeLegacyBankCollection } from './enterpriseDb'
import { ensureAllDirectoryCollections } from './directoryCollections'

export interface CollectionStatus {
    collection: string
    status: 'создана' | 'уже есть'
    documents: number
}

// Базовые физические коллекции создаются при регистрации предприятия,
// а не только после первого действия пользователя в соответствующем разделе.
const EXTRA_COLLECTIONS = [
    'molo_records',
    'workspace_documents',
    'workspace_folders',
    'workspace_versions',
    'directory_definitions',
    'directory_items',
    'directory_departments'
] // служебные данные MoloDB, пространство и справочники

export async function ensureTenantStructure(enterpriseId: string) {
    await ensureCompanyDb(enterpriseId)
    // При создании/синхронизации предприятия гарантируем физические коллекции справочников.
    await ensureAllDirectoryCollections(enterpriseId)
    const bankRemoved = await removeLegacyBankCollection(enterpriseId)

    const models = tenantModels(enterpriseId)
    const db = getTenantConnection(enterpriseId).db!
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c: any) => c.name))

    const names: string[] = []
    for (const name of Object.keys(TENANT_MODELS) as TenantModelName[]) {
        const model: any = models[name]
        names.push(model.collection.name)
    }
    names.push(...EXTRA_COLLECTIONS)

    const collections: CollectionStatus[] = []
    for (const colName of names) {
        const had = existing.has(colName)
        if (!had) {
            try {
                await db.createCollection(colName)
            } catch (e: any) {
                if (e?.code !== 48) throw e // 48 = коллекция уже существует
            }
        }
        // Индексы моделей (для molo_records индексы создаёт store)
        const model: any = Object.values(models).find((m: any) => m.collection.name === colName)
        if (model) await model.init()
        const documents = await db.collection(colName).estimatedDocumentCount()
        collections.push({ collection: colName, status: had ? 'уже есть' : 'создана', documents })
    }

    return { collections, bankRemoved }
}
