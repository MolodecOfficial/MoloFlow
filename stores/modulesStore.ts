import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { useModulePrefetch } from '~/composables/compiler/useModulePrefetch'
import { buildAuthHeaders, resolveUserId } from '~~/server/utils/authContext'

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
    const appStore = useAppStore()

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

    // Единственное объявление: заголовки авторизации (токен + x-user-id)
    const getAuthHeaders = (): Record<string, string> => {
        return buildAuthHeaders(appStore.currentUser?._id)
    }

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
                params: { minimal: '1' },
                headers: getAuthHeaders()
            })
            enterpriseModules.value = res.modules || []
            enterpriseModulesLoaded.value = true

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
            const data: any = await $fetch(`/api/browser/modules?${params.toString()}`, {
                headers: getAuthHeaders()
            })
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
            body: { targetEnterpriseId },
            headers: getAuthHeaders()
        })
        await loadEnterpriseModules(targetEnterpriseId, true)
    }

    const loadModuleFilesById = async (enterpriseId: string, moduleId: string) => {
        loadingFiles.value = true
        try {
            const response: any = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`, {
                headers: getAuthHeaders()
            })
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

    // ── Удаление модуля ──
    const deleteModule = async (enterpriseId: string, moduleId: string) => {
        if (!enterpriseId || !moduleId) return

        appStore.loadUserFromStorage()
        const currentUserId = resolveUserId(appStore.currentUser?._id)

        await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}`, {
            method: 'DELETE',
            params: { userId: currentUserId || undefined },
            headers: buildAuthHeaders(currentUserId)
        })

        await loadEnterpriseModules(enterpriseId, true)

        if (selectedModuleId.value === moduleId) {
            resetForm()
        }
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
        resetForm,
        deleteModule
    }
})