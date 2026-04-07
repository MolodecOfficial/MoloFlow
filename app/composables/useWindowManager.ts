import { ref } from 'vue'
import type { WindowItem } from '~/types/window'
import { menuConfig, moduleConfig, type MenuGroup, type MenuItem } from '~/utils/menuConfig'

const windows = ref<WindowItem[]>([])
let zIndexCounter = 100

export interface WindowSizeOptions {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
}

// Поиск пункта меню в указанном списке групп
function findInGroups(groups: MenuGroup[], groupId: string, itemId: string, subGroupId?: string) {
    const group = groups.find(g => g.id === groupId)
    if (!group) return null

    if (subGroupId) {
        const parentItem = group.items.find(item => item.id === subGroupId)
        if (!parentItem?.items) return null
        const childItem = parentItem.items.find(item => item.id === itemId)
        if (!childItem) return null
        return {
            groupTitle: group.title,
            subGroupTitle: parentItem.title,
            itemTitle: childItem.title,
            componentName: childItem.componentName,
            componentPath: childItem.componentPath,
        }
    }

    const item = group.items.find(item => item.id === itemId)
    if (!item) return null
    return {
        groupTitle: group.title,
        itemTitle: item.title,
        subGroupTitle: undefined,
        componentName: item.componentName,
        componentPath: item.componentPath,
    }
}

function findMenuItem(groupId: string, itemId: string, subGroupId?: string) {
    // Сначала ищем в основном меню
    const fromMenu = findInGroups(menuConfig, groupId, itemId, subGroupId)
    if (fromMenu) return fromMenu

    // Затем в модулях
    const fromModules = findInGroups(moduleConfig, groupId, itemId, subGroupId)
    return fromModules
}

export function useWindowManager() {
    const openWindow = (
        groupId: string,
        itemId: string,
        subGroupId?: string,
        sizeOptions?: WindowSizeOptions,
        isModal: boolean = false,
        componentPath?: string,
        moduleData?: any,
        data?: any
    ) => {
        // Пытаемся найти в статическом меню
        let menuItem = findMenuItem(groupId, itemId, subGroupId)

        // Если это динамический модуль (itemId начинается с dynamic_)
        let finalComponentName = menuItem?.componentName
        let finalComponentPath = componentPath || menuItem?.componentPath
        let finalGroupTitle = menuItem?.groupTitle || groupId
        let finalSubGroupTitle = menuItem?.subGroupTitle
        let finalItemTitle = menuItem?.itemTitle || itemId

        if (moduleData) {
            finalComponentName = 'DynamicModuleLoader'
            finalComponentPath = 'modules/DynamicModuleLoader'
            finalItemTitle = moduleData.name || itemId
            finalGroupTitle = 'Мои модули'
        }

        // Проверка, не открыто ли уже такое окно (только для немодальных)
        if (!isModal) {
            const existingWindow = windows.value.find(
                w =>
                    w.itemId === itemId &&
                    w.groupId === groupId &&
                    w.subGroupId === subGroupId &&
                    !w.isMinimized,
            )
            if (existingWindow) {
                focusWindow(existingWindow.id)
                return
            }
        }

        let fullTitle = finalGroupTitle
        if (finalSubGroupTitle) fullTitle += ` → ${finalSubGroupTitle}`
        fullTitle += ` → ${finalItemTitle}`

        const defaultSize = {
            width: sizeOptions?.width ?? 600,
            height: sizeOptions?.height ?? 400,
            minWidth: sizeOptions?.minWidth ?? 400,
            minHeight: sizeOptions?.minHeight ?? 300,
        }



        const newWindow: WindowItem = {
            id: `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            groupTitle: finalGroupTitle,
            itemTitle: finalItemTitle,
            fullTitle,
            itemId,
            groupId,
            subGroupId,
            subGroupTitle: finalSubGroupTitle,
            componentName: finalComponentName,
            componentPath: finalComponentPath,
            zIndex: ++zIndexCounter,
            isMinimized: false,
            position: {
                x: 50 + windows.value.length * 30,
                y: 50 + windows.value.length * 30,
            },
            size: {
                width: defaultSize.width,
                height: defaultSize.height,
                minWidth: defaultSize.minWidth,
                minHeight: defaultSize.minHeight,
                isMaximized: false,
            },
            isModal: isModal,
            data: moduleData || data || null
        }

        windows.value.push(newWindow)
        console.log('Window opened:', newWindow)
    }

    const closeWindow = (itemId: string) => {
        const index = windows.value.findIndex(w => w.id === itemId)
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
            window.size.width = Math.max(minWidth, newSize.width)
            window.size.height = Math.max(minHeight, newSize.height)
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

    const updateWindowData = (groupId: string, itemId: string, newData: any) => {
        const win = windows.value.find(
            w => w.groupId === groupId && w.itemId === itemId
        )

        if (!win) return

        win.data = {
            ...(win.data || {}),
            ...newData
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
        maximizeWindow,
        updateWindowData
    }
}