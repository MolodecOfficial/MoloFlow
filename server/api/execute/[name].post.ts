// server/api/execute/[name].post.ts
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { getModuleSandbox } from '~~/app/utils/moduleSandbox'
import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'name')
    const body = await readBody(event)
    const { fileName, data } = body || {}

    if (!moduleId) {
        throw createError({
            statusCode: 400,
            message: 'moduleId is required'
        })
    }

    const mod = await DynamicModule.findById(moduleId)
    if (!mod) {
        throw createError({ statusCode: 404, message: 'Module not found' })
    }

    // ── ОБРАБОТКА PYTHON: Запуск фонового демона 24/7 ──
    if (mod.format === 'py') {
        try {
            // Вызываем внутренний эндпоинт демона
            const daemonRes = await $fetch<{ success: boolean; pid: number; message: string }>('/api/py/daemon', {
                method: 'POST',
                body: {
                    action: 'start',
                    moduleId: mod._id.toString(),
                    enterpriseId: mod.enterpriseId
                }
            })

            return {
                result: daemonRes,
                logs: [`[Daemon] ${daemonRes.message}`]
            }
        } catch (error: any) {
            console.error('[Execute API Python Daemon Error]:', error)
            throw createError({
                statusCode: error.statusCode || 500,
                message: error.message || 'Не удалось запустить фоновый Python-демон',
                data: { logs: [error.message] }
            })
        }
    }

    // ── ОБРАБОТКА JS / TS ЧЕРЕЗ VM ──
    try {
        const sandbox = await getModuleSandbox(moduleId, mod.enterpriseId)
        const { result, logs } = await sandbox.executeFile(fileName, data || {})
        return { result, logs }
    } catch (error: any) {
        console.error('[Execute API Error]:', error.message)
        const logs = error.data?.logs || []
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Script execution failed',
            data: { logs }
        })
    }
})