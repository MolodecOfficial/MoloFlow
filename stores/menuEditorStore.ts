// stores/menuEditorStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMenuEditorStore = defineStore('menuEditor', () => {
    const locations = ref<any[]>([])
    const selectedGroupId = ref('')
    const selectedParentId = ref<string | null>(null)
    const adding = ref(false)

    // Создание места
    const newLocation = ref({ title: '', type: 'menu' as 'menu' | 'module', order: 0 })
    const showNewForm = ref(false)
    const creating = ref(false)

    // Дерево
    const tree = ref<any[]>([])
    const expanded = ref<Set<string>>(new Set())
    const allExpanded = ref(false)

    // Удаление
    const deletingGroup = ref<string | null>(null)
    const deletingItem = ref<string | null>(null)

    const toggleGroup = (id: string) => {
        if (expanded.value.has(id)) {
            expanded.value.delete(id)
        } else {
            expanded.value.add(id)
        }
        expanded.value = new Set(expanded.value)
    }

    const toggleAll = () => {
        if (allExpanded.value) {
            expanded.value = new Set()
            allExpanded.value = false
        } else {
            tree.value.forEach(g => expanded.value.add(g.id))
            allExpanded.value = true
            expanded.value = new Set(expanded.value)
        }
    }

    const resetSelection = () => {
        selectedGroupId.value = ''
        selectedParentId.value = null
    }

    return {
        // State
        locations,
        selectedGroupId,
        selectedParentId,
        adding,
        newLocation,
        showNewForm,
        creating,
        tree,
        expanded,
        allExpanded,
        deletingGroup,
        deletingItem,

        // Actions
        toggleGroup,
        toggleAll,
        resetSelection
    }
})