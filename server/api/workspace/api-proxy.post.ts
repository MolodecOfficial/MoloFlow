// server/api/workspace/api-proxy.post.ts
// Прокси для импорта данных из внешнего API в MoloTable.
// Зачем: браузер упирается в CORS, а токены удобнее не светить в сетевой вкладке чужих доменов.
// Защита от SSRF: резолвим DNS сами, блокируем приватные адреса и «пинним» проверенный IP на сокет.
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns/promises'
import net from 'node:net'
import { createError, defineEventHandler, readBody } from 'h3'

const MAX_BYTES = 5 * 1024 * 1024 // 5 МБ на ответ
const TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 3
const ALLOWED_METHODS = ['GET', 'POST']
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'cookie'])

// Для внутренних API компании: MOLO_API_PROXY_ALLOW_PRIVATE=true в .env
const allowPrivate = () => process.env.MOLO_API_PROXY_ALLOW_PRIVATE === 'true'

function isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number) as [number, number]
        return (
            a === 0 || a === 10 || a === 127 ||
            (a === 100 && b >= 64 && b <= 127) || // CGNAT
            (a === 169 && b === 254) ||           // link-local, облачные metadata
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            a >= 224
        )
    }
    const v6 = ip.toLowerCase()
    if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7))
    return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

async function resolveSafe(hostname: string): Promise<{ address: string; family: number }> {
    const list = net.isIP(hostname)
        ? [{ address: hostname, family: net.isIP(hostname) }]
        : await dns.lookup(hostname, { all: true })
    if (!list.length) throw createError({ statusCode: 400, statusMessage: 'Не удалось определить адрес хоста' })
    if (!allowPrivate() && list.some(a => isPrivateIp(a.address))) {
        throw createError({ statusCode: 400, statusMessage: 'Адреса во внутренних сетях запрещены' })
    }
    return list[0]!
}

function requestPinned(
    url: URL,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    pinned: { address: string; family: number },
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
    return new Promise((resolve, reject) => {
        const lib = url.protocol === 'https:' ? https : http
        const req = lib.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || undefined,
                path: url.pathname + url.search,
                method,
                headers,
                timeout: TIMEOUT_MS,
                // подменяем резолв: соединяемся именно с проверенным IP (защита от DNS-rebinding)
                lookup: (_h: string, opts: any, cb: any) =>
                    opts?.all ? cb(null, [{ address: pinned.address, family: pinned.family }]) : cb(null, pinned.address, pinned.family),
            } as any,
            (res) => {
                const chunks: Buffer[] = []
                let size = 0
                res.on('data', (chunk: Buffer) => {
                    size += chunk.length
                    if (size > MAX_BYTES) {
                        req.destroy(new Error('too_large'))
                        return
                    }
                    chunks.push(chunk)
                })
                res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }))
                res.on('error', reject)
            },
        )
        req.on('timeout', () => req.destroy(new Error('timeout')))
        req.on('error', reject)
        if (body) req.write(body)
        req.end()
    })
}

export default defineEventHandler(async (event) => {
    // TODO: подключи сюда свою проверку авторизации, как в остальных /api/workspace/* маршрутах

    const input = await readBody<{
        url?: string
        method?: string
        headers?: Record<string, string>
        body?: string
    }>(event)

    const method = String(input?.method || 'GET').toUpperCase()
    if (!ALLOWED_METHODS.includes(method)) {
        throw createError({ statusCode: 400, statusMessage: 'Поддерживаются только GET и POST' })
    }

    let url: URL
    try {
        url = new URL(String(input?.url || ''))
    } catch {
        throw createError({ statusCode: 400, statusMessage: 'Некорректный URL' })
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw createError({ statusCode: 400, statusMessage: 'Разрешены только http и https' })
    }

    const headers: Record<string, string> = { Accept: 'application/json, text/csv;q=0.8, */*;q=0.5' }
    for (const [k, v] of Object.entries(input?.headers || {})) {
        const key = String(k).trim()
        if (!key || FORBIDDEN_HEADERS.has(key.toLowerCase())) continue
        headers[key] = String(v)
    }
    const body = method === 'POST' && input?.body ? String(input.body) : undefined
    if (body) {
        headers['Content-Length'] = String(Buffer.byteLength(body))
        if (!Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json'
    }

    try {
        let current = url
        let currentMethod = method
        let currentBody = body
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const pinned = await resolveSafe(current.hostname)
            const res = await requestPinned(current, currentMethod, headers, currentBody, pinned)

            if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
                current = new URL(String(res.headers.location), current)
                if (!['http:', 'https:'].includes(current.protocol)) {
                    throw createError({ statusCode: 400, statusMessage: 'Редирект на недопустимый протокол' })
                }
                if (res.status === 303 || ((res.status === 301 || res.status === 302) && currentMethod === 'POST')) {
                    currentMethod = 'GET'
                    currentBody = undefined
                    delete headers['Content-Length']
                }
                continue
            }

            if (res.status < 200 || res.status >= 300) {
                throw createError({
                    statusCode: 502,
                    statusMessage: `API ответил статусом ${res.status}`,
                    data: { upstreamStatus: res.status, snippet: res.body.toString('utf8').slice(0, 300) },
                })
            }

            return {
                status: res.status,
                contentType: String(res.headers['content-type'] || ''),
                text: res.body.toString('utf8'),
            }
        }
        throw createError({ statusCode: 502, statusMessage: 'Слишком много редиректов' })
    } catch (e: any) {
        if (e?.statusCode) throw e
        const msg = e?.message === 'too_large'
            ? 'Ответ больше 5 МБ'
            : e?.message === 'timeout'
                ? 'API не ответил за 15 секунд'
                : `Не удалось выполнить запрос: ${e?.code || e?.message || 'ошибка сети'}`
        throw createError({ statusCode: 502, statusMessage: msg })
    }
})