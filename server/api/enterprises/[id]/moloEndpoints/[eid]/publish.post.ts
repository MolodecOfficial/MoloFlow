// server/api/enterprises/[id]/moloEndpoints/[eid]/publish.post.ts
import { createError, defineEventHandler, getRouterParam } from 'h3'
import mongoose from 'mongoose'

import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { getModuleSandbox } from '~~/app/utils/moduleSandbox'
import { buildPythonBundleFromMoloDb, executePythonBundleInCloud } from '~~/server/utils/pythonRunner'
import {
    getMoloFlowConnectPublicUrl,
    publishMoloFlowSnapshot
} from '~~/server/utils/moloFlowConnect'

const TIMEOUT_MS = 15000

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id') || ''
        const eid = getRouterParam(event, 'eid') || ''

        if (!mongoose.Types.ObjectId.isValid(enterpriseId) || !mongoose.Types.ObjectId.isValid(eid)) {
            throw createError({ statusCode: 400, message: 'Некорректный идентификатор' })
        }

        await resolveActor(event, enterpriseId, 'schema')
        const models = tenantModels(enterpriseId)

        const endpoint: any = await models.MoloEndpoint.findOne({ _id: eid, enterpriseId }).lean()
        if (!endpoint) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })

        if (!endpoint.enabled) {
            throw createError({ statusCode: 409, message: 'Сначала включите эндпоинт' })
        }

        const mod: any = await models.DynamicModule.findOne({ _id: endpoint.moduleId, isActive: true }).select('format name').lean()
        if (!mod) throw createError({ statusCode: 409, message: 'Модуль эндпоинта не найден' })

        const connectAuthEnabled = endpoint.connectAuthEnabled !== false
        const connectKeyHash = String(endpoint.connectKeyHash || '')

        const context = {
            method: 'GET',
            path: endpoint.slug,
            query: {},
            body: undefined,
            headers: {},
            ip: 'molo-flow-connect-publisher'
        }

        let data: any
        let pyBundle = null

        if (mod.format === 'py') {
            // Собираем весь Python-модуль со всеми его файлами и зависимостями из MoloDB
            pyBundle = await buildPythonBundleFromMoloDb(enterpriseId, String(endpoint.moduleId))
            const execOut = await executePythonBundleInCloud({
                bundle: pyBundle,
                entryFile: endpoint.file || undefined,
                context,
                timeoutMs: TIMEOUT_MS
            })
            data = execOut.result
            if (data && typeof data === 'object' && Number.isInteger(data.status) && 'body' in data) {
                data = data.body
            }
        } else {
            // Для JS/TS серверных модулей
            const sandbox = await getModuleSandbox(String(endpoint.moduleId), enterpriseId)
            let timer: any
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(createError({ statusCode: 504, message: 'Обработчик не ответил вовремя' })), TIMEOUT_MS)
            })

            const execution: any = await Promise.race([
                sandbox.executeFile(endpoint.file || 'main', context),
                timeout
            ]).finally(() => { clearTimeout(timer) })

            data = execution?.result
            if (data && typeof data === 'object' && Number.isInteger(data.status) && 'body' in data) {
                data = data.body
            }
        }

        const published = await publishMoloFlowSnapshot(
            enterpriseId,
            endpoint.slug,
            data,
            {
                enabled: connectAuthEnabled,
                keyHash: connectAuthEnabled ? connectKeyHash : ''
            },
            pyBundle
        )

        const publicUrl = published.publicUrl || getMoloFlowConnectPublicUrl(enterpriseId, endpoint.slug)

        await models.MoloEndpoint.updateOne(
            { _id: eid, enterpriseId },
            {
                $set: {
                    connectPublished: true,
                    connectUrl: publicUrl,
                    connectPublishedAt: new Date(),
                    connectLastError: ''
                }
            }
        )

        return {
            success: true,
            published: true,
            publicUrl,
            status: 'OK'
        }
    } catch (error: any) {
        throw toHttpError(error)
    }
})