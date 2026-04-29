import { Menu } from '~~/server/models/menu.model';

export default defineEventHandler(async (event) => {
    try {
        const groups = await Menu.find({ isActive: true, type: 'menu' }).lean();

        const availableLocations = [];

        for (const group of groups) {
            if (!group || !group.id || !group.title) continue;

            const locations = [];

            // Корень группы
            locations.push({
                id: null,
                title: `В корень группы "${group.title}"`,
                groupId: group.id,
                parentPath: []
            });

            // Рекурсивный сбор всех элементов, которые могут быть родителями (имеют items)
            const collectParentCandidates = (items: any[], path: string[] = []) => {
                if (!items) return;
                for (const item of items) {
                    if (item.items && Array.isArray(item.items) && item.items.length > 0) {
                        locations.push({
                            id: item.id,
                            title: item.title,
                            groupId: group.id,
                            parentPath: [...path, item.title]
                        });
                    }
                    if (item.items?.length) {
                        collectParentCandidates(item.items, [...path, item.title]);
                    }
                }
            };

            if (group.items && Array.isArray(group.items)) {
                collectParentCandidates(group.items);
            }

            availableLocations.push({
                groupId: group.id,
                groupTitle: group.title,
                locations: locations
            });
        }

        return availableLocations;

    } catch (error: any) {
        console.error('Ошибка в /api/menu/location:', error);
        return [];
    }
});