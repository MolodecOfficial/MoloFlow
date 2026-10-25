import { defineEventHandler, getRouterParam, createError } from 'h3'
import { ModuleCatalog } from '~~/server/models/moduleCatalog.model'
import { tenantModels } from '~~/server/utils/tenantDb'
import { isOid, refreshModuleCatalog } from '~~/server/utils/modules'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id || !isOid(id)) throw createError({ statusCode: 400, message: 'Некорректный ID модуля' })

    await refreshModuleCatalog()
    const catalog: any = await ModuleCatalog.findOne({ _id: id, isPublic: true, isActive: { $ne: false } }).lean()
    if (!catalog) throw createError({ statusCode: 404, message: 'Публичный модуль не найден или отключён' })

    const { DynamicModule } = tenantModels(String(catalog.enterpriseId))
    const module: any = await DynamicModule.findById(id).select('-clientBundle').lean()
    if (!module || module.isPublic !== true || module.isActive === false) {
        throw createError({ statusCode: 404, message: 'Модуль больше не опубликован или недоступен' })
    }

    return {
        module: {
            ...module,
            _id: String(module._id),
            enterpriseId: String(catalog.enterpriseId),
            files: (module.files || []).map((file: any) => ({
                name: file.name,
                path: file.path,
                format: file.format,
                isServerFile: file.isServerFile,
                size: file.size
            }))
        }
    }
})
