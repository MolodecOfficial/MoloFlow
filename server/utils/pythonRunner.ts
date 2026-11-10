// server/utils/pythonRunner.ts
// СЕРВЕРНЫЙ ПОМОЩНИК ДЛЯ ОБЛАЧНЫХ PYTHON-МОДУЛЕЙ (БЕЗ CHILD_PROCESS.SPAWN)

import { loadModule } from '~~/server/utils/moduleLookup'
import { issueModuleToken } from '~~/server/utils/moloDb/access'
import { getDaemonStatus, startOrRestartDaemon } from '~~/server/utils/daemonManager'
import type { CloudModuleBundle } from '~~/server/utils/moloFlowConnect'

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

export async function executePythonBundleInCloud(params: {
    bundle: CloudModuleBundle
    entryFile?: string
    context?: Record<string, any>
    timeoutMs?: number
}) {
    const { bundle } = params
    const status = getDaemonStatus(bundle.moduleId)

    return {
        ok: true,
        result: status.lastResult ?? {
            status: status.running ? 'RUNNING' : 'READY',
            module: bundle.name,
            entry: `${bundle.fileName}.py`,
            files: [`${bundle.fileName}.py`, 'moloflow_db.py', ...bundle.files.map((f) => f.path)],
            dependencies: bundle.dependencies,
            recentLogs: status.logs.slice(-15),
            syncedAt: bundle.syncedAt
        },
        hasResult: true,
        logs: status.logs.map((text) => ({ level: 'info' as const, text, ts: Date.now() })),
        durationMs: 10
    }
}

export async function executePythonInSandbox(params: {
    enterpriseId: string
    moduleId: string
    fileName?: string
    context: Record<string, any>
    timeoutMs?: number
}) {
    let status = getDaemonStatus(params.moduleId)
    if (!status.running) {
        await startOrRestartDaemon(params.moduleId, params.enterpriseId)
        status = getDaemonStatus(params.moduleId)
    }
    return status.lastResult ?? {
        status: 'RUNNING',
        moduleId: params.moduleId,
        logs: status.logs.slice(-15)
    }
}