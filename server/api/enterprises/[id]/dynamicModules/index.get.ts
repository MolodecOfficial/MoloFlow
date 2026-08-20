import { DynamicModule } from '~~/server/models/dynamicModules.model';

// Поля, которых достаточно для отрисовки пунктов меню.
// Никакого code / files / dependencies — это и есть основной вес ответа.
const MENU_FIELDS = '_id name fileName format description';

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

        // ?minimal=1 — используется меню (MoloMenu), которому нужны только
        // название/формат/fileName. Полный код/файлы/зависимости в этом случае
        // не запрашиваются и не гоняются по сети — это и было причиной медленной загрузки меню.
        const isMinimal = getQuery(event).minimal === '1' || getQuery(event).minimal === 'true';

        let query = DynamicModule.find({ enterpriseId, isActive: true }).sort({ createdAt: -1 });

        if (isMinimal) {
            query = query.select(MENU_FIELDS).lean();
            const modules = await query;
            return { success: true, modules };
        }

        // Полная выдача — как раньше, для редактора модулей, которому нужен code/files/dependencies
        const modules = await query;

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