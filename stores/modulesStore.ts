import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useModulePrefetch } from '~/composables/compiler/useModulePrefetch'

export interface BrowserModule {
    _id: string
    name: string
    fileName?: string
    description?: string
    format: 'vue' | 'js' | 'ts'
    previewImage?: string
    tags: string[]
    stats?: { downloads: number }
}

export const useModulesStore = defineStore('modules', () => {
    // ── 1. Модули предприятия ──
    const enterpriseModules = ref<any[]>([])
    const enterpriseModulesLoaded = ref(false)
    const enterpriseModulesLoading = ref(false)

    // ── 2. Браузер публичных модулей ──
    const browserModules = ref<BrowserModule[]>([])
    const browserLoading = ref(false)
    const browserTotalPages = ref(1)
    const browserCurrentPage = ref(1)
    const browserSearchQuery = ref('')
    const browserFormatFilter = ref('')
    const browserSortBy = ref('downloads')

    // ── 3. Редактор Creature ──
    const selectedModuleId = ref<string | null>(null)
    const editorLoading = ref(false)
    const formData = ref({
        name: '',
        fileName: '',
        description: '',
        format: 'vue' as 'vue' | 'js' | 'ts',
        code: '',
        isPublic: false,
        tags: [] as string[],
        previewImage: null as string | null,
        dependencies: {} as Record<string, string>,
        devDependencies: {} as Record<string, string>,
        serverEntry: '',
        composables: [] as string[]
    })
    const moduleFiles = ref<any[]>([])
    const loadingFiles = ref(false)

    const isEditing = computed(() => !!selectedModuleId.value)
    const clientFiles = computed(() => moduleFiles.value.filter(f => !f.isServerFile))
    const serverFiles = computed(() => moduleFiles.value.filter(f => f.isServerFile))

    // Загрузка легкого списка модулей + фоновый прогрев SFC
    const loadEnterpriseModules = async (enterpriseId: string, force = false) => {
        if (!enterpriseId) {
            enterpriseModules.value = []
            enterpriseModulesLoaded.value = false
            return
        }
        if (!force && enterpriseModulesLoaded.value) return

        enterpriseModulesLoading.value = true
        try {
            const res: any = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules`, {
                params: { minimal: '1' }
            })
            enterpriseModules.value = res.modules || []
            enterpriseModulesLoaded.value = true

            // Запуск фонового прогрева модулей через requestIdleCallback
            if (import.meta.client && enterpriseModules.value.length > 0) {
                const { prefetchModules } = useModulePrefetch()
                void prefetchModules(enterpriseModules.value, enterpriseId)
            }
        } catch {
            enterpriseModules.value = []
        } finally {
            enterpriseModulesLoading.value = false
        }
    }

    const fetchBrowserModules = async () => {
        browserLoading.value = true
        try {
            const params = new URLSearchParams({
                search: browserSearchQuery.value,
                format: browserFormatFilter.value,
                sortBy: browserSortBy.value,
                page: String(browserCurrentPage.value),
                limit: '12'
            })
            const data: any = await $fetch(`/api/browser/modules?${params.toString()}`)
            browserModules.value = data.modules || []
            browserTotalPages.value = data.pagination?.pages || 1
        } catch {
            browserModules.value = []
        } finally {
            browserLoading.value = false
        }
    }

    const importBrowserModule = async (moduleId: string, targetEnterpriseId: string) => {
        await $fetch(`/api/browser/modules/${moduleId}/import`, {
            method: 'POST',
            body: { targetEnterpriseId }
        })
        await loadEnterpriseModules(targetEnterpriseId, true)
    }

    const loadModuleFilesById = async (enterpriseId: string, moduleId: string) => {
        loadingFiles.value = true
        try {
            const response: any = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`)
            moduleFiles.value = response.files || []
            if (response.mainFile?.code) {
                formData.value.code = response.mainFile.code
            }
        } finally {
            loadingFiles.value = false
        }
    }

    const resetForm = () => {
        formData.value = {
            name: '',
            fileName: '',
            description: '',
            format: 'vue',
            code: '',
            isPublic: false,
            tags: [],
            previewImage: null,
            dependencies: {},
            devDependencies: {},
            serverEntry: '',
            composables: []
        }
        moduleFiles.value = []
        selectedModuleId.value = null
    }

    return {
        enterpriseModules,
        enterpriseModulesLoaded,
        enterpriseModulesLoading,
        browserModules,
        browserLoading,
        browserTotalPages,
        browserCurrentPage,
        browserSearchQuery,
        browserFormatFilter,
        browserSortBy,
        selectedModuleId,
        editorLoading,
        formData,
        moduleFiles,
        loadingFiles,
        isEditing,
        clientFiles,
        serverFiles,
        loadEnterpriseModules,
        fetchBrowserModules,
        importBrowserModule,
        loadModuleFilesById,
        resetForm
    }
})