// server/api/py/daemon.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { enterpriseOfModule } from '~~/server/utils/moduleLookup'
import {
    listAllDaemons,
    getDaemonStatus,
    stopDaemon,
    startOrRestartDaemon,
    recordDaemonHeartbeat
} from '~~/server/utils/daemonManager'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { action = 'restart', moduleId, enterpriseId } = body || {}

    if (action === 'list') {
        return { success: true, daemons: listAllDaemons() }
    }

    if (!moduleId) {
        throw createError({ statusCode: 400, message: 'moduleId обязателен' })
    }

    if (action === 'heartbeat') {
        const eid = await enterpriseOfModule(moduleId, enterpriseId)
        if (!eid) return { ok: false }
        return await recordDaemonHeartbeat({
            moduleId: String(moduleId),
            enterpriseId: String(eid),
            log: body.log,
            result: body.result,
            finished: body.finished
        })
    }

    if (action === 'stop') {
        await stopDaemon(moduleId)
        return { success: true, message: 'Процесс остановлен' }
    }

    if (action === 'status') {
        return getDaemonStatus(moduleId)
    }

    const eid = await enterpriseOfModule(moduleId, enterpriseId)
    if (!eid) {
        throw createError({ statusCode: 404, message: 'Предприятие модуля не найдено' })
    }

    return await startOrRestartDaemon(moduleId, eid)
})