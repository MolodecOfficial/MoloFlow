import { defineEventHandler, readBody, createError } from 'h3'
import { DirectoryDefinition } from '~~/server/models/directoryDefinition.model'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { enterpriseId, slug, title, aliases, fields, codeLabel, titleLabel, groupByKey } = body

    if (!enterpriseId || !slug || !title) {
        throw createError({ statusCode: 400, message: 'enterpriseId, slug и title обязательны' })
    }

    const cleanSlug = String(slug).toLowerCase().trim().replace(/\s+/g, '_')
    const cleanAliases = Array.isArray(aliases)
        ? aliases.map((a: string) => a.trim().toLowerCase()).filter(Boolean)
        : []

    const created = await DirectoryDefinition.findOneAndUpdate(
        { enterpriseId, slug: cleanSlug },
        {
            $set: {
                title,
                aliases: cleanAliases,
                fields: fields || [],
                codeLabel: codeLabel || 'Код / Идентификатор',
                titleLabel: titleLabel || 'Наименование',
                groupByKey: groupByKey || ''
            }
        },
        { upsert: true, new: true }
    )

    return created
})