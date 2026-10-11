import { defineEventHandler, readBody, createError } from 'h3'
import { Department } from '~~/server/models/department.model'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { enterpriseId, key, name, description } = body

    if (!enterpriseId || !name) {
        throw createError({ statusCode: 400, message: 'enterpriseId и name обязательны' })
    }

    const cleanKey = String(key || name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-я_]/gi, '_')
        .replace(/_+/g, '_')

    const department = await Department.findOneAndUpdate(
        { enterpriseId, key: cleanKey },
        {
            $set: {
                name: name.trim(),
                key: cleanKey,
                description: description || ''
            }
        },
        { upsert: true, new: true }
    )

    return department
})