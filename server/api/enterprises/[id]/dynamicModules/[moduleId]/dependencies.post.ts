import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');
    const enterpriseId = getRouterParam(event, 'enterpriseId');
    const body = await readBody(event);
    const { action, packageName, version, packageType = 'dependencies' } = body;

    console.log(`[Dependencies POST] Module: ${moduleId}, Action: ${action}, Package: ${packageName}`);

    if (!moduleId || !enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Missing moduleId or enterpriseId'
        });
    }

    const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId });
    if (!module) {
        throw createError({ statusCode: 404, message: 'Module not found' });
    }

    // Инициализируем Map если их нет
    if (!module.dependencies) module.dependencies = new Map();
    if (!module.devDependencies) module.devDependencies = new Map();

    if (action === 'add') {
        if (!packageName) {
            throw createError({ statusCode: 400, message: 'packageName is required' });
        }

        const targetMap = packageType === 'devDependencies' ? module.devDependencies : module.dependencies;
        targetMap.set(packageName, version || 'latest');
        await module.save();

        // Преобразуем Map в объект для ответа
        const result = {};
        for (const [key, value] of targetMap) {
            result[key] = value;
        }

        return {
            success: true,
            [packageType]: result,
            message: `Package ${packageName} added successfully`
        };
    }

    if (action === 'remove') {
        const targetMap = packageType === 'devDependencies' ? module.devDependencies : module.dependencies;
        if (!targetMap.has(packageName)) {
            throw createError({ statusCode: 404, message: 'Package not found' });
        }

        targetMap.delete(packageName);
        await module.save();

        // Преобразуем Map в объект для ответа
        const result = {};
        for (const [key, value] of targetMap) {
            result[key] = value;
        }

        return {
            success: true,
            [packageType]: result,
            message: `Package ${packageName} removed successfully`
        };
    }

    throw createError({ statusCode: 400, message: 'Invalid action. Use "add" or "remove"' });
});