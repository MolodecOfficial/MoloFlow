import { DynamicModule } from '~~/server/models/dynamicModules.model'

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'id')
    const user = event.context.user
    const body = await readBody(event)
    const targetEnterpriseId = body.targetEnterpriseId

    if (!moduleId || !targetEnterpriseId) {
        throw createError({ statusCode: 400, message: 'Missing moduleId or targetEnterpriseId' })
    }

    // Найти публичный модуль (включая все вложенные файлы)
    const sourceModule = await DynamicModule.findOne({
        _id: moduleId,
        isPublic: true,
        isActive: true
    }).lean()  // используем lean() для получения plain object

    if (!sourceModule) {
        throw createError({ statusCode: 404, message: 'Модуль не найден или недоступен' })
    }

    // Проверить, нет ли уже модуля с таким именем в целевом предприятии
    const existing = await DynamicModule.findOne({
        enterpriseId: targetEnterpriseId,
        name: sourceModule.name
    })

    if (existing) {
        throw createError({ statusCode: 409, message: 'Модуль с таким именем уже существует в вашем предприятии' })
    }

    // Копируем файлы из исходного модуля, удаляя _id и обновляя даты
    const copiedFiles = (sourceModule.files || []).map((file: any) => ({
        name: file.name,
        path: file.path,
        format: file.format,
        code: file.code,
        isServerFile: file.isServerFile || false,
        size: file.size || 0,
        createdAt: new Date(),
        updatedAt: new Date()
    }))

    // Создать копию модуля со всеми файлами
    const importedModule = new DynamicModule({
        name: sourceModule.name,
        fileName: sourceModule.fileName,
        description: sourceModule.description,
        format: sourceModule.format,
        code: sourceModule.code,
        enterpriseId: targetEnterpriseId,
        createdBy: user ? { _id: user.id, name: user.name, role: user.role } : { _id: 'system', name: 'System' },
        isPublic: false,
        tags: sourceModule.tags || [],
        previewImage: sourceModule.previewImage,
        isOfficial: false,
        version: 1,
        stats: { downloads: 0, ratings: { average: 0, count: 0 } },
        // Копируем зависимости
        dependencies: sourceModule.dependencies ? new Map(Object.entries(sourceModule.dependencies)) : new Map(),
        devDependencies: sourceModule.devDependencies ? new Map(Object.entries(sourceModule.devDependencies)) : new Map(),
        // Копируем дополнительные поля
        composables: sourceModule.composables || [],
        allowedModules: sourceModule.allowedModules || ['fs', 'path', 'crypto', 'axios', 'lodash'],
        apiVersion: sourceModule.apiVersion || 2,
        buildStatus: 'pending',
        // Копируем файлы!
        files: copiedFiles,
        // Определяем, есть ли серверный код
        hasServerCode: copiedFiles.some((file: any) => file.isServerFile === true)
    })

    await importedModule.save()

    // Увеличить счётчик загрузок исходного модуля
    await sourceModule.incrementDownloads?.() || await DynamicModule.findByIdAndUpdate(moduleId, {
        $inc: { 'stats.downloads': 1 },
        $set: { 'stats.lastUsed': new Date() }
    })

    // Возвращаем импортированный модуль с файлами
    const result = importedModule.toObject()

    return {
        success: true,
        module: result,
        filesCopied: copiedFiles.length,
        message: `Модуль "${sourceModule.name}" успешно импортирован в ваше предприятие. Скопировано файлов: ${copiedFiles.length}`
    }
})