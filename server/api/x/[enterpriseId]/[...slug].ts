// server/api/x/[enterpriseId]/[...slug].ts
import { timingSafeEqual, createHash } from 'node:crypto'
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
import { executePythonInSandbox } from '~~/server/utils/pythonRunner'

const TIMEOUT_MS = 25000
const MAX_BODY = 10 * 1024 * 1024
const HIDDEN_HEADERS = new Set(['cookie', 'authorization', 'x-api-key', 'x-molo-key', 'x-molo-db-token'])
const SAFE_RESPONSE_HEADERS = /^(content-type|cache-control|location|x-[a-z0-9-]+)$/i

function sameSecret(a: string, b: string) {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'enterpriseId') || ''
    const slug = (getRouterParam(event, 'slug') || '').replace(/^\/+|\/+$/g, '')
    const method = getMethod(event).toUpperCase()

    const Endpoint = tenantModels(enterpriseId).MoloEndpoint
    const ep: any = await Endpoint.findOne({ enterpriseId, slug, enabled: true }).lean()
    if (!ep) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })

    const open = ep.access !== 'members'
    if (open) {
        setHeader(event, 'Access-Control-Allow-Origin', '*')
        setHeader(event, 'Access-Control-Allow-Methods', ep.methods.join(', '))
        setHeader(event, 'Access-Control-Allow-Headers', 'content-type, x-api-key, authorization, x-molo-key')
    }
    if (method === 'OPTIONS') {
        setResponseStatus(event, 204)
        return ''
    }

    if (!ep.methods.includes(method)) {
        throw createError({ statusCode: 405, message: `Метод ${method} не разрешён для этого эндпоинта` })
    }

    // Gateway и прямой API используют один Molo-Key. В БД хранится только SHA-256.
    const bearer = (getHeader(event, 'authorization') || '').replace(/^Bearer\s+/i, '')
    const supplied = String(getHeader(event, 'x-molo-key') || getHeader(event, 'x-api-key') || bearer || '')
    const expectedHash = String(ep.connectKeyHash || '').toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
        throw createError({ statusCode: 503, message: 'Для эндпоинта не настроен Molo-Key' })
    }
    const suppliedHash = createHash('sha256').update(supplied, 'utf8').digest('hex')
    if (!supplied || !sameSecret(suppliedHash, expectedHash)) {
        throw createError({ statusCode: 401, message: 'Неверный Molo-Key' })
    }

    const mod: any = await tenantModels(enterpriseId).DynamicModule.findOne({ _id: ep.moduleId, isActive: true }).select('format name').lean()
    if (!mod) throw createError({ statusCode: 502, message: 'Модуль эндпоинта недоступен' })

    let body: any
    if (method !== 'GET' && method !== 'HEAD') {
        if (Number(getHeader(event, 'content-length') || 0) > MAX_BODY) {
            throw createError({ statusCode: 413, message: 'Тело запроса слишком большое' })
        }
        body = await readBody(event).catch(() => undefined)
    }

    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(getRequestHeaders(event))) {
        if (!HIDDEN_HEADERS.has(k)) headers[k] = String(v)
    }

    const context = {
        method,
        path: slug,
        query: getQuery(event),
        body,
        headers,
        ip: getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    }

    let status = 200
    try {
        let payload: any

        if (mod.format === 'py') {
            payload = await executePythonInSandbox({
                enterpriseId,
                moduleId: String(ep.moduleId),
                fileName: ep.file || undefined,
                context,
                timeoutMs: TIMEOUT_MS
            })
        } else {
            const sandbox = await getModuleSandbox(String(ep.moduleId), enterpriseId)
            let timer: any
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(createError({ statusCode: 504, message: 'Обработчик не ответил вовремя' })), TIMEOUT_MS)
            })
            const res: any = await Promise.race([sandbox.executeFile(ep.file || 'main', context), timeout]).finally(() => {
                clearTimeout(timer)
            })
            payload = res?.result
        }

        if (payload && typeof payload === 'object' && Number.isInteger(payload.status) && 'body' in payload) {
            status = Math.min(Math.max(payload.status, 100), 599)
            for (const [k, v] of Object.entries(payload.headers || {})) {
                if (SAFE_RESPONSE_HEADERS.test(k)) setHeader(event, k, String(v))
            }
            payload = payload.body
        }

        setResponseStatus(event, status)
        return payload === undefined ? null : payload
    } catch (e: any) {
        status = e?.statusCode || 500
        throw createError({
            statusCode: status,
            message: e?.message || 'Ошибка выполнения обработчика'
        })
    } finally {
        Endpoint.updateOne(
            { _id: ep._id },
            { $inc: { 'stats.calls': 1 }, $set: { 'stats.lastCallAt': new Date(), 'stats.lastStatus': status } }
        ).catch(() => {})
    }
})