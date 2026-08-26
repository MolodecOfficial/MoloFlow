// ПУТЬ В ПРОЕКТЕ: server/api/enterprises/[id]/dynamicModules/[moduleId]/dependencies/[package].delete.ts
import { findDynamicModuleByKey } from '~~/app/utils/dynamicModuleLookup';

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

    const module = await findDynamicModuleByKey(enterpriseId, moduleId);
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