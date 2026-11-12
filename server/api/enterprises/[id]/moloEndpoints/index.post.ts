// server/api/enterprises/[id]/moloEndpoints/index.post.ts
import { randomBytes, createHash } from 'node:crypto'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import mongoose from 'mongoose'

import { tenantModels } from '~~/server/utils/tenantDb'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { getMoloFlowGatewayPublicUrl, isMoloFlowGatewayConfigured } from '~~/server/utils/moloFlowGateway'

const SLUG_RE = /^[a-z0-9][a-z0-9_/-]{0,63}$/
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const MAX_ENDPOINTS = 100

const bad = (message: string, statusCode = 400) =>
    createError({ statusCode, message })

function generateConnectKey() {
    return randomBytes(32).toString('base64url')
}

function hashConnectKey(key: string) {
    return createHash('sha256').update(key, 'utf8').digest('hex')
}

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')

        if (!enterpriseId || !mongoose.Types.ObjectId.isValid(enterpriseId)) {
            throw bad('Некорректный идентификатор предприятия')
        }

        const actor = await resolveActor(event, enterpriseId, 'schema')

        const models = tenantModels(enterpriseId)
        const Endpoint = models.MoloEndpoint
        const DynamicModule = models.DynamicModule

        const body = (await readBody(event)) || {}

        const slug = String(body.slug || '')
            .trim()
            .replace(/^\/+|\/+$/g, '')

        if (!SLUG_RE.test(slug) || slug.includes('//')) {
            throw bad('Адрес: строчные латинские буквы, цифры, «-», «_» и «/», до 64 символов')
        }

        const methods = [
            ...new Set<string>(
                (Array.isArray(body.methods) ? body.methods : ['POST'])
                    .map((m: any) => String(m).toUpperCase())
            )
        ]

        if (!methods.length || methods.some(m => !METHODS.includes(m))) {
            throw bad(`Методы: ${METHODS.join(', ')}`)
        }

        const access = 'key'

        const moduleId = String(body.moduleId || '')

        if (!mongoose.Types.ObjectId.isValid(moduleId)) {
            throw bad('Выберите модуль')
        }

        const mod: any = await DynamicModule.findById(moduleId).lean()

        if (!mod) throw bad('Модуль не найден', 404)

        if (mod.format !== 'js' && mod.format !== 'ts' && mod.format !== 'py') {
            throw bad('Эндпоинт можно привязать к js, ts или py модулю')
        }

        const file = String(body.file || '').trim()

        if (file) {
            const known = (mod.files || []).some(
                (f: any) => (f.isServerFile || mod.format === 'py') && (f.path === file || f.name === file)
            )

            if (!known) throw bad('Файл не найден в выбранном модуле')
        }

        const existing: any =
            body._id && mongoose.Types.ObjectId.isValid(body._id)
                ? await Endpoint.findOne({ _id: body._id, enterpriseId }).lean()
                : null

        if (body._id && !existing) {
            throw bad('Эндпоинт не найден', 404)
        }

        // Старый query-string secret больше не используется. Доступ только через X-Molo-Key.
        const secret = ''

        // MoloFlow Gateway always requires a Molo-Key. Keep the hash on this existing endpoint document.
        const connectAuthEnabled = true

        const regenerateConnectKey = body.regenerateConnectKey === true

        let connectKey = ''
        let connectKeyHash = existing?.connectKeyHash || ''
        let connectKeyCreatedAt = existing?.connectKeyCreatedAt || null

        if (!connectKeyHash || regenerateConnectKey) {
            connectKey = generateConnectKey()
            connectKeyHash = hashConnectKey(connectKey)
            connectKeyCreatedAt = new Date()
        }

        const fields: Record<string, any> = {
            enterpriseId,
            slug,
            description: String(body.description || '').slice(0, 200),
            methods,
            moduleId,
            file,
            access,
            secret,
            enabled: body.enabled !== false,

            connectAuthEnabled,
            connectKeyHash,
            connectKeyCreatedAt,

            updatedAt: new Date()
        }

        if (existing) {
            const routeChanged = existing.slug !== slug
            const endpointDisabled = fields.enabled === false

            if (existing.connectPublished && (routeChanged || endpointDisabled)) {
                fields.connectPublished = false
                fields.connectUrl = ''
                fields.connectPublishedAt = null
                fields.connectLastError = ''
            }

            await Endpoint.updateOne(
                { _id: existing._id, enterpriseId },
                { $set: fields }
            )

            const isPublished = fields.connectPublished ?? !!existing.connectPublished
            const gatewayUrl = isPublished && isMoloFlowGatewayConfigured()
                ? getMoloFlowGatewayPublicUrl(enterpriseId, slug)
                : ''

            return {
                success: true,
                endpoint: {
                    _id: String(existing._id),
                    slug,
                    description: fields.description,
                    methods,
                    moduleId,
                    file,
                    access,
                    enabled: fields.enabled,
                    connectAuthEnabled,
                    hasConnectKey: !!connectKeyHash,
                    connectKeyCreatedAt,
                    connectPublished: fields.connectPublished ?? !!existing.connectPublished,
                    connectUrl: gatewayUrl,
                    connectPublishedAt: fields.connectPublishedAt ?? existing.connectPublishedAt ?? null,
                    connectLastError: fields.connectLastError ?? existing.connectLastError ?? '',
                    ...(connectKey ? { connectKey } : {})
                },
                ...(connectKey ? { connectKey } : {})
            }
        }

        if (await Endpoint.countDocuments({ enterpriseId }) >= MAX_ENDPOINTS) {
            throw bad(`Можно создать не больше ${MAX_ENDPOINTS} эндпоинтов`, 409)
        }

        const created = await Endpoint.create({
            ...fields,
            createdBy: {
                _id: actor.id,
                name: actor.name || ''
            }
        })

        return {
            success: true,
            endpoint: {
                _id: String(created._id),
                slug,
                description: fields.description,
                methods,
                moduleId,
                file,
                access,
                enabled: fields.enabled,
                connectAuthEnabled,
                hasConnectKey: !!connectKeyHash,
                connectKeyCreatedAt,
                connectPublished: false,
                connectUrl: '',
                connectPublishedAt: null,
                connectLastError: ''
            },
            ...(connectKey ? { connectKey } : {})
        }
    } catch (e) {
        throw toHttpError(e)
    }
})