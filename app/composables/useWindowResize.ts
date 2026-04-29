import { ref } from 'vue'

export interface UseWindowResizeOptions {
    initialSize: { width: number; height: number; minWidth?: number; minHeight?: number }
    position: { x: number; y: number }
    onResize: (size: { width: number; height: number }) => void
    onMove: (position: { x: number; y: number }) => void
}

export function useWindowResize(options: UseWindowResizeOptions) {
    const isResizing = ref(false)
    const resizeEdge = ref<string>('')

    const startState = ref({
        mouseX: 0,
        mouseY: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0
    })

    const currentSize = ref({
        width: options.initialSize.width,
        height: options.initialSize.height
    })

    const currentPosition = ref({
        x: options.position.x,
        y: options.position.y
    })

    const minWidth = options.initialSize.minWidth || 300
    const minHeight = options.initialSize.minHeight || 200

    const handleResizeStart = (e: MouseEvent, edge: string) => {
        e.preventDefault()
        e.stopPropagation()

        isResizing.value = true
        resizeEdge.value = edge

        startState.value = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            width: currentSize.value.width,
            height: currentSize.value.height,
            x: currentPosition.value.x,
            y: currentPosition.value.y
        }
    }

    const handleResize = (e: MouseEvent) => {
        if (!isResizing.value || !resizeEdge.value) return

        const deltaX = e.clientX - startState.value.mouseX
        const deltaY = e.clientY - startState.value.mouseY
        const edge = resizeEdge.value

        let newWidth = startState.value.width
        let newHeight = startState.value.height
        let newX = startState.value.x
        let newY = startState.value.y

        const maxWidth = window.innerWidth - 20
        const maxHeight = window.innerHeight - 20

        if (edge.includes('e')) {
            newWidth = Math.min(maxWidth, Math.max(minWidth, startState.value.width + deltaX))
        }
        if (edge.includes('w')) {
            const possibleWidth = startState.value.width - deltaX
            newWidth = Math.min(maxWidth, Math.max(minWidth, possibleWidth))
            newX = startState.value.x + (startState.value.width - newWidth)
        }
        if (edge.includes('s')) {
            newHeight = Math.min(maxHeight, Math.max(minHeight, startState.value.height + deltaY))
        }
        if (edge.includes('n')) {
            const possibleHeight = startState.value.height - deltaY
            newHeight = Math.min(maxHeight, Math.max(minHeight, possibleHeight))
            newY = startState.value.y + (startState.value.height - newHeight)
        }

        currentSize.value = { width: newWidth, height: newHeight }
        currentPosition.value = { x: newX, y: newY }

        options.onResize({ width: newWidth, height: newHeight })
        options.onMove({ x: newX, y: newY })
    }

    const handleResizeEnd = () => {
        isResizing.value = false
        resizeEdge.value = ''
    }

    return {
        isResizing,
        resizeEdge,
        currentSize,
        currentPosition,
        handleResizeStart,
        handleResize,
        handleResizeEnd
    }
}