// server/utils/moloDb/query.ts
//
// Превращает «человеческие» фильтры, сортировки и патчи в безопасные запросы MongoDB.
// Разрешён только белый список операторов: никаких $where, $function и сырых $regex
// (вместо них — $contains / $startsWith с экранированием), поэтому ни ReDoS, ни инъекций.
import { Types } from 'mongoose'
import {
    FIELD_NAME_RE,
    LIMITS,
    MoloDbError,
    isPlainObject,
    validateRecord,
    type CollectionDef,
    type FieldType
} from './schema'

const MAX_DEPTH = 4
const MAX_KEYS = 40
const MAX_IN = 100
const LOGICAL = ['$and', '$or', '$nor']
const COMPARE = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte']
const TEXT_TYPES = new Set<FieldType>(['string', 'text', 'select'])

type Target = { path: string; type: FieldType | 'id'; label: string }

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isObjectId = (v: any) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)

export function toObjectId(v: any): Types.ObjectId {
    if (!isObjectId(v)) throw new MoloDbError('Некорректный идентификатор записи')
    return new Types.ObjectId(v)
}

export function clampInt(v: any, def: number, min: number, max: number): number {
    const n = Number(v)
    if (!Number.isFinite(n)) return def
    return Math.min(Math.max(Math.trunc(n), min), max)
}

function resolveTarget(coll: CollectionDef, key: string): Target {
    if (key === '_id') return { path: '_id', type: 'id', label: '_id' }
    if (key === 'createdAt' || key === 'updatedAt') return { path: key, type: 'date', label: key }
    const f = coll.fields.find((x) => x.name === key)
    if (f) return { path: `data.${key}`, type: f.type, label: f.label || f.name }
    if (coll.strict === false && FIELD_NAME_RE.test(key)) return { path: `data.${key}`, type: 'json', label: key }
    throw new MoloDbError(`Неизвестное поле «${key}» в запросе`)
}

function coerceQueryValue(t: Target, v: any): any {
    if (v === null) return null
    switch (t.type) {
        case 'id':
            return toObjectId(v)
        case 'string':
        case 'text':
        case 'select':
            if (typeof v !== 'string') throw new MoloDbError(`Поле «${t.label}»: ожидается строка`)
            return v
        case 'number': {
            const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
            if (typeof n !== 'number' || !Number.isFinite(n)) throw new MoloDbError(`Поле «${t.label}»: ожидается число`)
            return n
        }
        case 'boolean':
            if (typeof v === 'boolean') return v
            if (v === 'true') return true
            if (v === 'false') return false
            throw new MoloDbError(`Поле «${t.label}»: ожидается true или false`)
        case 'date': {
            const d = v instanceof Date ? v : typeof v === 'string' || typeof v === 'number' ? new Date(v) : null
            if (!d || Number.isNaN(d.getTime())) throw new MoloDbError(`Поле «${t.label}»: ожидается дата`)
            return d
        }
        case 'json':
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
            throw new MoloDbError(`Поле «${t.label}»: для json допустимы только простые значения`)
    }
}

const isOperatorObject = (v: any) =>
    isPlainObject(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => k.startsWith('$'))

function buildCondition(t: Target, val: any): any {
    if (isPlainObject(val) && !isOperatorObject(val)) {
        throw new MoloDbError(`Поле «${t.label}»: нельзя смешивать операторы и обычные ключи`)
    }
    if (Array.isArray(val)) throw new MoloDbError(`Поле «${t.label}»: массив допустим только внутри $in / $nin`)
    if (!isOperatorObject(val)) return coerceQueryValue(t, val)

    const cond: Record<string, any> = {}
    for (const [op, v] of Object.entries(val)) {
        if (COMPARE.includes(op)) {
            cond[op] = coerceQueryValue(t, v)
        } else if (op === '$in' || op === '$nin') {
            if (!Array.isArray(v) || v.length > MAX_IN) throw new MoloDbError(`${op}: нужен массив до ${MAX_IN} элементов`)
            cond[op] = v.map((x) => coerceQueryValue(t, x))
        } else if (op === '$exists') {
            if (typeof v !== 'boolean') throw new MoloDbError('$exists: нужно true или false')
            cond[op] = v
        } else if (op === '$contains' || op === '$startsWith') {
            if (!TEXT_TYPES.has(t.type as FieldType)) throw new MoloDbError(`${op} работает только с текстовыми полями`)
            if (typeof v !== 'string' || v.length > 100) throw new MoloDbError(`${op}: строка до 100 символов`)
            if (cond.$regex) throw new MoloDbError('Нельзя использовать $contains и $startsWith вместе')
            cond.$regex = (op === '$startsWith' ? '^' : '') + escapeRegex(v)
            cond.$options = 'i'
        } else {
            throw new MoloDbError(`Оператор «${op}» не поддерживается`)
        }
    }
    return cond
}

export function buildFilter(coll: CollectionDef, filter: any, depth = 0, counter = { n: 0 }): Record<string, any> {
    if (filter === undefined || filter === null) return {}
    if (!isPlainObject(filter)) throw new MoloDbError('Фильтр должен быть объектом')
    if (depth > MAX_DEPTH) throw new MoloDbError('Слишком глубокая вложенность фильтра')

    const out: Record<string, any> = {}
    for (const [key, val] of Object.entries(filter)) {
        if (++counter.n > MAX_KEYS) throw new MoloDbError('Слишком сложный фильтр')
        if (LOGICAL.includes(key)) {
            if (!Array.isArray(val) || !val.length || val.length > 10) throw new MoloDbError(`${key}: нужен массив из 1–10 условий`)
            out[key] = val.map((v) => buildFilter(coll, v, depth + 1, counter))
            continue
        }
        if (key.startsWith('$')) throw new MoloDbError(`Оператор «${key}» не поддерживается`)
        const target = resolveTarget(coll, key)
        out[target.path] = buildCondition(target, val)
    }
    return out
}

/** Поиск «по всем текстовым полям» одним запросом. */
export function buildSearch(coll: CollectionDef, text: any): Record<string, any> | null {
    const q = typeof text === 'string' ? text.trim().slice(0, 100) : ''
    if (!q) return null
    const fields = coll.fields.filter((f) => TEXT_TYPES.has(f.type)).slice(0, 8)
    if (!fields.length) throw new MoloDbError('В коллекции нет текстовых полей для поиска')
    const rx = escapeRegex(q)
    return { $or: fields.map((f) => ({ [`data.${f.name}`]: { $regex: rx, $options: 'i' } })) }
}

export function buildSort(coll: CollectionDef, sort: any): Record<string, 1 | -1> {
    let entries: Array<[string, 1 | -1]> = []

    const parseToken = (tok: string): [string, 1 | -1] => (tok.startsWith('-') ? [tok.slice(1), -1] : [tok.replace(/^\+/, ''), 1])
    if (typeof sort === 'string' && sort.trim()) {
        entries = sort.split(',').map((s) => parseToken(s.trim()))
    } else if (Array.isArray(sort)) {
        entries = sort.map((s) => parseToken(String(s)))
    } else if (isPlainObject(sort)) {
        entries = Object.entries(sort).map(([k, d]) => [k, d === -1 || d === 'desc' ? -1 : 1])
    }
    if (entries.length > 3) throw new MoloDbError('Сортировать можно не больше чем по 3 полям')
    if (!entries.length) entries = [['createdAt', -1]]

    const out: Record<string, 1 | -1> = {}
    for (const [name, dir] of entries) {
        const t = resolveTarget(coll, name)
        if (t.type === 'json') throw new MoloDbError(`По полю «${t.label}» сортировать нельзя`)
        out[t.path] = dir
    }
    // стабильный порядок для постраничной выдачи
    if (!('_id' in out)) out._id = Object.values(out)[0]
    return out
}

export function buildUpdate(
    coll: CollectionDef,
    input: { patch?: any; inc?: any; unset?: any }
): { update: Record<string, any>; touched: string[] } {
    const { data, errors } = validateRecord(coll, input.patch ?? {}, { partial: true })
    if (errors.length) throw new MoloDbError(errors.slice(0, 3).join('; '))

    const $set: Record<string, any> = { updatedAt: new Date() }
    const touched = new Set<string>()
    for (const [k, v] of Object.entries(data)) {
        $set[`data.${k}`] = v
        touched.add(k)
    }

    const update: Record<string, any> = { $set }

    if (input.inc !== undefined && input.inc !== null) {
        if (!isPlainObject(input.inc)) throw new MoloDbError('inc должен быть объектом {поле: число}')
        const $inc: Record<string, number> = {}
        for (const [k, n] of Object.entries(input.inc)) {
            const f = coll.fields.find((x) => x.name === k)
            if (!f || f.type !== 'number') throw new MoloDbError(`inc: поле «${k}» не числовое`)
            if (typeof n !== 'number' || !Number.isFinite(n)) throw new MoloDbError(`inc: «${k}» — нужно число`)
            if (touched.has(k)) throw new MoloDbError(`Поле «${k}» нельзя одновременно менять и увеличивать`)
            $inc[`data.${k}`] = n
            touched.add(k)
        }
        if (Object.keys($inc).length) update.$inc = $inc
    }

    if (input.unset !== undefined && input.unset !== null) {
        if (!Array.isArray(input.unset)) throw new MoloDbError('unset должен быть массивом имён полей')
        const $unset: Record<string, ''> = {}
        for (const k of input.unset) {
            const f = coll.fields.find((x) => x.name === k)
            if (!f && coll.strict !== false) throw new MoloDbError(`unset: неизвестное поле «${k}»`)
            if (f?.required) throw new MoloDbError(`unset: поле «${k}» обязательно`)
            if (touched.has(k)) throw new MoloDbError(`Поле «${k}» нельзя одновременно менять и удалять`)
            $unset[`data.${k}`] = ''
            touched.add(k)
        }
        if (Object.keys($unset).length) update.$unset = $unset
    }

    return { update, touched: [...touched] }
}

/** Из простого фильтра {поле: значение} достаёт равенства — для upsert. */
export function equalityFields(coll: CollectionDef, filter: any): Record<string, any> {
    const out: Record<string, any> = {}
    if (!isPlainObject(filter)) return out
    for (const [k, v] of Object.entries(filter)) {
        if (k.startsWith('$') || k === '_id') continue
        if (isPlainObject(v) || Array.isArray(v)) continue
        if (coll.fields.some((f) => f.name === k)) out[k] = v
    }
    return out
}

export { LIMITS }