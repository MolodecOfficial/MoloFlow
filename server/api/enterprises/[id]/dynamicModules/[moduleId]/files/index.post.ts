import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { resolveActor, toHttpError } from '~~/server/utils/moloDb/access'
import { findModule, updateModule } from '~~/server/utils/modules'

// body: { action: 'add' | 'update' | 'delete', file, oldPath? }
export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id')
        const key = getRouterParam(event, 'moduleId')
        if (!enterpriseId || !key) throw createError({ statusCode: 400, message: 'Отсутствуют обязательные параметры' })
        await resolveActor(event, enterpriseId, 'schema')

        const body = (await readBody(event)) || {}
        const { action, file, oldPath } = body

        const current: any = await findModule(enterpriseId, key)
        if (!current) throw createError({ statusCode: 404, message: 'Модуль не найден' })

        let files: any[] = Array.isArray(current.files) ? [...current.files] : []
        const now = new Date().toISOString()

        if (action === 'add') {
            if (!file?.path) throw createError({ statusCode: 400, message: 'Укажите путь файла' })
            files.push({ ...file, createdAt: now, updatedAt: now })
        } else if (action === 'update') {
            if (!file?.path) throw createError({ statusCode: 400, message: 'Укажите путь файла' })
            let index = -1
            if (oldPath) index = files.findIndex((f) => f.path === oldPath)
            if (index === -1) index = files.findIndex((f) => f.path === file.path)
            if (index === -1) {
                files.push({ ...file, createdAt: now, updatedAt: now })
            } else {
                files[index] = { ...files[index], ...file, updatedAt: now }
            }
        } else if (action === 'delete') {
            if (!file?.path) throw createError({ statusCode: 400, message: 'Укажите путь файла' })
            files = files.filter((f) => f.path !== file.path)
        } else {
            throw createError({ statusCode: 400, message: 'Неизвестное действие' })
        }

        // updateModule проверяет права, валидирует пути и обновляет каталог
        const saved: any = await updateModule(event, enterpriseId, String(current._id), { files })
        return { success: true, files: saved.files }
    } catch (e) {
        throw toHttpError(e)
    }
})
