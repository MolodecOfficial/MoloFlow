import { ref } from 'vue'

export interface UseWindowResizeOptions {
    initialSize: { width: number; height: number; minWidth?: number; minHeight?: number }
    position: { x: number; y: number }
    onResize: (size: { width: number; height: number }) => void
    onMove: (position: { x: number; y: number }) => void
}

export function useWindowResize(options: UseWindowResizeOptions) {
    const isResizing = ref(false)
    const resizeHandle = ref<string | null>(null)
    const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })

    const handleResizeStart = (e: MouseEvent, edge: string) => {
        isResizing.value = true
        resizeHandle.value = edge
        resizeStart.value = {
            x: e.clientX,
            y: e.clientY,
            width: options.initialSize.width,
            height: options.initialSize.height,
            posX: options.position.x,
            posY: options.position.y
        }

        e.preventDefault()
        e.stopPropagation()
    }

    const handleResize = (e: MouseEvent) => {
        if (!isResizing.value || !resizeHandle.value) return

        const deltaX = e.clientX - resizeStart.value.x
        const deltaY = e.clientY - resizeStart.value.y
        const edge = resizeHandle.value

        // Минимальные и максимальные размеры
        const minWidth = options.initialSize.minWidth || 300
        const minHeight = options.initialSize.minHeight || 200
        const maxWidth = window.innerWidth - 20
        const maxHeight = window.innerHeight - 20

        // Расчет новых размеров и позиции
        const result = calculateResize(edge, deltaX, deltaY, {
            width: resizeStart.value.width,
            height: resizeStart.value.height,
            x: resizeStart.value.posX,
            y: resizeStart.value.posY,
            minWidth,
            minHeight,
            maxWidth,
            maxHeight
        })

        // Применяем ограничения позиции
        const maxX = window.innerWidth - result.width
        const maxY = window.innerHeight - result.height
        result.x = Math.max(0, Math.min(result.x, maxX))
        result.y = Math.max(0, Math.min(result.y, maxY))

        // Эмитим события
        options.onResize({ width: result.width, height: result.height })
        if (result.x !== options.position.x || result.y !== options.position.y) {
            options.onMove({ x: result.x, y: result.y })
        }
    }

    const handleResizeEnd = () => {
        isResizing.value = false
        resizeHandle.value = null
    }

    return {
        isResizing,
        resizeHandle,
        handleResizeStart,
        handleResize,
        handleResizeEnd
    }
}

function calculateResize(
    edge: string,
    deltaX: number,
    deltaY: number,
    params: any
) {
    let { width, height, x, y } = params

    switch (edge) {
        case 'n':
            height = clamp(params.height - deltaY, params.minHeight, params.maxHeight)
            y = params.y + (params.height - height)
            break
        case 's':
            height = clamp(params.height + deltaY, params.minHeight, params.maxHeight)
            break
        case 'w':
            width = clamp(params.width - deltaX, params.minWidth, params.maxWidth)
            x = params.x + (params.width - width)
            break
        case 'e':
            width = clamp(params.width + deltaX, params.minWidth, params.maxWidth)
            break
        case 'nw':
            width = clamp(params.width - deltaX, params.minWidth, params.maxWidth)
            height = clamp(params.height - deltaY, params.minHeight, params.maxHeight)
            x = params.x + (params.width - width)
            y = params.y + (params.height - height)
            break
        case 'ne':
            width = clamp(params.width + deltaX, params.minWidth, params.maxWidth)
            height = clamp(params.height - deltaY, params.minHeight, params.maxHeight)
            y = params.y + (params.height - height)
            break
        case 'sw':
            width = clamp(params.width - deltaX, params.minWidth, params.maxWidth)
            height = clamp(params.height + deltaY, params.minHeight, params.maxHeight)
            x = params.x + (params.width - width)
            break
        case 'se':
            width = clamp(params.width + deltaX, params.minWidth, params.maxWidth)
            height = clamp(params.height + deltaY, params.minHeight, params.maxHeight)
            break
    }

    return { width, height, x, y }
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(value, max))
}