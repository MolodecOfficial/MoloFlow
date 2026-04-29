import { Menu } from '~~/server/models/menu.model';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { action, groupId, ...data } = body;

    // Создание новой группы
    if (action === 'createGroup') {
        const newGroup = new Menu({
            id: data.id || `group_${Date.now()}`,
            title: data.title,
            requiredRole: data.requiredRole || ['Управляющий'],
            order: data.order || 0,
            isActive: true,
            type: data.type || 'menu',
            items: []
        });

        await newGroup.save();
        return newGroup;
    }

    // Добавление пункта в существующую группу
    if (action === 'addItem') {
        const group = await Menu.findOne({ id: groupId });
        if (!group) {
            throw createError({ statusCode: 404, message: 'Группа не найдена' });
        }

        const newItem = {
            id: data.id || `item_${Date.now()}`,
            title: data.title,

            type: data.type || 'item',

            requiredRole: data.requiredRole || ['Управляющий'],
            isActive: true,

            componentName: data.componentName,
            componentPath: data.componentPath,

            items: []
        };

        // Если есть parentId, добавляем во вложенный пункт
        if (data.parentId) {
            const addToParent = (items: any[]): any[] => {
                return items.map(item => {
                    if (item.id === data.parentId) {
                        return {
                            ...item,
                            items: item.items ? [...item.items, newItem] : [newItem]
                        };
                    }
                    if (item.items) {
                        return { ...item, items: addToParent(item.items) };
                    }
                    return item;
                });
            };

            group.items = addToParent(group.items || []);
        } else {
            group.items = [...(group.items || []), newItem];
        }

        await group.save();
        return newItem;
    }

    throw createError({ statusCode: 400, message: 'Неверное действие' });
});