// stores/moduleEditorStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useModuleEditorStore = defineStore('moduleEditor', () => {
    // Модули
    const modules = ref<any[]>([])
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

    // Actions
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
        closeFileEditor
    }
})