import { getModuleSandbox } from '~~/app/utils/moduleSandbox';
import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');
    const modulePath = getRouterParam(event, 'path') || 'index';

    console.log(`[Module API] Calling ${moduleId}/${modulePath}`);

    const module = await DynamicModule.findById(moduleId);
    if (!module || !module.isActive) {
        throw createError({ statusCode: 404, message: 'Module not found or inactive' });
    }

    const user = event.context.user;
    if (!module.isPublic && module.enterpriseId !== user?.enterpriseId) {
        throw createError({ statusCode: 403, message: 'Access denied' });
    }

    try {
        const sandbox = await getModuleSandbox(moduleId, module.enterpriseId);
        const serverExports = await sandbox.loadServerModule();

        if (!serverExports) {
            throw createError({ statusCode: 404, message: 'Server entry not found' });
        }

        let handler;

        // Поддержка разных форматов экспорта
        if (serverExports.handlers && serverExports.handlers[modulePath]) {
            handler = serverExports.handlers[modulePath];
        } else if (serverExports.api && typeof serverExports.api[modulePath] === 'function') {
            handler = serverExports.api[modulePath];
        } else if (typeof serverExports[modulePath] === 'function') {
            handler = serverExports[modulePath];
        } else if (modulePath === 'index' && typeof serverExports.default === 'function') {
            handler = serverExports.default;
        } else {
            throw createError({ statusCode: 404, message: `Endpoint "/${modulePath}" not found in module` });
        }

        const result = await handler(event);
        return result;

    } catch (error: any) {
        console.error(`Module ${moduleId} error:`, error);
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Internal module error'
        });
    }
});