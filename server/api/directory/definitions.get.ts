import { defineEventHandler, getQuery, createError } from 'h3'
import { DirectoryDefinition } from '~~/server/models/directoryDefinition.model'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const enterpriseId = query.enterpriseId as string

    if (!enterpriseId) {
        throw createError({ statusCode: 400, message: 'Параметр enterpriseId обязателен' })
    }

    const customDefs = await DirectoryDefinition.find({ enterpriseId }).lean()
    return customDefs || []
})