import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');
    const enterpriseId = getRouterParam(event, 'id');
    const packageName = getRouterParam(event, 'package');
    const query = getQuery(event);
    const packageType = (query.packageType as string) || 'dependencies';

    if (!moduleId || !enterpriseId || !packageName) {
        throw createError({
            statusCode: 400,
            message: 'Missing params'
        });
    }

    const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId });
    if (!module) {
        throw createError({ statusCode: 404, message: 'Модуль не найден' });
    }

    const targetMap = packageType === 'devDependencies' ? module.devDependencies : module.dependencies;

    if (!targetMap.has(packageName)) {
        throw createError({ statusCode: 404, message: 'Зависимость не найдена' });
    }

    targetMap.delete(packageName);
    await module.save();

    return {
        success: true,
        message: `Зависимость ${packageName} успешно удалена`
    };
});