// stores/appStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Tab {
    _id: string
    name: string
    slug: string
    description?: string
    icon?: string
    color?: string
    category?: string
    defaultViewType?: 'table' | 'card' | 'list'
    groups?: TabGroup[]
    permissions?: any
    defaultStandardId?: string | null
}

export interface TabGroup {
    _id?: string
    name: string
    description?: string
    icon?: string
    order?: number
    image?: string | null
    link?: string
    fields?: TabField[]
}

export interface TabField {
    key: string
    label: string
    type: string
    required?: boolean
    description?: string
    options?: Array<{ label: string; value: string; color?: string }>
    isArray?: boolean
    isUnique?: boolean
    isSearchable?: boolean
    isFilterable?: boolean
    isSortable?: boolean
    isReadonly?: boolean
    isHidden?: boolean
    validation?: any
    display?: any
}

// Убираем tabId - стандарты глобальные
export interface Standard {
    _id: string
    name: string
    description?: string
    type: 'table' | 'card' | 'list'
    isDefault: boolean
    settings?: any
    styles?: any
    tableRows?: any[]
    cardSettings?: any
    listSettings?: any
}

export const useAppStore = defineStore('app', () => {
    const enterpriseId = ref<string | null>(null)
    const enterpriseData = ref<any>(null)

    const tabs = ref<Tab[]>([])
    const tabsLoading = ref(false)
    const currentTabId = ref<string | null>(null)
    const currentTab = ref<Tab | null>(null)
    const currentTabFields = ref<TabField[]>([])
    const tabsLoaded = ref(false)
    const tabsLoadingPromise = ref<Promise<any> | null>(null)

    // Стандарты теперь глобальные - один массив, не привязанный к tabId
    const standards = ref<Standard[]>([])
    const standardsLoading = ref(false)
    const currentStandard = ref<Standard | null>(null)

    // Кэш записей (остаётся по tabId)
    const entriesCache = ref<Map<string, any[]>>(new Map())
    const entriesLoading = ref(false)

    const setEnterprise = (id: string, data?: any) => {
        enterpriseId.value = id
        enterpriseData.value = data || null
        if (id) {
            localStorage.setItem('currentEnterprise', JSON.stringify({ _id: id, ...data }))
        }
        clearCache()
    }

    const clearCache = () => {
        entriesCache.value.clear()
        tabsLoaded.value = false
        tabs.value = []
        // Стандарты не очищаем при смене предприятия (они глобальные)
        // но для полной очистки можно:
        standards.value = []
        currentStandard.value = null
    }

    const loadEnterpriseFromStorage = (): boolean => {
        const str = localStorage.getItem('currentEnterprise')
        if (!str) return false
        try {
            const data = JSON.parse(str)
            enterpriseId.value = data._id
            enterpriseData.value = data
            return true
        } catch {
            return false
        }
    }

    const getEnterpriseId = (): string | null => {
        if (enterpriseId.value) return enterpriseId.value
        loadEnterpriseFromStorage()
        return enterpriseId.value
    }

    // ========== ВКЛАДКИ ==========
    const loadTabs = async (force = false): Promise<Tab[]> => {
        const id = getEnterpriseId()
        if (!id) return []

        if (tabsLoaded.value && !force) return tabs.value
        if (tabsLoadingPromise.value) {
            await tabsLoadingPromise.value
            return tabs.value
        }

        tabsLoadingPromise.value = (async () => {
            tabsLoading.value = true
            try {
                const response = await $fetch(`/api/enterprises/${id}/tabs`)
                tabs.value = response.tabs || []
                tabsLoaded.value = true
                return tabs.value
            } catch (error) {
                console.error('Ошибка загрузки вкладок', error)
                tabs.value = []
                return []
            } finally {
                tabsLoading.value = false
                tabsLoadingPromise.value = null
            }
        })()
        return await tabsLoadingPromise.value
    }

    const loadTabById = async (tabId: string, force = false) => {
        const id = getEnterpriseId()
        if (!id || !tabId) return null

        if (!force && currentTab.value?._id === tabId) return currentTab.value

        try {
            const response: any = await $fetch(`/api/enterprises/${id}/tabs/${tabId}`)
            currentTab.value = response.tab
            if (currentTab.value && response.tab.defaultStandardId !== undefined) {
                currentTab.value.defaultStandardId = response.tab.defaultStandardId
            }
            const fields: TabField[] = []
            if (response.tab?.groups) {
                for (const group of response.tab.groups) {
                    if (group.fields) fields.push(...group.fields)
                }
            }
            currentTabFields.value = fields

            const index = tabs.value.findIndex(t => t._id === tabId)
            if (index !== -1) tabs.value[index] = response.tab
            else tabs.value.push(response.tab)

            return response.tab
        } catch (error) {
            console.error('Ошибка загрузки вкладки', error)
            return null
        }
    }

    const setCurrentTab = (tabId: string) => {
        currentTabId.value = tabId
        const found = tabs.value.find(t => t._id === tabId)
        if (found) {
            currentTab.value = found
            const fields: TabField[] = []
            if (found.groups) {
                for (const group of found.groups) {
                    if (group.fields) fields.push(...group.fields)
                }
            }
            currentTabFields.value = fields

            // Выбираем стандарт по умолчанию из глобального списка
            const defaultStd = standards.value.find(s => s.isDefault === true)
            currentStandard.value = defaultStd || standards.value[0] || null
        }
    }

    const saveTab = async (tabData: any, editingId?: string | null) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')

        const url = editingId ? `/api/enterprises/${id}/tabs/${editingId}` : `/api/enterprises/${id}/tabs`
        const method = editingId ? 'PUT' : 'POST'
        const response: any = await $fetch(url, { method, body: tabData })

        tabsLoaded.value = false
        if (editingId) {
            entriesCache.value.delete(editingId)
        }
        await loadTabs(true)
        return response.tab
    }

    const deleteTab = async (tabId: string) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')
        await $fetch(`/api/enterprises/${id}/tabs/${tabId}`, { method: 'DELETE' })

        entriesCache.value.delete(tabId)
        await loadTabs(true)

        if (currentTabId.value === tabId) {
            currentTabId.value = null
            currentTab.value = null
            currentTabFields.value = []
        }
    }

    // ========== СТАНДАРТЫ (глобальные, без привязки к вкладкам) ==========
    const loadStandards = async (force = false): Promise<Standard[]> => {
        if (!force && standards.value.length) return standards.value

        standardsLoading.value = true
        try {
            const response = await $fetch('/api/standards')
            standards.value = response.standards || []
            return standards.value
        } catch (error) {
            console.error('Ошибка загрузки стандартов', error)
            return []
        } finally {
            standardsLoading.value = false
        }
    }

    const saveStandard = async (standardData: any, editingId?: string | null) => {
        const url = editingId ? `/api/standards/${editingId}` : '/api/standards'
        const method = editingId ? 'PUT' : 'POST'
        const response = await $fetch(url, { method, body: standardData })
        await loadStandards(true)
        return response.standard
    }

    const deleteStandard = async (standardId: string) => {
        await $fetch(`/api/standards/${standardId}`, { method: 'DELETE' })
        await loadStandards(true)
    }

    const setDefaultStandard = async (standardId: string) => {
        await $fetch(`/api/standards/${standardId}`, {
            method: 'PUT',
            body: { isDefault: true }
        })
        await loadStandards(true)
    }

    // ========== ЗАПИСИ ==========
    const loadEntries = async (tabId: string, force = false): Promise<any[]> => {
        const id = getEnterpriseId()
        if (!id || !tabId) return []

        if (!force && entriesCache.value.has(tabId)) {
            if (currentTabId.value === tabId) entriesLoading.value = false
            return entriesCache.value.get(tabId)!
        }

        entriesLoading.value = true
        try {
            const response = await $fetch(`/api/enterprises/${id}/tabs/${tabId}/full`)
            const loaded = response.entries || []
            entriesCache.value.set(tabId, loaded)
            return loaded
        } catch (error) {
            console.error('[loadEntries] Ошибка:', error)
            return []
        } finally {
            entriesLoading.value = false
        }
    }

    const loadEntriesForTab = async (tabId: string, force = false): Promise<any[]> => {
        return loadEntries(tabId, force)
    }

    const preloadTabData = async (tabId: string): Promise<void> => {
        // Стандарты глобальные, не нужно загружать для каждой вкладки
        // Загружаем только записи для конкретной вкладки
        await loadEntries(tabId)
    }

    const preloadAllTabsData = async (): Promise<void> => {
        const id = getEnterpriseId()
        if (!id) return

        // Загружаем стандарты один раз (глобально)
        await loadStandards()

        // Загружаем вкладки
        const tabsList = await loadTabs()

        // Загружаем записи для всех вкладок
        await Promise.all(tabsList.map(tab => loadEntries(tab._id)))
    }

    // Геттеры
    const isEnterpriseLoaded = computed(() => !!enterpriseId.value)
    const enterpriseName = computed(() => enterpriseData.value?.enterpriseName || '')
    const currentTabName = computed(() => currentTab.value?.name || '')
    const hasEntries = computed(() => (currentTabId.value ? (entriesCache.value.get(currentTabId.value)?.length || 0) > 0 : false))
    const hasStandards = computed(() => standards.value.length > 0)

    return {
        enterpriseId,
        enterpriseData,
        tabs,
        tabsLoading,
        tabsLoaded,
        currentTabId,
        currentTab,
        currentTabFields,
        standards,           // ← теперь standards (не standardsCache)
        standardsLoading,
        currentStandard,
        entriesCache,
        entriesLoading,

        isEnterpriseLoaded,
        enterpriseName,
        currentTabName,
        hasEntries,
        hasStandards,

        setEnterprise,
        loadEnterpriseFromStorage,
        getEnterpriseId,
        clearCache,

        loadTabs,
        loadTabById,
        setCurrentTab,
        saveTab,
        deleteTab,

        loadStandards,
        saveStandard,
        deleteStandard,
        setDefaultStandard,

        loadEntries,
        loadEntriesForTab,

        preloadTabData,
        preloadAllTabsData,
    }
})