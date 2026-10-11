import { defineEventHandler, getRouterParam, setResponseHeaders } from 'h3'
import { checkEnterpriseAccess } from '~~/server/utils/enterpriseAuth'
import { onAccessChange } from '~~/server/utils/accessEvents'

const WATCHDOG_MS = 1500    // как часто сервер сам сверяет роль (страховка, если publishAccessChange не вызвали)
const HEARTBEAT_MS = 15000  // чтобы соединение не считалось «мёртвым»

/**
 * GET /api/enterprises/:id/events  — поток Server-Sent Events.
 * Шлёт событие `access`, как только роль пользователя в предприятии изменилась
 * или доступ отозван. Клиент в ответ сразу запрашивает /me.
 */
export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id') as string

    // Бросит 401/403/404 до начала потока
    const first = await checkEnterpriseAccess(event, enterpriseId)
    let lastRole = first.effectiveRole
    const userId = first.userId

    const res = event.node.res
    setResponseHeaders(event, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    })
    res.statusCode = 200
    res.flushHeaders?.()

    const send = (name: string, data: any) => {
        if (!res.writableEnded) res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    let closed = false
    let checking = false
    const timers: ReturnType<typeof setInterval>[] = []
    let unsubscribe: (() => void) | null = null

    const cleanup = () => {
        if (closed) return
        closed = true
        timers.forEach(clearInterval)
        unsubscribe?.()
    }

    const check = async (reason: string) => {
        if (closed || checking) return
        checking = true
        try {
            const r = await checkEnterpriseAccess(event, enterpriseId)
            if (r.effectiveRole !== lastRole) {
                lastRole = r.effectiveRole
                send('access', { reason, role: r.effectiveRole })
            }
        } catch (e: any) {
            const code = e?.statusCode
            if (code === 401 || code === 403 || code === 404) {
                send('access', { reason: 'revoked' })
                cleanup()
                res.end()
            }
        } finally {
            checking = false
        }
    }

    send('ready', { role: lastRole })
    unsubscribe = onAccessChange(enterpriseId, userId, () => void check('push'))
    timers.push(setInterval(() => void check('watch'), WATCHDOG_MS))
    timers.push(setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n') }, HEARTBEAT_MS))

    // Ответ мы пишем сами — не даём h3 его закрыть
    ;(event as any)._handled = true
    return new Promise<void>((resolve) => {
        res.on('close', () => {
            cleanup()
            resolve()
        })
    })
})