import { menuConfig, type MenuItem } from '~/utils/menuConfig'

export function useMenuConfig() {
    const findMenuItem = (itemId: string, groupId?: string, subGroupId?: string): MenuItem | null => {
        for (const group of menuConfig) {
            if (groupId && group.id !== groupId) continue

            // Рекурсивный поиск
            const searchRecursive = (items: MenuItem[], targetId: string): MenuItem | null => {
                for (const item of items) {
                    if (item.id === targetId) {
                        // Проверяем, соответствует ли subGroupId
                        if (subGroupId) {
                            // Если ищем с подгруппой, проверяем родителя
                            const parentItem = items.find(i => i.id === subGroupId)
                            if (!parentItem || !parentItem.items?.some(child => child.id === targetId)) {
                                continue
                            }
                        }
                        return item
                    }

                    if (item.items) {
                        const found = searchRecursive(item.items, targetId)
                        if (found) return found
                    }
                }
                return null
            }

            return searchRecursive(group.items, itemId)
        }

        return null
    }

    // Получение пути к компоненту
    const getComponentPath = (itemId: string, groupId?: string): string | null => {
        const item = findMenuItem(itemId, groupId)

        if (item?.componentName) {
            return item.componentName
        }

        // Автогенерация имени файла
        if (groupId) {
            return `${groupId}_${itemId}`
                .split('_')
                .map((word, index) =>
                    index === 0 ? word.toLowerCase() :
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                )
                .join('')
        }

        return itemId
    }

    return {
        findMenuItem,
        getComponentPath
    }
}