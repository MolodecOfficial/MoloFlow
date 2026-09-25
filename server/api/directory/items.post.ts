import { defineEventHandler, readBody, createError } from 'h3'
import { DirectoryItem } from '~~/server/models/directoryItem.model'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { enterpriseId, directorySlug, title, code, description, attributes } = body

    if (!enterpriseId || !directorySlug || !title) {
        throw createError({
            statusCode: 400,
            message: 'enterpriseId, directorySlug и title обязательны'
        })
    }

    const newItem = await DirectoryItem.create({
        enterpriseId,
        directorySlug,
        title,
        code: code || '',
        description: description || '',
        attributes: attributes || {}
    })

    return newItem
})