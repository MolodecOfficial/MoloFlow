import { menuConfig, type MenuItem } from '~/utils/menuConfig'

export function useMenuConfig() {
    const findMenuItem = (itemId: string, groupId?: string, subGroupId?: string): MenuItem | null => {
        for (const group of menuConfig) {
            if (groupId && group.id !== groupId) continue

            const searchRecursive = (items: MenuItem[], targetId: string): MenuItem | null => {
                for (const item of items) {
                    if (item.id === targetId) {
                        if (subGroupId) {
                            const parentItem = items.find(i => i.id === subGroupId)
                            if (!parentItem?.items?.some(child => child.id === targetId)) continue
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

            const found = searchRecursive(group.items, itemId)
            if (found) return found
        }
        return null
    }

    return { findMenuItem }
}