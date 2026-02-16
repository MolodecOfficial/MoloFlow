import { ref } from 'vue'
import type { WindowItem } from '~/types/window'

const windows = ref<WindowItem[]>([])
let zIndexCounter = 100

export function useWindowManager() {
    const openWindow = (
        groupId: string,
        itemId: string,
        groupTitle: string,
        itemTitle: string,
        subGroupId?: string,
        subGroupTitle?: string
    ) => {
        console.log('✅ Открываем окно:', { groupId, itemId, groupTitle, itemTitle, subGroupId, subGroupTitle })

        // Проверяем, не открыто ли уже такое окно
        const existingWindow = windows.value.find(w =>
            w.itemId === itemId &&
            w.groupId === groupId &&
            w.subGroupId === subGroupId &&
            !w.isMinimized
        )

        if (existingWindow) {
            focusWindow(existingWindow.id)
            return
        }

        // Формируем полный заголовок
        let fullTitle = groupTitle
        if (subGroupTitle) fullTitle += ` → ${subGroupTitle}`
        fullTitle += ` → ${itemTitle}`

        const newWindow: WindowItem = {
            id: `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            groupTitle,
            itemTitle,
            fullTitle,
            itemId,
            groupId,
            subGroupId,
            subGroupTitle,
            zIndex: ++zIndexCounter,
            isMinimized: false,
            position: {
                x: 50 + (windows.value.length * 30),
                y: 50 + (windows.value.length * 30)
            },
            size: {
                width: 600,
                height: 400,
                minWidth: 400,
                minHeight: 300,
                maxWidth: 1600,
                maxHeight: 800,
                isMaximized: false
            }
        }

        console.log('✅ Создано окно:', newWindow)
        windows.value.push(newWindow)
    }

    const closeWindow = (id: string) => {
        const index = windows.value.findIndex(w => w.id === id)
        if (index !== -1) windows.value.splice(index, 1)
    }

    const focusWindow = (id: string) => {
        const window = windows.value.find(w => w.id === id)
        if (window) {
            if (window.isMinimized) window.isMinimized = false
            window.zIndex = ++zIndexCounter
        }
    }

    const minimizeWindow = (id: string) => {
        const window = windows.value.find(w => w.id === id)
        if (window) window.isMinimized = true
    }

    const moveWindow = (id: string, newPosition: { x: number; y: number }) => {
        const window = windows.value.find(w => w.id === id)
        if (window) window.position = newPosition
    }

    const resizeWindow = (id: string, newSize: { width: number; height: number }) => {
        const window = windows.value.find(w => w.id === id)
        if (window) {
            const minWidth = window.size.minWidth || 300
            const minHeight = window.size.minHeight || 200
            const maxWidth = window.size.maxWidth || 1200
            const maxHeight = window.size.maxHeight || 800
            window.size.width = Math.max(minWidth, Math.min(maxWidth, newSize.width))
            window.size.height = Math.max(minHeight, Math.min(maxHeight, newSize.height))
        }
    }

    const maximizeWindow = (id: string) => {
        const window = windows.value.find(w => w.id === id)
        if (!window) return

        window.size.isMaximized = !window.size.isMaximized

        if (window.size.isMaximized) {
            window.previousSize = { width: window.size.width, height: window.size.height }
            window.previousPosition = { ...window.position }
            window.zIndex = 9999
        } else {
            if (window.previousSize) {
                window.size.width = window.previousSize.width
                window.size.height = window.previousSize.height
            }
            if (window.previousPosition) {
                window.position = window.previousPosition
            }
            window.zIndex = ++zIndexCounter
        }
    }

    return {
        windows,
        openWindow,
        closeWindow,
        focusWindow,
        minimizeWindow,
        moveWindow,
        resizeWindow,
        maximizeWindow
    }
}