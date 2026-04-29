import { ref } from 'vue'
import type { WindowItem } from '~/types/window'

const windows = ref<WindowItem[]>([])
let zIndexCounter = 100

export interface WindowSizeOptions {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
}

// Кэш заголовков из API
let menuTitlesCache: Map<string, { groupTitle?: string; itemTitle?: string; subGroupTitle?: string }> | null = null

export function useWindowManager() {
    const loadMenuTitles = async () => {
        if (menuTitlesCache) return

        try {
            // Загружаем все меню без фильтрации по роли, чтобы получить все возможные заголовки
            const response = await $fetch('/api/menu', { params: { type: 'all' } })
            menuTitlesCache = new Map()

            // Проходим по всем группам и собираем заголовки
            for (const group of response as any[]) {
                if (group.items) {
                    for (const item of group.items) {
                        menuTitlesCache.set(item.id, {
                            groupTitle: group.title,
                            itemTitle: item.title
                        })

                        // Сохраняем также подгруппы
                        if (item.items) {
                            for (const childItem of item.items) {
                                menuTitlesCache.set(childItem.id, {
                                    groupTitle: group.title,
                                    itemTitle: childItem.title,
                                    subGroupTitle: item.title
                                })
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Не удалось загрузить заголовки меню:', error)
            menuTitlesCache = new Map()
        }
    }

    const findMenuTitles = (groupId: string, itemId: string, subGroupId?: string) => {
        if (!menuTitlesCache) return null

        // Сначала ищем по itemId
        const titles = menuTitlesCache.get(itemId)
        if (titles) return titles

        // Пробуем найти по groupId
        for (const [key, value] of menuTitlesCache.entries()) {
            if (value.groupTitle && key.includes(groupId)) {
                return value
            }
        }

        return null
    }

    const formatTitle = (text: string): string => {
        if (!text) return ''

        // Словарь перевода ID в читаемые названия
        const titleMap: Record<string, string> = {
            'login': 'Войти в предприятие',
            'register': 'Регистрация предприятия',
            'control': 'Управление предприятием',
            'customisation': 'Кастомизация',
            'confirm': 'Подтверждение',
            'employee_tasks': 'Мои задачи',
            'employee_documents': 'Документы',
            'employee_schedule': 'График работы',
            'employee_reports': 'Отчеты',
            'sfd1': 'Движение Денежных Средств',
            'sfd2': 'Инкассация',
            'creature': 'Создание модуля',
            'browser': 'Браузер модулей',
            'preview': 'Предпоказ модуля',
            'points': 'Точки',
            'ProblemPoints': 'Проблемные точки',
            'ConfigurePoints': 'Конфигурация точки',
            'termsOfUse': 'Условия пользования',
            'createPoint': 'Создание точки',
            'createEmployee': 'Создание сотрудника',
            'createPlan': 'Создание плана',
        }

        return titleMap[text] || text
    }

    const openWindow = (
        groupId: string,
        itemId: string,
        subGroupId?: string,
        sizeOptions?: WindowSizeOptions,
        isModal: boolean = false,
        componentPath?: string,
        moduleData?: any,
        extraData?: any
    ) => {
        // Загружаем заголовки из API при первом вызове
        if (!menuTitlesCache) {
            loadMenuTitles()
        }

        // Получаем заголовки
        let groupTitle = formatTitle(groupId)
        let itemTitle = formatTitle(itemId)
        let subGroupTitle = subGroupId ? formatTitle(subGroupId) : undefined

        // Пробуем найти лучшие заголовки из кэша API
        const apiTitles = findMenuTitles(groupId, itemId, subGroupId)
        if (apiTitles) {
            if (apiTitles.groupTitle) groupTitle = apiTitles.groupTitle
            if (apiTitles.itemTitle) itemTitle = apiTitles.itemTitle
            if (apiTitles.subGroupTitle) subGroupTitle = apiTitles.subGroupTitle
        }

        // Для модулей используем название из moduleData
        if (moduleData?.name) {
            itemTitle = moduleData.name
            groupTitle = 'Модули'
        }

        const finalComponentName = componentPath || (moduleData ? 'DynamicModuleLoader' : undefined)
        const finalComponentPath = componentPath || (moduleData ? 'modules/DynamicModuleLoader' : undefined)

        const fullTitle = subGroupTitle
            ? `${groupTitle} → ${subGroupTitle} → ${itemTitle}`
            : `${groupTitle} → ${itemTitle}`

        // Проверка на уже открытое окно
        if (!isModal) {
            const existingWindow = windows.value.find(
                w =>
                    w.itemId === itemId &&
                    w.groupId === groupId &&
                    w.subGroupId === subGroupId &&
                    !w.isMinimized
            )
            if (existingWindow) {
                focusWindow(existingWindow.id)
                return
            }
        }

        const defaultSize = {
            width: sizeOptions?.width ?? 600,
            height: sizeOptions?.height ?? 400,
            minWidth: sizeOptions?.minWidth ?? 400,
            minHeight: sizeOptions?.minHeight ?? 300,
        }

        const newWindow: WindowItem = {
            id: `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            groupTitle,
            itemTitle,
            fullTitle,
            itemId,
            groupId,
            subGroupId,
            subGroupTitle,
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
            isModal,
            data: moduleData || extraData || {}
        }

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
        const win = windows.value.find(w => w.groupId === groupId && w.itemId === itemId)
        if (!win) return
        win.data = { ...(win.data || {}), ...newData }
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