// Создание / изменение эндпоинта в MoloDB предприятия.
import { randomBytes } from 'node:crypto'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import mongoose from 'mongoose'
import { tenantModels } from '~~/server/utils/tenantDb'
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
        const Endpoint = tenantModels(enterpriseId).MoloEndpoint
        const DynamicModule = tenantModels(enterpriseId).DynamicModule
        const body = (await readBody(event)) || {}

        const slug = String(body.slug || '').trim().replace(/^\/+|\/+$/g, '')
        if (!SLUG_RE.test(slug) || slug.includes('//')) throw bad('Адрес: строчные латинские буквы, цифры, «-», «_» и «/», до 64 символов')

        const methods = [...new Set<string>((Array.isArray(body.methods) ? body.methods : ['POST']).map((m: any) => String(m).toUpperCase()))]
        if (!methods.length || methods.some((m) => !METHODS.includes(m))) throw bad(`Методы: ${METHODS.join(', ')}`)
        const access = ['public', 'key', 'members'].includes(body.access) ? body.access : 'members'

        const moduleId = String(body.moduleId || '')
        if (!mongoose.Types.ObjectId.isValid(moduleId)) throw bad('Выберите модуль')
        const mod: any = await DynamicModule.findById(moduleId).lean()
        if (!mod) throw bad('Модуль не найден', 404)
        if (mod.format !== 'js' && mod.format !== 'ts') throw bad('Эндпоинт можно привязать только к js/ts-модулю')

        const file = String(body.file || '').trim()
        if (file) {
            const known = (mod.files || []).some((f: any) => f.isServerFile && (f.path === file || f.name === file))
            if (!known) throw bad('Серверный файл не найден в модуле')
        }

        const existing: any = body._id && mongoose.Types.ObjectId.isValid(body._id)
            ? await Endpoint.findOne({ _id: body._id, enterpriseId }).lean() : null
        const secret = access === 'key'
            ? (existing?.secret && body.regenerateKey !== true ? existing.secret : randomBytes(24).toString('base64url'))
            : ''
        const fields = {
            enterpriseId, slug, description: String(body.description || '').slice(0, 200),
            methods, moduleId, file, access, secret, enabled: body.enabled !== false,
            updatedAt: new Date()
        }

        try {
            if (body._id && !existing) throw bad('Эндпоинт не найден', 404)
            if (existing) {
                await Endpoint.updateOne({ _id: existing._id, enterpriseId }, { $set: fields })
                return { success: true, endpoint: { _id: String(existing._id), ...fields } }
            }
            if (await Endpoint.countDocuments({ enterpriseId }) >= MAX_ENDPOINTS) throw bad(`Можно создать не больше ${MAX_ENDPOINTS} эндпоинтов`, 409)
            const created = await Endpoint.create({ ...fields, createdBy: { _id: actor.id, name: actor.name || '' } })
            return { success: true, endpoint: { _id: String(created._id), ...fields } }
        } catch (e: any) {
            if (e?.code === 11000) throw bad(`Эндпоинт с адресом «${slug}» уже существует`, 409)
            throw e
        }
    } catch (e) { throw toHttpError(e) }
})
