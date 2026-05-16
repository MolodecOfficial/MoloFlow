<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { getEditorLanguage, MONACO_EDITOR_OPTIONS } from '~~/app/utils/monacoConfig'
import { initMonacoTypeScript, registerMonacoSnippets } from '~~/app/utils/monaco-init'
import { useUserStore } from '~~/stores/userStore'
import { useMenuEditorStore } from '~~/stores/menuEditorStore'
import { useModuleEditorStore } from '~~/stores/moduleEditorStore'
import { useMenuApi } from '~/composables/useMenuApi'
import { useModuleApi } from '~/composables/useModuleApi'

import jsIcon from '~~/public/js.png'
import tsIcon from '~~/public/ts.png'
import vueIcon from '~~/public/vue.png'

if (typeof window !== 'undefined') {
  initMonacoTypeScript()
  registerMonacoSnippets()
}

const emit = defineEmits(['close', 'saved'])

const { openWindow, updateWindowData } = useWindowManager()
const { addNotification } = useNotifications('Создание модуля')
const { addLog } = useLogger('Создание модуля')

const userStore = useUserStore()
const menuStore = useMenuEditorStore()
const moduleStore = useModuleEditorStore()

const menuApi = useMenuApi()
const moduleApi = useModuleApi()

/* =========================================
   ЛОКАЛЬНОЕ СОСТОЯНИЕ
========================================= */
const enterpriseInfo = ref<any>(null)
const monacoRef = ref()
const previewWindowId = ref<string | null>(null)

const showDocumentation = ref(false)
const loadingUPD = ref(false)

const newDepName = ref('')
const newDepVersion = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/* =========================================
   STORE REFS
========================================= */

// module store
const {
  modules,
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
  deletingItem
} = storeToRefs(menuStore)

/* =========================================
   КОНСТАНТЫ
========================================= */
const locationTypes = [
  { label: 'Меню', value: 'menu' },
  { label: 'Модули', value: 'module' }
]

const fileFormats = [
  { label: '.vue', value: 'vue' },
  { label: '.js', value: 'js' },
  { label: '.ts', value: 'ts' }
]

const availableFormats = [
  { label: '.vue', value: 'vue' },
  { label: '.js', value: 'js' },
  { label: '.ts', value: 'ts' }
]

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
const fetchModules = async () => {
  if (!enterpriseInfo.value?._id) {
    addLog('error', 'Нет ID предприятия')
    return
  }

  loading.value = true

  try {
    modules.value = await moduleApi.fetchModules(
        enterpriseInfo.value._id
    )
  } finally {
    loading.value = false
  }
}

const loadModuleFiles = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return

  loadingFiles.value = true

  try {
    moduleFiles.value = await moduleApi.loadModuleFiles(
        enterpriseInfo.value._id,
        selectedModuleId.value
    )
  } finally {
    loadingFiles.value = false
  }
}

const loadDependencies = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return

  const result = await moduleApi.loadDependencies(
      enterpriseInfo.value._id,
      selectedModuleId.value
  )

  formData.value.dependencies = result.dependencies
  formData.value.devDependencies = result.devDependencies
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
    const payload = {
      ...formData.value,
      code:
          formData.value.code || getPlaceholder(),
      createdBy: currentUser.value
    }

    const response = await moduleApi.saveModule(
        enterpriseInfo.value._id,
        payload,
        isEditing.value,
        selectedModuleId.value || undefined
    )

    await fetchModules()

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
        editingFilePath.value
            ? 'Файл обновлён'
            : 'Файл добавлен'
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

  try {
    await moduleApi.addDependency(
        enterpriseInfo.value._id,
        selectedModuleId.value,
        newDepName.value,
        newDepVersion.value || 'latest',
        activeDepTab.value
    )

    await loadDependencies()

    addNotification('info', 'Зависимость добавлена')

    newDepName.value = ''
    newDepVersion.value = ''
  } catch {
    addNotification(
        'error',
        'Ошибка добавления зависимости'
    )
  }
}

const removeDependency = async (
    packageName: string
) => {
  if (!selectedModuleId.value) return

  try {
    await moduleApi.removeDependency(
        enterpriseInfo.value._id,
        selectedModuleId.value,
        packageName,
        activeDepTab.value
    )

    await loadDependencies()

    addNotification('info', 'Зависимость удалена')
  } catch {
    addNotification(
        'error',
        'Ошибка удаления зависимости'
    )
  }
}

const clearModuleCache = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return

  try {
    clearingCache.value = true

    await moduleApi.clearCache(
        selectedModuleId.value,
        enterpriseInfo.value._id
    )

    addNotification(
        'info',
        'Кеш модуля очищен'
    )
  } catch {
    addNotification(
        'error',
        'Ошибка очистки кеша'
    )
  } finally {
    clearingCache.value = false
  }
}

/* =========================================
   MENU API METHODS
========================================= */
const loadAvailableLocations = async () => {
  locations.value = await menuApi.loadLocations()

  if (
      locations.value.length > 0 &&
      !selectedGroupId.value
  ) {
    selectedGroupId.value =
        locations.value[0].groupId
  }
}

const loadMenuTree = async () => {
  tree.value = await menuApi.loadTree()
  if (expanded.value.size === 0) {
    menuStore.toggleAll()
  }
}

const createNewLocation = async () => {
  if (!newLocation.value.title.trim()) {
    addNotification('warning', 'Введите название места')
    return
  }

  try {
    creating.value = true

    await menuApi.createGroup(
        newLocation.value.title,
        newLocation.value.type,
        newLocation.value.order
    )

    addNotification(
        'info',
        'Новое место в меню создано'
    )

    newLocation.value = {
      title: '',
      type: 'menu',
      order: 0
    }

    showNewForm.value = false

    await loadAvailableLocations()
    await loadMenuTree()

    window.dispatchEvent(
        new CustomEvent('modules-updated')
    )
  } catch {
    addNotification(
        'error',
        'Ошибка создания места'
    )
  } finally {
    creating.value = false
  }
}

const deleteLocation = async (
    groupId: string
) => {
  if (
      !confirm(
          `Удалить группу "${groupId}"?`
      )
  ) {
    return
  }

  try {
    deletingGroup.value = groupId

    await menuApi.deleteGroup(groupId)

    if (selectedGroupId.value === groupId) {
      menuStore.resetSelection()
    }

    await loadAvailableLocations()
    await loadMenuTree()

    addNotification(
        'info',
        'Группа удалена'
    )
  } catch {
    addNotification(
        'error',
        'Ошибка удаления группы'
    )
  } finally {
    deletingGroup.value = null
  }
}

const deleteMenuItem = async (
    groupId: string,
    itemId: string
) => {
  if (
      !confirm(
          'Удалить этот элемент меню?'
      )
  ) {
    return
  }

  try {
    deletingItem.value = itemId

    await menuApi.deleteItem(
        groupId,
        itemId
    )

    await loadAvailableLocations()
    await loadMenuTree()

    addNotification(
        'info',
        'Элемент меню удалён'
    )

    window.dispatchEvent(
        new CustomEvent('modules-updated')
    )
  } catch {
    addNotification(
        'error',
        'Ошибка удаления элемента'
    )
  } finally {
    deletingItem.value = null
  }
}

const addModuleToMenuItem = async (
    groupId: string,
    parentItemId: string
) => {
  selectedGroupId.value = groupId
  selectedParentId.value = parentItemId

  await nextTick()

  const el = document.querySelector(
      '.menu-actions-row'
  )

  if (el) {
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
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
    addNotification(
        'error',
        'Не удалось сохранить модуль'
    )
    return
  }

  const mod = modules.value.find(
      (m: any) => m._id === moduleId
  )

  if (!mod) {
    addNotification('error', 'Модуль не найден')
    return
  }

  try {
    adding.value = true

    await menuApi.addModule(
        mod,
        selectedGroupId.value,
        selectedParentId.value
    )

    addNotification(
        'info',
        'Модуль добавлен в меню'
    )

    menuStore.resetSelection()

    await loadMenuTree()

    window.dispatchEvent(
        new CustomEvent('modules-updated')
    )
  } catch {
    addNotification(
        'error',
        'Модуль не добавлен в меню'
    )
  } finally {
    adding.value = false
  }
}

/* =========================================
   PREVIEW
========================================= */
const openPreviewInWindow = () => {
  if (!formData.value.code?.trim()) {
    addNotification(
        'warning',
        'Нет кода для предпросмотра'
    )
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
        moduleName:
            formData.value.name ||
            'Без названия',
        code: formData.value.code,
        files: moduleFiles.value,
        dependencies:
        formData.value.dependencies,
        moduleId:
        selectedModuleId.value
      }
  )
}

/* =========================================
   IMAGE HANDLING
========================================= */
const handleImageUpload = (
    event: Event
) => {
  const input =
      event.target as HTMLInputElement

  if (!input.files?.[0]) return

  const reader = new FileReader()

  reader.onload = e => {
    formData.value.previewImage =
        e.target?.result as string
  }

  reader.readAsDataURL(input.files[0])
}

const removePreview = () => {
  formData.value.previewImage = null
}

/* =========================================
   HELPERS
========================================= */
const toggleDocumentation = () => {
  showDocumentation.value =
      !showDocumentation.value
}

/* =========================================
   WATCHERS
========================================= */
watch(tagsInput, value => {
  formData.value.tags = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
})

watch(composablesInput, value => {
  formData.value.composables = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
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

      const mod = mods.find(
          (m: any) => m._id === id
      )

      if (!mod) return

      moduleStore.loadModule(mod)

      if (!formData.value.code) {
        formData.value.code = getPlaceholder()
      }

      await loadModuleFiles()
      await loadDependencies()
    },
    {
      immediate: true
    }
)

watch(
    () => formData.value.format,
    () => {
      if (!isEditing.value) {
        formData.value.code =
            getPlaceholder()
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

      updateWindowData(
          'modules',
          previewWindowId.value,
          {
            moduleName:
            formData.value.name,
            code,
            isEditing:
            isEditing.value
          }
      )
    }
)

watch(showDocumentation, async () => {
  await nextTick()

  setTimeout(() => {
    monacoRef.value?.editor?.layout?.()
  }, 50)
})

/* =========================================
   LIFECYCLE
========================================= */
onMounted(async () => {
  const saved = localStorage.getItem('currentEnterprise')

  if (saved) {
    try {
      enterpriseInfo.value = JSON.parse(saved)
      await fetchModules()
    } catch {
      addNotification(
          'warning',
          'Ошибка при получении предприятия'
      )
    }
  }

  // Загружаем меню
  await loadAvailableLocations()
  await loadMenuTree()

  // ВАЖНО:
  // Если модуль уже выбран (selectedModuleId сохранён в store),
  // НЕ сбрасываем форму.
  // Иначе watcher на selectedModuleId загрузит данные,
  // а resetForm() их тут же затрёт.
  if (selectedModuleId.value) {
    const mod = modules.value.find(
        (m: any) => m._id === selectedModuleId.value
    )

    if (mod) {
      moduleStore.loadModule(mod)

      if (!formData.value.code) {
        formData.value.code = getPlaceholder()
      }

      await loadModuleFiles()
      await loadDependencies()
    }
  } else {
    // Только если модуль НЕ выбран — создаём пустую форму
    moduleStore.resetForm()
    formData.value.code = getPlaceholder()
  }
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
              class="default"
              @click="openPreviewInWindow"
          >
            Предпросмотр
          </MoloButton>

          <MoloButton
              @click="toggleDocumentation"
              :class="showDocumentation ? 'default' : 'confirm'"
          >
            {{ showDocumentation ? 'Скрыть док.' : 'Документация' }}
          </MoloButton>
        </div>
      </div>

      <div class="header-right">
        <MoloSelect
            v-model="selectedModuleId"
            :parent="modules"
            children="name"
            valueKey="_id"
            :disabled="!modules || modules.length === 0 ? 'Нет модулей' : 'Выбрать модуль'"
            class="module-select"
        />
      </div>
    </div>

    <hr />

    <div class="editor-grid">
      <!-- ОСНОВНЫЕ НАСТРОЙКИ -->
      <div class="main-settings">
        <div class="settings-group">
          <h3>Основное</h3>

          <div class="form-row">
            <MoloInput
                tLabel="Название"
                lRequired
                v-model="formData.name"
                placeholder="Введите название"
            />

            <MoloInput
                tLabel="Имя файла"
                lRequired
                v-model="formData.fileName"
                placeholder="на_английском"
            />

            <MoloSelect
                tLabel="Формат"
                lRequired
                v-model="formData.format"
                :parent="availableFormats"
                children="label"
                valueKey="value"
            />
          </div>
        </div>

        <div class="settings-group">
          <h3>Мета</h3>

          <div class="form-row">
            <MoloInput
                tLabel="Описание"
                v-model="formData.description"
                placeholder="Что делает модуль?"
            />

            <MoloInput
                tLabel="Теги"
                v-model="tagsInput"
                placeholder="ui, таблицы, графики"
            />
          </div>
        </div>

        <div class="settings-group">
          <div class="form-row low">
            <label class="checkbox-label">
              <input type="checkbox" v-model="formData.isPublic" />
              <span>Общедоступный</span>
            </label>

            <div class="preview-upload">
              <MoloInput
                  type="file"
                  accept="image/*"
                  @change="handleImageUpload"
                  tLabel="Превью"
              />

              <div
                  v-if="formData.previewImage"
                  class="preview-image"
              >
                <img
                    :src="formData.previewImage"
                    alt="preview"
                    style="width: 60px"
                />

                <MoloButton
                    class="action-btn close small"
                    @click="removePreview"
                >
                  ✕
                </MoloButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- УПРАВЛЕНИЕ МЕНЮ -->
      <div class="menu-settings">
        <div class="settings-group">
          <div class="settings-group-header">
            <h3>Управление меню</h3>

            <div class="header-actions-row">
              <MoloButton
                  class="confirm"
                  @click="showNewForm = !showNewForm"
              >
                {{ showNewForm ? 'Скрыть' : 'Новое место' }}
              </MoloButton>
            </div>
          </div>

          <!-- Создание новой группы -->
          <div
              v-if="showNewForm"
              class="new-location-form"
          >
            <MoloInput
                v-model="newLocation.title"
                tLabel="Название места"
                placeholder="Например: Аналитика"
                lRequired
            />

            <MoloSelect
                v-model="newLocation.type"
                tLabel="Тип"
                :parent="locationTypes"
                children="label"
                valueKey="value"
            />

            <MoloInput
                v-model="newLocation.order"
                tLabel="Порядок"
                type="number"
                placeholder="0"
            />

            <MoloButton
                class="confirm"
                :disabled="!newLocation.title || creating"
                @click="createNewLocation"
            >
              <span v-if="!creating">Создать место</span>
              <MoloLoaders v-else btnLoader />
            </MoloButton>
          </div>

          <hr
              v-if="showNewForm"
              style="margin: 8px 0; border-color: rgba(255,255,255,0.05);"
          />

          <!-- Дерево меню -->
          <div class="menu-tree">
            <div class="menu-tree-header">
              <span class="menu-tree-label">
                Структура меню
              </span>

              <button
                  class="expand-all-btn"
                  @click="menuStore.toggleAll()"
              >
                {{ allExpanded ? 'Свернуть все' : 'Развернуть все' }}
              </button>
            </div>

            <div
                v-if="tree.length === 0"
                class="no-locations"
            >
              Нет доступных мест
            </div>

            <div
                v-for="group in tree"
                :key="group.id"
                class="tree-group"
            >
              <div class="tree-group-header">
                <div class="tree-group-info">
                  <span
                      class="tree-toggle"
                      @click="menuStore.toggleGroup(group.id)"
                  >
                    {{ expanded.has(group.id) ? '▾' : '▸' }}
                  </span>

                  <span class="tree-group-icon">📁</span>

                  <span class="tree-group-title">
                    {{ group.title }}
                  </span>

                  <span class="tree-badge">
                    {{ group.type }}
                  </span>
                </div>

                <button
                    class="tree-delete-btn"
                    @click="deleteLocation(group.id)"
                    :disabled="deletingGroup === group.id"
                    title="Удалить группу"
                >
                  <span
                      v-if="deletingGroup !== group.id"
                  >
                    ×
                  </span>

                  <span
                      v-else
                      class="deleting-spinner"
                  >
                    ⋯
                  </span>
                </button>
              </div>

              <div
                  v-if="expanded.has(group.id)"
                  class="tree-items"
              >
                <div
                    v-if="!group.items || group.items.length === 0"
                    class="tree-empty"
                >
                  Нет элементов
                </div>

                <MoloMenuItemTree
                    v-for="item in group.items"
                    :key="item.id"
                    :item="item"
                    :groupId="group.id"
                    :depth="1"
                    :deletingItem="deletingItem"
                    @delete-item="(itemId) => deleteMenuItem(group.id, itemId)"
                    @add-module="(itemId) => addModuleToMenuItem(group.id, itemId)"
                />
              </div>
            </div>
          </div>

          <hr
              style="margin: 8px 0; border-color: rgba(255,255,255,0.05);"
          />

          <!-- Добавление модуля в меню -->
          <MoloSelect
              v-model="selectedGroupId"
              :parent="locations"
              tLabel="Группа для добавления"
              children="groupTitle"
              valueKey="groupId"
              :disabled="locations.length === 0 ? 'Нет доступных групп' : 'Выбрать группу'"
          />

          <MoloSelect
              v-if="availableParents.length"
              v-model="selectedParentId"
              :parent="availableParents"
              tLabel="Родительский элемент"
              children="title"
              valueKey="id"
              disabled="Выбрать родителя (опционально)"
          />

          <MoloButton
              class="confirm"
              :disabled="!selectedGroupId || adding"
              @click="addModuleToMenu"
          >
            <span v-if="!adding">
              Добавить модуль в меню
            </span>
            <MoloLoaders v-else btnLoader />
          </MoloButton>
        </div>
      </div>
    </div>

    <hr />

    <!-- КОД МОДУЛЯ -->
    <div class="editor-section">
      <div class="modal-header">
        <h3>Код модуля</h3>

        <MoloButton
            v-if="selectedModuleId && enterpriseInfo?._id"
            class="confirm"
            @click="clearModuleCache"
            :disabled="clearingCache"
        >
          <MoloLoaders
              btnLoader
              v-if="clearingCache"
          />
          <span v-else>
            Очистить кеш
          </span>
        </MoloButton>
      </div>

      <div
          class="code-container"
          :class="{ 'with-docs': showDocumentation }"
      >
        <vue-monaco-editor
            ref="monacoRef"
            v-model:value="formData.code"
            theme="vs-dark"
            :language="editorLanguage"
            :options="MONACO_EDITOR_OPTIONS"
            class="monaco-editor-container"
        />

        <div
            v-if="showDocumentation"
            class="documentation"
        >
          <MoloDocumentation />
        </div>
      </div>
    </div>

    <hr />

    <!-- ФАЙЛЫ МОДУЛЯ -->
    <div class="files-section">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Файлы модуля</h3>

          <MoloButton
              class="confirm"
              @click="moduleStore.openFileEditor()"
          >
            Добавить файл
          </MoloButton>
        </div>

        <div
            v-if="loadingFiles"
            class="loader-wrapper"
        >
          <MoloLoaders wndLoader />
        </div>

        <section class="modal-body">
          <!-- Клиентские файлы -->
          <section class="file-items">
            <div
                v-for="file in clientFiles"
                :key="file.path"
                class="file-item"
            >
              <div class="file-info">
                <span class="file-logo">
                  <img
                      :src="vueIcon"
                      class="file-icon"
                      alt=""
                      v-if="file.format === 'vue'"
                  />
                  <img
                      :src="tsIcon"
                      class="file-icon"
                      alt=""
                      v-else-if="file.format === 'ts'"
                  />
                  <img
                      :src="jsIcon"
                      class="file-icon"
                      alt=""
                      v-else
                  />
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
                    @click="moduleStore.openFileEditor(file)"
                    class="action-btn-small edit"
                    title="Редактировать"
                >
                  ↩
                </MoloButton>

                <MoloButton
                    @click="deleteFile(file.path)"
                    class="action-btn-small delete"
                    title="Удалить"
                >
                  ×
                </MoloButton>
              </div>
            </div>
          </section>

          <!-- Серверные файлы -->
          <div
              v-for="file in serverFiles"
              :key="file.path"
              class="file-item"
          >
            <div class="file-info">
              <span class="file-logo">
                <img
                    :src="tsIcon"
                    class="file-icon"
                    alt=""
                    v-if="file.format === 'ts'"
                />
                <img
                    :src="jsIcon"
                    class="file-icon"
                    alt=""
                    v-else
                />
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
                  @click="moduleStore.openFileEditor(file)"
                  class="action-btn-small edit"
                  title="Редактировать"
              >
                ↩
              </MoloButton>

              <MoloButton
                  @click="deleteFile(file.path)"
                  class="action-btn-small delete"
                  title="Удалить"
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
        </section>
      </div>
    </div>

    <!-- МОДАЛКА ФАЙЛА -->
    <div
        v-if="showFileEditor"
        class="modal-overlay"
        @click.self="moduleStore.closeFileEditor()"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            {{ editingFilePath ? 'Редактирование файла' : 'Новый файл' }}
          </h3>

          <div class="modal-footer">
            <MoloButton
                class="close"
                @click="moduleStore.closeFileEditor()"
            >
              Отмена
            </MoloButton>

            <MoloButton
                class="confirm"
                @click="saveFile"
                :disabled="loadingUPD"
            >
              <span v-if="!loadingUPD">
                {{ editingFilePath ? 'Обновить' : 'Создать' }}
              </span>
              <MoloLoaders v-else btnLoader />
            </MoloButton>
          </div>
        </div>

        <div class="modal-body">
          <div class="form-row">
            <MoloInput
                v-model="fileForm.name"
                tLabel="Имя файла"
                placeholder="Button.vue"
                lRequired
            />

            <MoloInput
                v-model="fileForm.path"
                tLabel="Путь"
                placeholder="components/Button.vue"
                lRequired
            />

            <MoloSelect
                v-model="fileForm.format"
                tLabel="Формат"
                :parent="fileFormats"
                children="label"
                valueKey="value"
            />
          </div>

          <div
              class="form-row"
              style="margin-top: 12px;"
          >
            <label class="checkbox-label">
              <input
                  type="checkbox"
                  v-model="fileForm.isServer"
              />
              <span>Серверный файл</span>
            </label>
          </div>

          <div class="file-editor-container">
            <vue-monaco-editor
                v-model:value="fileForm.code"
                theme="vs-dark"
                :language="getEditorLanguage(fileForm.format)"
                :options="MONACO_EDITOR_OPTIONS"
                class="file-monaco-editor"
            />
          </div>
        </div>
      </div>
    </div>

    <hr />

    <!-- ЗАВИСИМОСТИ -->
    <section class="dependencies">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Зависимости</h3>

          <div class="dep-tabs">
            <MoloButton
                class="confirm"
                @click="activeDepTab = 'dependencies'"
            >
              dependencies
            </MoloButton>

            <MoloButton
                class="confirm"
                @click="activeDepTab = 'devDependencies'"
            >
              devDependencies
            </MoloButton>
          </div>
        </div>

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
                @click="removeDependency(pkg as string)"
                class="action-btn-small delete"
            >
              ×
            </button>
          </div>

          <div
              v-if="Object.keys(currentDeps).length === 0"
              class="dep-empty"
          >
            Нет зависимостей
          </div>
        </div>
      </div>

      <div class="modal-content">
        <div class="modal-header">
          <h3>Добавить</h3>
        </div>

        <section class="dependencies-new">
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

          <MoloButton
              @click="addDependency"
              class="confirm"
              :disabled="!newDepName"
          >
            Добавить
          </MoloButton>
        </section>
      </div>
    </section>

    <hr />

    <!-- ДЕЙСТВИЯ -->
    <div class="editor-actions">
      <MoloButton
          class="close"
          @click="emit('close')"
      >
        Отмена
      </MoloButton>

      <MoloButton
          class="confirm"
          :disabled="loading"
          @click="saveModule"
      >
        <span v-if="!loading">
          {{ isEditing ? 'Сохранить' : 'Создать' }}
        </span>

        <MoloLoaders v-else btnLoader />
      </MoloButton>
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

.menu-settings {
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

.settings-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-group h3 {
  margin: 0;
  font-size: 14px;
  color: #aaa;
  font-weight: 500;
}

.new-location-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
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

.file-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-item {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
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
  overflow: hidden;
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
  position: sticky;
  top: 0;
  z-index: 1;
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
  transform: translateX(4px);
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--half_opacity_bg);
  border-radius: 10px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--half_opacity_border);
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
  padding: 15px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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

.dependencies-new {
  display: flex;
  flex-direction: column;
  padding: 15px;
  gap: 10px;
}

hr {
  border-color: #3c3c3c;
  margin: 16px 0;
}

.header-actions-row {
  display: flex;
  gap: 8px;
}

.location-management {
  margin-top: 4px;
}

.location-header {
  margin-bottom: 8px;
}

.location-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.locations-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.location-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  transition: all 0.2s;
}

.location-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.location-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.location-title {
  font-size: 12px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.location-type-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(58, 110, 165, 0.2);
  border-radius: 10px;
  color: #6ea2ff;
  white-space: nowrap;
}

.delete-location-btn {
  background: none;
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.delete-location-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
}

.delete-location-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.deleting-spinner {
  animation: spin 1s linear infinite;
}

.no-locations {
  text-align: center;
  color: #666;
  padding: 12px;
  font-size: 12px;
}

.menu-actions-row {
  display: flex;
  gap: 8px;
}

.menu-actions-row > * {
  flex: 1;
}

.danger {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  color: #ef4444 !important;
}

.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25) !important;
}

.menu-tree {
  margin-top: 8px;
}

.menu-tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.menu-tree-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.expand-all-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 4px 10px;
  color: #888;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.expand-all-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.tree-group {
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  overflow: hidden;
}

.tree-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.tree-group-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.tree-group-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tree-group-title {
  font-size: 13px;
  font-weight: 500;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-badge {
  font-size: 9px;
  padding: 2px 6px;
  background: rgba(58, 110, 165, 0.2);
  border-radius: 10px;
  color: #6ea2ff;
  white-space: nowrap;
  flex-shrink: 0;
}

.tree-items {
  padding: 4px;
}

.tree-empty {
  text-align: center;
  color: #666;
  padding: 12px;
  font-size: 11px;
}

.tree-delete-btn {
  background: none;
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tree-delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
}

.tree-delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.deleting-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

  .dependencies {
    flex-direction: column;
  }
}
</style>