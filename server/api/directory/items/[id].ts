import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { DirectoryItem } from '~~/server/models/directoryItem.model'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const method = event.node.req.method

    if (!id) {
        throw createError({ statusCode: 400, message: 'ID записи не указан' })
    }

    if (method === 'PATCH') {
        const body = await readBody(event)
        const updated = await DirectoryItem.findByIdAndUpdate(
            id,
            {
                $set: {
                    title: body.title,
                    code: body.code,
                    description: body.description,
                    attributes: body.attributes || {}
                }
            },
            { new: true }
        )
        if (!updated) {
            throw createError({ statusCode: 404, message: 'Запись не найдена' })
        }
        return updated
    }

    if (method === 'DELETE') {
        const deleted = await DirectoryItem.findByIdAndDelete(id)
        if (!deleted) {
            throw createError({ statusCode: 404, message: 'Запись не найдена' })
        }
        return { success: true }
    }

    throw createError({ statusCode: 405, message: 'Метод не поддерживается' })
})