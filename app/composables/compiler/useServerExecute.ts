// app/composables/compiler/useServerExecute.ts
import { useLogger } from '~~/app/composables/useLogger'
import { useNotifications } from '~~/app/composables/useNotifications'
import { useWindowManager } from '~~/app/composables/window/useWindowManager'

export interface ServerLogEntry {
    level: 'info' | 'success' | 'warning' | 'error'
    source: string
    text: string
    ts: number
}

export interface ClientAction {
    type: 'openWindow' | 'notify' | 'custom'
    payload: any
}

export function replayServerLogs(entries: ServerLogEntry[] = []) {
    if (!entries || !Array.isArray(entries)) return
    const loggers = new Map<string, ReturnType<typeof useLogger>>()
    for (const e of entries) {
        let logger = loggers.get(e.source)
        if (!logger) {
            logger = useLogger(e.source)
            loggers.set(e.source, logger)
        }
        logger.addLog(e.level, e.text)
    }
}

/**
 * Исполнение клиентских composables по инструкциям от серверного файла
 */
export async function dispatchClientActions(actions: ClientAction[] = []) {
    if (!actions || !Array.isArray(actions)) return

    const { openWindow } = useWindowManager()
    const notifs = useNotifications('Сервер')

    for (const act of actions) {
        try {
            switch (act.type) {
                case 'openWindow':
                    // act.payload: { target: string, data?: any }
                    if (act.payload?.target) {
                        openWindow(act.payload.target, act.payload.data)
                    }
                    break
                case 'notify':
                    // act.payload: { message: string, type?: string }
                    if (act.payload?.message) {
                        const lvl = act.payload.type || 'info'
                        if (typeof (notifs as any)[lvl] === 'function') {
                            (notifs as any)[lvl](act.payload.message)
                        } else {
                            notifs.info(act.payload.message)
                        }
                    }
                    break
            }
        } catch (err) {
            console.error('[dispatchClientActions Error]:', err)
        }
    }
}

export async function executeServerModule(moduleId: string, fileName?: string, data?: any) {
    try {
        const res = await $fetch<{
            result: any
            logs: string[]
            entries: ServerLogEntry[]
            actions?: ClientAction[]
        }>(`/api/execute/${moduleId}`, {
            method: 'POST',
            body: { fileName, data }
        })

        // 1. Проигрываем логи напрямую от имени исходного файла
        replayServerLogs(res.entries)

        // 2. Выполняем запрошенные сервером вызовы клиентских composables
        if (res.actions?.length) {
            await dispatchClientActions(res.actions)
        }

        return res
    } catch (e: any) {
        replayServerLogs(e?.data?.data?.entries)
        const message = e?.data?.message || e?.statusMessage || e?.message || 'Ошибка выполнения'
        throw new Error(message)
    }
}