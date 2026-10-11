import { onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { buildAuthHeaders } from '~~/server/utils/authContext'

/**
 * Держит сессию в актуальном состоянии:
 *  1) поток событий с сервера (SSE) — смена роли применяется почти мгновенно;
 *  2) запасной опрос раз в intervalMs, при возврате фокуса и при появлении сети.
 *
 * Поток открывается через fetch (а не EventSource), чтобы передавать заголовки авторизации.
 */
export function useAccessSync(intervalMs = 20_000) {
    const appStore = useAppStore()

    let pollTimer: ReturnType<typeof setInterval> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let abort: AbortController | null = null
    let runId = 0
    let retry = 0
    let stopped = false

    const tick = () => {
        if (document.visibilityState === 'hidden') return
        if (!appStore.getEnterpriseId()) return
        void appStore.refreshAccess()
    }

    const onVisible = () => {
        if (document.visibilityState === 'visible') tick()
    }

    const handleChunk = (chunk: string) => {
        let name = 'message'
        for (const line of chunk.split('\n')) {
            if (line.startsWith('event:')) name = line.slice(6).trim()
        }
        // Роль изменилась — сразу берём свежие данные (force: даже если уже идёт запрос)
        if (name === 'access') void appStore.refreshAccess(true)
    }

    const scheduleReconnect = () => {
        if (stopped) return
        retry++
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retry, 15_000))
    }

    async function connect() {
        if (stopped) return
        const id = appStore.getEnterpriseId()
        if (!id) return

        abort?.abort()
        const ctrl = new AbortController()
        abort = ctrl
        const myRun = ++runId

        try {
            const res = await fetch(`/api/enterprises/${id}/events`, {
                headers: { ...buildAuthHeaders(appStore.currentUser?._id), Accept: 'text/event-stream' },
                signal: ctrl.signal,
                cache: 'no-store'
            })

            if (res.status === 401 || res.status === 403 || res.status === 404) {
                // Доступа нет — пусть store решит, что делать (выход из предприятия и т.д.)
                void appStore.refreshAccess(true)
                throw new Error(String(res.status))
            }
            if (!res.ok || !res.body) throw new Error(String(res.status))

            retry = 0
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                let idx: number
                while ((idx = buffer.indexOf('\n\n')) >= 0) {
                    const chunk = buffer.slice(0, idx)
                    buffer = buffer.slice(idx + 2)
                    handleChunk(chunk)
                }
            }
        } catch {
            if (ctrl.signal.aborted) return
        }

        if (myRun === runId) scheduleReconnect()
    }

    const restart = () => {
        if (retryTimer) clearTimeout(retryTimer)
        abort?.abort()
        retry = 0
        if (appStore.enterpriseId) void connect()
    }

    onMounted(() => {
        stopped = false
        pollTimer = setInterval(tick, intervalMs)
        window.addEventListener('focus', tick)
        window.addEventListener('online', () => { tick(); restart() })
        document.addEventListener('visibilitychange', onVisible)
        // Поток открываем только после первой успешной сверки прав (MoloGuard),
        // чтобы не занимать соединения, пока идёт проверка
        if (appStore.lastSyncAt) void connect()
    })

    watch(() => appStore.lastSyncAt, (now, prev) => {
        if (now && !prev) restart()
    })

    // Вошли в другое предприятие / вышли — переоткрываем поток
    watch(() => appStore.enterpriseId, (id) => {
        if (id && appStore.lastSyncAt) restart()
        else { abort?.abort() }
    })

    onUnmounted(() => {
        stopped = true
        if (pollTimer) clearInterval(pollTimer)
        if (retryTimer) clearTimeout(retryTimer)
        abort?.abort()
        window.removeEventListener('focus', tick)
        document.removeEventListener('visibilitychange', onVisible)
    })

    return { refreshNow: () => appStore.refreshAccess(true) }
}