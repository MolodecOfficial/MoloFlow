import { Menu } from '~~/server/models/menu.model';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    const query = getQuery(event);
    const { itemId, parentId } = query;

    // Удаление группы
    if (!itemId) {
        const deleted = await Menu.findOneAndDelete({ id });
        if (!deleted) {
            throw createError({ statusCode: 404, message: 'Группа не найдена' });
        }
        return { message: 'Группа удалена', deleted };
    }

    // Удаление пункта из группы
    const group = await Menu.findOne({ id });
    if (!group) {
        throw createError({ statusCode: 404, message: 'Группа не найдена' });
    }

    const removeItem = (items: any[]): any[] => {
        return items
            .filter(item => item.id !== itemId)
            .map(item => ({
                ...item,
                items: item.items ? removeItem(item.items) : undefined
            }));
    };

    group.items = removeItem(group.items || []);
    await group.save();

    return { message: 'Пункт удален', group };
});