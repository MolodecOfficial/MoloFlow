import { Plugin } from '~~/server/models/plugin.model'
import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'enterpriseId')
    if (!enterpriseId) {
        throw createError({ statusCode: 400, message: 'ID предприятия не указан' })
    }

    const user = event.context.user
    const body = await readBody(event)

    if (!body.name) {
        throw createError({ statusCode: 400, message: 'Название плагина обязательно' })
    }
    if (!body.fileName) {
        throw createError({ statusCode: 400, message: 'Название файла плагина обязательно' })
    }
    if (!body.targetFileName) {
        throw createError({ statusCode: 400, message: 'Укажите fileName модуля, к которому относится плагин' })
    }

    // Плагин обязан ссылаться на реально существующий в этом предприятии
    // модуль. Ищем строго по enterpriseId, чтобы нельзя было привязать
    // плагин к чужому модулю по угаданному fileName.
    const targetModule = await DynamicModule.findOne({
        enterpriseId,
        fileName: body.targetFileName,
        isActive: true
    }).select('_id fileName').lean()

    if (!targetModule) {
        throw createError({
            statusCode: 404,
            message: `Модуль с fileName "${body.targetFileName}" не найден в этом предприятии`
        })
    }

    const files = (body.files || []).map((file: any) => ({
        name: file.name,
        path: file.path,
        format: file.format,
        code: file.code || '',
        isServerFile: file.isServerFile || false,
        size: file.size || 0
    }))

    let plugin
    try {
        plugin = await Plugin.create({
            name: body.name,
            fileName: body.fileName,
            description: body.description || '',
            targetFileName: targetModule.fileName,
            targetModuleId: targetModule._id,
            enterpriseId,
            createdBy: user ? { _id: user.id, name: user.name, role: user.role } : { _id: 'system', name: 'System' },
            isEnabled: body.isEnabled !== undefined ? !!body.isEnabled : true,
            files,
            dependencies: body.dependencies ? new Map(Object.entries(body.dependencies)) : new Map(),
            devDependencies: body.devDependencies ? new Map(Object.entries(body.devDependencies)) : new Map()
        })
    } catch (err: any) {
        if (err?.code === 11000) {
            throw createError({ statusCode: 409, message: 'Плагин с таким именем уже существует для этого модуля' })
        }
        throw err
    }

    return { success: true, plugin }
})