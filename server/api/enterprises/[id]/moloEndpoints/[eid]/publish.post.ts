// server/api/enterprises/[id]/moloEndpoints/[eid]/publish.post.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { getMoloFlowGatewayPublicUrl, isMoloFlowGatewayConfigured } from '~~/server/utils/moloFlowGateway'
import { getModuleSandbox } from '~~/app/utils/moduleSandbox'
import { buildPythonBundleFromMoloDb } from '~~/server/utils/pythonRunner'

function isPythonBot(code: string, files: any[] = []): boolean {
    const all = [code, ...files.map(f => f?.code || '')].join('\n')
    return (
        all.includes('start_polling') ||
        all.includes('Dispatcher(') ||
        all.includes('aiogram') ||
        all.includes('infinity_polling') ||
        all.includes('while True:')
    )
}

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id') || ''
        const eid = getRouterParam(event, 'eid') || ''

        if (!mongoose.Types.ObjectId.isValid(enterpriseId) || !mongoose.Types.ObjectId.isValid(eid)) {
            throw createError({ statusCode: 400, message: 'Некорректный идентификатор' })
        }

        await resolveActor(event, enterpriseId, 'schema')
        if (!isMoloFlowGatewayConfigured()) {
            throw createError({ statusCode: 503, message: 'MoloFlow Gateway не настроен. Укажите MOLOFLOW_GATEWAY_URL.' })
        }

        const models = tenantModels(enterpriseId)
        const endpoint: any = await models.MoloEndpoint.findOne({ _id: eid, enterpriseId }).lean()
        if (!endpoint) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })
        if (!endpoint.enabled) throw createError({ statusCode: 409, message: 'Сначала включите эндпоинт' })

        const moduleDoc: any = await models.DynamicModule.findOne({ _id: endpoint.moduleId, isActive: { $ne: false } }).lean()
        if (!moduleDoc) throw createError({ statusCode: 409, message: 'Модуль эндпоинта не найден или отключён' })

        if (!/^[a-f0-9]{64}$/i.test(String(endpoint.connectKeyHash || ''))) {
            throw createError({ statusCode: 409, message: 'Для публикации выпустите Molo-Key. Защита не настроена.' })
        }

        let finalData: any = null
        let pyBundle: any = null
        const isPy = moduleDoc.format === 'py'
        const isBot = isPy && isPythonBot(moduleDoc.code || '', moduleDoc.files || [])

        // 1. Обработка Python-модуля (бота или скрипта) либо JS/TS-модуля
        if (isPy) {
            pyBundle = await buildPythonBundleFromMoloDb(enterpriseId, String(moduleDoc._id))

            finalData = {
                type: 'python_bot_daemon',
                status: 'running',
                engine: 'gateway',
                module: moduleDoc.name,
                startedAt: new Date().toISOString(),
                files: [
                    `${moduleDoc.fileName || 'main'}.py`,
                    ...(moduleDoc.files || []).map((f: any) => f.path || f.name)
                ]
            }
        } else {
            try {
                const sandbox = await getModuleSandbox(String(endpoint.moduleId), enterpriseId)
                const execRes: any = await sandbox.executeFile(endpoint.file || 'main', {
                    method: 'GET',
                    path: endpoint.slug,
                    query: {},
                    headers: {}
                })

                let resultPayload = execRes?.result
                if (resultPayload && typeof resultPayload === 'object' && 'body' in resultPayload) {
                    resultPayload = resultPayload.body
                }
                finalData = resultPayload
            } catch (execError: any) {
                throw createError({
                    statusCode: 500,
                    message: `Ошибка выполнения модуля: ${execError?.message || execError}`
                })
            }
        }

        const publicUrl = getMoloFlowGatewayPublicUrl(enterpriseId, endpoint.slug)
        const now = new Date()

        // 2. Сохраняем в коллекцию gateway_endpoints (включая moduleBundle для Python)
        const mainDb = mongoose.connection.db
        if (mainDb) {
            await mainDb.collection('gateway_endpoints').updateOne(
                { enterpriseId, slug: endpoint.slug },
                {
                    $set: {
                        endpointId: String(endpoint._id),
                        enterpriseId,
                        name: endpoint.description || endpoint.slug,
                        slug: endpoint.slug,
                        moduleId: String(endpoint.moduleId),
                        file: endpoint.file || '',
                        format: moduleDoc.format,
                        isBot,
                        moduleBundle: pyBundle,
                        methods: endpoint.methods || ['GET'],
                        keyHash: String(endpoint.connectKeyHash).toLowerCase(),
                        data: finalData,
                        enabled: true,
                        updatedAt: now
                    },
                    $setOnInsert: { createdAt: now }
                },
                { upsert: true }
            )
        }

        // 3. Отправляем публикацию на MoloFlow Gateway по HTTP
        const gatewayUrl = (process.env.MOLOFLOW_GATEWAY_URL || '').trim().replace(/\/+$/, '')
        const publishKey = (process.env.MOLOFLOW_GATEWAY_PUBLISH_KEY || process.env.GATEWAY_PUBLISH_KEY || '').trim()

        if (gatewayUrl && publishKey) {
            try {
                await $fetch(`${gatewayUrl}/api/v1/publish`, {
                    method: 'POST',
                    headers: { 'x-gateway-publish-key': publishKey },
                    body: {
                        endpointId: String(endpoint._id),
                        enterpriseId,
                        name: endpoint.description || endpoint.slug,
                        slug: endpoint.slug,
                        moduleId: String(endpoint.moduleId),
                        file: endpoint.file || '',
                        format: moduleDoc.format,
                        isBot,
                        moduleBundle: pyBundle,
                        methods: endpoint.methods || ['GET'],
                        keyHash: endpoint.connectKeyHash,
                        data: finalData
                    }
                })
            } catch (err: any) {
                console.warn('[Gateway HTTP Sync Warning]: использована синхронизация через БД:', err?.message)
            }
        }

        await models.MoloEndpoint.updateOne(
            { _id: eid, enterpriseId },
            {
                $set: {
                    connectPublished: true,
                    connectUrl: publicUrl,
                    connectPublishedAt: now,
                    connectLastError: '',
                    data: finalData,
                    updatedAt: now
                }
            }
        )

        return {
            success: true,
            published: true,
            publicUrl,
            data: finalData
        }
    } catch (error: any) {
        throw toHttpError(error)
    }
})