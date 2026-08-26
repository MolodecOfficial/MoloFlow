// ПУТЬ В ПРОЕКТЕ: server/api/enterprises/[id]/dynamicModules/[moduleId]/files/index.get.ts
import { findDynamicModuleByKey } from '~~/app/utils/dynamicModuleLookup';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');
    const enterpriseId = getRouterParam(event, 'id');

    if (!moduleId || !enterpriseId) {
        throw createError({ statusCode: 400, message: 'Missing moduleId or enterpriseId' });
    }

    const module = await findDynamicModuleByKey(enterpriseId, moduleId);
    if (!module) {
        throw createError({ statusCode: 404, message: 'Module not found' });
    }

    // Преобразуем files в чистые объекты
    const files = (module.files || []).map((file: any) => ({
        name: file.name,
        path: file.path,
        format: file.format,
        code: file.code || '',
        isServerFile: file.isServerFile || false,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
    }));

    return {
        success: true,
        mainFile: {
            name: `${module.fileName}.${module.format}`,
            path: `${module.fileName}.${module.format}`,
            format: module.format,
            code: module.code
        },
        files: files
    };
});