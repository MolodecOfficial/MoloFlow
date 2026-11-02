// server/api/py/daemon.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { enterpriseOfModule, loadModule } from '~~/server/utils/moduleLookup'
import { issueModuleToken } from '~~/server/utils/moloDb/access'
import { PY_CLIENT_SOURCE } from '~~/server/utils/moloDb/pythonClient'
import { ensurePythonEnv } from '~~/server/utils/pythonEnv'

interface ManagedProcess {
    pid: number
    child: ChildProcess
    runDir: string
    moduleId: string
    logs: string[]
    startedAt: number
}

// Реестр запущенных фоновых процессов
const runningDaemons = new Map<string, ManagedProcess>()

function sanitizeRelativePath(rawPath: string): string {
    const normalized = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '')
    return normalized.replace(/^[\\\/]+/, '')
}

/**
 * Безусловное завершение процесса и всего его дерева
 */
async function killProcessTree(proc: ManagedProcess): Promise<void> {
    const pid = proc.pid
    try {
        if (process.platform === 'win32') {
            try {
                execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
            } catch {}
        } else {
            try {
                process.kill(-pid, 'SIGKILL')
            } catch {
                proc.child.kill('SIGKILL')
            }
        }
    } catch {}

    // Очищаем старую рабочую папку
    if (proc.runDir) {
        try {
            await fs.rm(proc.runDir, { recursive: true, force: true })
        } catch {}
    }
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { action = 'restart', moduleId, enterpriseId } = body || {}

    // ── 0. ПОЛУЧЕНИЕ СПИСКА ВСЕХ ЗАПУЩЕННЫХ ДЕМОНОВ (moduleId НЕ нужен!) ──
    if (action === 'list') {
        const list = []
        for (const [mId, proc] of runningDaemons.entries()) {
            list.push({
                moduleId: mId,
                pid: proc.pid,
                startedAt: proc.startedAt,
                running: true,
                logs: proc.logs ? proc.logs.slice(-20) : []
            })
        }
        return { success: true, daemons: list }
    }

    // Для остальных действий (start, stop, restart, status) moduleId обязателен:
    if (!moduleId) {
        throw createError({ statusCode: 400, message: 'moduleId обязателен' })
    }

    // ── 1. ОСТАНОВКА ──
    if (action === 'stop') {
        const proc = runningDaemons.get(moduleId)
        if (!proc) {
            return { success: true, message: 'Процесс уже остановлен' }
        }

        await killProcessTree(proc)
        runningDaemons.delete(moduleId)
        return { success: true, message: 'Процесс полностью остановлен' }
    }

    // ── 2. СТАТУС КОНКРЕТНОГО МОДУЛЯ ──
    if (action === 'status') {
        const proc = runningDaemons.get(moduleId)
        return {
            running: !!proc,
            pid: proc?.pid,
            startedAt: proc?.startedAt,
            logs: proc?.logs || []
        }
    }

    // ── 3. СТАРТ / ПЕРЕЗАПУСК С НУЛЯ ──
    if (runningDaemons.has(moduleId)) {
        const oldProc = runningDaemons.get(moduleId)!
        await killProcessTree(oldProc)
        runningDaemons.delete(moduleId)
        await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // Загружаем актуальную версию модуля прямо из БД
    const eid = await enterpriseOfModule(moduleId, enterpriseId)
    const moduleDoc: any = eid ? await loadModule(moduleId, eid) : null
    if (!moduleDoc || moduleDoc.format !== 'py') {
        throw createError({ statusCode: 404, message: 'Python-модуль не найден или не является .py' })
    }

    // Создаем изолированную директорию
    const runId = `daemon_${moduleId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const runDir = path.join(os.tmpdir(), runId)
    await fs.mkdir(runDir, { recursive: true })

    // 1. Записываем главный файл
    const mainFileName = `${moduleDoc.fileName || 'main'}.py`
    const mainFilePath = path.join(runDir, mainFileName)
    await fs.writeFile(mainFilePath, moduleDoc.code || '', 'utf-8')

    // 2. Раскладываем все дополнительные файлы
    if (Array.isArray(moduleDoc.files)) {
        for (const f of moduleDoc.files) {
            if (!f.path && !f.name) continue
            const relativePath = f.path || f.name
            const targetPath = path.join(runDir, sanitizeRelativePath(relativePath))
            await fs.mkdir(path.dirname(targetPath), { recursive: true })
            await fs.writeFile(targetPath, f.code || '', 'utf-8')
        }
    }

    // Клиент мини-баз MoloFlow: from moloflow_db import db
    const helperPath = path.join(runDir, 'moloflow_db.py')
    try {
        await fs.access(helperPath)
    } catch {
        await fs.writeFile(helperPath, PY_CLIENT_SOURCE, 'utf-8')
    }

    const apiBase = (process.env.MOLO_API_URL || `http://127.0.0.1:${process.env.NITRO_PORT || process.env.PORT || '3000'}`).replace(/\/$/, '')
    const dbToken = await issueModuleToken(String(eid), String(moduleDoc._id))

    // Ставим pip-зависимости модуля
    const depsObj: Record<string, string> = moduleDoc.dependencies instanceof Map
        ? Object.fromEntries(moduleDoc.dependencies)
        : { ...((moduleDoc.dependencies as any) || {}) }
    const pythonCmd = await ensurePythonEnv(String(moduleDoc._id), depsObj, {
        log: (text) => console.log(`[pip ${moduleDoc.name}]`, text.trim())
    })
    const logsBuffer: string[] = []

    // Запуск процесса
    const child = spawn(pythonCmd, ['-u', mainFileName], {
        cwd: runDir,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONDONTWRITEBYTECODE: '1',
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            MOLO_API_URL: apiBase,
            MOLO_ENTERPRISE_ID: String(eid),
            MOLO_MODULE_ID: String(moduleDoc._id),
            MOLO_DB_TOKEN: dbToken
        }
    })

    if (process.platform !== 'win32') {
        child.unref()
    }

    const managed: ManagedProcess = {
        pid: child.pid!,
        child,
        runDir,
        moduleId,
        logs: logsBuffer,
        startedAt: Date.now()
    }

    child.stdout?.on('data', (d) => {
        const text = d.toString().trim()
        if (text) {
            managed.logs.push(`[OUT] ${text}`)
            if (managed.logs.length > 500) managed.logs.shift()
            console.log(`[Daemon ${moduleDoc.name}]`, text)
        }
    })

    child.stderr?.on('data', (d) => {
        const text = d.toString().trim()
        if (text) {
            managed.logs.push(`[ERR] ${text}`)
            if (managed.logs.length > 500) managed.logs.shift()
            console.info(`[Daemon ${moduleDoc.name} ERR]`, text)
        }
    })

    child.on('close', (code) => {
        console.log(`[Daemon ${moduleDoc.name}] Завершен с кодом ${code}`)
        if (runningDaemons.get(moduleId)?.pid === child.pid) {
            runningDaemons.delete(moduleId)
        }
        fs.rm(runDir, { recursive: true, force: true }).catch(() => {})
    })

    runningDaemons.set(moduleId, managed)

    return {
        success: true,
        message: `Бот запущен с нуля (PID: ${child.pid})`,
        pid: child.pid,
        running: true
    }
})