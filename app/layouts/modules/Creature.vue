  <script setup lang="ts">
  import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
  import {VueMonacoEditor} from '@guolao/vue-monaco-editor'
  import {getEditorLanguage, MONACO_EDITOR_OPTIONS} from '~~/app/utils/monacoConfig'
  import {initMonacoTypeScript, registerMonacoSnippets} from '~~/app/utils/monaco-init'
  import {useUserStore} from "~~/stores/userStore";

  import jsIcon from "~~/public/js.png";
  import tsIcon from "~~/public/ts.png";
  import vueIcon from "~~/public/vue.png";

  if (typeof window !== 'undefined') {
    initMonacoTypeScript()
    registerMonacoSnippets()
  }

  const emit = defineEmits(['close', 'saved'])
  const {openWindow, updateWindowData} = useWindowManager()
  const {addNotification} = useNotifications('Создание модуля')
  const {addLog} = useLogger('Создание модуля')
  const userStore = useUserStore()

  const showFileEditor = ref(false)
  const enterpriseInfo = ref<any>(null)
  const modules = ref<any[]>([])
  const selectedModuleId = ref<string | null>(null)
  const isEditing = computed(() => !!selectedModuleId.value)
  const monacoRef = ref()
  const showDocumentation = ref(false)
  const loading = ref(false)
  const loadingSubModules = ref(false)
  const loadingUPD = ref(false)
  const previewWindowId = ref<string | null>(null)

  const availableLocations = ref<any[]>([])
  const selectedGroupId = ref<string>('')
  const selectedParentId = ref<string | null>(null)
  const addingToMenu = ref(false)

  const activeDepTab = ref<'dependencies' | 'devDependencies'>('dependencies')
  const newDepName = ref('')
  const newDepVersion = ref('')
  const composablesInput = ref('')

  const newFileName = ref('')
  const newFilePath = ref('')
  const newFileFormat = ref('vue')
  const newFileCode = ref('')
  const newFileIsServer = ref(false)
  const editingFilePath = ref<string | null>(null)
  const moduleFiles = ref<any[]>([])
  const fileTab = ref<'list' | 'editor'>('list')

  const fileFormats = [
    {label: '.vue', value: 'vue'},
    {label: '.js', value: 'js'},
    {label: '.ts', value: 'ts'},
  ]

  const formData = ref({
    name: '',
    fileName: '',
    description: '',
    format: 'vue',
    code: '',
    isPublic: false,
    tags: [] as string[],
    previewImage: null as string | null,
    dependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>,
    serverEntry: '',
    composables: [] as string[]
  })

  const tagsInput = ref('')

  const currentDeps = computed(() => {
    if (activeDepTab.value === 'dependencies') {
      return formData.value.dependencies || {}
    }
    return formData.value.devDependencies || {}
  })

  const availableParents = computed(() => {
    if (!selectedGroupId.value) return []
    const group = availableLocations.value.find(g => g.groupId === selectedGroupId.value)
    if (!group) return []
    return (group.locations || []).filter((loc: any) => loc.id !== null)
  })

  const currentUser = computed(() => ({
    _id: userStore.userId || 'system',
    name: userStore.userName || 'System',
    role: userStore.userRole || 'system'
  }))

  const editorLanguage = computed(() => getEditorLanguage(formData.value.format))

  const availableFormats = [
    {label: '.vue', value: 'vue'},
    {label: '.js', value: 'js'},
    {label: '.ts', value: 'ts'}
  ]

  // Разделение файлов на клиентские и серверные
  const clientFiles = computed(() => moduleFiles.value.filter(f => !f.isServerFile))
  const serverFiles = computed(() => moduleFiles.value.filter(f => f.isServerFile))

  const getPlaceholder = () => {
    if (formData.value.format === 'vue') {
      return `<script setup>
  import { ref } from 'vue'

  const message = ref('Привет из динамического модуля!')

  const handleClick = () => {
    message.value = 'Работает!'
  }

  const { addNotification } = useNotifications()

  const notice = () => {
    addNotification('info', 'Стандартное уведомление')
  }

  const danger = () => {
    addNotification('warning', 'Предупреждающее уведомление')
  }

  const error = () => {
    addNotification('error', 'Уведомление об ошибке')
  }

  const testArray = ['Вика', 'Максим', 'Кирилл']
  <\/script>

  <template>
    <div class="container">
      <h1>{{ message }}</h1>
      <button @click="handleClick" class="action-btn confirm">Click me</button>
      <section class="container_input">
          <MoloInput
              lRequired
              tLabel="Надпись к полю ввода"
              maxLength="12"
              placeholder="Фоновый текст"
          />
          <MoloInput
              address
              lRequired
              tLabel="Режим ввода адреса"
          />
          <MoloInput
              phone
              lRequired
              tLabel="Режим ввода телефона"
          />
          <MoloSelect
              lRequired
              tLabel="Работа со списком"
              :parent="testArray"
              disabled="Выберите элемент"
              all="Все имена"
          />
      </section>
      <section class="container_notifications">
          <button @click="notice" class="action-btn confirm">Стандартное уведомление</button>
          <button @click="danger" class="action-btn danger">Предупреждающее уведомление</button>
          <button @click="error" class="action-btn close">Уведомление об ошибке</button>
      </section>
    </div>
  </template>

  <style scoped>
  .container {
      display: flex;
      flex-direction: column;
      gap: 10px;
  }
  .container_input {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      gap: 10px;
  }
  .container_notifications {
      display: flex;
      width: 100%;
      flex-direction: row;
      gap: 20px;
      justify-content: space-between;
  }
  .action-btn.confirm {
    padding: 6px 16px;
    background: #1eef6f;
    color: #020b18;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
  }
  .action-btn.danger {
    padding: 8px 16px;
    background: #efd31e;
    color: #020b18;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
  }
  .action-btn.close {
    padding: 8px 16px;
    background: #ef1e1e;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
  }
  </style>
  `
    }
    return '// module code...'
  }

  const fetchModules = async () => {
    if (!enterpriseInfo.value?._id) {
      addLog('error', 'Нет ID предприятия')
      return
    }

    addLog('info', 'Загружаем модули для редактирования')
    try {
      const enterpriseId = enterpriseInfo.value._id
      const res = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules`)
      modules.value = res.modules || []
      addLog('success', `Загружено ${modules.value.length} модулей`)
    } catch (e: any) {
      addLog('error', `Ошибка загрузки модулей: ${e.message}`)
      modules.value = []
    }
  }

  const loadModuleFiles = async (moduleId: string, enterpriseId: string) => {
    if (!moduleId || !enterpriseId) {
      addLog('error', `Компилятор не может найти айди элементов: ${moduleId && enterpriseId}`)
      return
    }
    addLog("info", `Начинаю загрузку файлов для модуля...`)
    loadingSubModules.value = true
    try {
      const response = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`)
      moduleFiles.value = response.files || []
      addLog('success', `Загружено ${moduleFiles.value.length} файла(ов)`)
    } catch (err: any) {
      addLog('error', `Ошибка загрузки файлов для модуля - ${err}`)
      moduleFiles.value = []
    } finally {
      loadingSubModules.value = false
    }
  }

  const openFileEditor = () => {
    resetFileForm()
    showFileEditor.value = true
  }

  const closeFileEditor = () => {
    showFileEditor.value = false
    resetFileForm()
  }

  const editFile = (file: any) => {
    newFileName.value = file.name
    newFilePath.value = file.path
    newFileFormat.value = file.format
    newFileCode.value = file.code || ''
    newFileIsServer.value = file.isServerFile || false
    editingFilePath.value = file.path
    showFileEditor.value = true
  }

  const resetFileForm = () => {
    newFileName.value = ''
    newFilePath.value = ''
    newFileFormat.value = 'vue'
    newFileCode.value = ''
    newFileIsServer.value = false
    editingFilePath.value = null
  }

  const normalizePath = (name: string, pathInput: string, format: string) => {
    let basePath = pathInput?.trim() || name.trim()
    basePath = basePath.replace(/^\.\//, '')
    if (!basePath.match(/\.[a-z]+$/)) {
      basePath += `.${format}`
    }
    return basePath
  }

  const saveFile = async () => {
    if (!selectedModuleId.value || !enterpriseInfo.value?._id) return

    if (!newFileName.value) {
      addNotification('warning', 'Введите имя файла')
      addLog('warning', 'Имя файла пустое')
      return
    }

    addLog('info', editingFilePath.value ? 'Начинаю обновление файла...' : 'Начинаю сохранение файла')

    try {
      loadingUPD.value = true
      const filePath = normalizePath(
          newFileName.value,
          newFilePath.value,
          newFileFormat.value
      )

      const fileData = {
        name: newFileName.value,
        path: filePath,
        format: newFileFormat.value,
        code: newFileCode.value,
        isServerFile: newFileIsServer.value
      }

      await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${selectedModuleId.value}/files`, {
        method: 'POST',
        body: {
          action: editingFilePath.value ? 'update' : 'add',
          file: fileData,
          oldPath: editingFilePath.value  // ← передаём старый путь для поиска
        }
      })

      addNotification('info', editingFilePath.value ? 'Файл обновлён' : 'Файл добавлен')
      addLog('success', editingFilePath.value ? 'Файл успешно обновлен' : 'Файл успешно сохранён')

      await loadModuleFiles(selectedModuleId.value, enterpriseInfo.value._id)
      closeFileEditor()

    } catch (error: any) {
      console.error('Save file error:', error)
      addNotification('error', 'Ошибка сохранения файла')
      addLog('error', `Ошибка сохранения файла - ${error.message}`)
    } finally {
      loadingUPD.value = false
    }
  }

  const deleteFile = async (filePath: string) => {
    if (!selectedModuleId.value || !enterpriseInfo.value?._id) return
    addLog('info', 'Начинаю удаление файла...')
    try {
      await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${selectedModuleId.value}/files`, {
        method: 'POST',
        body: {
          action: 'delete',
          file: {path: filePath}
        }
      })
      addNotification('info', 'Файл удалён')
      addLog('info', `Файл ${filePath} удалён`)
      await loadModuleFiles(selectedModuleId.value, enterpriseInfo.value._id)
    } catch (error: any) {
      addNotification('error', 'Ошибка удаления файла')
      addLog('error', `Ошибка удаления файла - ${error.message}`)
    }
  }

  const loadDependencies = async () => {
    if (!selectedModuleId.value || !enterpriseInfo.value?._id) return
    addLog('info', 'Начинаю загрузку зависимостей')
    try {
      const res = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${selectedModuleId.value}/dependencies`)
      if (res) {
        formData.value.dependencies = res.dependencies || {}
        formData.value.devDependencies = res.devDependencies || {}
        addLog('success', 'Зависимости загружены')
      }
    } catch (error) {
      addLog('error', `Ошибка загрузки зависимостей - ${error}`)
    }
  }

  const addDependency = async () => {
    if (!newDepName.value || !selectedModuleId.value) return
    addLog('info', 'Начинаю сохранение зависимости...')

    try {
      await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${selectedModuleId.value}/dependencies`, {
        method: 'POST',
        body: {
          action: 'add',
          packageName: newDepName.value,
          version: newDepVersion.value || 'latest',
          packageType: activeDepTab.value
        }
      })

      await loadDependencies()
      addNotification('info', `Зависимость добавлена`)
      addLog('success', `Зависимость ${newDepName.value} добавлен`)
      newDepName.value = ''
      newDepVersion.value = ''
    } catch (error: any) {
      addNotification('error', 'Ошибка добавления зависимости')
      addLog('error', `Ошибка добавления зависимости - ${error.message}`)
    }
  }

  const removeDependency = async (packageName: string) => {
    if (!selectedModuleId.value) return
    addLog('info', 'Начинаю удаление зависимости...')

    try {
      await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${selectedModuleId.value}/dependencies`, {
        method: 'POST',
        body: {
          action: 'remove',
          packageName,
          packageType: activeDepTab.value
        }
      })

      await loadDependencies()
      addNotification('info', `Зависимость удален`)
      addLog('success', `Зависимость ${packageName} удалена`)
    } catch (error: any) {
      addLog('error', `Ошибка удаления зависимости - ${error.message}`)
      addNotification('error', 'Ошибка удаления зависимости')
    }
  }

  const loadAvailableLocations = async () => {
    addLog('info', 'Поиск доступного места в меню')
    try {
      const locations = await $fetch('/api/menu/location')
      availableLocations.value = locations || []
      if (availableLocations.value.length > 0 && !selectedGroupId.value) {
        selectedGroupId.value = availableLocations.value[0].groupId
      }
      addLog('success', 'Места загружены')
    } catch (error) {
      addLog('error', `Ошибка загрузки мест в меню: ${error}`)
    }
  }

  const addModuleToMenu = async () => {
    if (!selectedGroupId.value) {
      addNotification('warning', 'Выберите группу меню')
      return
    }

    let moduleId = selectedModuleId.value
    if (!moduleId) {
      await saveModule()
      moduleId = selectedModuleId.value
      if (!moduleId) {
        addNotification('error', 'Не удалось сохранить модуль')
        return
      }
    }

    const mod = modules.value.find(m => m._id === moduleId)
    if (!mod) {
      addNotification('error', 'Модуль не найден')
      return
    }

    addingToMenu.value = true
    try {
      addLog('info', 'Добавляем модуль в меню...')
      await $fetch('/api/menu/module', {
        method: 'POST',
        body: {
          module: {
            _id: mod._id,
            name: mod.name,
            format: mod.format
          },
          targetGroupId: selectedGroupId.value,
          parentItemId: selectedParentId.value || null
        }
      })
      addNotification('info', 'Модуль добавлен в меню')
      window.dispatchEvent(new CustomEvent('modules-updated'))
      selectedGroupId.value = ''
      selectedParentId.value = null
      addLog('success', `Модуль "${mod.name}" добавлен в меню`)
    } catch (error: any) {
      addLog('info', `Ошибка добавления модуля "${mod.name}" в меню - ${error?.data?.message}`)
      addNotification('error', 'Модуль не добавлен в меню!')
    } finally {
      addingToMenu.value = false
    }
  }

  const saveModule = async () => {
    if (!enterpriseInfo.value?._id) {
      addNotification('error', 'ID предприятия не найден')
      return
    }

    if (!formData.value.name) {
      addNotification('error', 'Введите название модуля')
      return
    }

    if (!formData.value.fileName) {
      addNotification('error', 'Введите имя файла')
      return
    }

    loading.value = true
    const wasEditing = isEditing.value
    addLog('info', 'Начинаю сохранения модуля...')

    try {
      let response

      if (wasEditing) {
        // PUT запрос - обновление существующего модуля
        const url = `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${selectedModuleId.value}`

        response = await $fetch(url, {
          method: 'PUT',
          body: {
            name: formData.value.name,
            fileName: formData.value.fileName,
            description: formData.value.description,
            format: formData.value.format,
            code: formData.value.code,
            isPublic: formData.value.isPublic,
            tags: formData.value.tags,
            previewImage: formData.value.previewImage,
            dependencies: formData.value.dependencies,
            devDependencies: formData.value.devDependencies,
            serverEntry: formData.value.serverEntry,
            composables: formData.value.composables
          }
        })
      } else {
        // POST запрос - создание нового модуля
        const url = `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules`
        addLog('info', `POST запрос на ${url}`)

        response = await $fetch(url, {
          method: 'POST',
          body: {
            name: formData.value.name,
            fileName: formData.value.fileName,
            description: formData.value.description,
            format: formData.value.format,
            code: formData.value.code,
            enterpriseId: enterpriseInfo.value._id,
            isPublic: formData.value.isPublic,
            tags: formData.value.tags,
            previewImage: formData.value.previewImage,
            createdBy: {
              _id: currentUser.value._id,
              name: currentUser.value.name,
              role: currentUser.value.role
            },
            dependencies: formData.value.dependencies,
            devDependencies: formData.value.devDependencies,
            serverEntry: formData.value.serverEntry,
            composables: formData.value.composables
          }
        })
      }

      await fetchModules()

      if (!wasEditing) {
        selectedModuleId.value = response.module._id
        addNotification('info', 'Модуль создан')
        addLog('success', `Модуль ${response.module.fileName} успешно создан`)
        if (availableLocations.value.length === 0) {
          await loadAvailableLocations()
        }
      } else {
        // Принудительно перезагружаем данные модуля после обновления
        const updatedMod = modules.value.find(m => m._id === selectedModuleId.value)
        if (updatedMod) {
          formData.value = {
            name: updatedMod.name,
            fileName: updatedMod.fileName,
            description: updatedMod.description || '',
            format: updatedMod.format,
            code: updatedMod.code,
            isPublic: updatedMod.isPublic || false,
            tags: updatedMod.tags || [],
            previewImage: updatedMod.previewImage || null,
            dependencies: updatedMod.dependencies || {},
            devDependencies: updatedMod.devDependencies || {},
            serverEntry: updatedMod.serverEntry || '',
            composables: updatedMod.composables || []
          }
          tagsInput.value = (updatedMod.tags || []).join(', ')
          composablesInput.value = (updatedMod.composables || []).join(', ')
        }
        addLog('success', `Модуль ${response.module?.fileName || formData.value.fileName} успешно обновлён`)
        addNotification('info', 'Модуль обновлен')
      }

      emit('saved', response.module)
    } catch (error: any) {
      console.error('Save module error:', error)
      addNotification('error', error?.data?.message || error?.message || 'Ошибка сохранения модуля')
      addLog('error', `Ошибка сохранения модуля - ${error?.data?.message || error?.message} `)
    } finally {
      loading.value = false
    }
  }

  const handleImageUpload = (event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.files && input.files[0]) {
      const reader = new FileReader()
      reader.onload = (e) => {
        formData.value.previewImage = e.target?.result as string
      }
      reader.readAsDataURL(input.files[0])
    }
  }

  const removePreview = () => {
    formData.value.previewImage = null
  }

  const openPreviewInWindow = () => {
    if (!formData.value.code?.trim()) {
      addNotification('warning', 'Нет кода для предпросмотра')
      return
    }

    if (selectedModuleId.value && moduleFiles.value.length === 0) {
      addNotification('warning', 'Файлы модуля еще не загружены')
      return
    }

    const id = 'preview'
    previewWindowId.value = id

    const filesForPreview = moduleFiles.value.map(file => ({
      path: file.path,
      name: file.name,
      format: file.format,
      code: file.code,
      isServerFile: file.isServerFile
    }))

    addLog('info', 'Открываю предпоказ модуля...')

    openWindow('modules', id, null, {
      width: 600,
      height: 500,
      minWidth: 600,
      minHeight: 400
    }, false, 'modules/preview', null, {
      moduleName: formData.value.name || 'Без названия',
      code: formData.value.code,
      files: filesForPreview,
      dependencies: formData.value.dependencies
    })
  }

  const toggleDocumentation = () => {
    showDocumentation.value = !showDocumentation.value
  }

  const resetForm = () => {
    formData.value = {
      name: '',
      fileName: '',
      description: '',
      format: 'vue',
      code: getPlaceholder(),
      isPublic: false,
      tags: [],
      previewImage: null,
      dependencies: {},
      devDependencies: {},
      serverEntry: '',
      composables: []
    }
    tagsInput.value = ''
    composablesInput.value = ''
  }

  watch(tagsInput, (val) => {
    formData.value.tags = val.split(',').map(t => t.trim()).filter(Boolean)
  })

  watch(composablesInput, (val) => {
    formData.value.composables = val.split(',').map(c => c.trim()).filter(Boolean)
  })

  watch(selectedModuleId, async (id) => {
    if (!id) {
      resetForm()
      return
    }

    const mod = modules.value.find(m => m._id === id)
    if (mod) {
      formData.value = {
        name: mod.name,
        fileName: mod.fileName,
        description: mod.description || '',
        format: mod.format,
        code: mod.code,
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

      await loadModuleFiles(id, enterpriseInfo.value?._id)
      await loadDependencies()

      fileTab.value = 'list'
      resetFileForm()
    }
  })

  watch(() => formData.value.format, () => {
    if (!isEditing.value) formData.value.code = getPlaceholder()
  })

  watch(selectedGroupId, () => {
    selectedParentId.value = null
  })

  watch([newFileName, newFileFormat], () => {
    if (!newFileName.value) return
    if (!newFilePath.value || !newFilePath.value.includes('/')) {
      newFilePath.value = `${newFileName.value}.${newFileFormat.value}`
    }
  })

  watch(newFilePath, (val) => {
    if (!val) return
    if (!val.match(/\.[a-z]+$/)) {
      newFilePath.value = `${val}.${newFileFormat.value}`
    }
  })

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(() => formData.value.code, (code) => {
    if (!previewWindowId.value) return
    updateWindowData('modules', previewWindowId.value!, {
      moduleName: formData.value.name,
      code,
      isEditing: isEditing.value
    })
  })

  watch(showDocumentation, async () => {
    await nextTick()
    setTimeout(() => monacoRef.value?.editor?.layout?.(), 50)
  })

  onMounted(async () => {
    const data = localStorage.getItem('currentEnterprise')
    if (data) {
      try {
        enterpriseInfo.value = JSON.parse(data)
        await fetchModules()
      } catch (e) {
        addNotification('warning', 'Ошибка при получении предприятия')
      }
    }
    resetForm()
    await loadAvailableLocations()
  })

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })
  </script>

  <template>
    <div class="module-editor">
      <div class="editor-header">
        <div class="header-left">
          <h1>{{ isEditing ? 'Редактирование модуля' : 'Создание модуля' }}</h1>
          <div class="header-actions">
            <button type="button" class="action-btn" :class="selectedModuleId ? 'default' : 'confirm'"
                    @click="selectedModuleId = null">
              Новый
            </button>
            <button v-if="formData.format === 'vue'" class="action-btn"
                    :class="openPreviewInWindow ? 'default' : 'confirm' " @click="openPreviewInWindow">
              Предпросмотр
            </button>
            <button class="action-btn" @click="toggleDocumentation" :class="showDocumentation ? 'default' : 'confirm'">
              {{ showDocumentation ? 'Скрыть док.' : 'Документация' }}
            </button>
          </div>
        </div>

        <div class="header-right">
          <MoloSelect
              v-model="selectedModuleId"
              :parent="modules"
              children="name"
              valueKey="_id"
              disabled="Выбрать модуль"
              class="module-select"
          />
        </div>
      </div>

      <hr>

      <div class="editor-grid">
        <div class="main-settings">
          <div class="settings-group">
            <h3>Основное</h3>
            <div class="form-row">
              <MoloInput tLabel="Название" lRequired v-model="formData.name" placeholder="Введите название"/>
              <MoloInput tLabel="Имя файла" lRequired v-model="formData.fileName" placeholder="на_английском"/>
              <MoloSelect tLabel="Формат" lRequired v-model="formData.format" :parent="availableFormats" children="label"
                          valueKey="value"/>
            </div>
          </div>

          <div class="settings-group">
            <h3>Мета</h3>
            <div class="form-row">
              <MoloInput tLabel="Описание" v-model="formData.description" placeholder="Что делает модуль?"/>
              <MoloInput tLabel="Теги" v-model="tagsInput" placeholder="ui, таблицы, графики"/>
            </div>
          </div>

          <div class="settings-group">
            <div class="form-row low">
              <label class="checkbox-label">
                <input type="checkbox" v-model="formData.isPublic"/>
                <span>Общедоступный</span>
              </label>

              <div class="preview-upload">
                <MoloInput type="file" accept="image/*" @change="handleImageUpload" tLabel="Превью"/>
                <div v-if="formData.previewImage" class="preview-image">
                  <img :src="formData.previewImage" alt="preview" style="width: 60px"/>
                  <button class="action-btn close small" @click="removePreview">✕</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="menu-settings">
          <div class="settings-group">
            <h3>Добавление в меню</h3>
            <MoloSelect v-model="selectedGroupId" :parent="availableLocations" tLabel="Группа" children="groupTitle"
                        valueKey="groupId"/>
            <MoloSelect v-if="availableParents.length" v-model="selectedParentId" :parent="availableParents"
                        tLabel="Родитель" children="title" valueKey="id"/>
            <button class="action-btn confirm full-width" :disabled="!selectedGroupId || addingToMenu"
                    @click="addModuleToMenu">
              <span v-if="!addingToMenu">Добавить в меню</span>
              <MoloLoaders v-else btnLoader/>
            </button>
          </div>
        </div>
      </div>

      <hr>

      <div class="editor-section">
        <div class="modal-header">
          <h3>Код модуля</h3>
        </div>
        <div class="code-container" :class="{ 'with-docs': showDocumentation }">
          <vue-monaco-editor
              ref="monacoRef"
              v-model:value="formData.code"
              theme="vs-dark"
              :language="editorLanguage"
              :options="MONACO_EDITOR_OPTIONS"
              class="monaco-editor-container"
          />
          <div v-if="showDocumentation" class="documentation">
            <MoloDocumentation/>
          </div>
        </div>
      </div>

      <hr>

      <!-- Файлы модуля - клиентские и серверные вместе -->
      <div class="files-section">
        <div class="file-tree">
          <div class="file-tree-title">
            <span>Файлы модуля</span>
            <button class="action-btn confirm" @click="openFileEditor">Добавить файл</button>
          </div>

          <div class="file-item main">
      <span class="file-logo">
        <img :src="vueIcon" class="file-icon" alt="" v-if="formData.format == 'vue'">
        <img :src="tsIcon" class="file-icon" alt="" v-else-if="formData.format == 'ts'">
        <img :src="jsIcon" class="file-icon" alt="" v-else>
        {{ formData.fileName }}
      </span>
            <span class="file-badge">{{ formData.format }} | Главный файл</span>
          </div>

          <!-- Лоадер -->
          <div v-if="loadingSubModules" class="loader-wrapper">
            <MoloLoaders wndLoader/>
          </div>

          <!-- Клиентские файлы -->
          <div v-for="file in clientFiles" :key="file.path" class="file-item">
            <div class="file-info">
        <span class="file-logo">
          <img :src="vueIcon" class="file-icon" alt="" v-if="file.format == 'vue'">
          <img :src="tsIcon" class="file-icon" alt="" v-else-if="file.format == 'ts'">
          <img :src="jsIcon" class="file-icon" alt="" v-else>
          {{ file.name }}
        </span>
              <span class="file-badge">{{ file.format }}</span>
              <span class="file-path">{{ file.path }}</span>
            </div>
            <div class="file-actions">
              <button @click="editFile(file)" class="action-btn-small edit" title="Редактировать">↩</button>
              <button @click="deleteFile(file.path)" class="action-btn-small delete" title="Удалить">×</button>
            </div>
          </div>

          <!-- Серверные файлы -->
          <div v-for="file in serverFiles" :key="file.path" class="file-item">
            <div class="file-info">
        <span class="file-logo">
          <img :src="tsIcon" class="file-icon" alt="" v-if="file.format == 'ts'">
          <img :src="jsIcon" class="file-icon" alt="" v-else>
          {{ file.name }}
        </span>
              <span class="file-badge server">server | {{ file.format }}</span>
              <span class="file-path">{{ file.path }}</span>
            </div>
            <div class="file-actions">
              <button @click="editFile(file)" class="action-btn-small edit" title="Редактировать">↩</button>
              <button @click="deleteFile(file.path)" class="action-btn-small delete" title="Удалить">×</button>
            </div>
          </div>

          <div v-if="!loadingSubModules && clientFiles.length === 0 && serverFiles.length === 0" class="file-empty">
            Нет файлов
          </div>
        </div>
      </div>
      <!-- Модальное окно для создания/редактирования файла -->
      <div v-if="showFileEditor" class="modal-overlay" @click.self="closeFileEditor">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ editingFilePath ? 'Редактирование файла' : 'Новый файл' }}</h3>
          </div>

          <div class="modal-body">
            <div class="form-row">
              <MoloInput v-model="newFileName" tLabel="Имя файла" placeholder="Button.vue" lRequired/>
              <MoloInput v-model="newFilePath" tLabel="Путь" placeholder="components/Button.vue" lRequired/>
              <MoloSelect v-model="newFileFormat" tLabel="Формат" :parent="fileFormats" children="label"
                          valueKey="value"/>
            </div>

            <div class="form-row" style="margin-top: 12px;">
              <label class="checkbox-label">
                <input type="checkbox" v-model="newFileIsServer"/>
                <span>Серверный файл</span>
              </label>
            </div>

            <div class="file-editor-container">
              <vue-monaco-editor
                  v-model:value="newFileCode"
                  theme="vs-dark"
                  :language="getEditorLanguage(newFileFormat)"
                  :options="MONACO_EDITOR_OPTIONS"
                  class="file-monaco-editor"
              />
            </div>
          </div>

          <div class="modal-footer">
            <button class="action-btn close" @click="closeFileEditor">Отмена</button>
            <button class="action-btn confirm" @click="saveFile" :disabled="loadingUPD">
              <span v-if="!loadingUPD">{{ editingFilePath ? 'Обновить' : 'Создать' }}</span>
              <MoloLoaders v-else btnLoader/>
            </button>
          </div>
        </div>
      </div>

      <hr>

      <div class="package-tree">
        <div class="file-tree-title">
          <span>Зависимости</span>
        </div>

        <div class="dep-tabs">
          <button :class="['action-btn', { confirm: activeDepTab === 'dependencies' }]"
                  @click="activeDepTab = 'dependencies'">dependencies
          </button>
          <button :class="['action-btn', { confirm: activeDepTab === 'devDependencies' }]"
                  @click="activeDepTab = 'devDependencies'">devDependencies
          </button>
        </div>

        <div class="dep-list">
          <div v-for="(version, pkg) in currentDeps" :key="pkg" class="dep-item">
            <span class="dep-name">{{ pkg }}</span>
            <span class="dep-version">{{ version }}</span>
            <button @click="removeDependency(pkg)" class="action-btn-small delete">×</button>
          </div>
          <div v-if="Object.keys(currentDeps).length === 0" class="dep-empty">Нет зависимостей</div>
        </div>

        <div class="add-dep-form">
          <MoloInput v-model="newDepName" placeholder="package-name" tLabel="Пакет"/>
          <MoloInput v-model="newDepVersion" placeholder="latest" tLabel="Версия"/>
          <button @click="addDependency" class="action-btn confirm" :disabled="!newDepName">Добавить</button>
        </div>
      </div>

      <hr>

      <div class="editor-actions">
        <button class="action-btn close" @click="emit('close')">Отмена</button>
        <button class="action-btn confirm" :disabled="loading" @click="saveModule">
          <span v-if="!loading">{{ isEditing ? 'Сохранить' : 'Создать' }}</span>
          <MoloLoaders btnLoader v-else/>
        </button>
      </div>
    </div>
  </template>

  <style scoped>
  .module-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
  }

  .editor-section {
    display: flex;
    flex-direction: column;
    background-color: var(--half_opacity_bg);
    border: 1px solid var(--half_opacity_border);
    border-radius: 12px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    flex: 1;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
  }

  .header-left h1 {
    margin: 0;
    font-size: 24px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .header-right {
    min-width: 250px;
  }

  .module-select {
    width: 100%;
  }

  .editor-grid {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 10px;
  }

  .main-settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .settings-group {
    background: var(--half_opacity_bg);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border: 1px solid var(--half_opacity_border);
  }

  .settings-group h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #aaa;
    font-weight: 500;
  }

  .full-width {
    width: 100%;
    margin-top: 12px;
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .code-container {
    display: flex;
    height: 500px;
    width: 100%;
    overflow: hidden;
  }

  .monaco-editor-container {
    flex: 1;
    height: 100%;
    width: 100%;
  }

  .documentation {
    flex: 0 0 550px;
    background-color: #1e1e1e;
    border-left: 1px solid #3c3c3c;
    overflow: auto;
  }

  @media (max-width: 900px) {
    .editor-grid {
      grid-template-columns: 1fr;
    }

    .header-left {
      flex-direction: column;
    }

    .code-container.with-docs {
      flex-direction: column;
    }

    .documentation {
      max-width: 100%;
      height: 300px;
    }
  }

  .checkbox-label {
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
  }

  .form-row {
    display: flex;
    gap: 10px;
  }

  .form-row > * {
    flex: 1;
  }

  .form-row.low {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preview-upload {
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
    gap: 8px;
    width: fit-content;
  }

  .preview-image {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .files-section {
    display: flex;
    width: 100%;
    justify-content: space-between;
    gap: 20px;
  }

  .file-tree {
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
    border-radius: 8px;
    padding: 16px;
    width: 100%;
  }

  .file-tree-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #e0e0e0;
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    margin: 4px 0;
    background: #252525;
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
  }

  .file-item.main {
    border-left: 3px solid #3a6ea5;
  }

  .file-logo {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .file-icon {
    width: 20px;
  }

  .file-info {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .file-badge {
    font-size: 10px;
    background: #3c3c3c;
    padding: 2px 6px;
    border-radius: 10px;
    color: #aaa;
  }

  .file-badge.server {
    background: #3a6ea5;
    color: #fff;
  }

  .file-path {
    font-size: 11px;
    color: #666;
  }

  .file-empty {
    text-align: center;
    color: #666;
    padding: 20px;
  }

  .file-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn-small {
    padding: 2px 8px;
    font-size: 14px;
    background: none;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    cursor: pointer;
    color: #ccc;
    transition: all 0.2s;
  }

  .action-btn-small:hover {
    background: #333;
  }

  .action-btn-small.edit:hover {
    border-color: #3a6ea5;
    color: #3a6ea5;
  }

  .action-btn-small.delete:hover {
    border-color: #ef4444;
    color: #ef4444;
  }

  .dep-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .dep-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 16px;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
  }

  .dep-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #252525;
    border-bottom: 1px solid #3c3c3c;
  }

  .dep-item:last-child {
    border-bottom: none;
  }

  .dep-name {
    font-family: monospace;
    color: #3a6ea5;
  }

  .dep-version {
    font-family: monospace;
    color: #1eef6f;
    font-size: 12px;
  }

  .dep-empty {
    text-align: center;
    color: #666;
    padding: 20px;
  }

  .add-dep-form {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  .add-dep-form > * {
    flex: 1;
  }

  .modal-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-content {
    background: #1e1e1e;
    border-radius: 12px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    border: 1px solid #3c3c3c;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 18px;
  }


  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #3c3c3c;
    flex-shrink: 0;
  }

  .file-editor-container {
    height: 400px;
    margin-top: 16px;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    overflow: hidden;
  }

  .file-monaco-editor {
    height: 100%;
    width: 100%;
  }

  .action-btn.close.small {
    padding: 4px 8px;
    font-size: 12px;
    background: #ef1e1e;
    color: white;
  }


  hr {
    border-color: #3c3c3c;
    margin: 16px 0;
  }

  @media (max-width: 768px) {
    .form-row {
      flex-direction: column;
    }

    .modal-content {
      width: 95%;
      max-height: 90vh;
    }

    .file-editor-container {
      height: 300px;
    }

    .files-section {
      flex-direction: column;
    }
  }
  </style>