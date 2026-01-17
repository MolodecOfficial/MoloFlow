import { ref } from 'vue'

export interface UseWindowDragOptions {
    initialPosition: { x: number; y: number }
    windowSize: { width: number; height: number }
    onMove: (position: { x: number; y: number }) => void
}

export function useWindowDrag(options: UseWindowDragOptions) {
    const isDragging = ref(false)
    const dragStart = ref({ x: 0, y: 0 })
    const dragPosition = ref(options.initialPosition)

    const handleDragStart = (e: MouseEvent) => {
        isDragging.value = true
        dragStart.value = {
            x: e.clientX - dragPosition.value.x,
            y: e.clientY - dragPosition.value.y
        }
    }

    const handleDrag = (e: MouseEvent) => {
        if (!isDragging.value) return

        const newX = e.clientX - dragStart.value.x
        const newY = e.clientY - dragStart.value.y

        // Ограничиваем позицию
        const maxX = window.innerWidth - options.windowSize.width
        const maxY = window.innerHeight - options.windowSize.height

        const position = {
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        }

        dragPosition.value = position
        options.onMove(position)
    }

    const handleDragEnd = () => {
        isDragging.value = false
    }

    return {
        isDragging,
        dragPosition,
        handleDragStart,
        handleDrag,
        handleDragEnd
    }
}