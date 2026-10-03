// server/api/py/daemon.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DynamicModule } from '~~/server/models/dynamicModules.model'

interface ManagedProcess {
    pid: number
    child: ChildProcess
    runDir: string
    moduleId: string
    logs: string[]
    startedAt: number
}

// Реестр фоновых демонов на сервере (живет пока жив сам Nuxt)
const runningDaemons = new Map<string, ManagedProcess>()

function sanitizeRelativePath(rawPath: string): string {
    const normalized = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '')
    return normalized.replace(/^[\\\/]+/, '')
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { action = 'start', moduleId, enterpriseId } = body || {}

    if (!moduleId) {
        throw createError({ statusCode: 400, message: 'moduleId обязателен' })
    }

    // 1. ОСТАНОВКА ПРОЦЕССА
    if (action === 'stop') {
        const proc = runningDaemons.get(moduleId)
        if (!proc) {
            return { success: true, message: 'Процесс уже остановлен' }
        }

        try {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'])
            } else {
                proc.child.kill('SIGTERM')
            }
        } catch {}

        runningDaemons.delete(moduleId)
        return { success: true, message: 'Процесс успешно остановлен' }
    }

    // 2. СТАТУС ПРОЦЕССА И ЛОГИ
    if (action === 'status') {
        const proc = runningDaemons.get(moduleId)
        return {
            running: !!proc,
            pid: proc?.pid,
            startedAt: proc?.startedAt,
            logs: proc?.logs || []
        }
    }

    // 3. ЗАПУСК ПРОЦЕССА В ФОНЕ (action === 'start')
    if (runningDaemons.has(moduleId)) {
        const existing = runningDaemons.get(moduleId)!
        return {
            success: true,
            message: 'Модуль уже запущен в фоновом режиме',
            pid: existing.pid,
            running: true
        }
    }

    const moduleDoc = await DynamicModule.findById(moduleId)
    if (!moduleDoc || moduleDoc.format !== 'py') {
        throw createError({ statusCode: 404, message: 'Python-модуль не найден' })
    }

    // Создаем папку запуска
    const runId = `daemon_${moduleId}_${Date.now()}`
    const runDir = path.join(os.tmpdir(), runId)
    await fs.mkdir(runDir, { recursive: true })

    // Раскладываем файлы модуля
    const mainFileName = `${moduleDoc.fileName || 'main'}.py`
    const mainFilePath = path.join(runDir, mainFileName)
    await fs.writeFile(mainFilePath, moduleDoc.code || '', 'utf-8')

    if (Array.isArray(moduleDoc.files)) {
        for (const f of moduleDoc.files) {
            if (!f.path) continue
            const targetPath = path.join(runDir, sanitizeRelativePath(f.path))
            await fs.mkdir(path.dirname(targetPath), { recursive: true })
            await fs.writeFile(targetPath, f.code || '', 'utf-8')
        }
    }

    const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
    const logsBuffer: string[] = []

    // Запускаем через detached, чтобы процесс не висел на текущем потоке
    const child = spawn(pythonCmd, [mainFileName], {
        cwd: runDir,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1'
        }
    })

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
            console.error(`[Daemon ${moduleDoc.name} ERR]`, text)
        }
    })

    child.on('close', (code) => {
        console.log(`[Daemon ${moduleDoc.name}] Завершен с кодом ${code}`)
        runningDaemons.delete(moduleId)
        fs.rm(runDir, { recursive: true, force: true }).catch(() => {})
    })

    runningDaemons.set(moduleId, managed)

    return {
        success: true,
        message: `Скрипт запущен в фоне (PID: ${child.pid})`,
        pid: child.pid,
        running: true
    }
})