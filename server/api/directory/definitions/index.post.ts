import { defineEventHandler, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { tenantModels } from '~~/server/utils/tenantDb'
import { ensureDirectoryCollection } from '~~/server/utils/directoryCollections'
import { ensureDirectoryStudioCollection } from '~~/server/utils/enterpriseDb'
import { slugToCollection } from '~~/server/utils/directoryCollections'

// POST /api/directory/definitions   body: { enterpriseId, slug, title, aliases?, fields?, codeLabel?, titleLabel?, groupByKey? }
// Создаёт описание справочника и сразу его коллекцию dir_<slug>.
export default defineEventHandler(async (event) => {
    try {
        const b = (await readBody(event)) || {}
        const enterpriseId = String(b.enterpriseId || '')
        if (!enterpriseId || !b.slug || !b.title) {
            throw createError({ statusCode: 400, message: 'enterpriseId, slug и title обязательны' })
        }
        await resolveActor(event, enterpriseId, 'schema')
        const { DirectoryDefinition } = tenantModels(enterpriseId)

        // Use the same normalization for the definition, physical MongoDB collection,
        // and MoloDB Studio registry. Numeric names such as "1" are valid.
        const slug = String(b.slug).toLowerCase().trim().replace(/\s+/g, '_')
        const collectionName = slugToCollection(slug)
        const aliases = Array.isArray(b.aliases) ? b.aliases.map((a: string) => String(a).trim().toLowerCase()).filter(Boolean) : []

        const def = await DirectoryDefinition.findOneAndUpdate(
            { slug },
            {
                $set: {
                    enterpriseId,
                    slug,
                    title: String(b.title),
                    aliases,
                    fields: Array.isArray(b.fields) ? b.fields : [],
                    codeLabel: b.codeLabel || 'Код / Идентификатор',
                    titleLabel: b.titleLabel || 'Наименование',
                    groupByKey: b.groupByKey || ''
                }
            },
            { upsert: true, new: true }
        ).lean()

        // Create the physical tenant collection first, then register that exact name
        // in the MoloDB Studio metadata. This avoids UI-only custom directories.
        const physicalCollection = await ensureDirectoryCollection(enterpriseId, slug)
        await ensureDirectoryStudioCollection(enterpriseId, slug, String(b.title), Array.isArray(b.fields) ? b.fields.map((f: any) => ({
            name: String(f.key || f.name || ''), label: String(f.label || f.key || f.name || ''), type: String(f.type || 'string')
        })) : [])
        if (physicalCollection !== collectionName) {
            throw createError({ statusCode: 500, message: 'Имя коллекции справочника не совпало с реестром MoloDB' })
        }
        // Return the persisted definition including its tenant identifier.
        return await DirectoryDefinition.findById((def as any)._id).lean()
    } catch (e) {
        throw toHttpError(e)
    }
})
