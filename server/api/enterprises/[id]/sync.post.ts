// POST /api/enterprises/:id/sync
// Проверяет и создаёт все коллекции предприятия (включая коллекции справочников),
// переносит старые данные, пересобирает системные записи.
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { migrateLegacyData } from '~~/server/utils/legacyMigration'
import { ensureTenantStructure } from '~~/server/utils/tenantSetup'
import { rebuildSystemDirectories } from '~~/server/utils/enterpriseRegistry'
import { ensureAllDirectoryCollections, migrateDirectoryItems } from '~~/server/utils/directoryCollections'
import { migrateDocumentVersions } from '~~/server/utils/workspaceCollections'
import { invalidateDefCache } from '~~/server/utils/moloDb/store'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw createError({ statusCode: 400, message: 'Не указано предприятие' })
        await resolveActor(event, enterpriseId, 'schema')

        const migrated = await migrateLegacyData(enterpriseId)
        const structure = await ensureTenantStructure(enterpriseId)
        const dirMoved = await migrateDirectoryItems(enterpriseId)
        const versionsMoved = await migrateDocumentVersions(enterpriseId)
        const dirCollections = await ensureAllDirectoryCollections(enterpriseId)
        const stats = await rebuildSystemDirectories(enterpriseId)
        invalidateDefCache(enterpriseId)

        const copied = migrated.reduce((sum, r) => sum + r.copied, 0)
        const moved = dirMoved.reduce((sum, r) => sum + r.moved, 0)
        return {
            success: true,
            message:
                `Структура проверена. Коллекций предприятия: ${structure.collections.length}, ` +
                `коллекций справочников: ${dirCollections.length}. Перенесено записей: ${copied + moved}. Сотрудников: ${stats.staff}.`,
            collections: structure.collections,
            directoryCollections: dirCollections,
            migrated,
            directoryMoved: dirMoved,
            bankRemoved: structure.bankRemoved,
            ...stats
        }
    } catch (e) {
        throw toHttpError(e)
    }
})
