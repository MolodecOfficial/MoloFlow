import { ref } from 'vue'

export interface UseWindowDragOptions {
    initialPosition: { x: number; y: number }
    windowSize: { width: number; height: number }
    onMove: (position: { x: number; y: number }) => void
}

export function useWindowDrag(options: UseWindowDragOptions) {
    const isDragging = ref(false)
    const dragOffset = ref({ x: 0, y: 0 })
    const currentPosition = ref({ x: options.initialPosition.x, y: options.initialPosition.y })

    const handleDragStart = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.closest('.window-controls') || target.closest('.resize-handle')) {
            return
        }

        e.preventDefault()

        isDragging.value = true
        dragOffset.value = {
            x: e.clientX - currentPosition.value.x,
            y: e.clientY - currentPosition.value.y
        }
    }

    const handleDrag = (e: MouseEvent) => {
        if (!isDragging.value) return

        const newX = e.clientX - dragOffset.value.x
        const newY = e.clientY - dragOffset.value.y

        const maxX = Math.max(0, window.innerWidth - options.windowSize.width)
        const maxY = Math.max(0, window.innerHeight - options.windowSize.height)

        const position = {
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        }

        currentPosition.value = position
        options.onMove(position)
    }

    const handleDragEnd = () => {
        isDragging.value = false
    }

    return {
        isDragging,
        currentPosition,
        handleDragStart,
        handleDrag,
        handleDragEnd
    }
}