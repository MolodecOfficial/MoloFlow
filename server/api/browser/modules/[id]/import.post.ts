import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'id')
    const user = event.context.user
    const body = await readBody(event)
    const targetEnterpriseId = body.targetEnterpriseId // ID предприятия, куда импортируем

    if (!moduleId || !targetEnterpriseId) {
        throw createError({ statusCode: 400, message: 'Missing moduleId or targetEnterpriseId' })
    }

    // Найти публичный модуль
    const sourceModule = await DynamicModule.findOne({
        _id: moduleId,
        isPublic: true,
        isActive: true
    })
    if (!sourceModule) throw createError({ statusCode: 404, message: 'Модуль не найден или недоступен' })

    // Проверить, нет ли уже модуля с таким именем в целевом предприятии
    const existing = await DynamicModule.findOne({
        enterpriseId: targetEnterpriseId,
        name: sourceModule.name
    })
    if (existing) {
        throw createError({ statusCode: 409, message: 'Модуль с таким именем уже существует в вашем предприятии' })
    }

    // Создать копию
    const importedModule = new DynamicModule({
        name: sourceModule.name,
        fileName: sourceModule.fileName,
        description: sourceModule.description,
        format: sourceModule.format,
        code: sourceModule.code,
        enterpriseId: targetEnterpriseId,
        createdBy: user ? { _id: user.id, name: user.name, role: user.role } : { _id: 'system', name: 'System' },
        isPublic: false, // по умолчанию не публичный
        tags: sourceModule.tags,
        previewImage: sourceModule.previewImage,
        isOfficial: false,
        version: 1,
        stats: { downloads: 0, ratings: { average: 0, count: 0 } }
    })

    await importedModule.save()

    // Увеличить счётчик загрузок исходного модуля
    await sourceModule.incrementDownloads()

    return {
        success: true,
        module: importedModule,
        message: 'Модуль успешно импортирован в ваше предприятие'
    }
})