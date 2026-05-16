export function useMenuApi() {
    const loadLocations = () => $fetch('/api/menu/location').catch(() => [])
    const loadTree = () => $fetch('/api/menu', {params: {type: 'all'}}).catch(() => [])
    const addModule = (m: any, g: string, p: string | null) => $fetch('/api/menu/module', {
        method: 'POST',
        body: {module: {_id: m._id, name: m.name, format: m.format}, targetGroupId: g, parentItemId: p}
    })
    const createGroup = (t: string, type: string, order: number) => $fetch('/api/menu', {
        method: 'POST',
        body: {action: 'createGroup', title: t, type, order, id: `group_${Date.now()}`}
    })
    const deleteGroup = (id: string) => $fetch(`/api/menu/${id}`, {method: 'DELETE'})
    const deleteItem = (g: string, i: string) => $fetch(`/api/menu/${g}?itemId=${i}`, {method: 'DELETE'})
    return {loadLocations, loadTree, addModule, createGroup, deleteGroup, deleteItem}
}