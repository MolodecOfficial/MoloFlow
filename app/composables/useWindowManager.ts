// composables/useWindowManager.ts
import { ref } from 'vue'
import type { WindowItem, WindowSizeOptions } from '~/types/window'

const windows = ref<WindowItem[]>([])
let zIndexCounter = 100
let cascadeStep = 0

// Отступ снизу под панель/док, чтобы окна не открывались точно под меню
const TOPBAR_OFFSET = 90
const CASCADE_STEP_X = 34
const CASCADE_STEP_Y = 28

const getViewport = () => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
})

// Не даёт окну оказаться за пределами видимой области — актуально и для
// каскадной раскладки, и для восстановления сохранённой позиции на экране
// меньшего размера, чем тот, где окно в прошлый раз сохранялось.
const clampToViewport = (pos: { x: number; y: number }, size: { width: number; height: number }) => {
    const { width: vw, height: vh } = getViewport()
    const maxX = Math.max(16, vw - size.width - 16)
    const maxY = Math.max(TOPBAR_OFFSET, vh - size.height - 16)
    return {
        x: Math.min(Math.max(16, pos.x), maxX),
        y: Math.min(Math.max(TOPBAR_OFFSET, pos.y), maxY),
    }
}

// Каскад, который "заворачивается" на новый круг, как только упирается
// в правый/нижний край экрана — раньше окна просто улетали за пределы
// вьюпорта после ~10-15 открытий подряд.
const getCascadePosition = (width: number, height: number) => {
    const { width: vw, height: vh } = getViewport()
    const maxSteps = Math.max(
        1,
        Math.floor((vw - width - 32) / CASCADE_STEP_X),
        Math.floor((vh - height - TOPBAR_OFFSET - 32) / CASCADE_STEP_Y)
    )
    const step = cascadeStep % maxSteps
    cascadeStep++

    return clampToViewport(
        { x: 80 + step * CASCADE_STEP_X, y: TOPBAR_OFFSET + step * CASCADE_STEP_Y },
        { width, height }
    )
}

// Ключ для localStorage (можно привязать к enterpriseId)
const STORAGE_PREFIX = 'window_settings_'

interface StoredWindowSettings {
    size: { width: number; height: number }
    position: { x: number; y: number }
    isMaximized?: boolean
}

export function useWindowManager() {
    // Получаем текущий enterpriseId (из стора или пропсов)
    const getEnterpriseId = (): string | null => {
        try {
            const data = localStorage.getItem('currentEnterprise')
            if (data) {
                const enterprise = JSON.parse(data)
                return enterprise._id
            }
        } catch (e) {}
        return null
    }

    // Загрузка сохранённых настроек окна
    const loadWindowSettings = (windowKey: string): StoredWindowSettings | null => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) return null
        const key = `${STORAGE_PREFIX}${enterpriseId}_${windowKey}`
        const stored = localStorage.getItem(key)
        if (stored) {
            try {
                return JSON.parse(stored)
            } catch (e) {}
        }
        return null
    }

    // Сохранение настроек окна (размер, позиция)
    const saveWindowSettings = (windowKey: string, settings: StoredWindowSettings) => {
        const enterpriseId = getEnterpriseId()
        if (!enterpriseId) return
        const key = `${STORAGE_PREFIX}${enterpriseId}_${windowKey}`
        localStorage.setItem(key, JSON.stringify(settings))
    }

    // Формирование ключа для окна (groupId, itemId, subGroupId)
    const getWindowKey = (groupId: string, itemId: string, subGroupId?: string): string => {
        return subGroupId ? `${groupId}/${subGroupId}/${itemId}` : `${groupId}/${itemId}`
    }

    // Основная функция открытия окна
    const openWindow = (
        groupId?: string | null,
        itemId: string,
        subGroupId?: string,
        sizeOptions?: WindowSizeOptions,
        isModal: boolean = false,
        componentPath?: string,
        moduleData?: any,
        extraData?: any,
        customTitle?: string
    ) => {
        // Генерируем ключ для сохранения настроек
        const windowKey = getWindowKey(groupId, itemId, subGroupId)
        const savedSettings = !isModal ? loadWindowSettings(windowKey) : null

        // Формируем заголовок
        let groupTitle = groupId
        let itemTitle = itemId
        let subGroupTitle = subGroupId

        if (customTitle) {
            // Если передан явный заголовок, используем его как itemTitle
            itemTitle = customTitle
            groupTitle = ''
            subGroupTitle = ''
        } else {
            // Попытка получить красивые названия из словаря или API меню
            const titles = getTitlesFromDictionary(groupId, itemId, subGroupId)
            if (titles) {
                groupTitle = titles.groupTitle || groupId
                itemTitle = titles.itemTitle || itemId
                subGroupTitle = titles.subGroupTitle || subGroupId
            } else {
                // fallback – транслитерация или просто ID
                groupTitle = transliterate(groupId)
                itemTitle = transliterate(itemId)
                subGroupTitle = subGroupId ? transliterate(subGroupId) : undefined
            }
        }

        // Собираем полный заголовок
        const fullTitle = subGroupTitle
            ? `${groupTitle} → ${subGroupTitle} → ${itemTitle}`
            : groupTitle
                ? `${groupTitle} → ${itemTitle}`
                : itemTitle

        // Размеры: приоритет у явно переданных, затем сохранённые, затем по умолчанию
        const defaultSize = {
            width: sizeOptions?.width ?? 800,
            height: sizeOptions?.height ?? 600,
            minWidth: sizeOptions?.minWidth ?? 400,
            minHeight: sizeOptions?.minHeight ?? 300,
        }

        let initialSize = { ...defaultSize }

        // Раньше позиция считалась как `80 + windows.length * 30` без ограничений —
        // после десятка открытых окон новые улетали за пределы экрана и их
        // приходилось искать вручную. Теперь каскад "заворачивается", когда
        // упирается в правый/нижний край, и учитывает реальный размер окна.
        let initialPosition = getCascadePosition(initialSize.width, initialSize.height)
        let isMaximized = false

        if (savedSettings && !isModal) {
            initialSize = {
                width: savedSettings.size.width,
                height: savedSettings.size.height,
                minWidth: defaultSize.minWidth,
                minHeight: defaultSize.minHeight,
            }
            // Раньше сохранённая позиция игнорировалась (была закомментирована) —
            // окно всегда открывалось по каскаду, даже если пользователь его
            // специально передвинул в удобное место. Теперь восстанавливаем её,
            // но clampToViewport() не даст окну вылезти за экран, если с прошлого
            // раза разрешение уменьшилось (например, открыли с другого монитора).
            initialPosition = clampToViewport(savedSettings.position, initialSize)
            isMaximized = savedSettings.isMaximized || false
        }

        // Проверка на уже открытое (не модальное) окно
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

        const finalComponentName = componentPath || (moduleData ? 'DynamicModuleLoader' : undefined)
        const finalComponentPath = componentPath || (moduleData ? 'modules/DynamicModuleLoader' : undefined)

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
            position: initialPosition,
            size: {
                width: initialSize.width,
                height: initialSize.height,
                minWidth: defaultSize.minWidth,
                minHeight: defaultSize.minHeight,
                isMaximized,
            },
            isModal,
            data: moduleData || extraData || {},
            windowKey,
        }

        windows.value.push(newWindow)
    }

    // Вспомогательные функции: словарь русских названий (можно расширить или загружать из БД)
    const titleDictionary: Record<string, string> = {
        // Группы
        'enterprises': 'Предприятие',
        'settings': 'Настройки',
        'employees': 'Сотрудники',
        'modules': 'Модули',
        'tabs': 'Вкладки',
        'creature': 'Создание',
        'standards': 'Стандарты отображения',
        'configurator': 'Конфигуратор',
        'control': 'Управление',
        'customisation': 'Кастомизация',
        'register': 'Регистрация',
        'login': 'Вход',
        // Подгруппы / детали
        'standard': 'Стандарт',
        'tab': 'Вкладка',
    }

    const getTitlesFromDictionary = (groupId?: string, itemId?: string, subGroupId?: string) => {
        const groupTitle = groupId ? (titleDictionary[groupId] || titleDictionary[groupId.toLowerCase()]) : undefined
        const itemTitle = itemId ? (titleDictionary[itemId] || titleDictionary[itemId.toLowerCase()]) : undefined
        const subGroupTitle = subGroupId ? (titleDictionary[subGroupId] || titleDictionary[subGroupId.toLowerCase()]) : undefined

        if (groupTitle || itemTitle || subGroupTitle) {
            return { groupTitle, itemTitle, subGroupTitle }
        }
        return null
    }

    // Простая транслитерация для fallback
    const transliterate = (text: string): string => {
        const map: Record<string, string> = {
            'enterprises': 'Предприятие',
            'settings': 'Настройки',
            'tabs': 'Вкладки',
            'standards': 'Стандарты',
            'configurator': 'Конфигуратор',
            'control': 'Управление',
            'customisation': 'Кастомизация',
            'employees': 'Сотрудники',
            'modules': 'Модули',
            'creature': 'Создание',
        }
        if (map[text.toLowerCase()]) return map[text.toLowerCase()]
        // Иначе просто капитализируем
        return text.charAt(0).toUpperCase() + text.slice(1)
    }

    const closeWindow = (id: string) => {
        const win = windows.value.find(w => w.id === id)
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
        if (window) {
            window.position = newPosition
            if (!window.isModal && window.windowKey) {
                saveWindowSettings(window.windowKey, {
                    size: { width: window.size.width, height: window.size.height },
                    position: newPosition,
                    isMaximized: window.size.isMaximized,
                })
            }
        }
    }

    const resizeWindow = (id: string, newSize: { width: number; height: number }) => {
        const window = windows.value.find(w => w.id === id)
        if (window) {
            const minWidth = window.size.minWidth || 300
            const minHeight = window.size.minHeight || 200
            window.size.width = Math.max(minWidth, newSize.width)
            window.size.height = Math.max(minHeight, newSize.height)
            if (!window.isModal && window.windowKey) {
                saveWindowSettings(window.windowKey, {
                    size: { width: window.size.width, height: window.size.height },
                    position: window.position,
                    isMaximized: window.size.isMaximized,
                })
            }
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

        if (!window.isModal && window.windowKey) {
            saveWindowSettings(window.windowKey, {
                size: { width: window.size.width, height: window.size.height },
                position: window.position,
                isMaximized: window.size.isMaximized,
            })
        }
    }

    const updateWindowData = (groupId: string, itemId: string, newData: any) => {
        const win = windows.value.find(w => w.groupId === groupId && w.itemId === itemId)
        if (win) {
            // Создаем полностью новый объект данных
            win.data = {
                ...(win.data || {}),
                ...newData,
                _updated: Date.now()
            }
            // Форсируем реактивность через замену ссылки
            win.data = { ...win.data }
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
        updateWindowData,
    }
}