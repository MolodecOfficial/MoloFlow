// server/api/enterprises/[id]/moloEndpoints/index.post.ts
// Создание / изменение эндпоинта (нужно право MODULES_DEV). Если передан _id — это изменение.
import { randomBytes } from 'node:crypto'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import mongoose from 'mongoose'
import { DynamicModule } from '~~/server/models/dynamicModules.model'
import { MoloEndpoint } from '~~/server/models/moloEndpoint.model'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'

const SLUG_RE = /^[a-z0-9][a-z0-9_\-/]{0,63}$/
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const MAX_ENDPOINTS = 100

const bad = (message: string, statusCode = 400) => createError({ statusCode, message })

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        if (!enterpriseId) throw bad('Не указано предприятие')
        const actor = await resolveActor(event, enterpriseId, 'schema')
        const body = (await readBody(event)) || {}

        const slug = String(body.slug || '').trim().replace(/^\/+|\/+$/g, '')
        if (!SLUG_RE.test(slug) || slug.includes('//')) {
            throw bad('Адрес: строчные латинские буквы, цифры, «-», «_» и «/», до 64 символов')
        }

        const methods = [...new Set<string>((Array.isArray(body.methods) ? body.methods : ['POST']).map((m: any) => String(m).toUpperCase()))]
        if (!methods.length || methods.some((m) => !METHODS.includes(m))) throw bad(`Методы: ${METHODS.join(', ')}`)

        const access = ['public', 'key', 'members'].includes(body.access) ? body.access : 'members'

        const moduleId = String(body.moduleId || '')
        if (!mongoose.Types.ObjectId.isValid(moduleId)) throw bad('Выберите модуль')
        const mod: any = await DynamicModule.findOne({ _id: moduleId, enterpriseId }).lean()
        if (!mod) throw bad('Модуль не найден', 404)
        if (mod.format !== 'js' && mod.format !== 'ts') throw bad('Эндпоинт можно привязать только к js/ts-модулю')

        const file = String(body.file || '').trim()
        if (file) {
            const known = (mod.files || []).some((f: any) => f.isServerFile && (f.path === file || f.name === file))
            if (!known) throw bad('Серверный файл не найден в модуле')
        }

        const fields = {
            slug,
            description: String(body.description || '').slice(0, 200),
            methods,
            moduleId,
            file,
            access,
            enabled: body.enabled !== false,
            updatedAt: new Date()
        }

        const existing: any = body._id && mongoose.Types.ObjectId.isValid(body._id)
            ? await MoloEndpoint.findOne({ _id: body._id, enterpriseId }).lean()
            : null

        let secret = ''
        if (access === 'key') {
            secret = existing?.secret && body.regenerateKey !== true ? existing.secret : randomBytes(24).toString('base64url')
        }

        try {
            if (existing) {
                await MoloEndpoint.updateOne({ _id: existing._id }, { $set: { ...fields, secret } })
                return { success: true, endpoint: { _id: String(existing._id), ...fields, secret } }
            }
            if ((await MoloEndpoint.countDocuments({ enterpriseId })) >= MAX_ENDPOINTS) {
                throw bad(`Можно создать не больше ${MAX_ENDPOINTS} эндпоинтов`, 409)
            }
            const created = await MoloEndpoint.create({
                enterpriseId,
                ...fields,
                secret,
                createdBy: { _id: actor.id, name: actor.name || '' }
            })
            return { success: true, endpoint: { _id: String(created._id), ...fields, secret } }
        } catch (e: any) {
            if (e?.code === 11000) throw bad(`Эндпоинт с адресом «${slug}» уже существует`, 409)
            throw e
        }
    } catch (e) {
        throw toHttpError(e)
    }
})