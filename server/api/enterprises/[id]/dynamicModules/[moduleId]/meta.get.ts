import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');

    const module = await DynamicModule.findById(moduleId);
    if (!module || !module.isActive) {
        throw createError({ statusCode: 404, message: 'Module not found or inactive' });
    }

    // Проверка прав доступа
    const user = event.context.user;
    if (!module.isPublic && module.enterpriseId !== user?.enterpriseId) {
        throw createError({ statusCode: 403, message: 'Access denied' });
    }

    return {
        id: module._id,
        name: module.name,
        version: module.version,
        description: module.description,
        format: module.format,
        isPublic: module.isPublic,
        tags: module.tags,
        composables: module.composables || [],
        serverEntry: module.serverEntry,
        dependencies: module.dependencies instanceof Map
            ? Object.fromEntries(module.dependencies)
            : (module.dependencies || {}),
        cssUrl: null, // можно добавить генерацию CSS
        clientEntry: `/api/modules/${moduleId}/client-bundle`
    };
});