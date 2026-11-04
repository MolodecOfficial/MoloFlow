import { tenantModels, getTenantConnection } from './tenantDb'

export function versionModel(enterpriseId: string, _docId?: unknown): any {
    return tenantModels(enterpriseId).WorkspaceDocumentVersion
}

export async function ensureDocumentCollection(_enterpriseId: string, _docId: unknown): Promise<void> {}

export async function dropDocumentCollection(enterpriseId: string, docId: unknown): Promise<void> {
    const { WorkspaceDocumentVersion } = tenantModels(enterpriseId)
    await WorkspaceDocumentVersion.deleteMany({ documentId: docId })
}

export async function cleanupAndMigrateLegacyWsCollections(enterpriseId: string): Promise<number> {
    const conn = getTenantConnection(enterpriseId)
    const db = conn.db
    if (!db) return 0

    const wsCols = await db.listCollections({ name: /^ws_.*_versions$/ }, { nameOnly: true }).toArray()
    if (!wsCols.length) return 0

    const targetCol = db.collection('workspace_versions')
    let movedTotal = 0

    for (const col of wsCols) {
        const docs = await db.collection(col.name).find({}).toArray()
        if (docs.length > 0) {
            try {
                await targetCol.insertMany(docs, { ordered: false })
                movedTotal += docs.length
            } catch (e: any) {}
        }
        await db.dropCollection(col.name).catch(() => {})
    }

    return movedTotal
}

export const migrateDocumentVersions = cleanupAndMigrateLegacyWsCollections
