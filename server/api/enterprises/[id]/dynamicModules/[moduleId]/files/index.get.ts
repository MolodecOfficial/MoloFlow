import { defineEventHandler, getRouterParam, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { findModule } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const key = getRouterParam(event, 'moduleId')
        if (!enterpriseId || !key) throw createError({ statusCode: 400, message: 'Отсутствуют параметры' })
        await resolveActor(event, enterpriseId, 'data')

        const doc: any = await findModule(enterpriseId, key)
        if (!doc) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        const files = (doc.files || []).map((f: any) => ({
            name: f.name,
            path: f.path,
            format: f.format,
            code: f.code || '',
            isServerFile: !!f.isServerFile,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt
        }))

        return {
            success: true,
            mainFile: {
                name: `${doc.fileName}.${doc.format}`,
                path: `${doc.fileName}.${doc.format}`,
                format: doc.format,
                code: doc.code || ''
            },
            files
        }
    } catch (e) {
        throw toHttpError(e)
    }
})
