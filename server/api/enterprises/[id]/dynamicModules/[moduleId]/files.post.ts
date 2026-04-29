import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');
    const enterpriseId = getRouterParam(event, 'id');
    const body = await readBody(event);
    const { action, file } = body;


    if (!moduleId || !enterpriseId) {
        throw createError({ statusCode: 400, message: 'Missing moduleId or enterpriseId' });
    }

    const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId });
    if (!module) {
        throw createError({ statusCode: 404, message: 'Module not found' });
    }

    // Инициализируем files если нет
    if (!module.files) {
        module.files = [];
    }

    if (action === 'add' || action === 'update') {
        if (!file || !file.name || !file.path || !file.format) {
            throw createError({ statusCode: 400, message: 'File data is required (name, path, format)' });
        }

        const existingIndex = module.files.findIndex((f: any) => f.path === file.path);

        if (existingIndex >= 0) {
            // Обновляем
            module.files[existingIndex].name = file.name;
            module.files[existingIndex].format = file.format;
            module.files[existingIndex].code = file.code || '';
            module.files[existingIndex].updatedAt = new Date();
        } else {
            // Добавляем
            module.files.push({
                name: file.name,
                path: file.path,
                format: file.format,
                code: file.code || '',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        if (!file.path.match(/\.[a-z]+$/)) {
            file.path += `.${file.format}`
        }

        await module.save();

        const savedFile = module.files.find((f: any) => f.path === file.path);

        return {
            success: true,
            file: {
                name: savedFile.name,
                path: savedFile.path,
                format: savedFile.format,
                code: savedFile.code
            },
            message: existingIndex >= 0 ? 'Файл обновлён' : 'Файл добавлен'
        };
    }

    if (action === 'delete') {
        if (!file?.path) {
            throw createError({ statusCode: 400, message: 'File path is required for deletion' });
        }

        const beforeCount = module.files.length;
        module.files = module.files.filter((f: any) => f.path !== file.path);

        if (module.files.length === beforeCount) {
            throw createError({ statusCode: 404, message: 'File not found' });
        }

        await module.save();

        return {
            success: true,
            message: 'Файл удалён'
        };
    }

    throw createError({ statusCode: 400, message: 'Invalid action. Use "add", "update", or "delete"' });
});