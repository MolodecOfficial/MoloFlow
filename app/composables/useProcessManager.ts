// app/composables/useProcessManager.ts
import { ref, computed } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { useModulesStore } from '~~/stores/modulesStore'
import { useLogger } from '~~/app/composables/useLogger'
import { executeServerModule } from '~~/app/composables/compiler/useServerExecute'

export type ProcessStatus = 'idle' | 'running' | 'success' | 'error'

export interface ManagedScriptItem {
    id: string
    name: string
    fileName: string
    format: 'py' | 'js' | 'ts'
    status: ProcessStatus
    pid?: number
    startedAt?: number
    lastMessage?: string
    moduleData: any
}

// Глобальное реактивное состояние процессов
const scriptProcesses = ref<Map<string, ManagedScriptItem>>(new Map())
const isPolling = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

export function useProcessManager() {
    const appStore = useAppStore()
    const modulesStore = useModulesStore()
    const { addLog } = useLogger('Диспетчер процессов')

    const enterpriseId = computed(() => appStore.getEnterpriseId() || '')

    // Список всех процессов в виде массива
    const processesList = computed(() => Array.from(scriptProcesses.value.values()))

    // Количество активных (работающих) процессов
    const runningCount = computed(() =>
        processesList.value.filter((p) => p.status === 'running').length
    )

    /**
     * Синхронизация списка скриптовых модулей предприятия
     */
    async function refreshScriptsList() {
        if (!enterpriseId.value) return

        // Подгружаем модули предприятия, если еще не загружены
        if (!modulesStore.enterpriseModulesLoaded) {
            await modulesStore.loadEnterpriseModules(enterpriseId.value)
        }

        const scriptsOnly = (modulesStore.enterpriseModules || []).filter(
            (m: any) => m && ['py', 'js', 'ts'].includes(m.format) && m.isActive !== false
        )

        // Обновляем карту процессов, сохраняя уже известные статусы
        for (const m of scriptsOnly) {
            const existing = scriptProcesses.value.get(m._id)
            if (!existing) {
                scriptProcesses.value.set(m._id, {
                    id: m._id,
                    name: m.name || m.fileName,
                    fileName: m.fileName,
                    format: m.format,
                    status: 'idle',
                    moduleData: m
                })
            } else {
                existing.name = m.name || m.fileName
                existing.moduleData = m
            }
        }

        // Удаляем те, которые были удалены из предприятия
        const activeIds = new Set(scriptsOnly.map((m: any) => m._id))
        for (const id of scriptProcesses.value.keys()) {
            if (!activeIds.has(id)) {
                scriptProcesses.value.delete(id)
            }
        }

        // Опрашиваем бэкенд о статусе Python-демонов
        await checkDaemonsStatus()
    }

    /**
     * Запрос статуса работающих Python-демонов
     */
    async function checkDaemonsStatus() {
        if (!enterpriseId.value) return
        try {
            const res = await $fetch<{ success: boolean; daemons: any[] }>('/api/py/daemon', {
                method: 'POST',
                body: { action: 'list', enterpriseId: enterpriseId.value }
            })

            if (res?.success && Array.isArray(res.daemons)) {
                const runningMap = new Map(res.daemons.map((d: any) => [d.moduleId, d]))

                for (const proc of scriptProcesses.value.values()) {
                    if (proc.format === 'py') {
                        const daemon = runningMap.get(proc.id)
                        if (daemon) {
                            proc.status = 'running'
                            proc.pid = daemon.pid
                            proc.startedAt = daemon.startedAt
                            if (daemon.logs?.length) {
                                proc.lastMessage = daemon.logs[daemon.logs.length - 1]
                            }
                        } else if (proc.status === 'running') {
                            proc.status = 'idle'
                            proc.pid = undefined
                        }
                    }
                }
            }
        } catch {
            // Ошибку сети не спамим
        }
    }

    /**
     * Запуск скрипта
     */
    async function startProcess(item: ManagedScriptItem) {
        if (!enterpriseId.value) return
        item.status = 'running'
        item.lastMessage = 'Запуск процесса...'
        addLog('info', `Запуск скрипта [${item.format.toUpperCase()}]: ${item.name}`)

        try {
            if (item.format === 'py') {
                const res = await $fetch<{ success: boolean; pid: number; message: string }>(
                    '/api/py/daemon',
                    {
                        method: 'POST',
                        body: {
                            action: 'restart',
                            moduleId: item.id,
                            enterpriseId: enterpriseId.value
                        }
                    }
                )
                item.status = 'running'
                item.pid = res.pid
                item.startedAt = Date.now()
                item.lastMessage = res.message
                addLog('success', `Бот "${item.name}" запущен (PID: ${res.pid})`)
            } else {
                // JS / TS скрипт
                item.startedAt = Date.now()
                const res = await executeServerModule(item.id, undefined, {
                    moduleName: item.name,
                    enterpriseId: enterpriseId.value
                })
                item.status = 'success'
                item.lastMessage = 'Выполнение успешно завершено'
                addLog('success', `Скрипт "${item.name}" отработал успешно`)
            }
        } catch (err: any) {
            item.status = 'error'
            item.lastMessage = err?.data?.message || err?.message || 'Ошибка выполнения'
            addLog('error', `Ошибка скрипта "${item.name}": ${item.lastMessage}`)
        }
    }

    /**
     * Остановка скрипта (в первую очередь для Python-демонов)
     */
    async function stopProcess(item: ManagedScriptItem) {
        if (item.format === 'py') {
            try {
                await $fetch('/api/py/daemon', {
                    method: 'POST',
                    body: { action: 'stop', moduleId: item.id }
                })
                item.status = 'idle'
                item.pid = undefined
                item.startedAt = undefined
                item.lastMessage = 'Процесс остановлен'
                addLog('warning', `Бот "${item.name}" остановлен`)
            } catch (err: any) {
                addLog('error', `Не удалось остановить "${item.name}": ${err?.message}`)
            }
        } else {
            item.status = 'idle'
            item.lastMessage = 'Остановлен'
        }
    }

    /**
     * Перезапуск
     */
    async function restartProcess(item: ManagedScriptItem) {
        await stopProcess(item)
        await startProcess(item)
    }

    /**
     * Запуск фонового опроса статусов (раз в 3.5 секунды)
     */
    function startPolling() {
        if (isPolling.value) return
        isPolling.value = true
        refreshScriptsList()
        pollTimer = setInterval(checkDaemonsStatus, 3500)
    }

    function stopPolling() {
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = null
        isPolling.value = false
    }

    return {
        processesList,
        runningCount,
        refreshScriptsList,
        startProcess,
        stopProcess,
        restartProcess,
        startPolling,
        stopPolling
    }
}