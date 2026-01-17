export interface WindowItem {
    id: string
    groupTitle: string
    itemTitle: string
    fullTitle: string
    itemId: string
    groupId: string
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
    }
    isResizing?: boolean
    resizeEdge?: string | null
}