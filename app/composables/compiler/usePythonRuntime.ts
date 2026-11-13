// app/composables/compiler/usePythonRuntime.ts
import { ref } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { buildAuthHeaders } from '~~/server/utils/authContext'

export type PyStage = 'idle' | 'runtime' | 'packages' | 'running'
export type PyLogLevel = 'info' | 'error' | 'system'

export interface PyLog {
    level: PyLogLevel
    text: string
    ts: number
}

export interface PyError {
    type: string
    message: string
    traceback: string
    line: number | null
    column: number | null
    file: string | null
}

export interface PyRunResult {
    ok: boolean
    result: any
    hasResult: boolean
    error?: PyError
    logs: PyLog[]
    durationMs: number
    stopped?: boolean
}

export interface PyFile {
    path: string
    code: string
}

export interface PyDiagnostic {
    line: number
    column: number
    endLine: number
    endColumn: number
    message: string
}

export interface PyRunOptions {
    entry: PyFile
    files: PyFile[]
    dependencies?: Record<string, string>
    context?: any
    timeoutMs?: number
    onLog?: (log: PyLog) => void
    onStage?: (stage: PyStage) => void
    engine?: 'client' | 'server'
    moduleId?: string
}

const DEFAULT_TIMEOUT_MS = 30_000

const stage = ref<PyStage>('idle')
const runtimeReady = ref(false)
const busy = ref(false)

let worker: Worker | null = null
let readyPromise: Promise<void> | null = null
let readyResolve: (() => void) | null = null
let readyReject: ((e: Error) => void) | null = null
let seq = 0

interface PendingRun {
    logs: PyLog[]
    opts: PyRunOptions
    resolve: (r: PyRunResult) => void
    timer: ReturnType<typeof setTimeout> | null
    startedAt: number
}

let pendingRun: { id: string; state: PendingRun } | null = null
const pendingChecks = new Map<string, (d: PyDiagnostic[]) => void>()

function setStage(next: PyStage) {
    stage.value = next
    pendingRun?.state.opts.onStage?.(next)
}

function failRun(message: string, extra: Partial<PyRunResult> = {}) {
    if (!pendingRun) return
    const { state } = pendingRun
    if (state.timer) clearTimeout(state.timer)
    state.resolve({
        ok: false,
        result: null,
        hasResult: false,
        logs: state.logs,
        durationMs: Date.now() - state.startedAt,
        error: { type: 'RuntimeError', message, traceback: '', line: null, column: null, file: null },
        ...extra
    })
    pendingRun = null
    busy.value = false
    setStage('idle')
}

function onMessage(ev: MessageEvent) {
    const msg = ev.data || {}

    switch (msg.type) {
        case 'ready':
            runtimeReady.value = true
            readyResolve?.()
            break

        case 'stage': {
            const current = pendingRun
            if (current && current.id === msg.id) {
                setStage(msg.stage)
                if (msg.stage === 'running') {
                    const { state } = current
                    const limit = state.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
                    state.timer = setTimeout(() => stop('timeout'), limit)
                }
            }
            break
        }

        case 'log': {
            const current = pendingRun
            if (current && current.id === msg.id) {
                const entry: PyLog = { level: msg.level, text: msg.text, ts: Date.now() }
                current.state.logs.push(entry)
                current.state.opts.onLog?.(entry)
            }
            break
        }

        case 'result': {
            const current = pendingRun
            if (current && current.id === msg.id) {
                const { state } = current
                if (state.timer) clearTimeout(state.timer)
                state.resolve({
                    ok: !!msg.ok,
                    result: msg.result ?? null,
                    hasResult: !!msg.hasResult,
                    error: msg.error,
                    logs: state.logs,
                    durationMs: msg.durationMs ?? Date.now() - state.startedAt
                })
                pendingRun = null
                busy.value = false
                setStage('idle')
                runtimeReady.value = true
            }
            break
        }

        case 'check-result': {
            const cb = pendingChecks.get(msg.id)
            if (cb) {
                pendingChecks.delete(msg.id)
                cb(msg.errors || [])
            }
            break
        }

        case 'fatal':
            if (pendingRun?.id === msg.id) {
                failRun(msg.message || 'Ошибка Python-воркера')
            } else {
                readyReject?.(new Error(msg.message))
                resetWorker()
            }
            break
    }
}

function resetWorker() {
    worker?.terminate()
    worker = null
    readyPromise = null
    readyResolve = null
    readyReject = null
    runtimeReady.value = false
    for (const cb of pendingChecks.values()) cb([])
    pendingChecks.clear()
}

function ensureWorker(): Worker {
    if (worker) return worker
    worker = new Worker(new URL('../../workers/pyodide.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = onMessage
    worker.onerror = (e) => {
        const message = e.message || 'Не удалось запустить облачный Python-воркер'
        failRun(message)
        readyReject?.(new Error(message))
        resetWorker()
    }
    return worker
}

function stop(reason: 'user' | 'timeout' | 'unmount' = 'user') {
    if (pendingRun) {
        const message = reason === 'timeout' ? 'Выполнение прервано по таймауту' : 'Выполнение остановлено'
        failRun(message, { stopped: true })
    }
    resetWorker()
}

function warmup(): Promise<void> {
    if (runtimeReady.value) return Promise.resolve()
    if (readyPromise) return readyPromise
    const w = ensureWorker()
    readyPromise = new Promise<void>((resolve, reject) => {
        readyResolve = resolve
        readyReject = reject
    })
    readyPromise.catch(() => {})
    w.postMessage({ type: 'init', id: 'warmup' })
    return readyPromise
}

async function runWorker(opts: PyRunOptions): Promise<PyRunResult> {
    if (busy.value) {
        return {
            ok: false,
            result: null,
            hasResult: false,
            logs: [],
            durationMs: 0,
            error: {
                type: 'Busy',
                message: 'Python уже выполняет другую задачу — дождитесь завершения или нажмите «Стоп»',
                traceback: '',
                line: null,
                column: null,
                file: null
            }
        }
    }

    busy.value = true
    const id = `run-${++seq}`
    const w = ensureWorker()
    const appStore = useAppStore()
    const enterpriseId = appStore.getEnterpriseId() || ''
    const authHeaders = buildAuthHeaders(appStore.currentUser?._id)

    const cleanFiles = (opts.files || []).map(f => ({
        path: String(f.path || ''),
        code: String(f.code || '')
    }))

    let cleanDependencies: Record<string, string> = {}
    if (opts.dependencies instanceof Map) {
        cleanDependencies = Object.fromEntries(opts.dependencies)
    } else if (opts.dependencies && typeof opts.dependencies === 'object') {
        cleanDependencies = JSON.parse(JSON.stringify(opts.dependencies))
    }

    let cleanContext: any = {}
    try {
        cleanContext = opts.context !== undefined ? JSON.parse(JSON.stringify(opts.context)) : {}
    } catch {
        cleanContext = {}
    }

    return new Promise<PyRunResult>((resolve) => {
        pendingRun = {
            id,
            state: { logs: [], opts, resolve, timer: null, startedAt: Date.now() }
        }
        setStage(runtimeReady.value ? 'packages' : 'runtime')

        w.postMessage({
            type: 'run',
            id,
            entry: String(opts.entry?.path || 'main.py'),
            files: cleanFiles,
            dependencies: cleanDependencies,
            context: cleanContext,
            enterpriseId,
            authHeaders
        })
    })
}

async function runServer(opts: PyRunOptions): Promise<PyRunResult> {
    return runWorker(opts)
}

async function run(opts: PyRunOptions): Promise<PyRunResult> {
    return runWorker(opts)
}

function check(code: string): Promise<PyDiagnostic[]> {
    if (!worker || !runtimeReady.value) return Promise.resolve([])
    const id = `check-${++seq}`
    return new Promise((resolve) => {
        pendingChecks.set(id, resolve)
        worker!.postMessage({ type: 'check', id, code })
    })
}

function normalizePyPath(path: string, format = 'py'): string {
    let p = (path || '').trim().replace(/\\/g, '/').replace(/^\.?\/+/, '')
    if (!/\.[a-z0-9]+$/i.test(p)) p += `.${format}`
    return p
}

export function collectPyFiles(mainCode: string, fileName: string | undefined, files: any[] = []): {
    entry: PyFile;
    files: PyFile[]
} {
    const entry: PyFile = { path: normalizePyPath(fileName || 'main'), code: String(mainCode || '') }
    const extra: PyFile[] = []

    for (const f of files || []) {
        if (!f) continue
        const format = String(f.format || '').toLowerCase()
        if (format !== 'py' && format !== 'json') continue

        const rawPath = f.path || f.name || ''
        const path = normalizePyPath(rawPath, format)
        if (path && path !== entry.path) {
            extra.push({ path, code: String(f.code || '') })
        }
    }

    return { entry, files: [entry, ...extra] }
}

export function usePythonRuntime() {
    return { stage, runtimeReady, busy, run, stop, check, warmup, runServer }
}