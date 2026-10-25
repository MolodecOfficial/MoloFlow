import { getTenantConnection, tenantModels } from '~~/server/utils/tenantDb'
import { modelForCollection } from '~~/server/utils/directoryCollections'
import { Types } from 'mongoose'
import {
    LIMITS,
    MoloDbError,
    flattenRecord,
    validateRecord,
    type CollectionDef,
    type DatabaseDef
} from './schema'
import { buildFilter, buildSearch, buildSort, buildUpdate, clampInt, equalityFields, toObjectId } from './query'

export interface DbActor {
    kind: 'user' | 'module' | 'system'
    id?: string
    role?: string
}

export interface OpContext {
    enterpriseId: string
    db: string
    col: string
    actor: DbActor
}

/** Минимум методов драйвера, который нам нужен (позволяет подменять хранилище в тестах). */
export interface RecordsCollection {
    find(filter: any): { sort(s: any): any; skip(n: number): any; limit(n: number): any; toArray(): Promise<any[]> }
    findOne(filter: any, opts?: any): Promise<any | null>
    insertOne(doc: any): Promise<any>
    insertMany(docs: any[]): Promise<any>
    updateOne(filter: any, update: any): Promise<{ matchedCount: number; modifiedCount: number }>
    updateMany(filter: any, update: any): Promise<{ matchedCount: number; modifiedCount: number }>
    deleteOne(filter: any): Promise<{ deletedCount: number }>
    deleteMany(filter: any): Promise<{ deletedCount: number }>
    countDocuments(filter: any, opts?: any): Promise<number>
}

export interface StoreDeps {
    records: (enterpriseId: string) => Promise<RecordsCollection>
    loadDef: (enterpriseId: string, db: string) => Promise<DatabaseDef | null>
}

const READ_OPS = new Set(['find', 'findOne', 'get', 'count'])
const WRITE_OPS = new Set(['insert', 'insertMany', 'update', 'delete'])
const ADMIN_ROLE = 'Администратор'

// ──────────────────────────────────────────────────────────────
// Подключение к Mongo (лениво, чтобы файл можно было импортировать без БД)
// ──────────────────────────────────────────────────────────────

const recordsCache = new Map<string, Promise<RecordsCollection>>()

async function defaultRecords(enterpriseId: string): Promise<RecordsCollection> {
    const cached = recordsCache.get(enterpriseId)
    if (cached) return cached
    const p = (async () => {
        const db = getTenantConnection(enterpriseId).db
        if (!db) throw new MoloDbError('MongoDB ещё не подключена', 503)
        const col = db.collection('molo_records')
        await col.createIndex({ db: 1, col: 1, createdAt: -1 }, { name: 'molo_scope_created' })
        await col.createIndex({ expireAt: 1 }, { name: 'molo_ttl', expireAfterSeconds: 0 })
        return col as unknown as RecordsCollection
    })().catch((e) => {
        recordsCache.delete(enterpriseId)
        throw e
    })
    recordsCache.set(enterpriseId, p)
    return p
}

const DEF_TTL_MS = 15_000
const defCache = new Map<string, { at: number; def: DatabaseDef | null }>()

export function invalidateDefCache(enterpriseId: string, db?: string) {
    if (db) defCache.delete(`${enterpriseId}:${db}`)
    else for (const k of defCache.keys()) if (k.startsWith(`${enterpriseId}:`)) defCache.delete(k)
}

async function defaultLoadDef(enterpriseId: string, db: string): Promise<DatabaseDef | null> {
    const key = `${enterpriseId}:${db}`
    const hit = defCache.get(key)
    if (hit && Date.now() - hit.at < DEF_TTL_MS) return hit.def

    const { MoloDatabase } = tenantModels(enterpriseId)
    const doc: any = await MoloDatabase.findOne({ name: db }).lean()
    const def: DatabaseDef | null = doc
        ? { name: doc.name, title: doc.title, description: doc.description, collections: doc.collections || [] }
        : null
    defCache.set(key, { at: Date.now(), def })
    return def
}

const defaultDeps: StoreDeps = { records: defaultRecords, loadDef: defaultLoadDef }

// ──────────────────────────────────────────────────────────────
// Вспомогательное
// ──────────────────────────────────────────────────────────────

function assertAccess(coll: CollectionDef, actor: DbActor, kind: 'read' | 'write') {
    if (actor.kind !== 'user' || actor.role === ADMIN_ROLE) return
    const allowed = coll.access?.[kind] || []
    if (allowed.length && !allowed.includes(actor.role || '')) {
        throw new MoloDbError(
            `Нет доступа на ${kind === 'read' ? 'чтение' : 'запись'} в коллекцию «${coll.title || coll.name}»`,
            403
        )
    }
}

function idOrFilter(coll: CollectionDef, body: any): Record<string, any> {
    if (body.id !== undefined && body.id !== null && body.id !== '') return { _id: toObjectId(body.id) }
    return buildFilter(coll, body.filter)
}

async function checkUnique(
    records: RecordsCollection,
    base: Record<string, any>,
    coll: CollectionDef,
    data: Record<string, any>,
    excludeId?: Types.ObjectId
) {
    for (const f of coll.fields) {
        if (!f.unique || data[f.name] === undefined || data[f.name] === null) continue
        const q: Record<string, any> = { ...base, [`data.${f.name}`]: data[f.name] }
        if (excludeId) q._id = { $ne: excludeId }
        if ((await records.countDocuments(q, { limit: 1 })) > 0) {
            throw new MoloDbError(`Значение поля «${f.label || f.name}» уже используется`, 409)
        }
    }
}

function maxDocsOf(coll: CollectionDef) {
    return Math.min(coll.maxDocs ?? LIMITS.defaultMaxDocs, LIMITS.hardMaxDocs)
}

async function insertRecords(
    records: RecordsCollection,
    ctx: OpContext,
    coll: CollectionDef,
    inputs: any[]
): Promise<any[]> {
    if (!inputs.length) return []
    if (inputs.length > LIMITS.batch) throw new MoloDbError(`За один раз можно добавить не больше ${LIMITS.batch} записей`)

    const prepared = inputs.map((doc, i) => {
        const { data, errors } = validateRecord(coll, doc)
        if (errors.length) throw new MoloDbError(inputs.length > 1 ? `Запись ${i + 1}: ${errors[0]}` : errors.slice(0, 3).join('; '))
        return data
    })

    // уникальность внутри самой пачки
    for (const f of coll.fields.filter((x) => x.unique)) {
        const seen = new Set<string>()
        for (const d of prepared) {
            if (d[f.name] === undefined || d[f.name] === null) continue
            const k = d[f.name] instanceof Date ? d[f.name].toISOString() : String(d[f.name])
            if (seen.has(k)) throw new MoloDbError(`Значение поля «${f.label || f.name}» повторяется в пачке`, 409)
            seen.add(k)
        }
    }

    const base = { enterpriseId: ctx.enterpriseId, db: ctx.db, col: ctx.col }
    const total = await records.countDocuments(base)
    if (total + prepared.length > maxDocsOf(coll)) {
        throw new MoloDbError(`Достигнут лимит записей в коллекции (${maxDocsOf(coll)})`, 413)
    }
    for (const d of prepared) await checkUnique(records, base, coll, d)

    const now = new Date()
    const docs = prepared.map((data) => ({
        _id: new Types.ObjectId(),
        ...base,
        data,
        createdAt: now,
        updatedAt: now,
        ...(ctx.actor.id ? { createdBy: ctx.actor.id } : {}),
        ...(coll.ttlDays ? { expireAt: new Date(now.getTime() + coll.ttlDays * 86_400_000) } : {})
    }))
    if (docs.length === 1) await records.insertOne(docs[0])
    else await records.insertMany(docs)
    return docs.map(flattenRecord)
}

// ──────────────────────────────────────────────────────────────
// Главная функция
// ──────────────────────────────────────────────────────────────

function moduleRow(doc: any) {
    return {
        _id: String(doc._id),
        name: doc.name || '',
        fileName: doc.fileName || '',
        format: doc.format || '',
        description: doc.description || '',
        isPublic: doc.isPublic === true,
        isActive: doc.isActive !== false,
        version: doc.version || 1,
        hasServerCode: doc.hasServerCode === true,
        tags: doc.tags || [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    }
}

async function readSystemModules(ctx: OpContext, body: any) {
    const { DynamicModule } = tenantModels(ctx.enterpriseId)
    const filter: Record<string, any> = {}
    if (body.id) filter._id = body.id
    else if (body.filter && typeof body.filter === 'object' && !Array.isArray(body.filter)) {
        for (const [key, value] of Object.entries(body.filter)) {
            if (['_id', 'name', 'fileName', 'format', 'isPublic', 'isActive', 'version'].includes(key)) filter[key] = value
        }
    }
    if (body.search) {
        const q = String(body.search).trim().slice(0, 100)
        if (q) {
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.$or = ['name', 'fileName', 'format', 'description', 'tags'].map((key) => ({ [key]: { $regex: escaped, $options: 'i' } }))
        }
    }
    if (body.op === 'count') return { count: await DynamicModule.countDocuments(filter) }
    if (body.op === 'get' || body.op === 'findOne') {
        const doc = body.op === 'get'
            ? await DynamicModule.findById(body.id).lean()
            : await DynamicModule.findOne(filter).sort({ updatedAt: -1 }).lean()
        return { item: doc ? moduleRow(doc) : null }
    }
    if (body.op !== 'find') throw new MoloDbError('Коллекция «modules» доступна только для чтения', 403)
    const limit = clampInt(body.limit, 50, 1, LIMITS.queryLimit)
    const skip = clampInt(body.skip, 0, 0, 100_000)
    const sortRaw = String(body.sort || '-updatedAt')
    const sortKey = sortRaw.startsWith('-') ? sortRaw.slice(1) : sortRaw
    const sortDir = sortRaw.startsWith('-') ? -1 : 1
    const allowedSort = ['name', 'fileName', 'format', 'isPublic', 'isActive', 'version', 'createdAt', 'updatedAt']
    const sort: Record<string, 1 | -1> = { [allowedSort.includes(sortKey) ? sortKey : 'updatedAt']: sortDir as 1 | -1 }
    const [docs, total] = await Promise.all([
        DynamicModule.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        DynamicModule.countDocuments(filter)
    ])
    return { items: docs.map(moduleRow), total, limit, skip }
}

/**
 * Коллекции системных разделов должны читать/писать реальные tenant-коллекции,
 * а не универсальную molo_records. Это обеспечивает одинаковые данные в API
 * пространства/справочников и в MoloDB Studio.
 */
async function runTenantCollectionOp(ctx: OpContext, body: any): Promise<any> {
    const { WorkspaceDocument, WorkspaceFolder, DirectoryDefinition } = tenantModels(ctx.enterpriseId)
    let model: any
    if (ctx.db === 'workspace') {
        if (ctx.col === 'workspace_documents') model = WorkspaceDocument
        else if (ctx.col === 'workspace_folders') model = WorkspaceFolder
        else if (ctx.col === 'workspace_versions') {
            // История версий хранится в ws_<documentId>_versions. В Studio она доступна
            // только для чтения, чтобы не создавать фиктивные записи в molo_records.
            if (['insert', 'insertMany', 'update', 'delete'].includes(String(body?.op))) {
                throw new MoloDbError('История версий создаётся автоматически при сохранении документа', 403)
            }
            const db = getTenantConnection(ctx.enterpriseId).db
            if (!db) throw new MoloDbError('MongoDB ещё не подключена', 503)
            const names = (await db.listCollections({ name: /^ws_.*_versions$/ }, { nameOnly: true }).toArray()).map((x: any) => x.name)
            let items: any[] = []
            for (const name of names) items.push(...await db.collection(name).find({ enterpriseId: ctx.enterpriseId }).toArray())
            const rawFilter = body?.filter && typeof body.filter === 'object' ? body.filter : {}
            items = items.filter((item) => Object.entries(rawFilter).every(([key, value]) => {
                if (key === '_id') return String(item._id) === String(value)
                return (item as any)[key] === value
            }))
            if (body?.op === 'count') return { count: items.length }
            if (body?.op === 'get' || body?.op === 'findOne') {
                const found = body?.id ? items.find((item) => String(item._id) === String(body.id)) : items[0]
                return { item: found || null }
            }
            if (body?.op === 'find') {
                const sortText = String(body.sort || '-createdAt')
                const desc = sortText.startsWith('-')
                const key = desc ? sortText.slice(1) : sortText
                items.sort((a, b) => {
                    const av = (a as any)[key], bv = (b as any)[key]
                    const cmp = av instanceof Date || bv instanceof Date ? new Date(av).getTime() - new Date(bv).getTime() : String(av ?? '').localeCompare(String(bv ?? ''))
                    return desc ? -cmp : cmp
                })
                const skip = clampInt(body.skip, 0, 0, 100_000)
                const limit = clampInt(body.limit, 50, 1, LIMITS.queryLimit)
                const page = items.slice(skip, skip + limit)
                return { items: page, limit, skip, ...(body.withTotal === false ? {} : { total: items.length }) }
            }
            throw new MoloDbError(`Неизвестная операция «${body?.op}»`)
        } else return null
    } else if (ctx.db === 'directories') {
        if (ctx.col === 'directory_definitions') model = DirectoryDefinition
        else if (/^dir_[\p{L}\p{N}_-]+$/u.test(ctx.col)) model = modelForCollection(ctx.enterpriseId, ctx.col)
        else return null
    } else return null

    const op = body?.op
    const idFilter = (value: any) => {
        if (value === undefined || value === null || value === '') return undefined
        return Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : value
    }
    const normalizeFilter = (input: any): Record<string, any> => {
        if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
        const out: Record<string, any> = {}
        for (const [key, value] of Object.entries(input)) {
            if (key === 'enterpriseId' || key === 'createdBy') continue
            if (key === '_id') out._id = idFilter(value)
            else out[key] = value
        }
        return out
    }
    const scope = { enterpriseId: ctx.enterpriseId }
    const filter = { ...scope, ...normalizeFilter(body.filter) }
    const cleanDoc = (input: any) => {
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MoloDbError('doc должен быть объектом')
        const doc = { ...input }
        delete doc._id
        delete doc.enterpriseId
        delete doc.createdBy
        if (ctx.db === 'workspace' && ctx.col === 'workspace_documents') {
            doc.type = doc.type || 'primary'
            doc.content = doc.content ?? ''
            doc.nameLower = String(doc.nameLower ?? doc.name ?? '').toLowerCase()
            doc.size = Number(doc.size ?? (typeof doc.content === 'string' ? Buffer.byteLength(doc.content) : 0))
        }
        if (ctx.db === 'directories' && ctx.col.startsWith('dir_')) {
            doc.directorySlug = doc.directorySlug || ctx.col.slice(4)
            doc.attributes = doc.attributes && typeof doc.attributes === 'object' ? doc.attributes : {}
        }
        return { ...doc, enterpriseId: ctx.enterpriseId }
    }
    const plain = (value: any) => value ? (typeof value.toObject === 'function' ? value.toObject() : value) : null
    const limit = clampInt(body.limit, 50, 1, LIMITS.queryLimit)
    const skip = clampInt(body.skip, 0, 0, 100_000)

    switch (op) {
        case 'find': {
            const sortText = String(body.sort || '-updatedAt')
            const desc = sortText.startsWith('-')
            const key = desc ? sortText.slice(1) : sortText
            const sort: Record<string, 1 | -1> = { [key || 'updatedAt']: desc ? -1 : 1 }
            const [items, total] = await Promise.all([
                model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
                body.withTotal === false ? Promise.resolve(undefined) : model.countDocuments(filter)
            ])
            return { items, limit, skip, ...(total === undefined ? {} : { total }) }
        }
        case 'findOne': {
            const item = await model.findOne(filter).sort({ updatedAt: -1, createdAt: -1 }).lean()
            return { item: item || null }
        }
        case 'get': {
            const id = idFilter(body.id)
            if (!id) throw new MoloDbError('Некорректный ID записи')
            return { item: await model.findOne({ ...scope, _id: id }).lean() }
        }
        case 'count': return { count: await model.countDocuments(filter) }
        case 'insert': {
            const item = await model.create(cleanDoc(body.doc))
            return { item: plain(item) }
        }
        case 'insertMany': {
            if (!Array.isArray(body.docs)) throw new MoloDbError('docs должен быть массивом')
            if (body.docs.length > LIMITS.batch) throw new MoloDbError(`За один раз можно добавить не больше ${LIMITS.batch} записей`)
            const items = body.docs.map(cleanDoc)
            return { items: (await model.insertMany(items)).map(plain) }
        }
        case 'update': {
            const targetFilter = body.id ? { _id: idFilter(body.id) } : normalizeFilter(body.filter)
            if (!Object.keys(targetFilter).length) throw new MoloDbError('Для изменения записи укажите id или filter')
            const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch) ? { ...body.patch } : {}
            for (const protectedKey of ['_id', 'enterpriseId', 'createdBy']) delete patch[protectedKey]
            if (body.many) {
                const result = await model.updateMany({ ...scope, ...targetFilter }, { $set: { ...patch, updatedAt: new Date() } })
                return { matched: result.matchedCount, modified: result.modifiedCount }
            }
            const item = await model.findOneAndUpdate(
                { ...scope, ...targetFilter },
                { $set: { ...patch, updatedAt: new Date() } },
                { new: true, runValidators: true }
            ).lean()
            return { matched: item ? 1 : 0, modified: item ? 1 : 0, item: item || null }
        }
        case 'delete': {
            const targetFilter = body.id ? { _id: idFilter(body.id) } : normalizeFilter(body.filter)
            if (!Object.keys(targetFilter).length && body.all !== true) throw new MoloDbError('Для удаления укажите id/filter или all: true')
            const result = body.many || body.all
                ? await model.deleteMany({ ...scope, ...targetFilter })
                : await model.deleteOne({ ...scope, ...targetFilter })
            return { deleted: result.deletedCount || 0 }
        }
        default: return null
    }
}

export async function runDbOp(ctx: OpContext, body: any, deps: StoreDeps = defaultDeps): Promise<any> {
    const op = body?.op
    if (!READ_OPS.has(op) && !WRITE_OPS.has(op)) throw new MoloDbError(`Неизвестная операция «${op}»`)

    const tenantResult = await runTenantCollectionOp(ctx, body)
    if (tenantResult !== null) return tenantResult

    // MoloDB Studio показывает системные модули из настоящей коллекции `modules`,
    // а не из molo_records. Изменение модулей остаётся за API редактора модулей.
    if (ctx.db === 'company' && ctx.col === 'modules') return readSystemModules(ctx, body)

    const def = await deps.loadDef(ctx.enterpriseId, ctx.db)
    if (!def) throw new MoloDbError(`База «${ctx.db}» не найдена`, 404)
    const coll = def.collections.find((c) => c.name === ctx.col)
    if (!coll) throw new MoloDbError(`Коллекция «${ctx.col}» не найдена в базе «${ctx.db}»`, 404)

    assertAccess(coll, ctx.actor, READ_OPS.has(op) ? 'read' : 'write')

    const records = await deps.records(ctx.enterpriseId)
    const base = { enterpriseId: ctx.enterpriseId, db: ctx.db, col: ctx.col }

    const scoped = (filter: Record<string, any>, search?: any) => {
        const q: Record<string, any> = { ...base, ...filter }
        const s = buildSearch(coll, search)
        if (s) q.$and = [...(q.$and || []), s]
        return q
    }

    switch (op) {
        case 'find': {
            const limit = clampInt(body.limit, 50, 1, LIMITS.queryLimit)
            const skip = clampInt(body.skip, 0, 0, 100_000)
            const query = scoped(buildFilter(coll, body.filter), body.search)
            const docs = await records.find(query).sort(buildSort(coll, body.sort)).skip(skip).limit(limit).toArray()
            const out: Record<string, any> = { items: docs.map(flattenRecord), limit, skip }
            if (body.withTotal !== false) out.total = await records.countDocuments(query)
            return out
        }

        case 'findOne': {
            const query = scoped(buildFilter(coll, body.filter), body.search)
            const docs = await records.find(query).sort(buildSort(coll, body.sort)).skip(0).limit(1).toArray()
            return { item: docs[0] ? flattenRecord(docs[0]) : null }
        }

        case 'get': {
            const doc = await records.findOne({ ...base, _id: toObjectId(body.id) })
            return { item: doc ? flattenRecord(doc) : null }
        }

        case 'count':
            return { count: await records.countDocuments(scoped(buildFilter(coll, body.filter), body.search)) }

        case 'insert': {
            const [item] = await insertRecords(records, ctx, coll, [body.doc])
            return { item }
        }

        case 'insertMany': {
            if (!Array.isArray(body.docs)) throw new MoloDbError('docs должен быть массивом')
            return { items: await insertRecords(records, ctx, coll, body.docs) }
        }

        case 'update': {
            const filter = idOrFilter(coll, body)
            const query = { ...base, ...filter }
            const { update, touched } = buildUpdate(coll, body)
            const touchesUnique = coll.fields.some((f) => f.unique && touched.includes(f.name))

            if (body.many) {
                if (body.upsert) throw new MoloDbError('upsert нельзя сочетать с many')
                if (touchesUnique) throw new MoloDbError('Уникальные поля нельзя менять сразу у нескольких записей')
                const res = await records.updateMany(query, update)
                return { matched: res.matchedCount, modified: res.modifiedCount }
            }

            const target = await records.findOne(query, { sort: { createdAt: -1, _id: -1 } })
            if (!target) {
                if (!body.upsert) return { matched: 0, modified: 0 }
                const data: Record<string, any> = { ...equalityFields(coll, body.filter), ...(body.patch || {}) }
                for (const [k, n] of Object.entries(body.inc || {})) data[k] = ((data[k] as number) || 0) + (n as number)
                const [item] = await insertRecords(records, ctx, coll, [data])
                return { matched: 0, modified: 0, upserted: true, item }
            }

            if (touchesUnique) {
                const { data } = validateRecord(coll, body.patch ?? {}, { partial: true })
                await checkUnique(records, base, coll, data, target._id)
            }
            const res = await records.updateOne({ _id: target._id }, update)
            const fresh = await records.findOne({ _id: target._id })
            return { matched: res.matchedCount, modified: res.modifiedCount, item: fresh ? flattenRecord(fresh) : null }
        }

        case 'delete': {
            const filter = idOrFilter(coll, body)
            const query = { ...base, ...filter }
            if (body.many) {
                if (!Object.keys(filter).length && body.all !== true) {
                    throw new MoloDbError('Пустой фильтр удалит все записи. Передайте all: true, если это нужно')
                }
                const res = await records.deleteMany(query)
                return { deleted: res.deletedCount }
            }
            const target = await records.findOne(query, { sort: { createdAt: -1, _id: -1 } })
            if (!target) return { deleted: 0 }
            const res = await records.deleteOne({ _id: target._id })
            return { deleted: res.deletedCount }
        }
    }
}

/** Удаление всех записей базы или отдельных коллекций (при изменении/удалении схемы). */
export async function purgeRecords(enterpriseId: string, db: string, cols?: string[], deps: StoreDeps = defaultDeps) {
    const records = await deps.records(enterpriseId)
    const q: Record<string, any> = { enterpriseId, db }
    if (cols) q.col = { $in: cols }
    const res = await records.deleteMany(q)
    return res.deletedCount
}