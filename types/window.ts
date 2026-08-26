// types/window.ts

export interface WindowPosition {
    x: number
    y: number
}

export interface WindowSize {
    width: number
    height: number
    minWidth?: number
    minHeight?: number
    isMaximized?: boolean
}

export interface WindowSizeOptions {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
}

/**
 * Открытое окно. Окно НЕ знает про файлы проекта — только про свой
 * ключ (key) и данные (data). Что рисовать по этому ключу — решает
 * WindowsContent.vue во время рендера (см. её комментарии).
 */
export interface WindowItem {
    id: string              // уникальный id конкретного открытого окна (генерируется при open)
    key: string               // ключ окна: id модуля из БД, имя модуля, 'login', 'settings' и т.п. — любая строка
    title: string
    zIndex: number
    isMinimized: boolean
    isModal: boolean
    position: WindowPosition
    size: WindowSize
    previousSize?: { width: number; height: number }
    previousPosition?: WindowPosition
    data?: any
}

export interface OpenWindowOptions {
    title?: string
    size?: WindowSizeOptions
    modal?: boolean
    /** true — всегда открыть новое окно, даже если с этим key уже есть открытое.
     *  По умолчанию false: одинаковый key -> существующее окно фокусируется
     *  и его data обновляется. */
    forceNew?: boolean
}