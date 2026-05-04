import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');
    const enterpriseId = getRouterParam(event, 'id');
    const body = await readBody(event);
    const { action, file, oldPath } = body;

    console.log('[FILES POST]', { action, file: file?.name, oldPath });

    if (!moduleId || !enterpriseId) {
        throw createError({ statusCode: 400, message: 'Missing params' });
    }

    const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId });
    if (!module) {
        throw createError({ statusCode: 404, message: 'Module not found' });
    }

    if (!module.files) module.files = [];

    if (action === 'add') {
        module.files.push({
            name: file.name,
            path: file.path,
            format: file.format,
            code: file.code || '',
            isServerFile: file.isServerFile || false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    else if (action === 'update') {
        // Ищем по старому пути (если передан) или по новому пути
        let index = -1;

        if (oldPath) {
            index = module.files.findIndex(f => f.path === oldPath);
        }
        if (index === -1) {
            index = module.files.findIndex(f => f.path === file.path);
        }
        if (index === -1) {
            index = module.files.findIndex(f => f.name === file.name);
        }

        if (index !== -1) {
            module.files[index] = {
                ...module.files[index],
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code,
                isServerFile: file.isServerFile ?? module.files[index].isServerFile,
                updatedAt: new Date()
            };
        } else {
            // Если не нашли - добавляем как новый
            module.files.push({
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code || '',
                isServerFile: file.isServerFile || false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
    }
    else if (action === 'delete') {
        module.files = module.files.filter(f => f.path !== file.path);
    }

    module.hasServerCode = module.files.some((f: any) => f.isServerFile);
    await module.save();

    return { success: true, files: module.files };
});