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

export interface Standard {
    _id: string
    name: string
    description?: string
    type: 'table' | 'card' | 'list'
    isDefault: boolean
    tabId: string
    settings?: any
    styles?: any
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

    // Кэш стандартов: ключ - tabId, значение - массив стандартов
    const standardsCache = ref<Map<string, Standard[]>>(new Map())
    const standardsLoading = ref(false)
    const currentStandard = ref<Standard | null>(null)

    // Кэш записей
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
        standardsCache.value.clear()
        entriesCache.value.clear()
        tabsLoaded.value = false
        tabs.value = []
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

            // Выбираем стандарт по умолчанию из кэша
            const cached = standardsCache.value.get(tabId) || []
            if (found.defaultStandardId) {
                const defaultStd = cached.find(s => s._id === found.defaultStandardId)
                currentStandard.value = defaultStd || cached[0] || null
            } else {
                currentStandard.value = cached[0] || null
            }
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
            standardsCache.value.delete(editingId)
            entriesCache.value.delete(editingId)
        }
        await loadTabs(true)
        return response.tab
    }

    const deleteTab = async (tabId: string) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')
        await $fetch(`/api/enterprises/${id}/tabs/${tabId}`, { method: 'DELETE' })

        standardsCache.value.delete(tabId)
        entriesCache.value.delete(tabId)
        await loadTabs(true)

        if (currentTabId.value === tabId) {
            currentTabId.value = null
            currentTab.value = null
            currentTabFields.value = []
        }
    }

    // ========== СТАНДАРТЫ (упрощённый кэш) ==========
    const loadStandards = async (tabId: string, force = false): Promise<Standard[]> => {
        const id = getEnterpriseId()
        if (!id || !tabId) return []

        // Если не force и есть в кэше – возвращаем
        if (!force && standardsCache.value.has(tabId)) {
            const cached = standardsCache.value.get(tabId)!
            if (currentTabId.value === tabId) standardsLoading.value = false
            return cached
        }

        standardsLoading.value = true
        try {
            const response = await $fetch(`/api/enterprises/${id}/standards?tabId=${tabId}`)
            const loaded = response.standards || []
            standardsCache.value.set(tabId, loaded)
            if (currentTabId.value === tabId) {
                // обновляем currentStandard, если есть defaultStandardId
                const defaultId = currentTab.value?.defaultStandardId
                if (defaultId) {
                    currentStandard.value = loaded.find(s => s._id === defaultId) || loaded[0] || null
                } else {
                    currentStandard.value = loaded[0] || null
                }
            }
            return loaded
        } catch (error) {
            console.error('Ошибка загрузки стандартов', error)
            return []
        } finally {
            standardsLoading.value = false
        }
    }

    const loadStandardsForTab = async (tabId: string, force = false): Promise<Standard[]> => {
        return loadStandards(tabId, force)
    }

    const saveStandard = async (standardData: any, editingId?: string | null) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')

        const url = editingId ? `/api/enterprises/${id}/standards/${editingId}` : `/api/enterprises/${id}/standards`
        const method = editingId ? 'PUT' : 'POST'
        const response: any = await $fetch(url, { method, body: standardData })

        if (standardData.tabId) {
            // Принудительно сбрасываем кэш для этой вкладки
            standardsCache.value.delete(standardData.tabId)
            await loadStandards(standardData.tabId, true)
            await loadTabById(standardData.tabId, true)
        }
        return response.standard
    }

    const deleteStandard = async (standardId: string, tabId: string) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')
        await $fetch(`/api/enterprises/${id}/standards/${standardId}`, { method: 'DELETE' })
        standardsCache.value.delete(tabId)
        await loadStandards(tabId, true)
        await loadTabById(tabId, true)
    }

    const setDefaultStandard = async (standardId: string, tabId: string) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')
        await $fetch(`/api/enterprises/${id}/standards/${standardId}`, {
            method: 'PUT',
            body: { isDefault: true, tabId }
        })
        standardsCache.value.delete(tabId)
        await loadStandards(tabId, true)
        await loadTabById(tabId, true)
    }

    const getStandardsByTabId = (tabId: string): Standard[] => {
        return standardsCache.value.get(tabId) || []
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
        await Promise.all([loadStandards(tabId), loadEntries(tabId)])
    }

    const preloadAllTabsData = async (): Promise<void> => {
        const id = getEnterpriseId()
        if (!id) return
        const tabsList = await loadTabs()
        await Promise.all(tabsList.map(tab => preloadTabData(tab._id)))
    }

    // Геттеры
    const isEnterpriseLoaded = computed(() => !!enterpriseId.value)
    const enterpriseName = computed(() => enterpriseData.value?.enterpriseName || '')
    const currentTabName = computed(() => currentTab.value?.name || '')
    const hasEntries = computed(() => (currentTabId.value ? (entriesCache.value.get(currentTabId.value)?.length || 0) > 0 : false))
    const hasStandards = computed(() => (currentTabId.value ? (standardsCache.value.get(currentTabId.value)?.length || 0) > 0 : false))

    return {
        enterpriseId,
        enterpriseData,
        tabs,
        tabsLoading,
        tabsLoaded,
        currentTabId,
        currentTab,
        currentTabFields,
        standardsCache,
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
        loadStandardsForTab,
        saveStandard,
        deleteStandard,
        setDefaultStandard,
        getStandardsByTabId,

        loadEntries,
        loadEntriesForTab,

        preloadTabData,
        preloadAllTabsData,
    }
})