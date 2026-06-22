// stores/moduleStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'

// Тип для публичного модуля (браузер)
export interface BrowserModule {
    _id: string
    name: string
    fileName: string
    description?: string
    format: 'vue' | 'js' | 'ts'
    previewImage?: string
    tags: string[]
    isOfficial?: boolean
    files?: Array<{ name: string; path: string; format: string }>
    stats?: { downloads: number; ratings: { average: number; count: number } }
}

export const useModulesStore = defineStore('modules', () => {
    // ========== Модули предприятия (было) ==========
    const modules = ref<any[]>([])
    const loading = ref(false)
    const enterpriseId = ref<string | null>(null)

    // ========== Браузер (публичные модули) ==========
    const browserModules = ref<BrowserModule[]>([])
    const browserLoading = ref(false)
    const browserTotalPages = ref(1)
    const browserCurrentPage = ref(1)
    const browserLimit = 12
    const browserSearchQuery = ref('')
    const browserFormatFilter = ref('')
    const browserSortBy = ref('downloads')

    // Кеш браузера: ключ → { modules, totalPages, timestamp }
    const browserCache = ref<Map<string, { modules: BrowserModule[]; totalPages: number; timestamp: number }>>(new Map())
    const CACHE_TTL = 5 * 60 * 1000 // 5 минут

    // Статусы импорта (мапа moduleId → boolean)
    const importLoadingMap = ref<Map<string, boolean>>(new Map())

    // Доступ к редактору
    const hasEditorAccess = ref(false)

    // ========== Геттеры для браузера ==========
    const browserHasModules = computed(() => browserModules.value.length > 0)
    const browserEmpty = computed(() => !browserLoading.value && browserModules.value.length === 0)

    // ========== Вспомогательные ==========
    const getBrowserCacheKey = () => {
        return JSON.stringify({
            search: browserSearchQuery.value,
            format: browserFormatFilter.value,
            sortBy: browserSortBy.value,
            page: browserCurrentPage.value,
            limit: browserLimit
        })
    }

    const isCacheValid = (timestamp: number) => Date.now() - timestamp < CACHE_TTL

    // ========== Основной метод загрузки публичных модулей (с кешем) ==========
    const fetchBrowserModules = async (force = false) => {
        const cacheKey = getBrowserCacheKey()
        const cached = browserCache.value.get(cacheKey)

        if (!force && cached && isCacheValid(cached.timestamp)) {
            browserModules.value = cached.modules
            browserTotalPages.value = cached.totalPages
            return
        }

        browserLoading.value = true
        try {
            const params = new URLSearchParams({
                search: browserSearchQuery.value,
                format: browserFormatFilter.value,
                sortBy: browserSortBy.value,
                page: String(browserCurrentPage.value),
                limit: String(browserLimit)
            })
            const data = await $fetch(`/api/browser/modules?${params.toString()}`)
            browserModules.value = data.modules || []
            browserTotalPages.value = data.pagination?.pages || 1

            browserCache.value.set(cacheKey, {
                modules: data.modules || [],
                totalPages: data.pagination?.pages || 1,
                timestamp: Date.now()
            })
        } catch (error) {
            console.error('fetchBrowserModules error:', error)
            browserModules.value = []
            browserTotalPages.value = 1
            throw error
        } finally {
            browserLoading.value = false
        }
    }

    // Debounced версия для поиска
    const debouncedFetchBrowser = useDebounceFn(() => fetchBrowserModules(), 300)

    // Мутации фильтров с автоматическим сбросом страницы
    const setBrowserSearchQuery = (query: string) => {
        browserSearchQuery.value = query
        browserCurrentPage.value = 1
        debouncedFetchBrowser()
    }

    const setBrowserFormatFilter = (format: string) => {
        browserFormatFilter.value = format
        browserCurrentPage.value = 1
        fetchBrowserModules()
    }

    const setBrowserSortBy = (sort: string) => {
        browserSortBy.value = sort
        browserCurrentPage.value = 1
        fetchBrowserModules()
    }

    const setBrowserPage = (page: number) => {
        browserCurrentPage.value = page
        fetchBrowserModules()
    }

    // Очистка кеша (при смене предприятия, например)
    const clearBrowserCache = () => {
        browserCache.value.clear()
    }

    // ========== Импорт модуля в предприятие ==========
    const importBrowserModule = async (moduleId: string, targetEnterpriseId: string) => {
        importLoadingMap.value.set(moduleId, true)
        try {
            await $fetch(`/api/browser/modules/${moduleId}/import`, {
                method: 'POST',
                body: { targetEnterpriseId }
            })
            // Оповещаем другие части приложения
            window.dispatchEvent(new Event('module-imported'))
            return true
        } catch (error) {
            console.error('Import error:', error)
            throw error
        } finally {
            importLoadingMap.value.set(moduleId, false)
        }
    }

    const isImportingModule = (moduleId: string) => {
        return importLoadingMap.value.get(moduleId) || false
    }

    // ========== Режим редактора ==========
    const checkEditorAccess = () => {
        const saved = localStorage.getItem('editor_access')
        hasEditorAccess.value = saved === 'admin123'
        return hasEditorAccess.value
    }

    const enableEditor = (code: string) => {
        if (code === 'admin123') {
            localStorage.setItem('editor_access', code)
            hasEditorAccess.value = true
            return true
        }
        return false
    }

    const disableEditor = () => {
        localStorage.removeItem('editor_access')
        hasEditorAccess.value = false
    }

    // ========== Старые методы (модули предприятия) без изменений ==========
    const setEnterprise = (id: string) => {
        enterpriseId.value = id
    }

    const fetchModules = async () => {
        if (!enterpriseId.value) return
        loading.value = true
        try {
            const res = await $fetch(`/api/enterprises/${enterpriseId.value}/dynamicModules`)
            modules.value = res.modules || []
        } catch (e) {
            console.error('Ошибка загрузки модулей', e)
            modules.value = []
        } finally {
            loading.value = false
        }
    }

    const getById = (id: string) => modules.value.find(m => m._id === id)
    const getByFileName = (fileName: string) => modules.value.find(m => m.fileName === fileName)

    const getModuleName = (identifier: string | { id?: string; fileName?: string; name?: string }) => {
        let module = null
        if (typeof identifier === 'string') {
            module = getById(identifier) || getByFileName(identifier)
        } else {
            if (identifier.id) module = getById(identifier.id)
            if (!module && identifier.fileName) module = getByFileName(identifier.fileName)
            if (!module && identifier.name) module = modules.value.find(m => m.name === identifier.name)
        }
        return module?.name || 'Модуль'
    }

    return {
        // Модули предприятия
        modules,
        loading,
        enterpriseId,
        setEnterprise,
        fetchModules,
        getById,
        getByFileName,
        getModuleName,

        // Браузер (публичные модули)
        browserModules,
        browserLoading,
        browserTotalPages,
        browserCurrentPage,
        browserSearchQuery,
        browserFormatFilter,
        browserSortBy,
        browserHasModules,
        browserEmpty,
        hasEditorAccess,

        fetchBrowserModules,
        setBrowserSearchQuery,
        setBrowserFormatFilter,
        setBrowserSortBy,
        setBrowserPage,
        clearBrowserCache,

        importBrowserModule,
        isImportingModule,

        checkEditorAccess,
        enableEditor,
        disableEditor,
    }
})