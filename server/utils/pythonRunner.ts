// server/utils/pythonRunner.ts
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { loadModule } from '~~/server/utils/moduleLookup'
import { issueModuleToken } from '~~/server/utils/moloDb/access'
import { PY_CLIENT_SOURCE } from '~~/server/utils/moloDb/pythonClient'
import { buildVendorZipBase64 } from '~~/server/utils/pythonVendorBundler'

export interface CloudModuleBundle {
    moduleId: string
    enterpriseId: string
    name: string
    fileName: string
    format: 'py'
    code: string
    files: Array<{ name: string; path: string; format: string; code: string }>
    dependencies: Record<string, string>
    vendorZipBase64?: string
    moloApiUrl?: string
    moloDbToken?: string
    syncedAt: string
}

let cachedPythonBin: string | null | undefined = undefined

export function findServerPythonBin(): string | null {
    if (cachedPythonBin !== undefined) return cachedPythonBin
    const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python']
    for (const cmd of candidates) {
        try {
            const res = spawnSync(cmd, ['--version'], { timeout: 3000, encoding: 'utf8' })
            if (res.status === 0 && (res.stdout.includes('Python 3') || res.stderr.includes('Python 3'))) {
                cachedPythonBin = cmd
                return cmd
            }
        } catch {}
    }
    cachedPythonBin = null
    return null
}

const ONE_SHOT_PY_RUNNER = `
import asyncio, inspect, json, os, sys, traceback

work_dir = os.path.abspath(os.path.dirname(__file__))
if work_dir not in sys.path:
    sys.path.insert(0, work_dir)

entry_file = os.environ.get("MOLO_ENTRY_FILE", "main.py")
context_raw = os.environ.get("MOLO_CONTEXT_JSON", "{}")

async def _run():
    ctx = json.loads(context_raw or "{}")
    target = os.path.join(work_dir, entry_file)
    with open(target, "r", encoding="utf-8") as f:
        source = f.read()

    import moloflow_db
    ns = {"__name__": "__molo_runner__", "__file__": target, "context": ctx, "db": moloflow_db.db}
    code = compile(source, target, "exec")
    exec(code, ns)

    for fn_name in ("main", "handler", "run"):
        fn = ns.get(fn_name)
        if inspect.isfunction(fn):
            sig = inspect.signature(fn)
            res = fn(ctx) if len(sig.parameters) > 0 else fn()
            if inspect.isawaitable(res):
                res = await res
            print("\\n__MOLO_RESULT__:" + json.dumps({"ok": True, "result": res}, ensure_ascii=False, default=str), flush=True)
            return

    print("\\n__MOLO_RESULT__:" + json.dumps({"ok": True, "result": None}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        tb = traceback.format_exc()
        sys.stderr.write(tb + "\\n")
        print("\\n__MOLO_RESULT__:" + json.dumps({"ok": False, "error": str(e), "traceback": tb}, ensure_ascii=False), flush=True)
        sys.exit(1)
`

function normalizeFileName(raw: string, format = 'py'): string {
    let p = String(raw || 'main.py').trim().replace(/\\/g, '/').replace(/^\.?\/+/, '')
    if (!/\.[a-z0-9]+$/i.test(p)) p += `.${format || 'py'}`
    return p
}

export async function prepareServerPyWorkspace(moduleDoc: any, enterpriseId: string, entryOverride?: string) {
    const workDir = path.join(os.tmpdir(), 'moloflow_server_py', `${enterpriseId}_${moduleDoc._id}`)
    await fs.mkdir(workDir, { recursive: true })

    const mainFile = normalizeFileName(moduleDoc.fileName || 'main', 'py')
    await fs.writeFile(path.join(workDir, mainFile), String(moduleDoc.code || ''), 'utf8')
    if (mainFile !== 'main.py') {
        await fs.writeFile(path.join(workDir, 'main.py'), String(moduleDoc.code || ''), 'utf8')
    }

    for (const f of moduleDoc.files || []) {
        const rel = normalizeFileName(f.path || f.name, f.format || 'py')
        if (rel.includes('..')) continue
        const full = path.join(workDir, rel)
        await fs.mkdir(path.dirname(full), { recursive: true })
        await fs.writeFile(full, String(f.code || ''), 'utf8')
    }

    await fs.writeFile(path.join(workDir, 'moloflow_db.py'), PY_CLIENT_SOURCE, 'utf8')
    await fs.writeFile(path.join(workDir, '_molo_runner.py'), ONE_SHOT_PY_RUNNER, 'utf8')

    const entryFile = entryOverride ? normalizeFileName(entryOverride, 'py') : mainFile
    return { workDir, entryFile }
}

export async function buildPythonBundleFromMoloDb(
    enterpriseId: string,
    moduleId: string
): Promise<CloudModuleBundle> {
    const mod: any = await loadModule(moduleId, enterpriseId, { lean: true })
    if (!mod) throw new Error('Python-модуль не найден в MoloDB')

    const depsObj: Record<string, string> = mod.dependencies instanceof Map
        ? Object.fromEntries(mod.dependencies)
        : { ...((mod.dependencies as any) || {}) }

    const files = (Array.isArray(mod.files) ? mod.files : []).map((f: any) => ({
        name: String(f.name || f.path || 'file.py'),
        path: String(f.path || f.name || 'file.py').replace(/\\/g, '/').replace(/^\.?\/+/, ''),
        format: String(f.format || 'py'),
        code: String(f.code || '')
    }))

    const dbToken = await issueModuleToken(String(enterpriseId), String(mod._id))
    const apiBase = (process.env.MOLO_API_URL || `http://127.0.0.1:${process.env.NITRO_PORT || process.env.PORT || '3000'}`).replace(/\/+$/, '')

    let vendorZipBase64: string | undefined = undefined
    if (Object.keys(depsObj).length > 0) {
        try {
            vendorZipBase64 = await buildVendorZipBase64(depsObj)
        } catch (e) {
            console.warn('[buildPythonBundleFromMoloDb] Не удалось собрать vendorZipBase64:', e)
        }
    }

    return {
        moduleId: String(mod._id),
        enterpriseId: String(enterpriseId),
        name: mod.name || mod.fileName || 'Python Module',
        fileName: mod.fileName || 'main',
        format: 'py',
        code: String(mod.code || ''),
        files,
        dependencies: depsObj,
        vendorZipBase64,
        moloApiUrl: apiBase,
        moloDbToken: dbToken,
        syncedAt: new Date().toISOString()
    }
}

export async function executePythonInSandbox(params: {
    enterpriseId: string
    moduleId: string
    fileName?: string
    context: Record<string, any>
    timeoutMs?: number
}) {
    const mod: any = await loadModule(params.moduleId, params.enterpriseId, { lean: true })
    if (!mod) throw new Error('Python-модуль не найден')

    const pyBin = findServerPythonBin()
    if (!pyBin) {
        return { status: 'READY', moduleId: params.moduleId }
    }

    const { workDir, entryFile } = await prepareServerPyWorkspace(mod, params.enterpriseId, params.fileName)
    const dbToken = await issueModuleToken(String(params.enterpriseId), String(mod._id))
    const apiBase = (process.env.MOLO_API_URL || `http://127.0.0.1:${process.env.NITRO_PORT || process.env.PORT || '3000'}`).replace(/\/+$/, '')

    return new Promise((resolve) => {
        const logs: string[] = []
        let stdoutBuf = ''

        const child = spawn(pyBin, ['-u', path.join(workDir, '_molo_runner.py')], {
            cwd: workDir,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONUNBUFFERED: '1',
                MOLO_API_URL: apiBase,
                MOLO_DB_TOKEN: dbToken,
                MOLO_ENTERPRISE_ID: String(params.enterpriseId),
                MOLO_ENTRY_FILE: entryFile,
                MOLO_CONTEXT_JSON: JSON.stringify(params.context || {})
            }
        })

        const timer = setTimeout(() => {
            try { child.kill('SIGKILL') } catch {}
            resolve({ ok: false, error: 'Timeout', logs })
        }, params.timeoutMs || 25000)

        child.stdout.on('data', (c) => {
            const t = String(c)
            stdoutBuf += t
            t.split('\n').filter(l => !l.startsWith('__MOLO_RESULT__:')).forEach(l => { if (l.trim()) logs.push(l.trimEnd()) })
        })
        child.stderr.on('data', (c) => {
            String(c).split('\n').forEach(l => { if (l.trim()) logs.push(l.trimEnd()) })
        })
        child.on('close', () => {
            clearTimeout(timer)
            const idx = stdoutBuf.lastIndexOf('__MOLO_RESULT__:')
            if (idx !== -1) {
                try {
                    const parsed = JSON.parse(stdoutBuf.slice(idx + '__MOLO_RESULT__:'.length).trim())
                    resolve(parsed.result ?? parsed)
                    return
                } catch {}
            }
            resolve({ ok: true, logs })
        })
    })
}
