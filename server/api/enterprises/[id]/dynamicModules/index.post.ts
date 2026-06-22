import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const user = event.context.user;

    // Получаем enterpriseId из params или body
    let enterpriseId = event.context.params?.id || body.enterpriseId;

    console.log('[Create Module] enterpriseId:', enterpriseId);
    console.log('[Create Module] body fields:', Object.keys(body));

    if (!enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Enterprise ID is required'
        });
    }

    if (!body.name || !body.format || !body.code) {
        console.log('[Create Module] Missing fields:', {
            name: !!body.name,
            format: !!body.format,
            code: !!body.code
        });
        throw createError({
            statusCode: 400,
            message: 'Missing required fields: name, format, code'
        });
    }

    // Проверка на существующий модуль
    const existing = await DynamicModule.findOne({
        name: body.name,
        enterpriseId
    });

    if (existing) {
        throw createError({
            statusCode: 400,
            message: 'Module already exists'
        });
    }

    // Преобразуем зависимости
    const dependencies = new Map(Object.entries(body.dependencies || {}));
    const devDependencies = new Map(Object.entries(body.devDependencies || {}));

    // СОЗДАЕМ МОДУЛЬ С КОДОМ
    const dynamicModule = await DynamicModule.create({
        name: body.name,
        fileName: body.fileName || body.name,
        format: body.format,
        code: body.code, // Сохраняем код!
        description: body.description || '',
        isPublic: body.isPublic || false,
        isActive: body.isActive !== false,
        tags: body.tags || [],
        previewImage: body.previewImage || null,
        dependencies: dependencies,
        devDependencies: devDependencies,
        serverEntry: body.serverEntry || '',
        composables: body.composables || [],
        enterpriseId: enterpriseId,
        version: 1,
        createdBy: body.createdBy || {
            _id: user?.id || 'system',
            name: user?.name || 'System',
            role: user?.role || 'system'
        }
    });

    console.log('[Create Module] Module created with ID:', dynamicModule._id);
    console.log('[Create Module] Code length:', dynamicModule.code?.length || 0);

    return {
        success: true,
        module: {
            ...dynamicModule.toObject(),
            dependencies: Object.fromEntries(dependencies),
            devDependencies: Object.fromEntries(devDependencies)
        }
    };
});