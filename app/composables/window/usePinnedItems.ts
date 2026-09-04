import { usePersistentState } from './usePersistentState'

export interface PinnedItem {
    id: string
    type: string
    data: Record<string, any>
    position: { x: number; y: number }
    size: { width: number; height: number }
    windowKey?: string   // ← ключ окна, с которым синхронизируется пин
    closeWithWindow?: boolean // ← true: пин автоматически удаляется при закрытии связанного окна
}

const pinnedItems = usePersistentState<PinnedItem[]>('pinned-desktop-items', [])

const DEFAULT_SIZE = { width: 190, height: 190 }

export function usePinnedItems() {
    function pin(
        type: string,
        data: Record<string, any>,
        position: { x: number; y: number },
        size?: { width: number; height: number },
        windowKey?: string,
        closeWithWindow?: boolean
    ): string {
        const id = crypto.randomUUID()
        pinnedItems.value = [
            ...pinnedItems.value,
            {
                id,
                type,
                data,
                position,
                size: size ?? DEFAULT_SIZE,
                windowKey,
                closeWithWindow: closeWithWindow ?? false,
            }
        ]
        console.log('[usePinnedItems] PIN created id=', id, 'windowKey=', windowKey, 'total=', pinnedItems.value.length)
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

    /** Включить/выключить автозакрытие пина вместе со связанным окном */
    function setCloseWithWindow(id: string, value: boolean) {
        pinnedItems.value = pinnedItems.value.map(i => i.id === id ? { ...i, closeWithWindow: value } : i)
    }

    /** Найти пин по связанному windowKey */
    function findByWindowKey(windowKey: string): PinnedItem | undefined {
        const found = pinnedItems.value.find(i => i.windowKey === windowKey)
        console.log('[usePinnedItems] findByWindowKey key=', windowKey, 'found=', !!found)
        return found
    }

    /** Синхронизировать data пина по windowKey (двусторонняя связь) */
    function syncDataByWindowKey(windowKey: string, patch: Record<string, any>) {
        const hasPin = pinnedItems.value.some(i => i.windowKey === windowKey)
        if (!hasPin) {
            console.log('[usePinnedItems] syncDataByWindowKey: NO pin found for key=', windowKey)
            return
        }
        pinnedItems.value = pinnedItems.value.map(i =>
            i.windowKey === windowKey
                ? { ...i, data: { ...i.data, ...patch, _syncedAt: Date.now() } }
                : i
        )
        console.log('[usePinnedItems] syncDataByWindowKey DONE key=', windowKey, 'dataKeys=', Object.keys(patch))
    }

    return {
        pinnedItems,
        pin,
        unpin,
        move,
        updateData,
        setCloseWithWindow,
        findByWindowKey,
        syncDataByWindowKey,
    }
}