// server/utils/pythonEnv.ts
// Изолированное Python-окружение (venv) на каждый модуль + установка его pip-зависимостей.
// Бот запускается только после того, как его пакеты реально установлены → не будет "module Not Found".
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createError } from 'h3'

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const VERSION_RE = /^[A-Za-z0-9.*+_\-<>=!~^, ]{0,60}$/
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i
const PIP_TIMEOUT_MS = 10 * 60 * 1000

export function systemPython(): string {
    return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
}

function envRoot(): string {
    return process.env.MOLO_PY_ENV_DIR || path.join(os.homedir(), '.moloflow', 'py-envs')
}

function venvPython(dir: string): string {
    return process.platform === 'win32'
        ? path.join(dir, 'Scripts', 'python.exe')
        : path.join(dir, 'bin', 'python')
}

async function exists(p: string): Promise<boolean> {
    try {
        await fs.access(p)
        return true
    } catch {
        return false
    }
}

function tail(text: string, max = 1500): string {
    return text.length > max ? text.slice(-max) : text
}

/** Защита от инъекций аргументов в pip: имя — только буквы/цифры/._-, версия — только безопасные символы. */
export function validateDependencies(deps: Record<string, string>): void {
    for (const [name, version] of Object.entries(deps)) {
        if (!NAME_RE.test(name)) {
            throw createError({ statusCode: 400, message: `Некорректное имя pip-пакета: «${name}»` })
        }
        if (version && !VERSION_RE.test(String(version))) {
            throw createError({ statusCode: 400, message: `Некорректная версия пакета ${name}: «${version}»` })
        }
    }
}

/** Преобразует запись "name: version" (как в UI) в спецификатор pip. */
export function toPipSpec(name: string, version?: string): string {
    const v = String(version || '').trim()
    if (!v || v === 'latest' || v === '*') return name
    if (v.startsWith('^')) return `${name}>=${v.slice(1)}`
    if (v.startsWith('~') && !v.startsWith('~=')) return `${name}~=${v.slice(1)}`
    if (/^[<>=!~]/.test(v)) return `${name}${v}`
    return `${name}==${v}`
}

function runProcess(cmd: string, args: string[], log?: (text: string) => void): Promise<{ code: number | null; output: string }> {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, {
            env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PIP_DISABLE_PIP_VERSION_CHECK: '1' }
        })
        let output = ''
        const onData = (chunk: Buffer) => {
            const text = chunk.toString()
            output += text
            log?.(text)
        }
        const timer = setTimeout(() => proc.kill('SIGKILL'), PIP_TIMEOUT_MS)
        proc.stdout.on('data', onData)
        proc.stderr.on('data', onData)
        proc.on('error', (err) => {
            clearTimeout(timer)
            reject(new Error(`Не удалось запустить ${cmd}: ${err.message}`))
        })
        proc.on('close', (code) => {
            clearTimeout(timer)
            resolve({ code, output })
        })
    })
}

/**
 * Возвращает путь к Python, в котором установлены зависимости модуля.
 * Без зависимостей — системный Python. С зависимостями — venv в ~/.moloflow/py-envs/<moduleId>.
 */
export async function ensurePythonEnv(
    moduleId: string,
    deps: Record<string, string>,
    opts: { force?: boolean; log?: (text: string) => void } = {}
): Promise<string> {
    if (!OBJECT_ID_RE.test(moduleId)) {
        throw createError({ statusCode: 400, message: 'Некорректный moduleId' })
    }
    validateDependencies(deps || {})

    const basePython = systemPython()
    const specs = Object.entries(deps || {}).map(([n, v]) => toPipSpec(n, v)).sort()
    if (!specs.length) return basePython

    const dir = path.join(envRoot(), moduleId)
    const marker = path.join(dir, '.deps.json')
    const hash = createHash('sha256').update(JSON.stringify(specs)).digest('hex')
    const python = venvPython(dir)

    if (!opts.force && (await exists(python))) {
        try {
            const saved = JSON.parse(await fs.readFile(marker, 'utf-8'))
            if (saved.hash === hash) return python
        } catch {}
    }

    await fs.mkdir(envRoot(), { recursive: true })

    if (!(await exists(python))) {
        const created = await runProcess(basePython, ['-m', 'venv', dir], opts.log)
        if (created.code !== 0 || !(await exists(python))) {
            await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
            throw createError({
                statusCode: 500,
                message: `Не удалось создать виртуальное окружение Python. Установите: sudo apt install python3-venv\n${tail(created.output, 500)}`
            })
        }
    }

    const args = ['-m', 'pip', 'install', ...specs]
    if (opts.force) args.push('--force-reinstall')
    const installed = await runProcess(python, args, opts.log)
    if (installed.code !== 0) {
        if (installed.output.includes('No module named pip')) {
            await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
            throw createError({ statusCode: 500, message: 'В venv нет pip. Установите: sudo apt install python3-venv python3-pip' })
        }
        throw createError({ statusCode: 500, message: `pip install завершился с ошибкой:\n${tail(installed.output)}` })
    }

    await fs.writeFile(marker, JSON.stringify({ hash, specs, updatedAt: new Date().toISOString() }), 'utf-8')
    return python
}
