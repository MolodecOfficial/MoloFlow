// composables/useApiTable.ts
import * as XLSX from 'xlsx'
import { API_TRANSFORMERS } from './useApiTransformers'

export interface ApiHeader {
    key: string
    value: string
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'yookassa'

export interface ApiSource {
    id: string
    name: string
    url: string
    method: 'GET' | 'POST'
    headers: ApiHeader[]
    body: string
    dataPath: string
    maxRows: number
    saveHeaders: boolean
    needsHeaders?: boolean

    authType: AuthType
    authLogin?: string
    authPassword?: string

    sheetId?: string
    sheetName?: string
    anchorRow?: number
    anchorCol?: number
    lastRows?: number
    lastCols?: number
    lastSyncAt?: string
}

export interface ApiMatrix {
    headers: string[]
    rows: any[][]
    totalRows: number
    truncated: boolean
    path: string
    columnWidths?: number[]
}

export type ApiImportTarget = 'new' | 'active' | 'refresh'

export interface ApiImportPayload {
    source: ApiSource
    matrix: ApiMatrix
    target: ApiImportTarget
}

export const DEFAULT_MAX_ROWS = 5000
export const HARD_MAX_ROWS = 50000
const MAX_COLS = 200
const MAX_FLATTEN_DEPTH = 3
const MAX_CELL_LEN = 32767

export function newSource(): ApiSource {
    return {
        id: `api_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        url: '',
        method: 'GET',
        headers: [],
        body: '',
        dataPath: '',
        maxRows: DEFAULT_MAX_ROWS,
        saveHeaders: false,
        authType: 'none',
        authLogin: '',
        authPassword: '',
    }
}

export function guessSourceName(url: string): string {
    try {
        const u = new URL(url)
        const last = u.pathname.split('/').filter(Boolean).pop()
        return last ? decodeURIComponent(last) : u.hostname
    } catch {
        return 'API'
    }
}

export function buildRequestHeaders(source: ApiSource): Record<string, string> {
    const headers: Record<string, string> = {}

    for (const h of source.headers) {
        if (h.key.trim()) headers[h.key.trim()] = h.value
    }

    if (source.authType === 'yookassa' || source.authType === 'basic') {
        const login = source.authLogin?.trim() || ''
        const pass = source.authPassword?.trim() || ''
        if (login || pass) {
            const raw = `${login}:${pass}`
            const token = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(raw))) : Buffer.from(raw).toString('base64')
            headers['Authorization'] = `Basic ${token}`
        }
    } else if (source.authType === 'bearer' && source.authPassword?.trim()) {
        headers['Authorization'] = `Bearer ${source.authPassword.trim()}`
    }

    return headers
}

const isPlainObject = (v: any): v is Record<string, any> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)

function getByPath(root: any, path: string): any {
    const tokens = path.match(/[^.[\]]+/g) || []
    let cur = root
    for (const t of tokens) {
        if (cur === null || cur === undefined) return undefined
        cur = cur[t]
    }
    return cur
}

function findBestArray(root: any): { value: any[]; path: string } | null {
    if (Array.isArray(root)) return { value: root, path: '' }

    const candidates: { value: any[]; path: string; score: number }[] = []
    const walk = (node: any, path: string, depth: number) => {
        if (!isPlainObject(node) || depth > 3) return
        for (const key of Object.keys(node)) {
            const child = node[key]
            const childPath = path ? `${path}.${key}` : key
            if (Array.isArray(child) && child.length) {
                const objects = child.filter(isPlainObject).length
                candidates.push({ value: child, path: childPath, score: objects * 1000 + child.length })
            } else if (isPlainObject(child)) {
                walk(child, childPath, depth + 1)
            }
        }
    }
    walk(root, '', 1)
    candidates.sort((a, b) => b.score - a.score)
    return candidates[0] ? { value: candidates[0].value, path: candidates[0].path } : null
}

function flattenObject(obj: Record<string, any>, prefix: string, out: Record<string, any>, depth: number) {
    for (const key of Object.keys(obj)) {
        const v = obj[key]
        const full = prefix ? `${prefix}.${key}` : key
        if (isPlainObject(v) && depth < MAX_FLATTEN_DEPTH && Object.keys(v).length) {
            flattenObject(v, full, out, depth + 1)
        } else {
            out[full] = v
        }
    }
}

function normalizeCell(v: any): any {
    if (v === null || v === undefined) return ''
    if (typeof v === 'number') return Number.isFinite(v) ? v : ''
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') return v.length > MAX_CELL_LEN ? v.slice(0, MAX_CELL_LEN) : v
    if (Array.isArray(v)) {
        const allPrimitive = v.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x))
        const s = allPrimitive ? v.join(', ') : JSON.stringify(v)
        return s.length > MAX_CELL_LEN ? s.slice(0, MAX_CELL_LEN) : s
    }
    const s = JSON.stringify(v)
    return s.length > MAX_CELL_LEN ? s.slice(0, MAX_CELL_LEN) : s
}

export function toMatrix(data: any, dataPath: string, maxRows: number, authType?: string): ApiMatrix {
    const limit = Math.min(Math.max(1, Math.floor(maxRows) || DEFAULT_MAX_ROWS), HARD_MAX_ROWS)

    let node = data
    let path = ''
    if (dataPath.trim()) {
        node = getByPath(data, dataPath.trim())
        path = dataPath.trim()
    } else {
        const found = findBestArray(data)
        if (found) {
            node = found.value
            path = found.path
        }
    }

    // 1. Одиночный объект
    if (isPlainObject(node)) {
        const flat: Record<string, any> = {}
        flattenObject(node, '', flat, 1)
        const entries = Object.entries(flat)
        return {
            headers: ['Поле', 'Значение'],
            rows: entries.slice(0, limit).map(([k, v]) => [k, normalizeCell(v)]),
            totalRows: entries.length,
            truncated: entries.length > limit,
            path,
        }
    }

    // 2. Если это примитив
    if (!Array.isArray(node)) {
        return { headers: ['Значение'], rows: [[normalizeCell(node)]], totalRows: 1, truncated: false, path }
    }

    const total = node.length
    const slice = node.slice(0, limit)

    // 3. ПРОВЕРКА НАЛИЧИЯ АДАПТЕРА СЕРВИСА (ЮKassa и др.)
    const transformer = authType ? API_TRANSFORMERS[authType] : null
    if (transformer && slice.length) {
        const flatRows = slice.map((item) => {
            const out: Record<string, any> = {}
            if (isPlainObject(item)) flattenObject(item, '', out, 1)
            else out['value'] = item
            return out
        })

        const headers = transformer.columns.map((c) => c.title)
        const columnWidths = transformer.columns.map((c) => c.width || 140)
        const rows = flatRows.map((row) =>
            transformer.columns.map((c) => {
                const rawVal = row[c.key]
                const formatted = c.format ? c.format(rawVal, row) : rawVal
                return normalizeCell(formatted)
            }),
        )

        return {
            headers,
            rows,
            totalRows: total,
            truncated: total > limit,
            path,
            columnWidths,
        }
    }

    // 4. Массив массивов (CSV-подобный)
    if (slice.length && slice.every(Array.isArray)) {
        const [head, ...rest] = slice as any[][]
        const width = Math.min(MAX_COLS, Math.max(...slice.map((r) => r.length)))
        const headers = Array.from({ length: width }, (_, i) => String(head?.[i] ?? `Колонка ${i + 1}`))
        return {
            headers,
            rows: rest.map((r) => Array.from({ length: width }, (_, i) => normalizeCell(r[i]))),
            totalRows: Math.max(0, total - 1),
            truncated: total > limit,
            path,
        }
    }

    // 5. Произвольный массив объектов (Fallback для неизвестных API)
    if (slice.some(isPlainObject)) {
        const flatRows = slice.map((item) => {
            const out: Record<string, any> = {}
            if (isPlainObject(item)) flattenObject(item, '', out, 1)
            else out['Значение'] = item
            return out
        })
        const headers: string[] = []
        const seen = new Set<string>()
        for (const row of flatRows) {
            for (const k of Object.keys(row)) {
                if (!seen.has(k) && headers.length < MAX_COLS) {
                    seen.add(k)
                    headers.push(k)
                }
            }
        }

        const parents = new Set(headers.filter((h) => headers.some((o) => o.startsWith(`${h}.`))))
        const finalHeaders = headers.filter((h) => !parents.has(h) || flatRows.some((r) => r[h] !== null && r[h] !== undefined && r[h] !== ''))

        return {
            headers: finalHeaders,
            rows: flatRows.map((row) => finalHeaders.map((h) => normalizeCell(row[h]))),
            totalRows: total,
            truncated: total > limit,
            path,
        }
    }

    return {
        headers: ['Значение'],
        rows: slice.map((v) => [normalizeCell(v)]),
        totalRows: total,
        truncated: total > limit,
        path,
    }
}

function parseCsvToObjects(text: string): Record<string, any>[] {
    const wb = XLSX.read(text, { type: 'string', raw: true })
    const ws = wb.Sheets[wb.SheetNames[0]!]
    if (!ws) return []
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: '' })
    if (rows.length < 2) return []
    const used = new Map<string, number>()
    const headers = (rows[0] as any[]).map((h, i) => {
        let name = String(h ?? '').trim() || `Колонка ${i + 1}`
        const n = used.get(name) ?? 0
        used.set(name, n + 1)
        if (n) name = `${name}_${n + 1}`
        return name
    })

    const toValue = (v: any) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !/^-?0\d/.test(v) ? Number(v) : v)
    return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, toValue((r as any[])[i] ?? '')])))
}

export function parseApiText(text: string, contentType: string): any {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('API вернул пустой ответ')
    const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
    if (looksJson || /json/i.test(contentType)) {
        try {
            return JSON.parse(trimmed)
        } catch {
            if (looksJson) throw new Error('Ответ похож на JSON, но не разбирается')
        }
    }
    if (/csv/i.test(contentType) || trimmed.includes('\n')) {
        const rows = parseCsvToObjects(trimmed)
        if (rows.length) return rows
    }
    throw new Error('Ответ не JSON и не CSV — отобразить в таблице нельзя')
}

export function apiErrorMessage(e: any): string {
    return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || e?.message || 'Не удалось выполнить запрос'
}

export function useApiTable() {
    async function fetchMatrix(source: ApiSource): Promise<ApiMatrix> {
        const headers = buildRequestHeaders(source)

        let res: { text: string; contentType: string }
        try {
            res = await $fetch<{ text: string; contentType: string }>('/api/workspace/api-proxy', {
                method: 'POST',
                body: {
                    url: source.url.trim(),
                    method: source.method,
                    headers,
                    body: source.method === 'POST' ? source.body : undefined,
                },
            })
        } catch (e: any) {
            throw new Error(apiErrorMessage(e))
        }

        const data = parseApiText(res.text, res.contentType)
        return toMatrix(data, source.dataPath, source.maxRows, source.authType)
    }

    return { fetchMatrix }
}