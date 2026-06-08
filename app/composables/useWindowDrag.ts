// composables/useWindowDrag.ts
import { ref, watch } from 'vue'

export interface UseWindowDragOptions {
    initialPosition: { x: number; y: number }
    windowSize: { width: number; height: number }
    onMove: (position: { x: number; y: number }) => void
}

export function useWindowDrag(options: UseWindowDragOptions) {
    const isDragging = ref(false)
    const dragOffset = ref({ x: 0, y: 0 })
    const currentPosition = ref({ x: options.initialPosition.x, y: options.initialPosition.y })

    // Следим за изменением позиции извне (например, после ресайза)
    watch(() => options.initialPosition, (newPos) => {
        currentPosition.value = { x: newPos.x, y: newPos.y }
    }, { deep: true })

    const handleDragStart = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        // Не начинаем перетаскивание, если клик по кнопкам управления или ресайзу
        if (target.closest('.window-controls') || target.closest('.resize-handle')) {
            return
        }

        e.preventDefault()
        e.stopPropagation()

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

        // Получаем актуальные размеры окна
        const windowWidth = options.windowSize.width
        const windowHeight = options.windowSize.height

        const maxX = Math.max(0, window.innerWidth - windowWidth)
        const maxY = Math.max(0, window.innerHeight - windowHeight)

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