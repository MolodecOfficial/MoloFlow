// stores/moduleEditorStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useModuleApi } from '~~/app/composables/useModuleApi'
import { useEnterpriseModulesStore } from './enterpriseModulesStore'

export const useModuleEditorStore = defineStore('moduleEditor', () => {
    // Получаем API-функции
    const { loadModuleFiles, loadDependencies } = useModuleApi()

    // Модули — БОЛЬШЕ НЕ отдельный список, а витрина над общим
    // enterpriseModulesStore. Тот же кэш, что видит меню (MoloMenu.vue),
    // видит и редактор модулей. Один fetch на двоих, один источник правды.
    const sharedModules = useEnterpriseModulesStore()
    const modules = computed(() => sharedModules.modules)
    const modulesLoaded = computed(() => sharedModules.loaded)
    const modulesLoading = computed(() => sharedModules.loading)
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

    // force=true — принудительная перезагрузка (например, после создания нового модуля).
    // Теперь просто проксирует в общий enterpriseModulesStore — тот же кэш,
    // что и у меню, так что после saveModule() достаточно инвалидировать
    // ОДИН раз, и обновится и меню, и этот список.
    const loadModules = async (enterpriseId: string, force = false) => {
        await sharedModules.load(enterpriseId, force)
    }

    // Один запрос отдаёт и mainFile (код главного файла модуля), и доп. файлы.
    // formData.code проставляется отсюда — больше не нужно тащить code
    // из облегчённого списка модулей (там его больше нет).
    const loadModuleFilesById = async (enterpriseId: string, moduleId: string) => {
        loadingFiles.value = true
        try {
            const result = await loadModuleFiles(enterpriseId, moduleId)
            moduleFiles.value = result.files || []
            if (result.mainFile) {
                formData.value.code = result.mainFile.code || ''
            }
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
        moduleFiles.value = []
    }

    // Проставляет лёгкие поля модуля (name/fileName/format/description/tags/...).
    // code сюда сознательно НЕ берётся из mod (в облегчённом списке его нет) —
    // он приходит отдельно из loadModuleFilesById(), которая грузит его вместе с файлами.
    const loadModule = (mod: any) => {
        if (!mod) return
        formData.value = {
            name: mod.name || '',
            fileName: mod.fileName || '',
            description: mod.description || '',
            format: mod.format || 'vue',
            code: '',
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

    const loadFullModule = async (
        enterpriseId:string,
        moduleId:string
    )=>{

        const service = useModuleService()


        const full =
            await service.fetchFullModuleData(
                moduleId,
                enterpriseId
            )


        formData.value = {

            name:
            full.name,

            fileName:
            full.fileName,

            description:
            full.description,


            format:
            full.format,


            code:
            full.code,


            isPublic:
            full.isPublic,


            tags:
            full.tags,


            previewImage:
                full.previewImage || null,


            dependencies:
            full.dependencies,


            devDependencies:
            full.devDependencies,


            serverEntry:
            full.serverEntry,


            composables:
            full.composables

        }


        moduleFiles.value =
            full.files


        selectedModuleId.value =
            moduleId


        return full
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
        loadFullModule,
        openFileEditor,
        closeFileEditor,
        loadModules,
        loadModuleFilesById,
        loadModuleDependencies,
    }
})