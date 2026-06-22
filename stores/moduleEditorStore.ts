// stores/moduleEditorStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useModuleApi } from '~~/app/composables/useModuleApi'

export const useModuleEditorStore = defineStore('moduleEditor', () => {
    // Получаем API-функции
    const { fetchModules, loadModuleFiles, loadDependencies } = useModuleApi()

    // Модули
    const modules = ref<any[]>([])
    const modulesLoaded = ref(false)
    const modulesLoading = ref(false)
    const selectedModuleId = ref<string | null>(null)
    const loading = ref(false)

    // Форма
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

    // Файлы
    const moduleFiles = ref<any[]>([])
    const loadingFiles = ref(false)

    // Редактор файла
    const showFileEditor = ref(false)
    const fileForm = ref({
        name: '',
        path: '',
        format: 'vue' as 'vue' | 'js' | 'ts',
        code: '',
        isServer: false
    })
    const editingFilePath = ref<string | null>(null)
    const savingFile = ref(false)

    // Зависимости
    const activeDepTab = ref<'dependencies' | 'devDependencies'>('dependencies')
    const newDep = ref({ name: '', version: '' })
    const clearingCache = ref(false)

    // Прочее
    const showDocs = ref(false)
    const tagsInput = ref('')
    const composablesInput = ref('')

    // Computed
    const isEditing = computed(() => !!selectedModuleId.value)
    const currentDeps = computed(() => {
        if (activeDepTab.value === 'dependencies') {
            return formData.value.dependencies || {}
        }
        return formData.value.devDependencies || {}
    })
    const clientFiles = computed(() => moduleFiles.value.filter(f => !f.isServerFile))
    const serverFiles = computed(() => moduleFiles.value.filter(f => f.isServerFile))

    // ============================================
    // ACTIONS
    // ============================================

    const loadModules = async (enterpriseId: string) => {
        if (modulesLoaded.value || modulesLoading.value) return
        modulesLoading.value = true
        try {
            modules.value = await fetchModules(enterpriseId)
            modulesLoaded.value = true
        } catch (error) {
            console.error('loadModules error:', error)
        } finally {
            modulesLoading.value = false
        }
    }

    const loadModuleFilesById = async (enterpriseId: string, moduleId: string) => {
        loadingFiles.value = true
        try {
            moduleFiles.value = await loadModuleFiles(enterpriseId, moduleId)
        } finally {
            loadingFiles.value = false
        }
    }

    const loadModuleDependencies = async (enterpriseId: string, moduleId: string) => {
        try {
            const result = await loadDependencies(enterpriseId, moduleId)
            formData.value.dependencies = result.dependencies
            formData.value.devDependencies = result.devDependencies
        } catch (error) {
            console.error('loadModuleDependencies error:', error)
        }
    }

    const resetForm = () => {
        formData.value = {
            name: '', fileName: '', description: '', format: 'vue', code: '',
            isPublic: false, tags: [], previewImage: null,
            dependencies: {}, devDependencies: {},
            serverEntry: '', composables: []
        }
        tagsInput.value = ''
        composablesInput.value = ''
    }

    const loadModule = (mod: any) => {
        if (!mod) return
        formData.value = {
            name: mod.name || '',
            fileName: mod.fileName || '',
            description: mod.description || '',
            format: mod.format || 'vue',
            code: mod.code || '',
            isPublic: mod.isPublic || false,
            tags: mod.tags || [],
            previewImage: mod.previewImage || null,
            dependencies: mod.dependencies || {},
            devDependencies: mod.devDependencies || {},
            serverEntry: mod.serverEntry || '',
            composables: mod.composables || []
        }
        tagsInput.value = (mod.tags || []).join(', ')
        composablesInput.value = (mod.composables || []).join(', ')
    }

    const openFileEditor = (file?: any) => {
        if (file) {
            fileForm.value = {
                name: file.name || '',
                path: file.path || '',
                format: file.format || 'vue',
                code: file.code || '',
                isServer: file.isServerFile || false
            }
            editingFilePath.value = file.path || null
        } else {
            fileForm.value = { name: '', path: '', format: 'vue', code: '', isServer: false }
            editingFilePath.value = null
        }
        showFileEditor.value = true
    }

    const closeFileEditor = () => {
        showFileEditor.value = false
        editingFilePath.value = null
    }

    return {
        // State
        modules,
        modulesLoaded,
        modulesLoading,
        selectedModuleId,
        loading,
        formData,
        moduleFiles,
        loadingFiles,
        showFileEditor,
        fileForm,
        editingFilePath,
        savingFile,
        activeDepTab,
        newDep,
        clearingCache,
        showDocs,
        tagsInput,
        composablesInput,

        // Computed
        isEditing,
        currentDeps,
        clientFiles,
        serverFiles,

        // Actions
        resetForm,
        loadModule,
        openFileEditor,
        closeFileEditor,
        loadModules,
        loadModuleFilesById,
        loadModuleDependencies,
    }
})