// ПУТЬ В ПРОЕКТЕ: server/api/enterprises/[id]/dynamicModules/[moduleId]/index.put.ts
import { DynamicModule } from '~~/server/models/dynamicModules.model';
import { findDynamicModuleByKey } from '~~/app/utils/dynamicModuleLookup';

export default defineEventHandler(async (event) => {
    const enterpriseId = getRouterParam(event, 'id');        // enterpriseId
    const moduleId = getRouterParam(event, 'moduleId');      // moduleId или fileName

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

    // Сначала резолвим реальный документ по fileName ИЛИ _id — иначе, как и в
    // остальных эндпоинтах, findOneAndUpdate с {_id: moduleId} упадёт CastError'ом,
    // если moduleId это fileName ('checkingAPI'), а не настоящий ObjectId.
    const existing = await findDynamicModuleByKey(enterpriseId, moduleId);
    if (!existing) {
        throw createError({
            statusCode: 404,
            message: 'Module not found or access denied'
        });
    }

    const updatedModule = await DynamicModule.findOneAndUpdate(
        {
            _id: existing._id,
            enterpriseId: enterpriseId  // ID предприятия (для безопасности)
        },
        {
            ...body,
            code: body.code,
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