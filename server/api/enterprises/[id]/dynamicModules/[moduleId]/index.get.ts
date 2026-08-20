// ПУТЬ В ПРОЕКТЕ: server/api/enterprises/[id]/dynamicModules/[moduleId]/index.get.ts
//
// НОВЫЙ эндпоинт. Раньше для одного модуля, привязанного к enterpriseId,
// не было GET, отдающего ВСЁ разом: мета (name/description/format/isPublic/
// tags/previewImage/serverEntry/composables), code, files и dependencies.
// Это заставляло клиента либо брать мета-данные из облегчённого списка
// (?minimal=1, там их просто нет — баг №1: терялись поля при редактировании),
// либо дёргать /files и /dependencies отдельно (два лишних запроса — баг №3:
// медленное открытие), либо падать, потому что подходящего запроса вообще
// не существовало (баг №2: ошибка загрузки модуля из меню).
//
// Теперь: один запрос -> весь модуль. Map-поля (dependencies/devDependencies/
// clientHooks) явно конвертируются в обычные объекты, иначе при сериализации
// в JSON они превращаются в "{}" (у Map нет собственных enumerable-свойств).
import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    try {
        const enterpriseId = getRouterParam(event, 'id');
        const moduleId = getRouterParam(event, 'moduleId');

        if (!enterpriseId || !moduleId) {
            throw createError({
                statusCode: 400,
                message: 'Missing enterpriseId or moduleId'
            });
        }

        const module = await DynamicModule.findOne({ _id: moduleId, enterpriseId });

        if (!module) {
            throw createError({ statusCode: 404, message: 'Module not found' });
        }

        const obj = module.toObject();

        const files = (module.files || []).map((file: any) => ({
            name: file.name,
            path: file.path,
            format: file.format,
            code: file.code || '',
            isServerFile: file.isServerFile || false,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt
        }));

        return {
            success: true,
            module: {
                ...obj,
                code: module.code || '',
                files,
                dependencies: module.dependencies instanceof Map
                    ? Object.fromEntries(module.dependencies)
                    : (obj.dependencies || {}),
                devDependencies: module.devDependencies instanceof Map
                    ? Object.fromEntries(module.devDependencies)
                    : (obj.devDependencies || {}),
                clientHooks: module.clientHooks instanceof Map
                    ? Object.fromEntries(module.clientHooks)
                    : (obj.clientHooks || {})
            }
        };

    } catch (error: any) {
        console.error('[GET Full Module] Error:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to fetch module'
        });
    }
});