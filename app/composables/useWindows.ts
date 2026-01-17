import { ref, computed } from 'vue'
import type { WindowItem } from '../types/window'
import { WindowService } from '../services/windowService'

export function useWindows() {
    const windows = ref<WindowItem[]>([])
    const windowService = WindowService.getInstance()

    const activeWindows = computed(() =>
        windows.value.filter(w => !w.isMinimized)
    )

    const minimizedWindows = computed(() =>
        windows.value.filter(w => w.isMinimized)
    )

    const openWindow = (itemId: string, groupId: string, groupTitle: string, itemTitle: string) => {
        // Проверяем, не открыто ли уже это окно
        const existingWindow = windows.value.find(w => w.itemId === itemId && !w.isMinimized)
        if (existingWindow) {
            focusWindow(existingWindow.id)
            return existingWindow
        }

        // Создаем новое окно
        const newWindow = windowService.createWindow({
            itemId,
            groupId,
            groupTitle,
            itemTitle
        })

        windows.value.push(newWindow)
        focusWindow(newWindow.id)
        return newWindow
    }

    const closeWindow = (id: string) => {
        const index = windows.value.findIndex(w => w.id === id)
        if (index !== -1) {
            windows.value.splice(index, 1)
        }
    }

    const minimizeWindow = (id: string) => {
        const window = windows.value.find(w => w.id === id)
        if (window) {
            window.isMinimized = true
        }
    }

    const focusWindow = (id: string) => {
        windows.value.forEach(w => {
            if (w.id === id) {
                w.isMinimized = false
                w.zIndex = Math.max(...windows.value.map(w => w.zIndex)) + 1
            }
        })
    }

    const moveWindow = (id: string, position: { x: number; y: number }) => {
        const window = windows.value.find(w => w.id === id)
        if (window) {
            window.position = position
        }
    }

    return {
        windows,
        activeWindows,
        minimizedWindows,
        openWindow,
        closeWindow,
        minimizeWindow,
        focusWindow,
        moveWindow
    }
}