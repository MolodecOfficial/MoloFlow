// server/api/enterprises/[id]/moloEndpoints/[eid]/unpublish.post.ts
import { createError, defineEventHandler, getRouterParam } from 'h3'
import mongoose from 'mongoose'
import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { stopDaemon } from '~~/server/utils/daemonManager'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id') || ''
        const eid = getRouterParam(event, 'eid') || ''
        if (!mongoose.Types.ObjectId.isValid(enterpriseId) || !mongoose.Types.ObjectId.isValid(eid)) {
            throw createError({ statusCode: 400, message: 'Некорректный идентификатор предприятия или эндпоинта' })
        }
        await resolveActor(event, enterpriseId, 'schema')
        const Endpoint = tenantModels(enterpriseId).MoloEndpoint
        const endpoint: any = await Endpoint.findOne({ _id: eid, enterpriseId }).lean()
        if (!endpoint) throw createError({ statusCode: 404, message: 'Эндпоинт не найден' })

        if (endpoint.moduleId) {
            await stopDaemon(String(endpoint.moduleId))
        }

        const mainDb = mongoose.connection.db
        if (mainDb) {
            await mainDb.collection('gateway_endpoints').updateOne(
                { enterpriseId, slug: endpoint.slug },
                { $set: { enabled: false, updatedAt: new Date() } }
            )
        }

        const gatewayUrl = (process.env.MOLOFLOW_GATEWAY_URL || '').trim().replace(/\/+$/, '')
        const publishKey = (process.env.MOLOFLOW_GATEWAY_PUBLISH_KEY || process.env.GATEWAY_PUBLISH_KEY || '').trim()
        if (gatewayUrl && publishKey) {
            await $fetch(`${gatewayUrl}/api/v1/unpublish`, {
                method: 'POST',
                headers: { 'x-gateway-publish-key': publishKey },
                body: { enterpriseId, slug: endpoint.slug, moduleId: String(endpoint.moduleId || '') }
            }).catch(() => {})
        }

        await Endpoint.updateOne(
            { _id: eid, enterpriseId },
            {
                $set: {
                    connectPublished: false,
                    connectUrl: '',
                    connectPublishedAt: null,
                    connectLastError: ''
                }
            }
        )
        return { success: true, published: false }
    } catch (error) {
        throw toHttpError(error)
    }
})