// server/api/py/run.post.ts
import { defineEventHandler, readBody } from 'h3'
import { startOrRestartDaemon } from '~~/server/utils/daemonManager'
import { getTenantId } from '~~/server/utils/tenantContext'

export default defineEventHandler(async (event) => {
    const startTime = Date.now()
    const body = (await readBody(event)) || {}
    const enterpriseId = body.enterpriseId || getTenantId(event)
    const moduleId = body.moduleId

    if (moduleId && enterpriseId) {
        try {
            const res = await startOrRestartDaemon(
                String(moduleId),
                String(enterpriseId),
                body.context || {}
            )
            return {
                ok: true,
                result: body.lastResult ?? res.result,
                hasResult: true,
                logs: [
                    { level: 'system', text: res.message, ts: Date.now() }
                ],
                durationMs: Date.now() - startTime
            }
        } catch (e: any) {
            return {
                ok: false,
                result: null,
                hasResult: false,
                error: { type: 'CloudSyncError', message: e?.message || String(e), traceback: '', line: null, column: null, file: null },
                logs: [{ level: 'error', text: e?.message || String(e), ts: Date.now() }],
                durationMs: Date.now() - startTime
            }
        }
    }

    return {
        ok: true,
        result: body.lastResult ?? null,
        hasResult: body.lastResult !== undefined,
        logs: [],
        durationMs: Date.now() - startTime
    }
})