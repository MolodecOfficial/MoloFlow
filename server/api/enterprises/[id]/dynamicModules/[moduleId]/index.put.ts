import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    // ПРАВИЛЬНО: получаем оба параметра из URL
    const enterpriseId = getRouterParam(event, 'id');        // enterpriseId
    const moduleId = getRouterParam(event, 'moduleId');      // moduleId

    const body = await readBody(event);
    const user = event.context.user;

    if (!enterpriseId || !moduleId) {
        throw createError({
            statusCode: 400,
            message: 'Enterprise ID and Module ID are required'
        });
    }

    // Запрещаем менять enterpriseId и createdBy
    delete body.enterpriseId;
    delete body.createdBy;

    // Обработка тегов
    if (body.tags && typeof body.tags === 'string') {
        body.tags = body.tags.split(',').map(t => t.trim());
    }

    // Только админ может менять isOfficial
    if (body.isOfficial !== undefined && user?.name !== 'MolodecOfficial') {
        delete body.isOfficial;
    }

    // ИЩЕМ ПО ОБОИМ ПОЛЯМ: enterpriseId И moduleId
    const updatedModule = await DynamicModule.findOneAndUpdate(
        {
            _id: moduleId,           // ID модуля
            enterpriseId: enterpriseId  // ID предприятия (для безопасности)
        },
        {
            ...body,
            updatedAt: new Date(),
            $inc: { version: 1 }
        },
        { new: true, runValidators: true }
    );

    if (!updatedModule) {
        throw createError({
            statusCode: 404,
            message: 'Module not found or access denied'
        });
    }

    const result = updatedModule.toObject();
    if (result.dependencies instanceof Map) {
        result.dependencies = Object.fromEntries(result.dependencies);
    }
    if (result.devDependencies instanceof Map) {
        result.devDependencies = Object.fromEntries(result.devDependencies);
    }

    return { success: true, module: result };
});