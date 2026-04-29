import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const user = event.context.user;

    let enterpriseId = event.context.params?.enterpriseId || body.enterpriseId;

    console.log('[Create Module] enterpriseId:', enterpriseId);

    if (!enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Enterprise ID is required'
        });
    }

    if (!body.name || !body.format || !body.code) {
        throw createError({
            statusCode: 400,
            message: 'Missing required fields'
        });
    }

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

    const dependencies = new Map(Object.entries(body.dependencies || {}));
    const devDependencies = new Map(Object.entries(body.devDependencies || {}));

    const dynamicModule = await DynamicModule.create({
        ...body,
        enterpriseId,
        dependencies,
        devDependencies,
        createdBy: body.createdBy || {
            _id: user?.id || 'system',
            name: user?.name || 'System',
            role: user?.role || 'system'
        }
    });

    return {
        success: true,
        module: {
            ...dynamicModule.toObject(),
            dependencies: Object.fromEntries(dependencies),
            devDependencies: Object.fromEntries(devDependencies)
        }
    };
});