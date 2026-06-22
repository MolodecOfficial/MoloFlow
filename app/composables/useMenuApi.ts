// composables/useMenuApi.ts
export function useMenuApi() {
    const loadLocations = () => $fetch('/api/menu/location').catch(() => [])
    const loadTree = () => $fetch('/api/menu', {params: {type: 'all'}}).catch(() => [])

    const addModule = (m: any, g: string, p: string | null) => $fetch('/api/menu/module', {
        method: 'POST', body: {
            module: {
                _id: m._id,
                name: m.name,
                format: m.format,
                fileName: m.fileName || m.placeName || m.id
            },
            targetGroupId: g,
            parentItemId: p
        }
    })

    // Создание группы верхнего уровня
    const createGroup = (title: string, placeName: string, type: string, order: number) => $fetch('/api/menu', {
        method: 'POST', body: {
            action: 'createGroup',
            title: title,
            placeName: placeName,
            type: type,
            order: order,
            requiredRole: ['Управляющий']
        }
    })

    // Добавление вложенного пункта
    const addMenuItem = (groupId: string, parentId: string | null, title: string, placeName: string, type: string, order: number, requiredRole: string[]) => $fetch('/api/menu', {
        method: 'POST', body: {
            action: 'addItem',
            groupId: groupId,
            parentId: parentId || null,
            title: title,
            placeName: placeName,
            type: type === 'menu' ? 'folder' : 'item',
            order: order,
            requiredRole: requiredRole
        }
    })

    const deleteGroup = (id: string) => $fetch(`/api/menu/${id}`, {method: 'DELETE'})
    const deleteItem = (g: string, i: string) => $fetch(`/api/menu/${g}?itemId=${i}`, {method: 'DELETE'})

    return {loadLocations, loadTree, addModule, createGroup, addMenuItem, deleteGroup, deleteItem}
}