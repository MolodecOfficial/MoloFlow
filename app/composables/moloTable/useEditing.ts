import { ref, nextTick } from 'vue'

export function useEditing() {
    const editingCell = ref<{ row: number; col: number } | null>(null)
    const editingContent = ref('')
    let editingInput: HTMLInputElement | null = null

    function startEditing(row: number, col: number, content: string) {
        editingContent.value = content
        editingCell.value = { row, col }
        nextTick(() => {
            if (editingInput) {
                editingInput.focus()
                editingInput.select()
            }
        })
    }

    function saveEditing(): { row: number; col: number; content: string } | null {
        if (!editingCell.value) return null
        const { row, col } = editingCell.value
        const content = editingContent.value
        editingCell.value = null
        editingInput = null
        return { row, col, content }
    }

    function cancelEditing() {
        editingCell.value = null
        editingInput = null
    }

    function setInputRef(el: HTMLInputElement | null) {
        editingInput = el
    }

    return {
        editingCell,
        editingContent,
        startEditing,
        saveEditing,
        cancelEditing,
        setInputRef
    }
}