import { defineEventHandler, getQuery, createError } from 'h3'
import { Department } from '~~/server/models/department.model'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const enterpriseId = query.enterpriseId as string

    if (!enterpriseId) {
        throw createError({ statusCode: 400, message: 'enterpriseId обязателен' })
    }

    const list = await Department.find({ enterpriseId }).sort({ name: 1 }).lean()
    return list || []
})