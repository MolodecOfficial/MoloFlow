// app/composables/useProcessManager.ts
import { ref, computed } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { useModulesStore } from '~~/stores/modulesStore'
import { useLogger } from '~~/app/composables/useLogger'
import { executeServerModule } from '~~/app/composables/compiler/useServerExecute'
import { collectPyFiles } from '~~/app/composables/compiler/usePythonRuntime'
import { buildAuthHeaders } from '~~/server/utils/authContext'

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

const scriptProcesses = ref<Map<string, ManagedScriptItem>>(new Map())
const activePyWorkers = new Map<string, Worker>()
const isPolling = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

export function useProcessManager() {
    const appStore = useAppStore()
    const modulesStore = useModulesStore()
    const { addLog } = useLogger('Диспетчер процессов')

    const enterpriseId = computed(() => appStore.getEnterpriseId() || '')

    const processesList = computed(() => Array.from(scriptProcesses.value.values()))
    const runningCount = computed(() =>
        processesList.value.filter((p) => p.status === 'running').length
    )

    function terminatePyWorker(moduleId: string) {
        const w = activePyWorkers.get(moduleId)
        if (w) {
            w.terminate()
            activePyWorkers.delete(moduleId)
        }
    }

    /**
     * Запускает реальный код Python-модуля со всеми его файлами и зависимостями из MoloDB
     * в изолированном фоновом WebAssembly-воркере (0 файлов и процессов на ПК).
     */
    async function spawnPyWorkerInMemory(proc: ManagedScriptItem) {
        if (!import.meta.client || !enterpriseId.value) return
        terminatePyWorker(proc.id)

        const authHeaders = buildAuthHeaders(appStore.currentUser?._id)
        const fullRes: any = await $fetch(
            `/api/enterprises/${enterpriseId.value}/dynamicModules/${proc.id}`,
            { headers: authHeaders }
        )
        const fullMod = fullRes?.module || proc.moduleData
        if (!fullMod?.code) {
            throw new Error('Код модуля пуст или не найден в MoloDB')
        }

        const { entry, files } = collectPyFiles(fullMod.code, fullMod.fileName, fullMod.files || [])
        const worker = new Worker(new URL('../workers/pyodide.worker.ts', import.meta.url), { type: 'module' })
        activePyWorkers.set(proc.id, worker)

        const modLogger = useLogger(proc.name || 'Python')
        const virtualPid = 2000 + Math.floor(Math.random() * 7000)
        proc.pid = virtualPid
        proc.startedAt = Date.now()
        proc.status = 'running'

        worker.onmessage = (ev: MessageEvent) => {
            const msg = ev.data || {}
            if (msg.type === 'log') {
                proc.lastMessage = msg.text
                if (msg.level === 'error') {
                    modLogger.addLog('error', msg.text)
                } else if (msg.level === 'info') {
                    modLogger.addLog('info', msg.text)
                }
                // Отправляем лог на сервер для синхронизации со ссылкой Cloudflare
                void $fetch('/api/py/daemon', {
                    method: 'POST',
                    body: {
                        action: 'heartbeat',
                        moduleId: proc.id,
                        enterpriseId: enterpriseId.value,
                        log: msg.text
                    }
                }).catch(() => {})
            } else if (msg.type === 'result') {
                if (activePyWorkers.get(proc.id) !== worker) return
                activePyWorkers.delete(proc.id)
                worker.terminate()

                if (msg.ok) {
                    proc.status = 'success'
                    proc.lastMessage = msg.hasResult
                        ? `Результат: ${JSON.stringify(msg.result).slice(0, 120)}`
                        : 'Выполнение завершено'
                    void $fetch('/api/py/daemon', {
                        method: 'POST',
                        body: {
                            action: 'heartbeat',
                            moduleId: proc.id,
                            enterpriseId: enterpriseId.value,
                            result: msg.result,
                            finished: true
                        }
                    }).catch(() => {})
                } else {
                    proc.status = 'error'
                    const errMsg = msg.error?.message || 'Ошибка выполнения Python'
                    proc.lastMessage = errMsg
                    modLogger.addLog('error', msg.error?.traceback || errMsg)
                }
            } else if (msg.type === 'fatal') {
                proc.status = 'error'
                proc.lastMessage = msg.message || 'Сбой воркера'
                modLogger.addLog('error', proc.lastMessage!)
            }
        }

        worker.postMessage({
            type: 'run',
            id: `daemon-${proc.id}-${Date.now()}`,
            entry: entry.path,
            files,
            dependencies: fullMod.dependencies || {},
            context: {},
            enterpriseId: enterpriseId.value,
            authHeaders
        })
    }

    async function refreshScriptsList() {
        if (!enterpriseId.value) return

        if (!modulesStore.enterpriseModulesLoaded) {
            await modulesStore.loadEnterpriseModules(enterpriseId.value)
        }

        const scriptsOnly = (modulesStore.enterpriseModules || []).filter(
            (m: any) => m && ['py', 'js', 'ts'].includes(m.format) && m.isActive !== false
        )

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

        const activeIds = new Set(scriptsOnly.map((m: any) => m._id))
        for (const id of scriptProcesses.value.keys()) {
            if (!activeIds.has(id)) {
                terminatePyWorker(id)
                scriptProcesses.value.delete(id)
            }
        }

        await checkDaemonsStatus()
    }

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
                            // Если сервер помечает демон как активный (например, при автозапуске),
                            // а воркер в памяти ещё не поднят — поднимаем его автоматически!
                            if (!activePyWorkers.has(proc.id) && proc.status !== 'running') {
                                void spawnPyWorkerInMemory(proc).catch((e) => {
                                    proc.status = 'error'
                                    proc.lastMessage = e?.message || 'Ошибка старта'
                                })
                            } else {
                                proc.status = 'running'
                                proc.pid = proc.pid || daemon.pid
                                proc.startedAt = proc.startedAt || daemon.startedAt
                            }
                        } else if (!activePyWorkers.has(proc.id) && proc.status === 'running') {
                            proc.status = 'idle'
                            proc.pid = undefined
                        }
                    }
                }
            }
        } catch {}
    }

    async function startProcess(item: ManagedScriptItem) {
        if (!enterpriseId.value) return
        item.status = 'running'
        item.lastMessage = 'Запуск модуля в памяти...'
        addLog('info', `Запуск модуля [${item.format.toUpperCase()}]: ${item.name}`)

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
                await spawnPyWorkerInMemory(item)
                item.lastMessage = res.message
                addLog('success', `Модуль "${item.name}" запущен в облачной памяти`)
            } else {
                item.startedAt = Date.now()
                await executeServerModule(item.id, undefined, {
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
            addLog('error', `Ошибка модуля "${item.name}": ${item.lastMessage}`)
        }
    }

    async function stopProcess(item: ManagedScriptItem) {
        if (item.format === 'py') {
            terminatePyWorker(item.id)
            try {
                await $fetch('/api/py/daemon', {
                    method: 'POST',
                    body: { action: 'stop', moduleId: item.id }
                })
                item.status = 'idle'
                item.pid = undefined
                item.startedAt = undefined
                item.lastMessage = 'Процесс остановлен'
                addLog('warning', `Модуль "${item.name}" остановлен`)
            } catch (err: any) {
                addLog('error', `Не удалось остановить "${item.name}": ${err?.message}`)
            }
        } else {
            item.status = 'idle'
            item.lastMessage = 'Остановлен'
        }
    }

    async function restartProcess(item: ManagedScriptItem) {
        await stopProcess(item)
        await startProcess(item)
    }

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