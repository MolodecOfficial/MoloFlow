import DynamicModule from '~~/server/models/dynamicModules.model'
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const user = event.context.user
    if (!body.name || !body.format || !body.code || !body.enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Пропущены необходимые данные: название модуля, название файла, формат файла'
        })
    }

    // Проверка уникальности имени в рамках предприятия
    const existingModule = await DynamicModule.findOne({
        name: body.name,
        enterpriseId: body.enterpriseId
    })
    if (existingModule) {
        throw createError({ statusCode: 400, message: 'Модуль с таким именем уже существует' })
    }

    // Приоритет: сначала данные из тела запроса, потом из контекста
    let createdBy

    if (body.createdBy && body.createdBy._id && body.createdBy.name) {
        // Используем данные, явно переданные с клиента
        createdBy = {
            _id: body.createdBy._id,
            name: body.createdBy.name,
            role: body.createdBy.role || 'user'
        }
    } else if (user && user.id) {
        // Fallback: данные из контекста аутентификации
        createdBy = {
            _id: user.id,
            name: user.name || user.login || 'User',
            role: user.role || 'user'
        }
    } else {
        // Последний fallback: системный пользователь
        createdBy = {
            _id: 'system',
            name: 'System',
            role: 'system'
        }
    }

    // Логируем для отладки
    console.log('Creating module with createdBy:', createdBy)
    console.log('User from context:', user)
    console.log('Body.createdBy:', body.createdBy)

    // Обработка тегов
    let tags = body.tags || []
    if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim())

    const isOfficial = (user?.role === 'MolodecOfficial' && body.isOfficial === true) ? true : false

    const dynamicModule = new DynamicModule({
        name: body.name,
        fileName: body.fileName,
        description: body.description || '',
        format: body.format,
        code: body.code,
        enterpriseId: body.enterpriseId,
        createdBy, // ✅ Используем подготовленные данные
        isPublic: body.isPublic === true,
        tags,
        previewImage: body.previewImage || null,
        isOfficial,
    })

    await dynamicModule.save()

    return {
        success: true,
        module: dynamicModule
    }
})