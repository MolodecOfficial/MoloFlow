// server/utils/moloDb/systemModules.ts
// Коллекция «modules» в MoloDB Studio — это реальные модули предприятия.
// Чтение, редактирование и удаление идут через функции редактора модулей,
// поэтому права проверяются там же: администратор, управляющий и автор.
import { createError, type H3Event } from 'h3'
import { tenantModels } from '~~/server/utils/tenantDb'
import { toClientModule, updateModule, removeModule, isOid } from '~~/server/utils/modules'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const clamp = (v: any, def: number, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), min), max) : def
}
const bad = (message: string, statusCode = 400) => createError({ statusCode, message })

export async function runModulesOp(event: H3Event, enterpriseId: string, body: any): Promise<any> {
    const op = body?.op
    const { DynamicModule } = tenantModels(enterpriseId)

    switch (op) {
        case 'find': {
            const limit = clamp(body.limit, 50, 1, 500)
            const skip = clamp(body.skip, 0, 0, 100_000)
            const filter: Record<string, any> = {}
            const q = typeof body.search === 'string' ? body.search.trim().slice(0, 100) : ''
            if (q) {
                const rx = { $regex: esc(q), $options: 'i' }
                filter.$or = [{ name: rx }, { fileName: rx }, { description: rx }]
            }
            const [docs, total] = await Promise.all([
                DynamicModule.find(filter).select('-clientBundle').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
                DynamicModule.countDocuments(filter)
            ])
            return { items: docs.map((d: any) => toClientModule(d)), total, limit, skip }
        }

        case 'findOne':
        case 'get': {
            const id = body.id ?? body.filter?._id
            const doc: any = isOid(id) ? await DynamicModule.findById(id).select('-clientBundle').lean() : null
            return { item: doc ? toClientModule(doc) : null }
        }

        case 'count':
            return { count: await DynamicModule.countDocuments({}) }

        case 'update': {
            if (!isOid(body.id)) throw bad('Для изменения модуля укажите id')
            const doc = await updateModule(event, enterpriseId, body.id, body.patch || {})
            return { matched: 1, modified: 1, item: toClientModule(doc) }
        }

        case 'delete': {
            if (!isOid(body.id)) throw bad('Для удаления модуля укажите id (массовое удаление модулей не поддерживается)')
            await removeModule(event, enterpriseId, body.id)
            return { deleted: 1 }
        }

        case 'insert':
        case 'insertMany':
            throw bad('Модули создаются в редакторе модулей, а не в MoloDB Studio')

        default:
            throw bad(`Операция «${op}» для модулей не поддерживается`)
    }
}
