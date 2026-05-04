import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    try {
        const url = getRequestURL(event);
        const match = url.pathname.match(/enterprises\/([^/]+)\/dynamicModules/);

        const enterpriseId =
            match?.[1] ||
            (getQuery(event).enterpriseId as string);

        if (!enterpriseId) {
            throw createError({
                statusCode: 400,
                message: 'Enterprise ID is required'
            });
        }

        const modules = await DynamicModule.find({
            enterpriseId,
            isActive: true
        }).sort({ createdAt: -1 });

        return {
            success: true,
            modules: modules.map(m => ({
                ...m.toObject(),
                dependencies: Object.fromEntries(m.dependencies || []),
                devDependencies: Object.fromEntries(m.devDependencies || [])
            }))
        };

    } catch (error: any) {
        console.error('[GET Modules] Error:', error);

        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to fetch modules'
        });
    }
});