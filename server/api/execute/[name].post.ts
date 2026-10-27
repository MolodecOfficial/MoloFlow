// server/api/execute/[name].post.ts
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { getModuleSandbox } from '~~/app/utils/moduleSandbox'
import { enterpriseOfModule, loadModule } from '~~/server/utils/moduleLookup'

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'name')
    const body = await readBody(event)
    const { fileName, data } = body || {}

    if (!moduleId) {
        throw createError({ statusCode: 400, message: 'moduleId is required' })
    }

    const enterpriseId = await enterpriseOfModule(moduleId, data?.enterpriseId)
    const mod: any = enterpriseId ? await loadModule(moduleId, enterpriseId, { lean: true }) : null
    if (!mod) {
        throw createError({ statusCode: 404, message: 'Module not found' })
    }

    // ── PYTHON: фоновый демон ──
    if (mod.format === 'py') {
        try {
            const daemonRes = await $fetch<{ success: boolean; pid: number; message: string }>('/api/py/daemon', {
                method: 'POST',
                body: {
                    action: 'restart',
                    moduleId: mod._id.toString(),
                    enterpriseId
                }
            })

            return {
                result: daemonRes,
                logs: [`[Daemon] ${daemonRes.message}`],
                entries: [{ level: 'info', source: 'Daemon', text: daemonRes.message, ts: Date.now() }],
                actions: []
            }
        } catch (error: any) {
            console.error('[Execute API Python Daemon Error]:', error)
            throw createError({
                statusCode: error.statusCode || 500,
                message: error.message || 'Не удалось запустить фоновый Python-демон',
                data: {
                    logs: [error.message],
                    entries: [{ level: 'error', source: 'Daemon', text: String(error.message), ts: Date.now() }],
                    actions: []
                }
            })
        }
    }

    // ── JS / TS через VM ──
    try {
        const sandbox = await getModuleSandbox(moduleId, String(enterpriseId))
        const { result, logs, entries, actions } = await sandbox.executeFile(fileName, data || {})
        return { result, logs, entries, actions }
    } catch (error: any) {
        console.error('[Execute API Error]:', error.message)
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Script execution failed',
            data: {
                logs: error.data?.logs || [],
                entries: error.data?.entries || [],
                actions: error.data?.actions || []
            }
        })
    }
})