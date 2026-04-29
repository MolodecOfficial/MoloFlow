import fs from 'fs/promises';
import path from 'path';
import { DynamicModule } from '~~/server/models/dynamicModules.model';

export default defineEventHandler(async (event) => {
    const moduleId = getRouterParam(event, 'moduleId');
    console.log('[Client Bundle] Запрошен бандл для модуля:', moduleId);

    if (!moduleId) {
        throw createError({ statusCode: 400, message: 'moduleId is required' });
    }

    const module = await DynamicModule.findById(moduleId);
    if (!module || !module.clientBundlePath) {
        console.error('[Client Bundle] Модуль не найден или clientBundlePath отсутствует');
        throw createError({ statusCode: 404, message: 'Client bundle not found' });
    }

    const bundlePath = path.join(process.cwd(), module.clientBundlePath);
    console.log('[Client Bundle] Путь к файлу:', bundlePath);

    try {
        const bundle = await fs.readFile(bundlePath, 'utf-8');
        setHeader(event, 'Content-Type', 'application/javascript');
        return bundle;
    } catch (error: any) {
        console.error('[Client Bundle] Ошибка чтения файла:', error.message);
        throw createError({ statusCode: 404, message: 'Bundle file not found' });
    }
});