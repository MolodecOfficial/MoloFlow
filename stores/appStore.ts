// stores/appStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
    // ========== Данные предприятия ==========
    const enterpriseId = ref<string | null>(null)
    const enterpriseData = ref<any>(null)

    // ========== Вкладки ==========
    const tabs = ref<any[]>([])
    const tabsLoading = ref(false)
    const currentTabId = ref<string | null>(null)
    const currentTab = ref<any>(null)
    const currentTabFields = ref<any[]>([])

    // ========== Стандарты ==========
    const standards = ref<any[]>([])
    const standardsLoading = ref(false)
    const currentStandard = ref<any>(null)

    // ========== Записи ==========
    const entries = ref<any[]>([])
    const entriesLoading = ref(false)

    // ========== Методы предприятия ==========
    const setEnterprise = (id: string, data?: any) => {
        enterpriseId.value = id
        enterpriseData.value = data || null
        if (id) {
            localStorage.setItem('currentEnterprise', JSON.stringify({ _id: id, ...data }))
        }
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

    // ========== Методы вкладок ==========
    const loadTabs = async () => {
        const id = getEnterpriseId()
        if (!id) return
        tabsLoading.value = true
        try {
            const response = await $fetch(`/api/enterprises/${id}/tabs`)
            tabs.value = response.tabs || []
        } catch (error) {
            console.error('Ошибка загрузки вкладок', error)
            tabs.value = []
        } finally {
            tabsLoading.value = false
        }
    }

    const loadTabById = async (tabId: string) => {
        const id = getEnterpriseId()
        if (!id || !tabId) return null
        try {
            const response = await $fetch(`/api/enterprises/${id}/tabs/${tabId}`)
            currentTab.value = response.tab
            // Собираем поля из групп
            const fields: any[] = []
            if (response.tab?.groups) {
                for (const group of response.tab.groups) {
                    if (group.fields) fields.push(...group.fields)
                }
            }
            currentTabFields.value = fields
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
            // Собираем поля из групп
            const fields: any[] = []
            if (found.groups) {
                for (const group of found.groups) {
                    if (group.fields) fields.push(...group.fields)
                }
            }
            currentTabFields.value = fields
        }
    }

    const saveTab = async (tabData: any, editingId?: string | null) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')

        const url = editingId
            ? `/api/enterprises/${id}/tabs/${editingId}`
            : `/api/enterprises/${id}/tabs`
        const method = editingId ? 'PUT' : 'POST'

        const response = await $fetch(url, { method, body: tabData })
        await loadTabs()
        return response.tab
    }

    const deleteTab = async (tabId: string) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')
        await $fetch(`/api/enterprises/${id}/tabs/${tabId}`, { method: 'DELETE' })
        await loadTabs()
        if (currentTabId.value === tabId) {
            currentTabId.value = null
            currentTab.value = null
            currentTabFields.value = []
        }
    }

    // ========== Методы стандартов ==========
    const loadStandards = async (tabId?: string) => {
        const id = getEnterpriseId()
        const targetTabId = tabId || currentTabId.value
        if (!id || !targetTabId) return
        standardsLoading.value = true
        try {
            const response = await $fetch(`/api/enterprises/${id}/standards?tabId=${targetTabId}`)
            standards.value = response.standards || []
            const defaultStd = standards.value.find(s => s.isDefault) || standards.value[0]
            currentStandard.value = defaultStd || null
        } catch (error) {
            standards.value = []
        } finally {
            standardsLoading.value = false
        }
    }

    const saveStandard = async (standardData: any, editingId?: string | null) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')

        const url = editingId
            ? `/api/enterprises/${id}/standards/${editingId}`
            : `/api/enterprises/${id}/standards`
        const method = editingId ? 'PUT' : 'POST'

        const response: any = await $fetch(url, { method, body: standardData })
        if (standardData.tabId) {
            await loadStandards(standardData.tabId)
        }
        return response.standard
    }

    const deleteStandard = async (standardId: string, tabId: string) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')
        await $fetch(`/api/enterprises/${id}/standards/${standardId}`, { method: 'DELETE' })
        await loadStandards(tabId)
    }

    const setDefaultStandard = async (standardId: string, tabId: string, type: string) => {
        const id = getEnterpriseId()
        if (!id) throw new Error('Нет предприятия')
        await $fetch(`/api/enterprises/${id}/standards/${standardId}`, {
            method: 'PUT',
            body: { isDefault: true, tabId, type }
        })
        await loadStandards(tabId)
    }

    // ========== Методы записей ==========
    const loadEntries = async (tabId?: string) => {
        const id = getEnterpriseId()
        const targetTabId = tabId || currentTabId.value
        if (!id || !targetTabId) return
        entriesLoading.value = true
        try {
            const response = await $fetch(`/api/enterprises/${id}/tabs/${targetTabId}/entries`)
            entries.value = response.entries || []
        } catch (error) {
            entries.value = []
        } finally {
            entriesLoading.value = false
        }
    }

    // ========== Геттеры ==========
    const isEnterpriseLoaded = computed(() => !!enterpriseId.value)
    const enterpriseName = computed(() => enterpriseData.value?.enterpriseName || '')
    const currentTabName = computed(() => currentTab.value?.name || '')
    const hasEntries = computed(() => entries.value.length > 0)
    const hasStandards = computed(() => standards.value.length > 0)

    return {
        // Данные
        enterpriseId,
        enterpriseData,
        tabs,
        tabsLoading,
        currentTabId,
        currentTab,
        currentTabFields,
        standards,
        standardsLoading,
        currentStandard,
        entries,
        entriesLoading,

        // Геттеры
        isEnterpriseLoaded,
        enterpriseName,
        currentTabName,
        hasEntries,
        hasStandards,

        // Методы предприятия
        setEnterprise,
        loadEnterpriseFromStorage,
        getEnterpriseId,

        // Методы вкладок
        loadTabs,
        loadTabById,
        setCurrentTab,
        saveTab,
        deleteTab,

        // Методы стандартов
        loadStandards,
        saveStandard,
        deleteStandard,
        setDefaultStandard,

        // Методы записей
        loadEntries
    }
})