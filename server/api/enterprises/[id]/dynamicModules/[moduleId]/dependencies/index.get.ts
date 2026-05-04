import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    try {
        const moduleId = getRouterParam(event, 'moduleId');
        const enterpriseId = getRouterParam(event, 'id');


        if (!moduleId || !enterpriseId) {
            throw createError({
                statusCode: 400,
                message: 'Missing params'
            });
        }

        const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId });


        if (!module) {
            throw createError({ statusCode: 404, message: 'Модуль не найден' });
        }

        const dependencies = {};
        const devDependencies = {};

        if (module.dependencies) {
            // Проверяем, является ли Map
            if (module.dependencies instanceof Map) {
                for (const [key, value] of module.dependencies) {
                    dependencies[key] = value;
                }
            } else {
                Object.assign(dependencies, module.dependencies);
            }
        }

        if (module.devDependencies) {
            if (module.devDependencies instanceof Map) {
                for (const [key, value] of module.devDependencies) {
                    devDependencies[key] = value;
                }
            } else {
                Object.assign(devDependencies, module.devDependencies);
            }
        }

        const response = {
            dependencies,
            devDependencies,
            serverEntry: module.serverEntry || '',
            composables: module.composables || []
        };

        return response;

    } catch (error) {
        // Если это уже createError, пробрасываем его
        if (error.statusCode) {
            throw error;
        }

        throw createError({
            statusCode: 500,
            message: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});