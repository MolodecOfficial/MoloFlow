import { DynamicModule } from '~~/server/models/dynamicModules.model';

// Кеш для загруженных модулей
const moduleCache = new Map();
const fileCache = new Map();

export const getCachedModule = async (moduleId: string) => {
    if (moduleCache.has(moduleId)) {
        return moduleCache.get(moduleId);
    }

    const module = await DynamicModule.findById(moduleId);
    if (module) {
        moduleCache.set(moduleId, module);
        // Автоматически очищаем кеш через 5 минут
        setTimeout(() => moduleCache.delete(moduleId), 5 * 60 * 1000);
    }
    return module;
};

export const getCachedServerFile = async (fileName: string) => {
    if (fileCache.has(fileName)) {
        return fileCache.get(fileName);
    }

    const allModules = await DynamicModule.find({});
    for (const module of allModules) {
        const found = module.files?.find(f =>
            f.isServerFile === true &&
            (f.name === fileName || f.path === fileName)
        );
        if (found) {
            fileCache.set(fileName, found);
            setTimeout(() => fileCache.delete(fileName), 5 * 60 * 1000);
            return found;
        }
    }
    return null;
};