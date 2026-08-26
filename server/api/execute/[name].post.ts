// server/api/execute/[name].post.ts
import { getModuleSandbox } from '~~/app/utils/moduleSandbox';
import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'name');
    const body = await readBody(event);
    const { fileName, data } = body || {};

    if (!moduleId) {
        throw createError({
            statusCode: 400,
            message: `moduleId is required`
        });
    }

    const mod = await DynamicModule.findById(moduleId);
    if (!mod) throw createError({ statusCode: 404, message: `Module not found` });

    try {
        const sandbox = await getModuleSandbox(moduleId, mod.enterpriseId);
        // Теперь executeFile возвращает { result, logs }
        const { result, logs } = await sandbox.executeFile(fileName, data || {});
        return { result, logs };
    } catch (error: any) {
        console.error(`[Execute API] Error:`, error.message);
        // Если ошибка уже содержит логи (из песочницы), передаём их
        const logs = error.data?.logs || [];
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Script execution failed',
            data: { logs }
        });
    }
});