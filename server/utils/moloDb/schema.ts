// server/utils/moloDb/schema.ts
//
// Описание «мини-баз» MoloFlow: типы, лимиты, нормализация схем и валидация записей.
// Файл чистый (без Mongo и h3), поэтому его легко тестировать и переиспользовать.

export class MoloDbError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 400) {
        super(message)
        this.name = 'MoloDbError'
        this.statusCode = statusCode
    }
}

export const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'select', 'json'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export interface FieldDef {
    name: string
    label?: string
    type: FieldType
    required?: boolean
    unique?: boolean
    default?: any
    options?: string[]
    min?: number
    max?: number
    maxLength?: number
}

export interface CollectionDef {
    name: string
    title?: string
    fields: FieldDef[]
    /** true (по умолчанию): поля вне схемы запрещены */
    strict?: boolean
    ttlDays?: number
    maxDocs?: number
    /** Пустой список = доступно любому участнику предприятия */
    access?: { read?: string[]; write?: string[] }
}

export interface DatabaseDef {
    name: string
    title?: string
    description?: string
    collections: CollectionDef[]
}

export const LIMITS = {
    databases: 20,
    collections: 30,
    fields: 60,
    defaultMaxDocs: 50_000,
    hardMaxDocs: 500_000,
    docBytes: 256 * 1024,
    jsonBytes: 64 * 1024,
    stringLen: 1000,
    textLen: 100_000,
    options: 50,
    batch: 100,
    queryLimit: 500
} as const

export const NAME_RE = /^[a-z][a-z0-9_]{0,23}$/
export const FIELD_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/
export const RESERVED_NAMES = new Set(['id', '_id', 'createdAt', 'updatedAt', 'data', 'enterpriseId', 'db', 'col', 'expireAt'])
const SYSTEM_KEYS = new Set(['_id', 'id', 'createdAt', 'updatedAt'])
const UNIQUE_TYPES = new Set<FieldType>(['string', 'number', 'select', 'date'])

export const isPlainObject = (v: any): v is Record<string, any> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)

const labelOf = (f: Pick<FieldDef, 'name' | 'label'>) => f.label || f.name

// ──────────────────────────────────────────────────────────────
// Значения полей
// ──────────────────────────────────────────────────────────────

function assertSafeJson(value: any, depth = 0): void {
    if (depth > 10) throw new Error('слишком глубокая вложенность')
    if (Array.isArray(value)) {
        value.forEach((v) => assertSafeJson(v, depth + 1))
    } else if (isPlainObject(value)) {
        for (const [k, v] of Object.entries(value)) {
            if (k.startsWith('$') || k.includes('.')) throw new Error(`недопустимый ключ «${k}»`)
            assertSafeJson(v, depth + 1)
        }
    }
}

export function resolveDefault(f: FieldDef): any {
    if (f.default === undefined || f.default === null) return undefined
    if (f.type === 'date' && f.default === 'now') return new Date()
    if (f.type === 'date') return new Date(f.default)
    return f.type === 'json' ? JSON.parse(JSON.stringify(f.default)) : f.default
}

export function coerceField(f: FieldDef, v: any): { value?: any; error?: string } {
    const name = labelOf(f)
    switch (f.type) {
        case 'string':
        case 'text': {
            if (typeof v !== 'string') return { error: `Поле «${name}» должно быть строкой` }
            const max = f.maxLength ?? (f.type === 'text' ? LIMITS.textLen : LIMITS.stringLen)
            if (v.length > max) return { error: `Поле «${name}» длиннее ${max} символов` }
            return { value: v }
        }
        case 'number': {
            const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
            if (typeof n !== 'number' || !Number.isFinite(n)) return { error: `Поле «${name}» должно быть числом` }
            if (f.min !== undefined && n < f.min) return { error: `Поле «${name}» не может быть меньше ${f.min}` }
            if (f.max !== undefined && n > f.max) return { error: `Поле «${name}» не может быть больше ${f.max}` }
            return { value: n }
        }
        case 'boolean': {
            if (typeof v === 'boolean') return { value: v }
            if (v === 'true') return { value: true }
            if (v === 'false') return { value: false }
            return { error: `Поле «${name}» должно быть true или false` }
        }
        case 'date': {
            const d = v instanceof Date ? v : typeof v === 'string' || typeof v === 'number' ? new Date(v) : null
            if (!d || Number.isNaN(d.getTime())) return { error: `Поле «${name}» должно быть датой` }
            return { value: d }
        }
        case 'select': {
            if (typeof v !== 'string' || !(f.options || []).includes(v)) {
                return { error: `Поле «${name}» должно быть одним из: ${(f.options || []).join(', ')}` }
            }
            return { value: v }
        }
        case 'json': {
            try {
                assertSafeJson(v)
                if (JSON.stringify(v).length > LIMITS.jsonBytes) throw new Error(`больше ${LIMITS.jsonBytes / 1024} КБ`)
            } catch (e: any) {
                return { error: `Поле «${name}»: ${e.message}` }
            }
            return { value: v }
        }
    }
    return { error: `Поле «${name}»: неизвестный тип` }
}

/**
 * Проверяет и приводит запись к типам схемы.
 * partial = true — для обновлений: обязательность и значения по умолчанию не применяются.
 */
export function validateRecord(
    coll: CollectionDef,
    input: any,
    opts: { partial?: boolean } = {}
): { data: Record<string, any>; errors: string[] } {
    if (!isPlainObject(input)) return { data: {}, errors: ['Запись должна быть объектом'] }

    const errors: string[] = []
    const data: Record<string, any> = {}
    const known = new Set(coll.fields.map((f) => f.name))

    for (const key of Object.keys(input)) {
        if (SYSTEM_KEYS.has(key) || known.has(key)) continue
        if (coll.strict !== false) {
            errors.push(`Неизвестное поле «${key}»`)
        } else if (!FIELD_NAME_RE.test(key)) {
            errors.push(`Недопустимое имя поля «${key}»`)
        } else {
            const r = coerceField({ name: key, type: 'json' }, input[key])
            if (r.error) errors.push(r.error)
            else data[key] = r.value
        }
    }

    for (const f of coll.fields) {
        let v = input[f.name]
        if (v === undefined) {
            if (opts.partial) continue
            v = resolveDefault(f)
            if (v === undefined) {
                if (f.required) errors.push(`Поле «${labelOf(f)}» обязательно`)
                continue
            }
        }
        if (v === null) {
            if (f.required) errors.push(`Поле «${labelOf(f)}» обязательно`)
            else data[f.name] = null
            continue
        }
        const r = coerceField(f, v)
        if (r.error) errors.push(r.error)
        else data[f.name] = r.value
    }

    if (!errors.length && JSON.stringify(data).length > LIMITS.docBytes) {
        errors.push(`Запись больше ${LIMITS.docBytes / 1024} КБ`)
    }
    return { data, errors }
}

export function flattenRecord(doc: any): Record<string, any> {
    return { _id: String(doc._id), ...(doc.data || {}), createdAt: doc.createdAt, updatedAt: doc.updatedAt }
}

// ──────────────────────────────────────────────────────────────
// Нормализация схем (то, что приходит от пользователя при создании/изменении базы)
// ──────────────────────────────────────────────────────────────

function str(v: any, max: number): string {
    return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function intIn(v: any, min: number, max: number): number | undefined {
    if (v === undefined || v === null || v === '') return undefined
    const n = Number(v)
    return Number.isInteger(n) && n >= min && n <= max ? n : NaN
}

function normalizeField(raw: any, where: string, errs: string[]): FieldDef | null {
    if (!isPlainObject(raw)) {
        errs.push(`${where}: поле должно быть объектом`)
        return null
    }
    const name = str(raw.name, 40)
    if (!FIELD_NAME_RE.test(name) || RESERVED_NAMES.has(name)) {
        errs.push(`${where}: недопустимое имя поля «${name}» (латиница, цифры и «_», до 32 символов)`)
        return null
    }
    const type = raw.type as FieldType
    if (!FIELD_TYPES.includes(type)) {
        errs.push(`${where}.${name}: неизвестный тип «${raw.type}»`)
        return null
    }

    const f: FieldDef = { name, type }
    const label = str(raw.label, 60)
    if (label && label !== name) f.label = label
    if (raw.required) f.required = true

    if (raw.unique) {
        if (!UNIQUE_TYPES.has(type)) errs.push(`${where}.${name}: уникальным может быть только строка, число, дата или выбор`)
        else f.unique = true
    }

    if (type === 'select') {
        const opts = Array.isArray(raw.options) ? raw.options.map((o: any) => str(o, 60)).filter(Boolean) : []
        const uniq = [...new Set<string>(opts)].slice(0, LIMITS.options)
        if (!uniq.length) errs.push(`${where}.${name}: укажите варианты для списка`)
        f.options = uniq
    }

    if (type === 'number') {
        for (const k of ['min', 'max'] as const) {
            if (raw[k] === undefined || raw[k] === null || raw[k] === '') continue
            const n = Number(raw[k])
            if (!Number.isFinite(n)) errs.push(`${where}.${name}: «${k}» должно быть числом`)
            else f[k] = n
        }
        if (f.min !== undefined && f.max !== undefined && f.min > f.max) errs.push(`${where}.${name}: min больше max`)
    }

    if (type === 'string' || type === 'text') {
        const ml = intIn(raw.maxLength, 1, type === 'text' ? LIMITS.textLen : LIMITS.stringLen)
        if (Number.isNaN(ml)) errs.push(`${where}.${name}: недопустимая максимальная длина`)
        else if (ml !== undefined) f.maxLength = ml
    }

    if (raw.default !== undefined && raw.default !== null && raw.default !== '') {
        if (type === 'date' && raw.default === 'now') {
            f.default = 'now'
        } else {
            const r = coerceField(f, raw.default)
            if (r.error) errs.push(`${where}.${name}: значение по умолчанию — ${r.error}`)
            else f.default = r.value instanceof Date ? r.value.toISOString() : r.value
        }
    }
    return f
}

function normalizeCollection(raw: any, where: string, errs: string[]): CollectionDef | null {
    if (!isPlainObject(raw)) {
        errs.push(`${where}: коллекция должна быть объектом`)
        return null
    }
    const name = str(raw.name, 40)
    if (!NAME_RE.test(name)) {
        errs.push(`Коллекция «${name}»: имя — строчные латинские буквы, цифры и «_», до 24 символов`)
        return null
    }
    const here = `Коллекция «${name}»`
    const c: CollectionDef = { name, fields: [], strict: raw.strict !== false }

    const title = str(raw.title, 80)
    if (title) c.title = title

    const rawFields = Array.isArray(raw.fields) ? raw.fields : []
    if (rawFields.length > LIMITS.fields) errs.push(`${here}: не больше ${LIMITS.fields} полей`)
    const seen = new Set<string>()
    for (const rf of rawFields.slice(0, LIMITS.fields)) {
        const f = normalizeField(rf, here, errs)
        if (!f) continue
        if (seen.has(f.name)) errs.push(`${here}: поле «${f.name}» повторяется`)
        seen.add(f.name)
        c.fields.push(f)
    }

    const ttl = intIn(raw.ttlDays, 1, 3650)
    if (Number.isNaN(ttl)) errs.push(`${here}: срок хранения — целое число дней от 1 до 3650`)
    else if (ttl !== undefined) c.ttlDays = ttl

    const md = intIn(raw.maxDocs, 1, LIMITS.hardMaxDocs)
    if (Number.isNaN(md)) errs.push(`${here}: лимит записей — целое число от 1 до ${LIMITS.hardMaxDocs}`)
    else if (md !== undefined) c.maxDocs = md

    if (isPlainObject(raw.access)) {
        const list = (v: any) =>
            Array.isArray(v) ? [...new Set<string>(v.map((x: any) => str(x, 40)).filter(Boolean))].slice(0, 10) : []
        const read = list(raw.access.read)
        const write = list(raw.access.write)
        if (read.length || write.length) c.access = { read, write }
    }
    return c
}

export function normalizeDatabaseDef(raw: any): DatabaseDef {
    const errs: string[] = []
    if (!isPlainObject(raw)) throw new MoloDbError('Описание базы должно быть объектом')

    const name = str(raw.name, 40)
    if (!NAME_RE.test(name)) errs.push('Имя базы — строчные латинские буквы, цифры и «_», начинается с буквы, до 24 символов')

    const def: DatabaseDef = { name, title: str(raw.title, 80), description: str(raw.description, 300), collections: [] }

    const rawCols = Array.isArray(raw.collections) ? raw.collections : []
    if (rawCols.length > LIMITS.collections) errs.push(`В базе не больше ${LIMITS.collections} коллекций`)
    const seen = new Set<string>()
    for (const rc of rawCols.slice(0, LIMITS.collections)) {
        const c = normalizeCollection(rc, 'Коллекция', errs)
        if (!c) continue
        if (seen.has(c.name)) errs.push(`Коллекция «${c.name}» повторяется`)
        seen.add(c.name)
        def.collections.push(c)
    }

    if (errs.length) throw new MoloDbError(errs.slice(0, 5).join('; '))
    return def
}