// server/utils/moloDb/store.ts
//
// Единая точка выполнения операций над данными мини-баз. Её используют:
//   • HTTP-эндпоинт  /api/enterprises/[id]/moloDb/[db]/[col]  (интерфейс, клиентские модули, Python)
//   • песочница серверных модулей  (db внутри server-файла) — без HTTP, напрямую
// Все записи живут в ОДНОЙ коллекции Mongo (molo_records) и отделены полями
// enterpriseId + db + col, поэтому нет динамических моделей, лишних индексов и
// ограничения Mongo в 64 индекса на коллекцию.
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
    records: () => Promise<RecordsCollection>
    loadDef: (enterpriseId: string, db: string) => Promise<DatabaseDef | null>
}

const READ_OPS = new Set(['find', 'findOne', 'get', 'count'])
const WRITE_OPS = new Set(['insert', 'insertMany', 'update', 'delete'])
const ADMIN_ROLE = 'Администратор'

// ──────────────────────────────────────────────────────────────
// Подключение к Mongo (лениво, чтобы файл можно было импортировать без БД)
// ──────────────────────────────────────────────────────────────

let recordsReady: Promise<RecordsCollection> | null = null

async function defaultRecords(): Promise<RecordsCollection> {
    if (recordsReady) return recordsReady
    recordsReady = (async () => {
        const { default: mongoose } = await import('mongoose')
        const db = mongoose.connection.db
        if (!db) throw new MoloDbError('MongoDB ещё не подключена', 503)
        const col = db.collection('molo_records')
        await col.createIndex({ enterpriseId: 1, db: 1, col: 1, createdAt: -1 }, { name: 'molo_scope_created' })
        // TTL: записи коллекций со сроком хранения удаляются Mongo автоматически
        await col.createIndex({ expireAt: 1 }, { name: 'molo_ttl', expireAfterSeconds: 0 })
        return col as unknown as RecordsCollection
    })().catch((e) => {
        recordsReady = null
        throw e
    })
    return recordsReady
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

    const { MoloDatabase } = await import('~~/server/models/moloDatabase.model')
    const doc: any = await MoloDatabase.findOne({ enterpriseId, name: db }).lean()
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

export async function runDbOp(ctx: OpContext, body: any, deps: StoreDeps = defaultDeps): Promise<any> {
    const op = body?.op
    if (!READ_OPS.has(op) && !WRITE_OPS.has(op)) throw new MoloDbError(`Неизвестная операция «${op}»`)

    const def = await deps.loadDef(ctx.enterpriseId, ctx.db)
    if (!def) throw new MoloDbError(`База «${ctx.db}» не найдена`, 404)
    const coll = def.collections.find((c) => c.name === ctx.col)
    if (!coll) throw new MoloDbError(`Коллекция «${ctx.col}» не найдена в базе «${ctx.db}»`, 404)

    assertAccess(coll, ctx.actor, READ_OPS.has(op) ? 'read' : 'write')

    const records = await deps.records()
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
    const records = await deps.records()
    const q: Record<string, any> = { enterpriseId, db }
    if (cols) q.col = { $in: cols }
    const res = await records.deleteMany(q)
    return res.deletedCount
}