// stores/menuEditorStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useMenuApi } from '~~/app/composables/useMenuApi'

export const useMenuEditorStore = defineStore('menuEditor', () => {
    const { loadLocations: fetchLocations, loadTree: fetchTree } = useMenuApi()

    const locations = ref<any[]>([])
    const selectedGroupId = ref('')
    const selectedParentId = ref<string | null>(null)
    const adding = ref(false)

    const locationsLoaded = ref(false)
    const treeLoaded = ref(false)
    const locationsLoading = ref(false)
    const treeLoading = ref(false)

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

    // ============================================
    // ACTIONS
    // ============================================

    // Добавляем параметр force для принудительной перезагрузки
    const loadLocations = async (force = false) => {
        if (!force && (locationsLoaded.value || locationsLoading.value)) return
        locationsLoading.value = true
        try {
            locations.value = await fetchLocations()
            locationsLoaded.value = true
        } catch (error) {
            console.error('loadLocations error:', error)
        } finally {
            locationsLoading.value = false
        }
    }

    // Добавляем параметр force для принудительной перезагрузки
    const loadTree = async (force = false) => {
        if (!force && (treeLoaded.value || treeLoading.value)) return
        treeLoading.value = true
        try {
            tree.value = await fetchTree()
            treeLoaded.value = true
        } catch (error) {
            console.error('loadTree error:', error)
        } finally {
            treeLoading.value = false
        }
    }

    // Добавляем метод для полного обновления всех данных меню
    const refreshAllMenuData = async () => {
        // Сбрасываем флаги загрузки, чтобы принудительно перезагрузить
        locationsLoaded.value = false
        treeLoaded.value = false

        // Загружаем свежие данные
        await Promise.all([
            loadLocations(true),
            loadTree(true)
        ])
    }

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
        locationsLoaded,
        treeLoaded,
        locationsLoading,
        treeLoading,

        // Actions
        toggleGroup,
        toggleAll,
        resetSelection,
        loadLocations,
        loadTree,
        refreshAllMenuData, // Новый метод
    }
})