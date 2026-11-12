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
    desiredStatus?: 'idle' | 'running'
    pid?: number
    startedAt?: number
    lastHeartbeat?: number
    lastMessage?: string
    moduleData: any
}

const scriptProcesses = ref<Map<string, ManagedScriptItem>>(new Map())
const activePyWorkers = new Map<string, Worker>()
const isPolling = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

// --- Защита от засыпания вкладки браузера (Chrome Tab Freezing / 5 минут) ---
let audioContext: AudioContext | null = null
let silentOscillator: OscillatorNode | null = null
let wakeLockSentinel: any = null

function enableTabKeepAlive() {
    if (typeof window === 'undefined') return

    // 1. Неслышимый Web Audio keep-alive: Chrome никогда не усыпляет вкладки со звуком
    try {
        if (!audioContext || audioContext.state === 'closed') {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
            if (AudioCtx) {
                audioContext = new AudioCtx()
                const osc = audioContext.createOscillator()
                const gain = audioContext.createGain()
                gain.gain.value = 0.00001 // Неслышимый уровень
                osc.connect(gain)
                gain.connect(audioContext.destination)
                osc.start()
                silentOscillator = osc
            }
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {})
        }
    } catch {}

    // 2. Screen Wake Lock API
    try {
        if ('wakeLock' in navigator && !wakeLockSentinel) {
            (navigator as any).wakeLock.request('screen').then((lock: any) => {
                wakeLockSentinel = lock
            }).catch(() => {})
        }
    } catch {}
}

function disableTabKeepAlive(activeRunningCount: number) {
    if (activeRunningCount > 0) return
    try {
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().catch(() => {})
            audioContext = null
            silentOscillator = null
        }
        if (wakeLockSentinel) {
            wakeLockSentinel.release().catch(() => {})
            wakeLockSentinel = null
        }
    } catch {}
}

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
     * в изолированном фоновом WebAssembly-воркере с вечным жизненным циклом.
     */
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
                    desiredStatus: 'idle',
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

    const printedLogCounts = new Map<string, number>()


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
                    if (proc.format !== 'py') continue
                    // Гасим любые старые браузерные воркеры, чтобы они не мешали шлюзу
                    terminatePyWorker(proc.id)
                    const daemon = runningMap.get(proc.id)
                    if (daemon) {
                        proc.status = 'running'
                        proc.pid = daemon.pid
                        proc.startedAt = daemon.startedAt
                    } else if (proc.status === 'running') {
                        proc.status = 'idle'
                        proc.pid = undefined
                    }
                }
            }
        } catch {}
    }

    async function startProcess(item: ManagedScriptItem) {
        if (!enterpriseId.value) return
        item.status = 'running'
        item.desiredStatus = 'running'
        item.lastMessage = 'Запуск модуля...'
        addLog('info', `Запуск модуля [${item.format.toUpperCase()}]: ${item.name}`)

        try {
            if (item.format === 'py') {
                printedLogCounts.set(item.id, 0)
                const res = await $fetch<{
                    success: boolean
                    pid: number
                    mode?: 'server' | 'gateway' | 'browser'
                    message: string
                }>('/api/py/daemon', {
                    method: 'POST',
                    body: {
                        action: 'restart',
                        moduleId: item.id,
                        enterpriseId: enterpriseId.value
                    }
                })

                item.pid = res.pid
                item.startedAt = Date.now()
                item.lastMessage = res.message

                // Запускаем браузерный Pyodide только если на сервере нет Python
                if (res.mode === 'browser') {
                    console.log('Заглушка')
                } else {
                    terminatePyWorker(item.id)
                }

                addLog('success', `Модуль "${item.name}" запущен (${res.mode === 'server' ? 'Сервер' : 'Облако'})`)
            } else {
                item.startedAt = Date.now()
                await executeServerModule(item.id, undefined, {
                    moduleName: item.name,
                    enterpriseId: enterpriseId.value
                })
                item.status = 'success'
                item.desiredStatus = 'idle'
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
        item.desiredStatus = 'idle'
        if (item.format === 'py') {
            terminatePyWorker(item.id)
            disableTabKeepAlive(runningCount.value - 1)
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
        disableTabKeepAlive(0)
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