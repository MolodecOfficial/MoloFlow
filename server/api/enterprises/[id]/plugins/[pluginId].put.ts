import { Plugin } from '~~/server/models/plugin.model'
import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'enterpriseId')
    const pluginId = getRouterParam(event, 'pluginId')
    if (!enterpriseId || !pluginId) {
        throw createError({ statusCode: 400, message: 'ID предприятия или плагина не указан' })
    }

    const body = await readBody(event)

    const existing = await Plugin.findOne({ _id: pluginId, enterpriseId, isActive: true })
    if (!existing) {
        throw createError({ statusCode: 404, message: 'Плагин не найден' })
    }

    let targetFileName = existing.targetFileName
    let targetModuleId = existing.targetModuleId

    // Если fileName цели меняется — переваливаем привязку заново,
    // с той же валидацией существования, что и при создании.
    if (body.targetFileName && body.targetFileName !== existing.targetFileName) {
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

        targetFileName = targetModule.fileName
        targetModuleId = targetModule._id
    }

    const updateData: any = {
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        targetFileName,
        targetModuleId,
        isEnabled: body.isEnabled !== undefined ? !!body.isEnabled : existing.isEnabled
    }

    if (body.files) {
        updateData.files = body.files.map((file: any) => ({
            name: file.name,
            path: file.path,
            format: file.format,
            code: file.code || '',
            isServerFile: file.isServerFile || false,
            size: file.size || 0
        }))
    }
    if (body.dependencies) {
        updateData.dependencies = new Map(Object.entries(body.dependencies))
    }
    if (body.devDependencies) {
        updateData.devDependencies = new Map(Object.entries(body.devDependencies))
    }

    let plugin
    try {
        plugin = await Plugin.findOneAndUpdate(
            { _id: pluginId, enterpriseId, isActive: true },
            { $set: updateData },
            { new: true }
        )
    } catch (err: any) {
        if (err?.code === 11000) {
            throw createError({ statusCode: 409, message: 'Плагин с таким именем уже существует для этого модуля' })
        }
        throw err
    }

    return { success: true, plugin }
})