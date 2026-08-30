import { usePersistentState } from './usePersistentState'

export interface PinnedItem {
    id: string
    type: string   // 'note' — в будущем можно добавлять другие типы виджетов
    data: Record<string, any>
    position: { x: number; y: number }
}

// Единый реестр на всё приложение — та же логика хранения, что и у заметок/окон
// (localStorage, привязан к текущему enterpriseId через usePersistentState).
const pinnedItems = usePersistentState<PinnedItem[]>('pinned-desktop-items', [])

export function usePinnedItems() {
    function pin(type: string, data: Record<string, any>, position: { x: number; y: number }): string {
        const id = crypto.randomUUID()
        pinnedItems.value = [...pinnedItems.value, { id, type, data, position }]
        return id
    }

    function unpin(id: string) {
        pinnedItems.value = pinnedItems.value.filter(i => i.id !== id)
    }

    function move(id: string, position: { x: number; y: number }) {
        pinnedItems.value = pinnedItems.value.map(i => i.id === id ? { ...i, position } : i)
    }

    function updateData(id: string, patch: Record<string, any>) {
        pinnedItems.value = pinnedItems.value.map(i => i.id === id ? { ...i, data: { ...i.data, ...patch } } : i)
    }

    return { pinnedItems, pin, unpin, move, updateData }
}