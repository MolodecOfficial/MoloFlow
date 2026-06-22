import { onUnmounted } from 'vue'

const DEFAULT_COL_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 22

export function useResize(
    columnWidths: { value: number[] },
    rowHeights: { value: number[] },
    minColWidth = 40,
    minRowHeight = 20
) {
    let resizingCol: number | null = null
    let resizingRow: number | null = null
    let resizeStartX = 0
    let resizeStartY = 0
    let resizeStartWidth = 0
    let resizeStartHeight = 0

    function startResizeColumn(col: number, e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        resizingCol = col
        resizeStartX = e.clientX
        resizeStartWidth = columnWidths.value[col] || DEFAULT_COL_WIDTH
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onResizeMouseMove)
        window.addEventListener('mouseup', onResizeMouseUp)
    }

    function startResizeRow(row: number, e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        resizingRow = row
        resizeStartY = e.clientY
        resizeStartHeight = rowHeights.value[row] || DEFAULT_ROW_HEIGHT
        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onResizeMouseMove)
        window.addEventListener('mouseup', onResizeMouseUp)
    }

    function onResizeMouseMove(e: MouseEvent) {
        if (resizingCol !== null) {
            const delta = e.clientX - resizeStartX
            const newWidth = Math.max(minColWidth, resizeStartWidth + delta)
            const newWidths = [...columnWidths.value]
            newWidths[resizingCol] = newWidth
            columnWidths.value = newWidths
        } else if (resizingRow !== null) {
            const delta = e.clientY - resizeStartY
            const newHeight = Math.max(minRowHeight, resizeStartHeight + delta)
            const newHeights = [...rowHeights.value]
            newHeights[resizingRow] = newHeight
            rowHeights.value = newHeights
        }
    }

    function onResizeMouseUp() {
        window.removeEventListener('mousemove', onResizeMouseMove)
        window.removeEventListener('mouseup', onResizeMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        resizingCol = null
        resizingRow = null
    }

    onUnmounted(() => {
        window.removeEventListener('mousemove', onResizeMouseMove)
        window.removeEventListener('mouseup', onResizeMouseUp)
    })

    return {
        startResizeColumn,
        startResizeRow
    }
}