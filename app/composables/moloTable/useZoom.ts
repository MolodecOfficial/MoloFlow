import { ref } from 'vue'

export function useZoom() {
    const zoomLevel = ref(1)
    const ZOOM_MIN = 0.5
    const ZOOM_MAX = 2
    const ZOOM_STEP = 0.1

    function zoomIn() {
        if (zoomLevel.value < ZOOM_MAX) zoomLevel.value += ZOOM_STEP
    }

    function zoomOut() {
        if (zoomLevel.value > ZOOM_MIN) zoomLevel.value -= ZOOM_STEP
    }

    function resetZoom() {
        zoomLevel.value = 1
    }

    function handleWheelZoom(e: WheelEvent) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
            zoomLevel.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel.value + delta))
        }
    }

    return {
        zoomLevel,
        zoomIn,
        zoomOut,
        resetZoom,
        handleWheelZoom
    }
}