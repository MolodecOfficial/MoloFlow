// server/api/py/run.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

interface PyFilePayload {
    path: string
    code: string
}

interface RunRequestBody {
    entry?: string
    files?: PyFilePayload[]
    context?: Record<string, any>
    timeoutMs?: number
}

function sanitizeRelativePath(rawPath: string): string {
    const normalized = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '')
    return normalized.replace(/^[\\\/]+/, '')
}

// Собираем раннер безопасным склеиванием строк, чтобы esbuild не ругался на двоеточия
function getRunnerCode(): string {
    return [
        'import sys',
        'import os',
        'import json',
        'import inspect',
        'import asyncio',
        '',
        'run_dir = os.path.dirname(os.path.abspath(__file__))',
        'if run_dir not in sys.path:',
        '    sys.path.insert(0, run_dir)',
        '',
        "entry_filename = sys.argv[1] if len(sys.argv) > 1 else 'main.py'",
        "context_raw = sys.argv[2] if len(sys.argv) > 2 else '{}'",
        '',
        'try:',
        '    context = json.loads(context_raw)',
        'except Exception:',
        '    context = {}',
        '',
        'try:',
        '    target_file = os.path.join(run_dir, entry_filename)',
        "    with open(target_file, 'r', encoding='utf-8') as f:",
        '        code_content = f.read()',
        '',
        "    ns = {'__name__': '__main__', '__file__': target_file, 'context': context}",
        "    compiled = compile(code_content, entry_filename, 'exec')",
        '    exec(compiled, ns)',
        '',
        '    entry_fn = None',
        "    for name in ('main', 'handler', 'run'):",
        '        if name in ns and inspect.isfunction(ns[name]):',
        '            entry_fn = ns[name]',
        '            break',
        '',
        '    result = None',
        '    has_result = False',
        '',
        '    if entry_fn:',
        '        sig = inspect.signature(entry_fn)',
        '        if len(sig.parameters) > 0:',
        '            res = entry_fn(context)',
        '        else:',
        '            res = entry_fn()',
        '',
        '        if inspect.isawaitable(res):',
        '            res = asyncio.run(res)',
        '        result = res',
        '        has_result = True',
        '',
        '    print("---MOLO_OUTPUT_START---")',
        '    print(json.dumps({"ok": True, "result": result, "hasResult": has_result}, default=str))',
        '    print("---MOLO_OUTPUT_END---")',
        'except Exception as e:',
        '    import traceback',
        '    print("---MOLO_OUTPUT_START---")',
        '    print(json.dumps({',
        '        "ok": False,',
        '        "error": {',
        '            "type": type(e).__name__,',
        '            "message": str(e),',
        '            "traceback": traceback.format_exc()',
        '        }',
        '    }))',
        '    print("---MOLO_OUTPUT_END---")',
        '    sys.exit(1)'
    ].join('\n')
}

export default defineEventHandler(async (event) => {
    const body = (await readBody<RunRequestBody>(event)) || {}
    const { entry = 'main.py', files = [], context = {}, timeoutMs = 30000 } = body

    if (!files.length && !entry) {
        throw createError({ statusCode: 400, statusMessage: 'Не переданы файлы для запуска' })
    }

    const runId = `molo_py_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const runDir = path.join(os.tmpdir(), runId)
    await fs.mkdir(runDir, { recursive: true })

    const logs: Array<{ level: 'info' | 'error' | 'system'; text: string; ts: number }> = []
    const startTime = Date.now()

    try {
        // 1. Раскладываем файлы модуля
        for (const f of files) {
            if (!f.path) continue
            const targetPath = path.join(runDir, sanitizeRelativePath(f.path))
            await fs.mkdir(path.dirname(targetPath), { recursive: true })
            await fs.writeFile(targetPath, f.code || '', 'utf-8')
        }

        // 2. Создаем файл раннера
        const runnerPath = path.join(runDir, '__molo_runner__.py')
        await fs.writeFile(runnerPath, getRunnerCode(), 'utf-8')

        // 3. Запускаем нативный системный Python
        const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
        const sanitizedEntry = sanitizeRelativePath(entry)

        // server/api/py/run.post.ts

        const child = spawn(pythonCmd, ['__molo_runner__.py', sanitizedEntry, JSON.stringify(context)], {
            cwd: runDir,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PYTHONDONTWRITEBYTECODE: '1',
                PYTHONIOENCODING: 'utf-8', // <-- Включает UTF-8 для stdout/stderr
                PYTHONUTF8: '1'            // <-- Включает режим UTF-8 в Python 3.7+ (PEP 540)
            }
        })

        let stdoutData = ''
        let stderrData = ''

        child.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString()
        })

        child.stderr.on('data', (chunk) => {
            stderrData += chunk.toString()
        })

        const exitPromise = new Promise<{ code: number | null }>((resolve) => {
            child.on('close', (code) => resolve({ code }))
            child.on('error', (err) => {
                logs.push({ level: 'error', text: `Ошибка интерпретатора Python: ${err.message}`, ts: Date.now() })
                resolve({ code: -1 })
            })
        })

        const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
            setTimeout(() => resolve({ timeout: true }), timeoutMs)
        })

        const runOutcome = await Promise.race([exitPromise, timeoutPromise])

        if ('timeout' in runOutcome) {
            child.kill('SIGKILL')
            return {
                ok: false,
                result: null,
                hasResult: false,
                durationMs: Date.now() - startTime,
                logs: [{ level: 'error', text: 'Таймаут выполнения скрипта', ts: Date.now() }],
                error: { type: 'TimeoutError', message: 'Время выполнения скрипта истекло' }
            }
        }

        let parsedResult: any = { ok: true, result: null, hasResult: false }
        const match = stdoutData.match(/---MOLO_OUTPUT_START---([\s\S]*?)---MOLO_OUTPUT_END---/)

        if (match) {
            try {
                parsedResult = JSON.parse(match[1].trim())
            } catch {
                parsedResult = { ok: false, error: { message: 'Не удалось разобрать JSON-ответ скрипта' } }
            }
            stdoutData = stdoutData.replace(/---MOLO_OUTPUT_START---[\s\S]*?---MOLO_OUTPUT_END---/, '').trim()
        }

        if (stdoutData) {
            stdoutData.split('\n').filter(Boolean).forEach((line) => {
                logs.push({ level: 'info', text: line, ts: Date.now() })
            })
        }

        if (stderrData) {
            stderrData.split('\n').filter(Boolean).forEach((line) => {
                logs.push({ level: 'error', text: line, ts: Date.now() })
            })
        }

        return {
            ok: parsedResult.ok,
            result: parsedResult.result,
            hasResult: parsedResult.hasResult,
            error: parsedResult.error,
            logs,
            durationMs: Date.now() - startTime
        }
    } finally {
        try {
            await fs.rm(runDir, { recursive: true, force: true })
        } catch {}
    }
})