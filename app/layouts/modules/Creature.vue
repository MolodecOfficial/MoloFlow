<script lang="ts" setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {VueMonacoEditor} from '@guolao/vue-monaco-editor'
import {getEditorLanguage, MONACO_EDITOR_OPTIONS} from '~~/app/utils/monacoConfig'
import {initMonacoTypeScript, registerMonacoSnippets} from '~~/app/utils/monaco-init'
import {useUserStore} from '~~/stores/userStore'
import {useMenuEditorStore} from '~~/stores/menuEditorStore'
import {useModuleEditorStore} from '~~/stores/moduleEditorStore'
import {storeToRefs} from 'pinia'

import jsIcon from '~~/public/js.png'
import tsIcon from '~~/public/ts.png'
import vueIcon from '~~/public/vue.png'

if (typeof window !== 'undefined') {
  initMonacoTypeScript()
  registerMonacoSnippets()
}

const emit = defineEmits(['close', 'saved'])

const {openWindow, updateWindowData} = useWindowManager()
const {addNotification} = useNotifications('Создание модуля')
const {addLog} = useLogger('Создание модуля')

const userStore = useUserStore()
const menuStore = useMenuEditorStore()
const moduleStore = useModuleEditorStore()

/* =========================================
   ЛОКАЛЬНОЕ СОСТОЯНИЕ
========================================= */
const enterpriseInfo = ref<any>(null)
const monacoRef = ref()
const previewWindowId = ref<string | null>(null)

const showDocumentation = ref(false)
const loadingUPD = ref(false)
const loadingDEP = ref(false)
const newDepName = ref('')
const newDepVersion = ref('')
const initialDataLoaded = ref(false)

const menuLocationModalOpen = ref(false)
const menuLocationModalMode = ref<'create' | 'edit'>('create')
const editingLocationData = ref<any>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/* =========================================
   STORE REFS
========================================= */

// module store
const {
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
  activeDepTab,
  clearingCache,
  tagsInput,
  composablesInput,
  isEditing,
  currentDeps,
  clientFiles,
  serverFiles
} = storeToRefs(moduleStore)

// menu store
const {
  locations,
  locationsLoaded,
  locationsLoading,
  selectedGroupId,
  selectedParentId,
  adding,
  newLocation,
  showNewForm,
  creating,
  tree,
  expanded,
  allExpanded,
  deletingGroup,
  deletingItem,
  treeLoaded,
  treeLoading
} = storeToRefs(menuStore)

/* =========================================
   КОНСТАНТЫ
========================================= */
const locationTypes = [
  {label: 'Меню', value: 'menu'},
  {label: 'Модули', value: 'module'}
]

const fileFormats = [
  {label: '.vue', value: 'vue'},
  {label: '.js', value: 'js'},
  {label: '.ts', value: 'ts'}
]

const availableFormats = [
  {label: '.vue', value: 'vue'},
  {label: '.js', value: 'js'},
  {label: '.ts', value: 'ts'}
]

// Форма для модалки создания места с выбором родителя
const modalLocationForm = ref({
  title: '',
  placeName: '',
  type: 'menu' as 'menu' | 'module',
  order: 0,
  requiredRole: ['Управляющий'] as string[],
  parentId: null as string | null
})

// Рекурсивный сбор папок с указанием groupId
const collectFolderItems = (items: any[], groupId: string, level: number = 0): any[] => {
  const result: any[] = []
  if (!items || !Array.isArray(items)) return result

  for (const item of items) {
    if (item.items && Array.isArray(item.items) && item.items.length > 0) {
      const indent = '  '.repeat(level)
      result.push({
        id: item.id,
        groupId: groupId,
        title: `${indent}📂 ${item.title}`,
        level: level,
        type: 'folder'
      })
      const children = collectFolderItems(item.items, groupId, level + 1)
      result.push(...children)
    }
  }
  return result
}

// Опции для выбора родителя (содержат groupId)
const parentLocationOptions = computed(() => {
  const options: { id: string | null; groupId: string | null; title: string; level: number; type: string }[] = [
    {id: null, groupId: null, title: '📁 Корень меню (верхний уровень)', level: 0, type: 'root'}
  ]

  for (const group of tree.value) {
    if (group.id && group.title) {
      options.push({
        id: group.id,
        groupId: group.id,
        title: `📁 ГРУППА: ${group.title}`,
        level: 0,
        type: 'group'
      })
      if (group.items && group.items.length) {
        const folders = collectFolderItems(group.items, group.id, 1)
        options.push(...folders)
      }
    }
  }

  return options
})

/* =========================================
   COMPUTED
========================================= */
const currentUser = computed(() => ({
  _id: userStore.userId || 'system',
  name: userStore.userName || 'System',
  role: userStore.userRole || 'system'
}))

const editorLanguage = computed(() =>
    getEditorLanguage(formData.value.format)
)

const availableParents = computed(() => {
  if (!selectedGroupId.value) return []

  const group = locations.value.find(
      (g: any) => g.groupId === selectedGroupId.value
  )

  if (!group) return []

  return (group.locations || []).filter(
      (loc: any) => loc.id !== null
  )
})

/* =========================================
   PLACEHOLDER
========================================= */
const getPlaceholder = () => {
  if (formData.value.format === 'vue') {
    return `<script setup>
  import { ref } from 'vue'

  const message = ref('Привет из динамического модуля!')

  const handleClick = () => {
    message.value = 'Работает!'
  }
  <\/script>

  <template>
    <div>
      <h1>{{ message }}</h1>
      <button @click="handleClick">Click me</button>
    </div>
  </template>
  `
  }

  return '// module code...'
}

/* =========================================
   MODULE API METHODS
========================================= */
const loadModuleFiles = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return
  await moduleStore.loadModuleFilesById(enterpriseInfo.value._id, selectedModuleId.value)
}

const loadDependencies = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return
  await moduleStore.loadModuleDependencies(enterpriseInfo.value._id, selectedModuleId.value)
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

  try {
    const {useModuleApi} = await import('~/composables/useModuleApi')
    const moduleApi = useModuleApi()

    const payload = {
      ...formData.value,
      code: formData.value.code || getPlaceholder(),
      createdBy: currentUser.value
    }

    const response = await moduleApi.saveModule(
        enterpriseInfo.value._id,
        payload,
        isEditing.value,
        selectedModuleId.value || undefined
    )

    await moduleStore.loadModules(enterpriseInfo.value._id)

    if (!isEditing.value) {
      selectedModuleId.value = response.module._id
      addNotification('info', 'Модуль создан')
    } else {
      addNotification('info', 'Модуль обновлён')
    }

    emit('saved', response.module)
  } catch (error: any) {
    addNotification(
        'error',
        error?.data?.message ||
        error?.message ||
        'Ошибка сохранения модуля'
    )
  } finally {
    loading.value = false
  }
}

const normalizePath = (
    name: string,
    pathInput: string,
    format: string
) => {
  let basePath = pathInput?.trim() || name.trim()
  basePath = basePath.replace(/^\.\//, '')
  if (!basePath.match(/\.[a-z]+$/)) {
    basePath += `.${format}`
  }
  return basePath
}

const saveFile = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return

  if (!fileForm.value.name) {
    addNotification('warning', 'Введите имя файла')
    return
  }

  try {
    loadingUPD.value = true

    const {useModuleApi} = await import('~/composables/useModuleApi')
    const moduleApi = useModuleApi()

    const filePath = normalizePath(
        fileForm.value.name,
        fileForm.value.path,
        fileForm.value.format
    )

    const fileData = {
      name: fileForm.value.name,
      path: filePath,
      format: fileForm.value.format,
      code: fileForm.value.code,
      isServerFile: fileForm.value.isServer
    }

    await moduleApi.saveFile(
        enterpriseInfo.value._id,
        selectedModuleId.value,
        fileData,
        !!editingFilePath.value,
        editingFilePath.value || undefined
    )

    addNotification(
        'info',
        editingFilePath.value ? 'Файл обновлён' : 'Файл добавлен'
    )

    await loadModuleFiles()
    moduleStore.closeFileEditor()
  } catch (error: any) {
    addNotification('error', 'Ошибка сохранения файла')
    addLog('error', error.message)
  } finally {
    loadingUPD.value = false
  }
}

const deleteFile = async (filePath: string) => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return

  try {
    const {useModuleApi} = await import('~/composables/useModuleApi')
    const moduleApi = useModuleApi()

    await moduleApi.deleteFile(
        enterpriseInfo.value._id,
        selectedModuleId.value,
        filePath
    )

    addNotification('info', 'Файл удалён')
    await loadModuleFiles()
  } catch {
    addNotification('error', 'Ошибка удаления файла')
  }
}

const addDependency = async () => {
  if (!newDepName.value || !selectedModuleId.value) return

  loadingDEP.value = true
  addLog('info', `Начинаю установку зависимости "${newDepName.value}"...`)

  try {
    const {useModuleApi} = await import('~/composables/useModuleApi')
    const moduleApi = useModuleApi()

    await moduleApi.addDependency(
        enterpriseInfo.value._id,
        selectedModuleId.value,
        newDepName.value,
        newDepVersion.value || 'latest',
        activeDepTab.value
    )

    await loadDependencies()
    addLog('success', `Зависимость "${newDepName.value}" успешно установлена!`)
    addNotification('info', 'Зависимость добавлена')

    newDepName.value = ''
    newDepVersion.value = ''
  } catch (error) {
    addLog('error', `Ошибка установки зависимости - ${error}`)
    addNotification('error', 'Ошибка добавления зависимости')
  } finally {
    loadingDEP.value = false
  }
}

const removeDependency = async (packageName: string) => {
  if (!selectedModuleId.value) return

  try {
    const {useModuleApi} = await import('~/composables/useModuleApi')
    const moduleApi = useModuleApi()

    await moduleApi.removeDependency(
        enterpriseInfo.value._id,
        selectedModuleId.value,
        packageName,
        activeDepTab.value
    )

    await loadDependencies()
    addNotification('info', 'Зависимость удалена')
  } catch {
    addNotification('error', 'Ошибка удаления зависимости')
  }
}

const clearModuleCache = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return

  try {
    clearingCache.value = true

    const {useModuleApi} = await import('~/composables/useModuleApi')
    const moduleApi = useModuleApi()

    const result = await moduleApi.clearCache(
        selectedModuleId.value,
        enterpriseInfo.value._id
    )

    console.log('Cache clear result:', result)
    addNotification('info', 'Кеш модуля очищен')
  } catch (error: any) {
    console.error('Clear cache error:', error)
    addNotification('error', error?.data?.message || error?.message || 'Ошибка очистки кеша')
  } finally {
    clearingCache.value = false
  }
}

// Функция для обновления всех данных меню
const refreshMenuData = async () => {
  await menuStore.loadLocations()
  await menuStore.loadTree()
  await menuStore.refreshAllMenuData()
}

/* =========================================
   MENU API METHODS (ГЛАВНОЕ ИСПРАВЛЕНИЕ)
========================================= */
function openCreateLocationModal() {
  menuLocationModalMode.value = 'create'
  modalLocationForm.value = {
    title: '',
    placeName: '',
    type: 'menu',
    order: 0,
    requiredRole: ['Управляющий'],
    parentId: null
  }
  menuLocationModalOpen.value = true
}

async function handleSaveLocation() {
  if (!modalLocationForm.value.title.trim()) {
    addNotification('warning', 'Введите название места')
    return
  }

  if (!modalLocationForm.value.placeName.trim()) {
    addNotification('warning', 'Введите ключ (название файла)')
    return
  }

  try {
    creating.value = true

    const {useMenuApi} = await import('~/composables/useMenuApi')
    const menuApi = useMenuApi()

    const parentId = modalLocationForm.value.parentId
    const selectedOption = parentLocationOptions.value.find(opt => opt.id === parentId)
    const groupId = selectedOption?.groupId

    if (parentId && groupId) {
      // Создаём вложенную папку внутри выбранного родителя
      await menuApi.addMenuItem(
          groupId,
          parentId,
          modalLocationForm.value.title,
          modalLocationForm.value.placeName,
          modalLocationForm.value.type,
          modalLocationForm.value.order,
          modalLocationForm.value.requiredRole
      )
      addNotification('info', 'Вложенная папка создана')
    } else {
      // Создаём группу верхнего уровня
      await menuApi.createGroup(
          modalLocationForm.value.title,
          modalLocationForm.value.placeName,
          modalLocationForm.value.type,
          modalLocationForm.value.order
      )
      addNotification('info', 'Новая группа меню создана')
    }

    // Обновляем все данные меню
    await refreshMenuData()

    // Если создали группу верхнего уровня, автоматически выбираем её
    if (!parentId) {
      const newGroup = locations.value.find(
          (g: any) => g.groupTitle === modalLocationForm.value.title
      )
      if (newGroup) {
        selectedGroupId.value = newGroup.groupId
      }
    }

    // Сбрасываем форму
    modalLocationForm.value = {
      title: '',
      placeName: '',
      type: 'menu',
      order: 0,
      requiredRole: ['Управляющий'],
      parentId: null
    }

    window.dispatchEvent(new CustomEvent('modules-updated'))
    menuLocationModalOpen.value = false
  } catch (error: any) {
    console.error('Create location error:', error)
    addNotification('error', error?.message || 'Ошибка создания места')
  } finally {
    creating.value = false
  }
}

const deleteLocation = async (groupId: string) => {
  if (!confirm(`Удалить группу "${groupId}"?`)) return

  try {
    deletingGroup.value = groupId

    const {useMenuApi} = await import('~/composables/useMenuApi')
    const menuApi = useMenuApi()

    await menuApi.deleteGroup(groupId)

    if (selectedGroupId.value === groupId) {
      menuStore.resetSelection()
    }

    await refreshMenuData()

    addNotification('info', 'Группа удалена')
  } catch {
    addNotification('error', 'Ошибка удаления группы')
  } finally {
    deletingGroup.value = null
  }
}

const deleteMenuItem = async (groupId: string, itemId: string) => {
  if (!confirm('Удалить этот элемент меню?')) return

  try {
    deletingItem.value = itemId

    const {useMenuApi} = await import('~/composables/useMenuApi')
    const menuApi = useMenuApi()

    await menuApi.deleteItem(groupId, itemId)

    await refreshMenuData()

    addNotification('info', 'Элемент меню удалён')
    window.dispatchEvent(new CustomEvent('modules-updated'))
  } catch {
    addNotification('error', 'Ошибка удаления элемента')
  } finally {
    deletingItem.value = null
  }
}

const addModuleToMenuItem = async (groupId: string, parentItemId: string) => {
  selectedGroupId.value = groupId
  selectedParentId.value = parentItemId

  await nextTick()

  const el = document.querySelector('.menu-actions-row')
  if (el) {
    el.scrollIntoView({behavior: 'smooth', block: 'center'})
  }
}

const addModuleToMenu = async () => {
  if (!selectedGroupId.value) {
    addNotification('warning', 'Выберите группу')
    return
  }

  let moduleId = selectedModuleId.value

  if (!moduleId) {
    await saveModule()
    moduleId = selectedModuleId.value
  }

  if (!moduleId) {
    addNotification('error', 'Не удалось сохранить модуль')
    return
  }

  const mod = modules.value.find((m: any) => m._id === moduleId)

  if (!mod) {
    addNotification('error', 'Модуль не найден')
    return
  }

  try {
    adding.value = true

    const {useMenuApi} = await import('~/composables/useMenuApi')
    const menuApi = useMenuApi()

    await menuApi.addModule(mod, selectedGroupId.value, selectedParentId.value)

    addNotification('info', 'Модуль добавлен в меню')
    menuStore.resetSelection()

    // Обновляем дерево меню после добавления модуля
    await refreshMenuData()

    window.dispatchEvent(new CustomEvent('modules-updated'))
  } catch {
    addNotification('error', 'Модуль не добавлен в меню')
  } finally {
    adding.value = false
  }
}

/* =========================================
   PREVIEW
========================================= */
const openPreviewInWindow = () => {
  if (!formData.value.code?.trim()) {
    addNotification('warning', 'Нет кода для предпросмотра')
    return
  }

  const id = 'preview'
  previewWindowId.value = id

  openWindow(
      'modules',
      id,
      null,
      {
        width: 600,
        height: 500,
        minWidth: 600,
        minHeight: 400
      },
      false,
      'modules/preview',
      null,
      {
        moduleName: formData.value.name || 'Без названия',
        code: formData.value.code,
        files: moduleFiles.value,
        dependencies: formData.value.dependencies,
        moduleId: selectedModuleId.value
      }
  )
}

/* =========================================
   IMAGE HANDLING
========================================= */
const handleImageUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.[0]) return

  const reader = new FileReader()
  reader.onload = e => {
    formData.value.previewImage = e.target?.result as string
  }
  reader.readAsDataURL(input.files[0])
}

const removePreview = () => {
  formData.value.previewImage = null
}

const openDocumentation = () => {
  openWindow(
      'settings',
      'Documentation',
      null,
      {
        width: 1400,
        height: 600,
        minWidth: 600,
        minHeight: 400
      }
  )
}

/* =========================================
   HELPERS
========================================= */
const getEnterpriseId = (): string | null => {
  const saved = localStorage.getItem('currentEnterprise')
  if (saved) {
    try {
      return JSON.parse(saved)._id
    } catch {
      return null
    }
  }
  return null
}

/* =========================================
   WATCHERS
========================================= */
watch(tagsInput, value => {
  formData.value.tags = value.split(',').map(v => v.trim()).filter(Boolean)
})

watch(composablesInput, value => {
  formData.value.composables = value.split(',').map(v => v.trim()).filter(Boolean)
})

watch(
    [selectedModuleId, modules],
    async ([id, mods]) => {
      if (!id) {
        moduleStore.resetForm()
        formData.value.code = getPlaceholder()
        return
      }

      if (!mods || mods.length === 0) return

      const mod = mods.find((m: any) => m._id === id)
      if (!mod) return

      moduleStore.loadModule(mod)

      if (!formData.value.code) {
        formData.value.code = getPlaceholder()
      }

      await loadModuleFiles()
      await loadDependencies()
    },
    {immediate: true}
)

watch(
    () => formData.value.format,
    () => {
      if (!isEditing.value) {
        formData.value.code = getPlaceholder()
      }
    }
)

watch(selectedGroupId, () => {
  selectedParentId.value = null
})

watch(
    () => formData.value.code,
    code => {
      if (!previewWindowId.value) return
      updateWindowData('modules', previewWindowId.value, {
        moduleName: formData.value.name,
        code,
        isEditing: isEditing.value
      })
    }
)

watch(showDocumentation, async () => {
  await nextTick()
  setTimeout(() => {
    monacoRef.value?.editor?.layout?.()
  }, 50)
})

watch(moduleFiles, (newFiles) => {
  if (!previewWindowId.value) return
  updateWindowData('modules', previewWindowId.value, {
    files: newFiles
  })
})

/* =========================================
   LIFECYCLE
========================================= */
onMounted(async () => {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) {
    addNotification('warning', 'Нет информации о предприятии')
    return
  }

  const saved = localStorage.getItem('currentEnterprise')
  if (saved) {
    try {
      enterpriseInfo.value = JSON.parse(saved)
    } catch {
      addNotification('warning', 'Ошибка при получении предприятия')
    }
  }

  if (!modulesLoaded.value && !modulesLoading.value) {
    await moduleStore.loadModules(enterpriseId)
  }

  if (!locationsLoaded.value && !locationsLoading.value) {
    await menuStore.loadLocations()
  }

  if (!treeLoaded.value && !treeLoading.value) {
    await menuStore.loadTree()
  }

  if (locations.value.length > 0 && !selectedGroupId.value) {
    selectedGroupId.value = locations.value[0].groupId
  }

  if (selectedModuleId.value) {
    const mod = modules.value.find((m: any) => m._id === selectedModuleId.value)
    if (mod) {
      moduleStore.loadModule(mod)
      if (!formData.value.code) {
        formData.value.code = getPlaceholder()
      }
      await loadModuleFiles()
      await loadDependencies()
    }
  } else {
    moduleStore.resetForm()
    formData.value.code = getPlaceholder()
  }

  initialDataLoaded.value = true
})

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <div class="module-editor">
    <div class="editor-header">
      <div class="header-left">
        <h1>{{ isEditing ? 'Редактирование модуля' : 'Создание модуля' }}</h1>

        <div class="header-actions">
          <MoloButton
              :class="selectedModuleId ? 'default' : 'confirm'"
              @click="selectedModuleId = null"
          >
            Новый
          </MoloButton>

          <MoloButton
              v-if="formData.format === 'vue'"
              class="confirm"
              @click="openPreviewInWindow"
          >
            Предпросмотр
          </MoloButton>

          <MoloButton
              :class="openDocumentation ? 'confirm' : 'default'"
              @click="openDocumentation"
          >
            {{ showDocumentation ? 'Скрыть док.' : 'Документация' }}
          </MoloButton>
        </div>
      </div>

      <div class="header-right">
        <MoloSelect
            v-model="selectedModuleId"
            :disabled="!modules || modules.length === 0 ? 'Нет модулей' : 'Выбрать модуль'"
            :parent="modules"
            children="name"
            class="module-select"
            valueKey="_id"
        />
      </div>
    </div>

    <hr/>

    <div class="editor-grid">
      <!-- ОСНОВНЫЕ НАСТРОЙКИ -->
      <div class="main-settings">
        <MoloSection>
          <template #header>
            <span>Основное</span>
          </template>
          <template #main>
            <div class="form-row">
              <MoloInput
                  v-model="formData.name"
                  lRequired
                  placeholder="Введите название"
                  tLabel="Название"
              />

              <MoloInput
                  v-model="formData.fileName"
                  lRequired
                  placeholder="на_английском"
                  tLabel="Имя файла"
              />

              <MoloSelect
                  v-model="formData.format"
                  :parent="availableFormats"
                  children="label"
                  lRequired
                  tLabel="Формат"
                  valueKey="value"
              />
            </div>
          </template>
        </MoloSection>

        <MoloSection>
          <template #header>
            <span>Мета</span>
          </template>
          <template #main>
            <div class="form-row">
              <MoloInput
                  v-model="formData.description"
                  placeholder="Что делает модуль?"
                  tLabel="Описание"
              />

              <MoloInput
                  v-model="tagsInput"
                  placeholder="ui, таблицы, графики"
                  tLabel="Теги"
              />
            </div>
          </template>
        </MoloSection>

        <MoloSection>
          <template #header>
            <span>Дополнительно</span>
            <label class="checkbox-label">
              <input v-model="formData.isPublic" type="checkbox"/>
              <span>Общедоступный</span>
            </label>
          </template>
          <template #main>
            <div class="preview-upload">
              <MoloInput
                  accept="image/*"
                  tLabel="Превью"
                  type="file"
                  @change="handleImageUpload"
              />

              <div v-if="formData.previewImage" class="preview-image">
                <img :src="formData.previewImage" alt="preview" style="width: 60px"/>

                <MoloButton class="action-btn close small" @click="removePreview">
                  ✕
                </MoloButton>
              </div>
            </div>
          </template>
        </MoloSection>
      </div>

      <!-- УПРАВЛЕНИЕ МЕНЮ -->
      <div class="menu-settings">
        <MoloSection>
          <template #header>
            <span>Добавить в меню</span>
          </template>
          <template #main>
            <MoloSelect
                v-model="selectedGroupId"
                :disabled="locations.length === 0 ? 'Нет доступных групп' : 'Выбрать группу'"
                :parent="locations"
                children="groupTitle"
                tLabel="Группа"
                valueKey="groupId"
                :key="locations.length"
            />

            <MoloSelect
                v-if="availableParents.length"
                v-model="selectedParentId"
                :parent="availableParents"
                children="title"
                disabled="Выбрать родителя (опционально)"
                tLabel="Родительский элемент"
                valueKey="id"
            />

            <MoloButton
                :disabled="!selectedGroupId || adding"
                class="confirm"
                @click="addModuleToMenu"
            >
              <span v-if="!adding">Добавить в меню</span>
              <MoloLoaders v-else btnLoader/>
            </MoloButton>
          </template>
        </MoloSection>

        <MoloSection>
          <template #header>
            <span>Работа с меню</span>
          </template>
          <template #main>
            <MoloButton
                class="confirm full small"
                @click="openCreateLocationModal"
            >
              Добавить место
            </MoloButton>
            <MoloButton
                class="action full small"
            >
              Удалить место
            </MoloButton>
          </template>
        </MoloSection>
      </div>
    </div>

    <hr/>

    <!-- КОД МОДУЛЯ -->
    <MoloSection>
      <template #header>
        <span>Код модуля</span>
        <MoloButton
            v-if="selectedModuleId && enterpriseInfo?._id"
            :disabled="clearingCache"
            class="confirm small"
            @click="clearModuleCache"
        >
          <MoloLoaders v-if="clearingCache" btnLoader/>
          <span v-else>Очистить кеш</span>
        </MoloButton>
      </template>
      <template #main>
        <div class="code-container">
          <ClientOnly>
            <vue-monaco-editor
                ref="monacoRef"
                v-model:value="formData.code"
                :language="editorLanguage"
                :options="MONACO_EDITOR_OPTIONS"
                class="monaco-editor-container"
                theme="vs-dark"
            />
          </ClientOnly>
        </div>
      </template>
    </MoloSection>

    <hr/>

    <!-- ФАЙЛЫ МОДУЛЯ -->
    <MoloSection>
      <template #header>
        <span>Файлы модуля</span>
        <MoloButton class="confirm small" @click="moduleStore.openFileEditor()">
          Добавить файл
        </MoloButton>
      </template>
      <template #main>
        <div v-if="loadingFiles" class="loader-wrapper">
          <MoloLoaders wndLoader/>
        </div>
        <div>
          <div v-for="file in clientFiles" :key="file.path" class="file-item">
            <div class="file-info">
                <span class="file-logo">
                  <img
                      v-if="file.format === 'vue'"
                      :src="vueIcon"
                      alt=""
                      class="file-icon"
                  />
                  <img
                      v-else-if="file.format === 'ts'"
                      :src="tsIcon"
                      alt=""
                      class="file-icon"
                  />
                  <img v-else :src="jsIcon" alt="" class="file-icon"/>
                  {{ file.name }}
                </span>

              <span class="file-badge">
                  {{ file.format }}
                </span>

              <span class="file-path">
                  {{ file.path }}
                </span>
            </div>

            <div class="file-actions">
              <MoloButton
                  class="action-btn-small edit"
                  title="Редактировать"
                  @click="moduleStore.openFileEditor(file)"
              >
                ↩
              </MoloButton>

              <MoloButton
                  class="action-btn-small delete"
                  title="Удалить"
                  @click="deleteFile(file.path)"
              >
                ×
              </MoloButton>
            </div>
          </div>

          <div v-for="file in serverFiles" :key="file.path" class="file-item">
            <div class="file-info">
                <span class="file-logo">
                  <img
                      v-if="file.format === 'ts'"
                      :src="tsIcon"
                      alt=""
                      class="file-icon"
                  />
                  <img v-else :src="jsIcon" alt="" class="file-icon"/>
                  {{ file.name }}
                </span>

              <span class="file-badge server">
                  server | {{ file.format }}
                </span>

              <span class="file-path">
                  {{ file.path }}
                </span>
            </div>

            <div class="file-actions">
              <MoloButton
                  class="action-btn-small edit"
                  title="Редактировать"
                  @click="moduleStore.openFileEditor(file)"
              >
                ↩
              </MoloButton>

              <MoloButton
                  class="action-btn-small delete"
                  title="Удалить"
                  @click="deleteFile(file.path)"
              >
                ×
              </MoloButton>
            </div>
          </div>

          <div
              v-if="!loadingFiles && clientFiles.length === 0 && serverFiles.length === 0"
              class="file-empty"
          >
            Нет файлов
          </div>
        </div>
      </template>
    </MoloSection>

    <!-- МОДАЛКА ФАЙЛА -->
    <div
        v-if="showFileEditor"
        class="modal-overlay"
        @click.self="moduleStore.closeFileEditor()"
    >
      <div class="modal-content file-editor-modal">
        <div class="modal-header">
          <h3>
            {{ editingFilePath ? 'Редактирование файла' : 'Новый файл' }}
          </h3>

          <MoloButton class="close" @click="moduleStore.closeFileEditor()">
            ✕
          </MoloButton>
        </div>

        <div class="modal-body">
          <div class="form-row">
            <MoloInput
                v-model="fileForm.name"
                lRequired
                placeholder="Button.vue"
                tLabel="Имя файла"
            />

            <MoloInput
                v-model="fileForm.path"
                lRequired
                placeholder="components/Button.vue"
                tLabel="Путь"
            />

            <MoloSelect
                v-model="fileForm.format"
                :parent="fileFormats"
                children="label"
                tLabel="Формат"
                valueKey="value"
            />
          </div>

          <div class="form-row">
            <label class="checkbox-label">
              <input v-model="fileForm.isServer" type="checkbox"/>
              <span>Серверный файл</span>
            </label>
          </div>

          <div class="file-editor-container">
            <ClientOnly>
              <vue-monaco-editor
                  v-model:value="fileForm.code"
                  :language="getEditorLanguage(fileForm.format)"
                  :options="MONACO_EDITOR_OPTIONS"
                  class="file-monaco-editor"
                  theme="vs-dark"
              />
            </ClientOnly>
          </div>
        </div>

        <div class="modal-footer">
          <MoloButton class="close" @click="moduleStore.closeFileEditor()">
            Отмена
          </MoloButton>

          <MoloButton :disabled="loadingUPD" class="confirm" @click="saveFile">
              <span v-if="!loadingUPD">
                {{ editingFilePath ? 'Обновить' : 'Создать' }}
              </span>
            <MoloLoaders v-else btnLoader/>
          </MoloButton>
        </div>
      </div>
    </div>

    <hr/>

    <!-- ЗАВИСИМОСТИ -->
    <div class="dependencies">
      <MoloSection>
        <template #header>
          <span>Зависимости</span>
          <div class="dep-tabs">
            <MoloButton
                :class="activeDepTab === 'dependencies' ? 'confirm small' : 'default small'"
                @click="activeDepTab = 'dependencies'"
            >
              dependencies
            </MoloButton>

            <MoloButton
                :class="activeDepTab === 'devDependencies' ? 'confirm small' : 'default small'"
                @click="activeDepTab = 'devDependencies'"
            >
              devDependencies
            </MoloButton>
          </div>
        </template>
        <template #main>
          <div class="dep-list-header">
            <span>Название пакета</span>
            <span>Версия</span>
            <span>Действия</span>
          </div>

          <div class="dep-list">
            <div
                v-for="(version, pkg) in currentDeps"
                :key="pkg"
                class="dep-item"
            >
              <span class="dep-name">{{ pkg }}</span>
              <span class="dep-version">{{ version }}</span>

              <button
                  class="action-btn-small delete"
                  @click="removeDependency(pkg as string)"
              >
                ×
              </button>
            </div>

            <div v-if="Object.keys(currentDeps).length === 0" class="dep-empty">
              Нет зависимостей
            </div>
          </div>
        </template>
      </MoloSection>

      <MoloSection>
        <template #header>
          <span>Добавить зависимость</span>
          <MoloButton :disabled="!newDepName || loadingDEP" class="confirm small" @click="addDependency">
            <span v-if="!loadingDEP">Добавить</span>
            <MoloLoaders v-else btnLoader/>
          </MoloButton>
        </template>
        <template #main>
          <MoloInput
              v-model="newDepName"
              placeholder="package-name"
              tLabel="Пакет"
          />

          <MoloInput
              v-model="newDepVersion"
              placeholder="latest"
              tLabel="Версия"
          />
        </template>
      </MoloSection>
    </div>

    <div class="editor-actions">
      <MoloButton class="close" @click="emit('close')">
        Отмена
      </MoloButton>

      <MoloButton :disabled="loading" class="confirm" @click="saveModule">
          <span v-if="!loading">
            {{ isEditing ? 'Сохранить' : 'Создать' }}
          </span>
        <MoloLoaders v-else btnLoader/>
      </MoloButton>
    </div>
  </div>

  <!-- МОДАЛКА СОЗДАНИЯ МЕСТА В МЕНЮ С ВЫБОРОМ РОДИТЕЛЯ -->
  <MoloModal
      v-model="menuLocationModalOpen"
      title="Создание места в меню"
      confirm-text="Создать"
      cancel-text="Отмена"
      width="550px"
      close-on-overlay
      @confirm="handleSaveLocation"
      help-text="Вы можете создать вложенное меню, выбрав родительский элемент.
        Если выберите родителя (папку), новое место создастся внутри неё как подменю
  "
  >
    <template #body>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <section class="form-row">
          <MoloInput
              v-model="modalLocationForm.title"
              tLabel="Название места"
              lRequired
              placeholder="Например: Информация"
          />
          <MoloInput
              v-model="modalLocationForm.placeName"
              tLabel="Название ключа (название файла)"
              lRequired
              placeholder="Например: info"
          />
        </section>


        <MoloSelect
            v-model="modalLocationForm.type"
            :parent="locationTypes"
            children="label"
            tLabel="Тип места"
            valueKey="value"
        />

        <MoloSelect
            v-model="modalLocationForm.parentId"
            :parent="parentLocationOptions"
            children="title"
            tLabel="Родительское место"
            valueKey="id"
            help-text="Выберите, внутри какого места создать новое"
        />

        <MoloInput
            v-model.number="modalLocationForm.order"
            tLabel="Порядок сортировки"
            type="number"
            placeholder="0"
            help-text="Чем меньше число, тем выше в списке"
        />
      </div>
    </template>
  </MoloModal>
</template>

<style scoped>
.module-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  box-sizing: border-box;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
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

.menu-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  box-sizing: border-box;
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

.form-row {
  display: flex;
  gap: 10px;
}

.form-row > * {
  flex: 1;
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

.preview-upload {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.preview-image {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-item {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  font-family: monospace;
  font-size: 13px;
  border-bottom: 1px solid var(--half_opacity_border);
  padding: 8px 0;
}

.file-item:last-child {
  border-bottom: none;
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
  gap: 10px;
}

.dep-list {
  max-height: 300px;
  overflow-y: auto;
  border-radius: 4px;
}

.dep-list-header {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr 100px 70px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #3c3c3c;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.5);
}

.dep-item {
  display: grid;
  grid-template-columns: 1fr 100px 70px;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: var(--half_opacity_bg);
  border-bottom: 1px solid #3c3c3c;
  transition: all 0.2s ease;
}

.dep-item:last-child {
  border-bottom: none;
}

.dep-item:hover {
  background: #2a2a2a;
}

.dep-name {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dep-version {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #1eef6f;
  background: rgba(30, 239, 111, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  text-align: center;
  justify-self: start;
}

.dep-empty {
  text-align: center;
  color: #666;
  padding: 40px 20px;
  font-size: 14px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: var(--half_opacity_bg);
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--half_opacity_border);
}

.file-editor-modal {
  max-width: 1000px;
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
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.dependencies {
  display: flex;
  flex-direction: row;
  gap: 20px;
}

.info-note {
  padding: 10px 12px;
  background: rgba(100, 150, 255, 0.1);
  border-radius: 8px;
  font-size: 12px;
  color: #6496ff;
}

.loader-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
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

  .dependencies {
    flex-direction: column;
  }

  .editor-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-left {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>