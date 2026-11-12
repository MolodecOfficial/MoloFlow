// server/utils/pythonRunner.ts
import { spawn } from 'node:child_process'
import path from 'node:path'
import { loadModule } from '~~/server/utils/moduleLookup'
import { issueModuleToken } from '~~/server/utils/moloDb/access'
import {
    findServerPythonBin,
    getDaemonStatus,
    prepareServerPyWorkspace,
    startOrRestartDaemon
} from '~~/server/utils/daemonManager'

export interface CloudModuleBundle {
    moduleId: string
    enterpriseId: string
    name: string
    fileName: string
    format: 'py'
    code: string
    files: Array<{ name: string; path: string; format: string; code: string }>
    dependencies: Record<string, string>
    moloApiUrl?: string
    moloDbToken?: string
    syncedAt: string
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

    return {
        moduleId: String(mod._id),
        enterpriseId: String(enterpriseId),
        name: mod.name || mod.fileName || 'Python Module',
        fileName: mod.fileName || 'main',
        format: 'py',
        code: String(mod.code || ''),
        files,
        dependencies: depsObj,
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

    const allCode = [mod.code || '', ...(mod.files || []).map((f: any) => f.code || '')].join('\n')
    const isBot = allCode.includes('start_polling') || allCode.includes('Dispatcher(') || allCode.includes('while True:')

    if (isBot) {
        let status = getDaemonStatus(params.moduleId)
        if (!status.running) {
            await startOrRestartDaemon(params.moduleId, params.enterpriseId, params.context)
            status = getDaemonStatus(params.moduleId)
        }
        return {
            type: 'python_bot_daemon',
            running: status.running,
            pid: status.pid,
            mode: status.mode,
            publicUrl: status.publicUrl,
            logs: status.logs.slice(-30)
        }
    }

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
                MOLO_CONTEXT_JSON: JSON.stringify(params.context || {}),
                MOLO_IS_DAEMON: '0'
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

