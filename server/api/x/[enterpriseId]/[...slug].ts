// server/api/x/[enterpriseId]/[...slug].ts
//
// Публичный роутер пользовательских эндпоинтов:  /api/x/<предприятие>/<адрес>
// Находит эндпоинт, проверяет доступ и метод, затем выполняет серверный файл модуля в песочнице.
// Внутри файла доступен объект db (мини-базы), а в context лежит запрос:
//   { method, path, query, body, headers, ip }
// Ответ: что вернула функция; для своего статуса верните { status: 201, body: {...}, headers?: {...} }.
import { timingSafeEqual } from 'node:crypto'
import {
    createError,
    defineEventHandler,
    getHeader,
    getMethod,
    getQuery,
    getRequestHeaders,
    getRequestIP,
    getRouterParam,
    readBody,
    setHeader,
    setResponseStatus
} from 'h3'
import { getModuleSandbox } from '~~/app/utils/moduleSandbox'
import { tenantModels } from '~~/server/utils/tenantDb'
import { MoloEndpoint } from '~~/server/models/moloEndpoint.model'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'

const TIMEOUT_MS = 15_000
const MAX_BODY = 256 * 1024
const HIDDEN_HEADERS = new Set(['cookie', 'authorization', 'x-api-key', 'x-molo-db-token'])
const SAFE_RESPONSE_HEADERS = /^(content-type|cache-control|location|x-[a-z0-9-]+)$/i

// простой лимит запросов в минуту на (эндпоинт + IP)
const hits = new Map<string, { n: number; reset: number }>()
function rateLimited(key: string, max: number): boolean {
    const now = Date.now()
    const h = hits.get(key)
    if (!h || h.reset < now) {
        if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
        hits.set(key, { n: 1, reset: now + 60_000 })
        return false
    }
    return ++h.n > max
}

function sameSecret(a: string, b: string) {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'enterpriseId') || ''
    const slug = (getRouterParam(event, 'slug') || '').replace(/^\/+|\/+$/g, '')
    const method = getMethod(event).toUpperCase()

    const ep: any = await MoloEndpoint.findOne({ enterpriseId, slug, enabled: true }).lean()
    if (!ep) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })

    const open = ep.access !== 'members'
    if (open) {
        setHeader(event, 'Access-Control-Allow-Origin', '*')
        setHeader(event, 'Access-Control-Allow-Methods', ep.methods.join(', '))
        setHeader(event, 'Access-Control-Allow-Headers', 'content-type, x-api-key, authorization')
    }
    if (method === 'OPTIONS') {
        setResponseStatus(event, 204)
        return ''
    }
    if (!ep.methods.includes(method)) {
        throw createError({ statusCode: 405, message: `Метод ${method} не разрешён для этого эндпоинта` })
    }

    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    if (rateLimited(`${ep._id}:${ip}`, ep.access === 'public' ? 120 : 600)) {
        throw createError({ statusCode: 429, message: 'Слишком много запросов, попробуйте через минуту' })
    }

    // ── доступ ──
    if (ep.access === 'key') {
        const bearer = (getHeader(event, 'authorization') || '').replace(/^Bearer\s+/i, '')
        const supplied = String(getHeader(event, 'x-api-key') || bearer || getQuery(event).key || '')
        if (!sameSecret(supplied, ep.secret || '')) throw createError({ statusCode: 401, message: 'Неверный ключ доступа' })
    } else if (ep.access === 'members') {
        await checkEnterpriseAccess(event, enterpriseId)
    }

    const mod: any = await tenantModels(enterpriseId).DynamicModule.findOne({ _id: ep.moduleId, enterpriseId, isActive: true }).select('format').lean()
    if (!mod || mod.format === 'py') throw createError({ statusCode: 502, message: 'Модуль эндпоинта недоступен' })

    // ── запрос → context ──
    let body: any
    if (method !== 'GET' && method !== 'HEAD') {
        if (Number(getHeader(event, 'content-length') || 0) > MAX_BODY) throw createError({ statusCode: 413, message: 'Тело запроса слишком большое' })
        body = await readBody(event).catch(() => undefined)
    }
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(getRequestHeaders(event))) {
        if (!HIDDEN_HEADERS.has(k)) headers[k] = String(v)
    }
    const context = { method, path: slug, query: getQuery(event), body, headers, ip }

    // ── выполнение ──
    let status = 200
    try {
        const sandbox = await getModuleSandbox(String(ep.moduleId), enterpriseId)
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(createError({ statusCode: 504, message: 'Обработчик не ответил вовремя' })), TIMEOUT_MS)
        })
        const { result } = (await Promise.race([sandbox.executeFile(ep.file || 'main', context), timeout]).finally(() =>
            clearTimeout(timer)
        )) as { result: any }

        let payload = result
        if (result && typeof result === 'object' && Number.isInteger(result.status) && 'body' in result) {
            status = Math.min(Math.max(result.status, 100), 599)
            payload = result.body
            for (const [k, v] of Object.entries(result.headers || {})) {
                if (SAFE_RESPONSE_HEADERS.test(k)) setHeader(event, k, String(v))
            }
        }
        setResponseStatus(event, status)
        return payload === undefined ? null : payload
    } catch (e: any) {
        status = e?.statusCode || 500
        console.error(`[MoloDB endpoint ${slug}]`, e?.message)
        // посторонним внутренние ошибки обработчика не показываем
        throw createError({
            statusCode: status,
            message: ep.access === 'members' || status === 504 ? e?.message || 'Ошибка обработчика' : 'Ошибка выполнения обработчика'
        })
    } finally {
        MoloEndpoint.updateOne(
            { _id: ep._id },
            { $inc: { 'stats.calls': 1 }, $set: { 'stats.lastCallAt': new Date(), 'stats.lastStatus': status } }
        ).catch(() => {})
    }
})