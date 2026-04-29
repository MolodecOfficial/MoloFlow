export default defineEventHandler(async (event) => {
    const moduleId = event.context.params?.moduleId;
    const enterpriseId = event.context.params?.enterpriseId;

    if (!moduleId || !enterpriseId) {
        throw createError({
            statusCode: 400,
            message: 'Missing params'
        });
    }

    const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId });

    if (!module) {
        throw createError({ statusCode: 404, message: 'Module not found' });
    }

    return {
        dependencies: Object.fromEntries(module.dependencies || []),
        devDependencies: Object.fromEntries(module.devDependencies || []),
        serverEntry: module.serverEntry || '',
        composables: module.composables || []
    };
});