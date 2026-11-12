import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'

import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { getMoloFlowGatewayPublicUrl, isMoloFlowGatewayConfigured } from '~~/server/utils/moloFlowGateway'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')

        if (!enterpriseId || !mongoose.Types.ObjectId.isValid(enterpriseId)) {
            throw createError({
                statusCode: 400,
                message: 'Некорректный идентификатор предприятия'
            })
        }

        await resolveActor(event, enterpriseId, 'schema')

        const Endpoint = tenantModels(enterpriseId).MoloEndpoint
        const docs = await Endpoint.find({ enterpriseId })
            .sort({ slug: 1 })
            .lean()

        return {
            success: true,
            endpoints: docs.map((d: any) => ({
                _id: String(d._id),
                slug: d.slug,
                description: d.description || '',
                methods: d.methods || [],
                moduleId: String(d.moduleId || ''),
                file: d.file || '',

                // Существующая авторизация MoloFlow API.
                access: 'key',
                enabled: d.enabled,
                stats: d.stats || {},

                // MoloFlow Gateway (совместимые имена полей в существующих документах).
                connectPublished: !!d.connectPublished && isMoloFlowGatewayConfigured(),
                connectUrl: d.connectPublished && isMoloFlowGatewayConfigured()
                    ? getMoloFlowGatewayPublicUrl(enterpriseId, d.slug)
                    : '',
                connectPublishedAt: d.connectPublishedAt || null,
                connectLastError: d.connectLastError || '',

                // Никаких открытых ключей и хешей в ответе.
                connectAuthEnabled: d.connectAuthEnabled !== false,
                hasConnectKey: !!d.connectKeyHash,
                connectKeyCreatedAt: d.connectKeyCreatedAt || null,
                connectKeyLastUsedAt: d.connectKeyLastUsedAt || null,

                updatedAt: d.updatedAt
            }))
        }
    } catch (e) {
        throw toHttpError(e)
    }
})