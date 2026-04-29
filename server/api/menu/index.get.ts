import { Menu } from '~~/server/models/menu.model';

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event);
        const role = query.role as string;
        const type = query.type as 'menu' | 'module' | 'all' || 'all'; // ← меняем на all по умолчанию

        // Базовый фильтр - если type не all, фильтруем, иначе берем все
        const filter: any = {
            isActive: true
        };

        if (type !== 'all') {
            filter.type = type;
        }

        // Получаем все группы
        let groups = await Menu.find(filter).sort({ order: 1 }).lean();

        if (!groups || groups.length === 0) {
            return [];
        }

        if (!role) {
            return groups;
        }

        // Фильтрация по роли
        const filterItemsByRole = (items: any[] = []): any[] => {
            if (!items || !Array.isArray(items)) return [];

            return items
                .filter(item => {
                    if (item.isActive === false) return false;
                    if (item.requiredRole && Array.isArray(item.requiredRole)) {
                        return item.requiredRole.includes(role);
                    }
                    return true;
                })
                .map(item => ({
                    ...item,
                    items: filterItemsByRole(item.items || [])
                }))
                .filter(item => {
                    if (item.items && item.items.length > 0) return true;
                    if (item.componentName) return true;
                    return false;
                });
        };

        const filteredGroups = groups
            .filter(group => {
                if (group.isActive === false) return false;
                if (group.requiredRole && Array.isArray(group.requiredRole)) {
                    return group.requiredRole.includes(role);
                }
                return true;
            })
            .map(group => ({
                ...group,
                items: filterItemsByRole(group.items || [])
            }))
            .filter(group => {
                return group.items && group.items.length > 0;
            });

        return filteredGroups;

    } catch (error: any) {
        console.error('Ошибка в GET /api/menu:', error);
        throw createError({
            statusCode: 500,
            message: error.message || 'Ошибка загрузки меню'
        });
    }
});