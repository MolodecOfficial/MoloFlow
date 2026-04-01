export interface WindowItem {
    itemId: string        // 'control'
    groupId: string       // 'settings'
    subGroupId?: string   // 'enterprise'
    groupTitle: string    // 'Общие настройки'
    subGroupTitle?: string // 'Предприятие'
    itemTitle: string     // 'Управление предприятием'
    fullTitle: string     // 'Общие настройки → Предприятие → Управление предприятием'
    id: string
    componentName?: string
    zIndex: number
    isMinimized: boolean
    position: { x: number; y: number }
    size: {
        width: number;
        height: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
        isMaximized?: boolean
    }
    isResizing?: boolean
    isModal?: boolean
    resizeEdge?: string | null
    data?: any
}