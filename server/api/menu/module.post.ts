import { Menu } from '~~/server/models/menu.model';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        let { module, targetGroupId, parentItemId } = body;

        if (!module || !targetGroupId) {
            throw createError({
                statusCode: 400,
                message: 'Не переданы обязательные данные'
            });
        }
        if (!module || !module._id || !module.name) {
            throw createError({
                statusCode: 400,
                message: 'module должен содержать _id и name'
            });
        }

        // Преобразование parentItemId, если он объект
        if (parentItemId && typeof parentItemId === 'object') {
            parentItemId = parentItemId.id || parentItemId._id || null;
        }
        if (typeof parentItemId === 'string' && parentItemId === '[object Object]') {
            parentItemId = null;
        }

        const menuItem = {
            id: `module_${module._id}`,
            title: module.name,
            type: 'item',
            requiredRole: ['Управляющий', 'Сотрудник'],
            isActive: true,
            componentName: 'DynamicModuleLoader',      // ← Имя компонента
            componentPath: 'modules/DynamicModuleLoader', // ← Правильный путь
            isModule: true,
            moduleId: module._id,
            format: module.format,
            moduleData: {
                _id: module._id,
                name: module.name,
                format: module.format
            },
            items: []
        };

        let group = await Menu.findOne({ id: targetGroupId });
        if (!group && /^[0-9a-fA-F]{24}$/.test(targetGroupId)) {
            group = await Menu.findById(targetGroupId);
        }
        if (!group) {
            throw createError({
                statusCode: 404,
                message: 'Группа не найдена'
            });
        }

        const insertItem = (items: any[]): boolean => {
            for (const item of items) {
                if (String(item.id) === String(parentItemId)) {
                    item.items = item.items || [];
                    item.items.push(menuItem);
                    return true;
                }
                if (item.items?.length) {
                    if (insertItem(item.items)) return true;
                }
            }
            return false;
        };

        if (parentItemId) {
            const inserted = insertItem(group.items || []);
            if (!inserted) {
                throw createError({
                    statusCode: 400,
                    message: 'Родительский элемент не найден'
                });
            }
        } else {
            group.items = group.items || [];
            group.items.push(menuItem);
        }

        await group.save();

        return {
            success: true,
            menuItem,
            group: group.id
        };

    } catch (error: any) {
        console.error('Ошибка modulePost:', error);
        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка добавления модуля'
        });
    }
});