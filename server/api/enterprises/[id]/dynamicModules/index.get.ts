// server/api/enterprises/[id]/dynamicModules/index.get.ts
// Источник списка — локальная база предприятия (company / modules), а не общий каталог.
// Так видны и публичные, и приватные модули.
import { getQuery, getRequestURL, createError, defineEventHandler } from 'h3'
import { runDbOp } from '~~/server/utils/moloDb/store'
import { ensureCompanyDb, COMPANY_DB, MODULES_COL } from '~~/server/utils/enterpriseDb'
import { toHttpError } from '~~/server/utils/moloDb/access'

export default defineEventHandler(async (event) => {
    try {
        const url = getRequestURL(event)
        const match = url.pathname.match(/enterprises\/([^/]+)\/dynamicModules/)
        const enterpriseId = match?.[1] || (getQuery(event).enterpriseId as string)

        if (!enterpriseId) {
            throw createError({ statusCode: 400, message: 'Enterprise ID is required' })
        }

        const q = getQuery(event)
        const isMinimal = q.minimal === '1' || q.minimal === 'true'

        await ensureCompanyDb(enterpriseId)

        const { items } = await runDbOp(
            { enterpriseId, db: COMPANY_DB, col: MODULES_COL, actor: { kind: 'system' } },
            { op: 'find', filter: {}, limit: 500, withTotal: false }
        )

        const modules = (items as any[])
            .filter((r) => r.isActive !== false)
            .map((r) => {
                // _id для клиента — тот самый moduleId, который использует меню и редактор
                const base = {
                    _id: r.moduleId || r._id,
                    moduleId: r.moduleId || r._id,
                    name: r.name,
                    fileName: r.fileName,
                    format: r.format,
                    description: r.description || '',
                    isPublic: r.isPublic === true,
                    isActive: true
                }
                if (isMinimal) return base
                return {
                    ...r,
                    ...base,
                    code: r.code || '',
                    files: r.files || [],
                    dependencies: r.dependencies || {},
                    devDependencies: r.devDependencies || {}
                }
            })

        return { success: true, modules }
    } catch (e: any) {
        throw toHttpError(e)
    }
})