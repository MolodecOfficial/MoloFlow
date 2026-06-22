import { ref } from 'vue'

export function useSelection() {
    const selectedSet = ref<Set<string>>(new Set())
    const activeCell = ref<{ row: number; col: number } | null>(null)
    const dragSelecting = ref(false)
    let dragStartCell: { row: number; col: number } | null = null
    let dragEndCell: { row: number; col: number } | null = null

    function isSelected(row: number, col: number): boolean {
        return selectedSet.value.has(`${row},${col}`)
    }

    function selectCell(row: number, col: number, e?: MouseEvent, master?: { row: number; col: number }) {
        const target = master || { row, col }
        activeCell.value = target
        const key = `${target.row},${target.col}`
        if (e?.ctrlKey) {
            if (selectedSet.value.has(key)) selectedSet.value.delete(key)
            else selectedSet.value.add(key)
            selectedSet.value = new Set(selectedSet.value)
        } else {
            selectedSet.value = new Set([key])
        }
    }

    function startDrag(row: number, col: number, master?: { row: number; col: number }) {
        const target = master || { row, col }
        dragSelecting.value = true
        dragStartCell = target
        dragEndCell = target
        updateDragSelection()
    }

    function dragOver(row: number, col: number, master?: { row: number; col: number }) {
        if (!dragSelecting.value) return
        dragEndCell = master || { row, col }
        updateDragSelection()
    }

    function stopDrag() {
        dragSelecting.value = false
        dragStartCell = null
        dragEndCell = null
    }

    function updateDragSelection() {
        if (!dragStartCell || !dragEndCell) return
        const minRow = Math.min(dragStartCell.row, dragEndCell.row)
        const maxRow = Math.max(dragStartCell.row, dragEndCell.row)
        const minCol = Math.min(dragStartCell.col, dragEndCell.col)
        const maxCol = Math.max(dragStartCell.col, dragEndCell.col)
        const newSet = new Set<string>()
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                newSet.add(`${r},${c}`)
            }
        }
        selectedSet.value = newSet
    }

    function clearSelection() {
        selectedSet.value = new Set()
        activeCell.value = null
    }

    return {
        selectedSet,
        activeCell,
        dragSelecting,
        isSelected,
        selectCell,
        startDrag,
        dragOver,
        stopDrag,
        clearSelection
    }
}