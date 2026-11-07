import { createError, defineEventHandler, readBody } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { ensureDirectoryStudioCollection } from '~~/server/utils/enterpriseDb'
import { requireTenantId } from '~~/server/utils/tenantContext'

const SLUG_RE = /^[a-z][a-z0-9_]{0,48}$/
const FIELD_RE = /^[A-Za-z][A-Za-z0-9_]{0,48}$/
const ALLOWED_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'file', 'link']

export default defineEventHandler(async (event) => {
    try {
        const body = (await readBody(event)) || {}
        const enterpriseId = requireTenantId(event)

        // Авторизация по уровню данных для участников с правами редактирования
        await resolveActor(event, enterpriseId, 'data')

        const slug = String(body.slug || '').trim().toLowerCase()
        const title = String(body.title || '').trim()

        if (!SLUG_RE.test(slug)) {
            throw createError({ statusCode: 400, message: 'Некорректный идентификатор справочника' })
        }
        if (!title) {
            throw createError({ statusCode: 400, message: 'Укажите название справочника' })
        }

        const fields = Array.isArray(body.fields) ? body.fields.slice(0, 100).map((field: any) => {
            const key = String(field?.key || field?.name || '').trim()
            if (!FIELD_RE.test(key) || ['_id', 'id', 'enterpriseId', 'createdAt', 'updatedAt'].includes(key)) {
                throw createError({
                    statusCode: 400,
                    message: `Некорректный ключ поля «${key}»`
                })
            }
            const rawType = String(field.type || 'text').toLowerCase()
            const type = ALLOWED_TYPES.includes(rawType) ? rawType : 'text'

            return {
                key,
                label: String(field.label || key).trim().slice(0, 100),
                type,
                required: field.required === true,
                placeholder: String(field.placeholder || '').slice(0, 200),
                span: Number(field.span) === 2 ? 2 : 1,
                options: Array.isArray(field.options) ? field.options.slice(0, 100) : []
            }
        }) : []

        const aliases = Array.isArray(body.aliases)
            ? [...new Set(body.aliases.map((a: any) => String(a).trim().toLowerCase()).filter(Boolean))]
            : []

        const { DirectoryDefinition } = tenantModels(enterpriseId)

        const existing = await DirectoryDefinition.findOne({ slug }).lean()

        const def = await DirectoryDefinition.findOneAndUpdate(
            { slug },
            {
                $set: {
                    enterpriseId,
                    slug,
                    title,
                    description: String(body.description || ''),
                    aliases,
                    fields,
                    icon: String(body.icon || existing?.icon || 'folder'),
                    codeLabel: String(body.codeLabel || existing?.codeLabel || 'Код / Идентификатор'),
                    titleLabel: String(body.titleLabel || existing?.titleLabel || 'Наименование'),
                    groupByKey: String(body.groupByKey ?? existing?.groupByKey ?? ''),
                    isSystem: existing?.isSystem ?? false
                }
            },
            { upsert: true, new: true, runValidators: true }
        ).lean()

        // Обновляем виртуальную коллекцию в Studio
        try {
            await ensureDirectoryStudioCollection(enterpriseId, slug, title, fields)
        } catch (e) {
            console.warn('[Directory Studio Sync Warning]:', e)
        }

        return def
    } catch (error) {
        throw toHttpError(error)
    }
})