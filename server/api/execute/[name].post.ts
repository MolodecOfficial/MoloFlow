import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const fileName = getRouterParam(event, 'name');
    const body = await readBody(event);

    // Ищем серверный файл в БД
    const allModules = await DynamicModule.find({});

    let serverFile = null;

    for (const module of allModules) {
        const found = module.files?.find(f =>
            f.isServerFile === true &&
            (f.name === fileName || f.path === fileName)
        );
        if (found) {
            serverFile = found;
            break;
        }
    }

    if (!serverFile) {
        throw createError({ statusCode: 404, message: `Файл ${fileName} не найден` });
    }

    // Просто выполняем код через eval (для серверных файлов это безопасно)
    try {
        const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
        const handler = new AsyncFunction('body', serverFile.code + '\n\nreturn typeof defaultExport === "function" ? defaultExport(body) : (typeof handler === "function" ? handler(body) : { success: true });');
        return await handler(body);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});