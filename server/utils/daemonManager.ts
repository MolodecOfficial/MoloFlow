// server/utils/daemonManager.ts
// СЕРВЕРНЫЙ КООРДИНАТОР PYTHON-МОДУЛЕЙ И СИНХРОНИЗАЦИИ С CLOUDFLARE (БЕЗ CHILD_PROCESS.SPAWN)

import { loadModule } from '~~/server/utils/moduleLookup'
import { tenantModels } from '~~/server/utils/tenantDb'
import {
    publishMoloFlowSnapshot,
    updateMoloFlowBotStatus,
    getMoloFlowConnectPublicUrl,
    isMoloFlowConnectConfigured
} from '~~/server/utils/moloFlowConnect'

export interface ManagedCloudDaemon {
    pid: number
    moduleId: string
    enterpriseId: string
    name: string
    slug: string
    publicUrl: string
    logs: string[]
    lastResult: any
    startedAt: number
    running: boolean
}

const runningDaemons = new Map<string, ManagedCloudDaemon>()

function normalizeSlug(raw: string): string {
    return String(raw || 'module')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'module'
}

export async function stopDaemon(moduleId: string): Promise<boolean> {
    const proc = runningDaemons.get(moduleId)
    if (!proc) return false
    proc.running = false
    runningDaemons.delete(moduleId)
    await updateMoloFlowBotStatus(proc.enterpriseId, proc.slug, 'stopped').catch(() => {})
    return true
}

export function getDaemonStatus(moduleId: string) {
    const proc = runningDaemons.get(moduleId)
    return {
        running: !!proc?.running,
        pid: proc?.pid,
        publicUrl: proc?.publicUrl || null,
        startedAt: proc?.startedAt,
        lastResult: proc?.lastResult ?? null,
        logs: proc?.logs || []
    }
}

export function listAllDaemons() {
    const list = []
    for (const [mId, proc] of runningDaemons.entries()) {
        if (!proc.running) continue
        list.push({
            moduleId: mId,
            pid: proc.pid,
            publicUrl: proc.publicUrl,
            startedAt: proc.startedAt,
            running: true,
            logs: proc.logs.slice(-20)
        })
    }
    return list
}

export async function recordDaemonHeartbeat(params: {
    moduleId: string
    enterpriseId: string
    log?: string
    result?: any
    finished?: boolean
}) {
    const proc = runningDaemons.get(params.moduleId)
    if (!proc) return { ok: false }

    if (params.log) {
        proc.logs.push(params.log)
        if (proc.logs.length > 300) proc.logs.shift()
    }

    if (params.result !== undefined) {
        proc.lastResult = params.result
        if (isMoloFlowConnectConfigured()) {
            const { MoloEndpoint } = tenantModels(proc.enterpriseId)
            const linkedEndpoint: any = await MoloEndpoint.findOne({
                enterpriseId: proc.enterpriseId,
                moduleId: proc.moduleId
            }).lean()
            await publishMoloFlowSnapshot(
                proc.enterpriseId,
                proc.slug,
                params.result,
                {
                    enabled: linkedEndpoint ? linkedEndpoint.connectAuthEnabled !== false : false,
                    keyHash: linkedEndpoint?.connectKeyHash || ''
                }
            ).catch(() => {})
        }
    }

    if (params.finished) {
        proc.running = false
        runningDaemons.delete(params.moduleId)
    }

    return { ok: true }
}

export async function startOrRestartDaemon(moduleId: string, enterpriseId: string) {
    const moduleDoc: any = await loadModule(moduleId, enterpriseId, { lean: true })
    if (!moduleDoc || moduleDoc.format !== 'py') {
        throw new Error('Python-модуль не найден в MoloDB')
    }

    const { MoloEndpoint } = tenantModels(enterpriseId)
    const linkedEndpoint: any = await MoloEndpoint.findOne({
        enterpriseId,
        moduleId: String(moduleDoc._id)
    }).lean()

    const slug = linkedEndpoint?.slug || `py/${normalizeSlug(moduleDoc.fileName || moduleDoc.name)}`
    const filesList = (Array.isArray(moduleDoc.files) ? moduleDoc.files : []).map((f: any) => ({
        name: String(f.name || f.path || ''),
        path: String(f.path || f.name || ''),
        format: String(f.format || 'py'),
        code: String(f.code || '')
    }))

    const depsObj: Record<string, string> = moduleDoc.dependencies instanceof Map
        ? Object.fromEntries(moduleDoc.dependencies)
        : { ...((moduleDoc.dependencies as any) || {}) }

    const initialPayload = {
        status: 'RUNNING',
        module: moduleDoc.name,
        startedAt: new Date().toISOString(),
        files: [`${moduleDoc.fileName || 'main'}.py`, 'moloflow_db.py', ...filesList.map((f: any) => f.path)],
        dependencies: depsObj
    }

    let publicUrl = `/api/x/${enterpriseId}/${slug}`

    if (isMoloFlowConnectConfigured()) {
        try {
            const pub = await publishMoloFlowSnapshot(
                String(enterpriseId),
                slug,
                initialPayload,
                {
                    enabled: linkedEndpoint ? linkedEndpoint.connectAuthEnabled !== false : false,
                    keyHash: linkedEndpoint?.connectKeyHash || ''
                },
                {
                    moduleId: String(moduleDoc._id),
                    enterpriseId: String(enterpriseId),
                    name: moduleDoc.name,
                    fileName: moduleDoc.fileName || 'main',
                    format: 'py',
                    code: String(moduleDoc.code || ''),
                    files: filesList,
                    dependencies: depsObj,
                    syncedAt: new Date().toISOString()
                }
            )
            publicUrl = pub.publicUrl || getMoloFlowConnectPublicUrl(String(enterpriseId), slug)
        } catch {}
    }

    const pid = 2000 + Math.floor(Math.random() * 7000)
    const managed: ManagedCloudDaemon = {
        pid,
        moduleId: String(moduleDoc._id),
        enterpriseId: String(enterpriseId),
        name: moduleDoc.name,
        slug,
        publicUrl,
        logs: [`[Cloud] Ссылка активна: ${publicUrl}`],
        lastResult: initialPayload,
        startedAt: Date.now(),
        running: true
    }

    runningDaemons.set(String(moduleDoc._id), managed)

    return {
        success: true,
        pid,
        publicUrl,
        startedAt: managed.startedAt,
        logs: managed.logs,
        message: `[Cloudflare] Ссылка активна: ${publicUrl}`
    }
}