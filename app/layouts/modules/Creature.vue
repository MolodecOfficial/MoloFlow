<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getMonacoLanguage, buildEditorFiles } from '~~/app/composables/monaco/index'
import { useAppStore } from '~~/stores/appStore'
import { useMenuStore } from '~~/stores/menuStore'
import { useModulesStore } from '~~/stores/modulesStore'
import { useWindowManager } from '~~/app/composables/window/useWindowManager'

import jsIcon from '~~/public/js.png'
import tsIcon from '~~/public/ts.png'
import vueIcon from '~~/public/vue.png'

defineOptions({
  inheritAttrs: false
})

const props = defineProps<{
  initialModuleId?: string
}>()

const emit = defineEmits(['close', 'saved'])

let mainEditorInstance: any = null
let monacoCtx: any = null
const monacoEditorRef = ref<any>(null)

const { updateFiles: updateMonacoFiles } = useMonacoFiles()
const editorFiles = computed(() => [])

const { openWindow, updateWindowData, closeWindow, openPreviewWindow } = useWindowManager()
const { addNotification } = useNotifications('Создание модуля')
const { addLog } = useLogger('Создание модуля')

const appStore = useAppStore()
const menuStore = useMenuStore()
const modulesStore = useModulesStore()

const { locations, selectedGroupId, selectedParentId, tree } = storeToRefs(menuStore)
const {
  formData,
  moduleFiles,
  loadingFiles,
  selectedModuleId,
  isEditing,
  clientFiles,
  serverFiles,
  enterpriseModules: modules
} = storeToRefs(modulesStore)

const previewWindowId = ref<string | null>(null)
const loadingUPD = ref(false)
const loadingDEP = ref(false)
const newDepName = ref('')
const newDepVersion = ref('')
const menuLocationModalOpen = ref(false)
const adding = ref(false)
const creating = ref(false)
const clearingCache = ref(false)
const loading = ref(false)

const activeMainTab = ref<'code' | 'files' | 'deps'>('code')

const showFileEditor = ref(false)
const fileForm = ref({
  name: '',
  path: '',
  format: 'vue' as 'vue' | 'js' | 'ts',
  code: '',
  isServer: false
})
const editingFilePath = ref<string | null>(null)

const activeDepTab = ref<'dependencies' | 'devDependencies'>('dependencies')
const tagsInput = ref('')
const composablesInput = ref('')

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

const modalLocationForm = ref({
  title: '',
  placeName: '',
  type: 'menu' as 'menu' | 'module',
  order: 0,
  requiredRole: ['Управляющий'] as string[],
  parentId: null as string | null
})

const currentUser = computed(() => ({
  _id: appStore.currentUser?._id || 'system',
  name: appStore.currentUser?.name || 'System',
  role: appStore.currentMemberRole || appStore.currentUser?.role || 'system'
}))

const currentDeps = computed(() => {
  if (activeDepTab.value === 'dependencies') {
    return formData.value.dependencies || {}
  }
  return formData.value.devDependencies || {}
})

const editorLanguage = computed(() => getMonacoLanguage(formData.value.format))
const fileEditorLanguage = computed(() => getMonacoLanguage(fileForm.value.format))

// Формируем безопасный список родительских папок внутри выбранной группы
const availableParents = computed(() => {
  if (!selectedGroupId.value) return []
  const group = (locations.value || []).find((g: any) => (g.groupId || g.id) === selectedGroupId.value)
  if (!group) return []
  return (group.locations || group.items || []).filter((loc: any) => loc.id !== null && loc.type === 'folder')
})

const collectFolderItems = (items: any[], groupId: string, level = 0): any[] => {
  const result: any[] = []
  if (!items || !Array.isArray(items)) return result
  for (const item of items) {
    if (item.items && Array.isArray(item.items) && item.items.length > 0) {
      const indent = '  '.repeat(level)
      result.push({
        id: item.id || item._id,
        groupId,
        title: `${indent}📂 ${item.title}`,
        level,
        type: 'folder'
      })
      const children = collectFolderItems(item.items, groupId, level + 1)
      result.push(...children)
    }
  }
  return result
}

const parentLocationOptions = computed(() => {
  const options: { id: string | null; groupId: string | null; title: string; level: number; type: string }[] = [
    { id: null, groupId: null, title: '📁 Корень меню (верхний уровень)', level: 0, type: 'root' }
  ]
  for (const group of (tree.value || [])) {
    const gId = group.id || group.groupId || group._id
    if (gId && group.title) {
      options.push({
        id: gId,
        groupId: gId,
        title: `📁 ГРУППА: ${group.title}`,
        level: 0,
        type: 'group'
      })
      if (group.items && group.items.length) {
        const folders = collectFolderItems(group.items, gId, 1)
        options.push(...folders)
      }
    }
  }
  return options
})

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
  <div class="module-card">
    <h1>{{ message }}</h1>
    <button @click="handleClick">Нажми на меня</button>
  </div>
</template>

<style scoped>
.module-card {
  padding: 16px;
  color: #fff;
}
</style>`
  }
  if (formData.value.format === 'ts') {
    return `// TypeScript module
export function main(): string {
  return 'Hello from TypeScript!'
}
`
  }
  return `// JavaScript module
export function main() {
  return 'Hello from JavaScript!'
}
`
}

const getFilePlaceholder = (format: string) => {
  if (format === 'vue') {
    return `<script setup>
// Код компонента
<\/script>

<template>
  <div>
    <h2>Новый компонент</h2>
  </div>
</template>
`
  }
  if (format === 'ts') {
    return `export function example(): void {
  console.log('Hello from TypeScript!')
}`
  }
  return `export function example() {
  console.log('Hello from JavaScript!')
}`
}

const syncEditorFiles = () => {
  if (!monacoCtx) return
  const files = buildEditorFiles(formData.value, moduleFiles.value)
  monacoCtx.fs.loadFiles(files)
  updateMonacoFiles(files)
  monacoCtx.vfs.loadModuleFiles({
    code: formData.value.code,
    fileName: formData.value.fileName,
    format: formData.value.format,
    files: moduleFiles.value
  })
}

const selectModule = async (id: string | null) => {
  if (id === selectedModuleId.value) return
  selectedModuleId.value = id
  if (!id) {
    modulesStore.resetForm()
    formData.value.code = getPlaceholder()
    if (mainEditorInstance) {
      mainEditorInstance.setValue(formData.value.code)
    }
    syncEditorFiles()
    return
  }

  const entId = appStore.getEnterpriseId()
  if (!entId) return

  loadingFiles.value = true
  try {
    const res: any = await $fetch(`/api/enterprises/${entId}/dynamicModules/${id}`)
    const full = res?.module || null
    if (full) {
      formData.value = {
        name: full.name || '',
        fileName: full.fileName || '',
        description: full.description || '',
        format: full.format || 'vue',
        code: full.code || getPlaceholder(),
        isPublic: full.isPublic || false,
        tags: full.tags || [],
        previewImage: full.previewImage || null,
        dependencies: full.dependencies || {},
        devDependencies: full.devDependencies || {},
        serverEntry: full.serverEntry || '',
        composables: full.composables || []
      }
      tagsInput.value = (full.tags || []).join(', ')
      composablesInput.value = (full.composables || []).join(', ')
      moduleFiles.value = full.files || []
    }
  } finally {
    loadingFiles.value = false
  }

  if (mainEditorInstance) {
    mainEditorInstance.setValue(formData.value.code)
  }
  syncEditorFiles()
}

const saveModule = async () => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!enterpriseId) {
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
    if (mainEditorInstance) {
      formData.value.code = mainEditorInstance.getValue()
    }
    const payload = {
      ...formData.value,
      code: formData.value.code || getPlaceholder(),
      createdBy: currentUser.value
    }

    const url = isEditing.value && selectedModuleId.value
        ? `/api/enterprises/${enterpriseId}/dynamicModules/${selectedModuleId.value}`
        : `/api/enterprises/${enterpriseId}/dynamicModules`

    const response: any = await $fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      body: payload
    })

    await modulesStore.loadEnterpriseModules(enterpriseId, true)
    addLog('success', 'Модуль успешно сохранён!')
    if (!isEditing.value) {
      selectedModuleId.value = response.module?._id || response._id
      addNotification('info', 'Модуль создан')
    } else {
      addNotification('info', 'Модуль обновлён')
    }
    emit('saved', response.module || response)
  } catch (error: any) {
    addNotification('error', error?.data?.message || error?.message || 'Ошибка сохранения модуля')
  } finally {
    loading.value = false
  }
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
  const enterpriseId = appStore.getEnterpriseId()
  if (!selectedModuleId.value || !enterpriseId) {
    addNotification('error', 'Модуль не выбран')
    return
  }
  if (!fileForm.value.name) {
    addNotification('warning', 'Введите имя файла')
    return
  }
  try {
    loadingUPD.value = true
    const filePath = normalizePath(fileForm.value.name, fileForm.value.path, fileForm.value.format)
    const fileData = {
      name: fileForm.value.name,
      path: filePath,
      format: fileForm.value.format,
      code: fileForm.value.code || getFilePlaceholder(fileForm.value.format),
      isServerFile: fileForm.value.isServer
    }

    await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${selectedModuleId.value}/files`, {
      method: 'POST',
      body: {
        action: editingFilePath.value ? 'update' : 'add',
        file: fileData,
        oldPath: editingFilePath.value || undefined
      }
    })

    addNotification('info', editingFilePath.value ? 'Файл обновлён' : 'Файл добавлен')
    await modulesStore.loadModuleFilesById(enterpriseId, selectedModuleId.value)
    closeFileEditor()
    syncEditorFiles()
  } catch (error: any) {
    addNotification('error', error?.message || 'Ошибка сохранения файла')
  } finally {
    loadingUPD.value = false
  }
}

const deleteFile = async (filePath: string) => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!selectedModuleId.value || !enterpriseId) return
  try {
    await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${selectedModuleId.value}/files`, {
      method: 'POST',
      body: {
        action: 'delete',
        file: { path: filePath }
      }
    })
    addNotification('info', 'Файл удалён')
    await modulesStore.loadModuleFilesById(enterpriseId, selectedModuleId.value)
    syncEditorFiles()
  } catch (error: any) {
    addNotification('error', 'Ошибка удаления файла')
  }
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

const addDependency = async () => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!newDepName.value || !selectedModuleId.value || !enterpriseId) return
  loadingDEP.value = true
  try {
    await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${selectedModuleId.value}/dependencies`, {
      method: 'POST',
      body: {
        action: 'add',
        packageName: newDepName.value,
        version: newDepVersion.value || 'latest',
        packageType: activeDepTab.value
      }
    })
    const res: any = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${selectedModuleId.value}/dependencies`)
    formData.value.dependencies = res.dependencies || {}
    formData.value.devDependencies = res.devDependencies || {}
    addNotification('info', 'Зависимость добавлена')
    newDepName.value = ''
    newDepVersion.value = ''
  } catch (error: any) {
    addNotification('error', 'Ошибка добавления зависимости')
  } finally {
    loadingDEP.value = false
  }
}

const removeDependency = async (packageName: string) => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!selectedModuleId.value || !enterpriseId) return
  try {
    await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${selectedModuleId.value}/dependencies`, {
      method: 'POST',
      body: {
        action: 'remove',
        packageName,
        packageType: activeDepTab.value
      }
    })
    const res: any = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${selectedModuleId.value}/dependencies`)
    formData.value.dependencies = res.dependencies || {}
    formData.value.devDependencies = res.devDependencies || {}
    addNotification('info', 'Зависимость удалена')
  } catch {
    addNotification('error', 'Ошибка удаления зависимости')
  }
}

const clearModuleCache = async () => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!selectedModuleId.value || !enterpriseId) return
  try {
    clearingCache.value = true
    await $fetch('/api/npm/install', {
      method: 'POST',
      body: { moduleId: selectedModuleId.value, enterpriseId, forceReinstall: true }
    })
    addNotification('info', 'Кеш модуля очищен')
  } catch (error: any) {
    addNotification('error', error?.data?.message || 'Ошибка очистки кеша')
  } finally {
    clearingCache.value = false
  }
}

function openCreateLocationModal() {
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
  const enterpriseId = appStore.getEnterpriseId()
  if (!enterpriseId) {
    addNotification('error', 'Предприятие не выбрано')
    return
  }
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
    const parentId = modalLocationForm.value.parentId
    const selectedOption = parentLocationOptions.value.find(opt => opt.id === parentId)
    const groupId = selectedOption?.groupId

    let createdId = ''

    if (parentId && groupId) {
      const res: any = await $fetch('/api/menu', {
        method: 'POST',
        body: {
          enterpriseId,
          action: 'addItem',
          groupId,
          parentId,
          title: modalLocationForm.value.title,
          placeName: modalLocationForm.value.placeName,
          type: modalLocationForm.value.type === 'menu' ? 'folder' : 'item',
          order: modalLocationForm.value.order,
          requiredRole: modalLocationForm.value.requiredRole
        }
      })
      createdId = res?.item?.id || res?.id || ''
      addNotification('info', 'Вложенная папка создана')
    } else {
      const res: any = await $fetch('/api/menu', {
        method: 'POST',
        body: {
          enterpriseId,
          action: 'createGroup',
          title: modalLocationForm.value.title,
          placeName: modalLocationForm.value.placeName,
          type: modalLocationForm.value.type,
          order: modalLocationForm.value.order,
          requiredRole: ['Управляющий']
        }
      })
      createdId = res?.group?.groupId || res?.group?._id || res?.groupId || res?._id || ''
      addNotification('info', 'Новая группа меню создана')
    }

    await menuStore.loadLocations()
    await menuStore.loadTree()

    // Сразу выбираем созданное место в селекте
    if (groupId) {
      selectedGroupId.value = groupId
      selectedParentId.value = createdId || null
    } else if (createdId) {
      selectedGroupId.value = createdId
      selectedParentId.value = null
    }

    window.dispatchEvent(new CustomEvent('modules-updated'))
    menuLocationModalOpen.value = false
  } catch (error: any) {
    addNotification('error', error?.data?.message || error?.message || 'Ошибка создания места')
  } finally {
    creating.value = false
  }
}

const addModuleToMenu = async () => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!selectedGroupId.value || !enterpriseId) {
    addNotification('warning', 'Выберите группу меню')
    return
  }
  let moduleId = selectedModuleId.value
  if (!moduleId) {
    await saveModule()
    moduleId = selectedModuleId.value
  }
  if (!moduleId) return
  const mod = modules.value.find((m: any) => m._id === moduleId)
  if (!mod) return
  try {
    adding.value = true
    await menuStore.addModuleToMenu(mod, selectedGroupId.value, selectedParentId.value, enterpriseId)
    addNotification('info', 'Модуль добавлен в меню')
    menuStore.selectedGroupId = ''
    menuStore.selectedParentId = null
    window.dispatchEvent(new CustomEvent('modules-updated'))
  } catch {
    addNotification('error', 'Модуль не добавлен в меню')
  } finally {
    adding.value = false
  }
}

const openPreview = () => {
  previewWindowId.value = openPreviewWindow(formData.value.fileName, {
    moduleName: formData.value.name,
    code: formData.value.code,
    files: moduleFiles.value,
    dependencies: formData.value.dependencies,
    devDependencies: formData.value.devDependencies,
    moduleId: selectedModuleId.value
  })
}

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
  openWindow('documentation', null, {
    width: 1200,
    height: 700,
    minWidth: 600,
    minHeight: 400
  })
}

watch(tagsInput, value => {
  formData.value.tags = value.split(',').map(v => v.trim()).filter(Boolean)
})

watch(composablesInput, value => {
  formData.value.composables = value.split(',').map(v => v.trim()).filter(Boolean)
})

watch(() => formData.value.format, () => {
  if (!isEditing.value) {
    formData.value.code = getPlaceholder()
    if (mainEditorInstance) {
      mainEditorInstance.setValue(formData.value.code)
    }
  }
})

watch(selectedGroupId, () => {
  selectedParentId.value = null
})

watch(() => formData.value.code, code => {
  if (!previewWindowId.value) return
  updateWindowData(previewWindowId.value, {
    moduleName: formData.value.name,
    code,
    isEditing: isEditing.value,
    _updated: Date.now()
  })
})

watch(moduleFiles, (newFiles) => {
  if (!previewWindowId.value) return
  updateWindowData(previewWindowId.value, { files: newFiles })
})

onMounted(async () => {
  const enterpriseId = appStore.getEnterpriseId()
  if (!enterpriseId) return
  await Promise.all([
    modulesStore.loadEnterpriseModules(enterpriseId),
    menuStore.loadLocations(enterpriseId),
    menuStore.loadTree(enterpriseId)
  ])
  if (props.initialModuleId) {
    await selectModule(props.initialModuleId)
  } else {
    modulesStore.resetForm()
    formData.value.code = getPlaceholder()
  }
})

onUnmounted(() => {
  if (previewWindowId.value) {
    closeWindow(previewWindowId.value)
    previewWindowId.value = null
  }
})
</script>

<template>
  <div class="creator-workspace">
    <header class="top-nav-bar">
      <div class="nav-left">
        <div class="badge-title">
          <span class="icon">⚡</span>
          <span>{{ isEditing ? formData.name || 'Модуль' : 'Новый модуль' }}</span>
        </div>

        <div class="quick-nav-actions">
          <section class="btn-group">
            <UIMoloButton
                class="small"
                :class="selectedModuleId ? 'default' : 'confirm'"
                @click="selectModule(null)"
            >
              Создать
            </UIMoloButton>

            <UIMoloButton
                v-if="formData.format === 'vue'"
                class="small confirm"
                title="Запустить просмотр компонента"
                @click="openPreview"
            >
              Запуск
            </UIMoloButton>
          </section>

          <UIMoloButton
              class="small"
              title="Справочные материалы"
              @click="openDocumentation"
          >
            📚 Документация
          </UIMoloButton>
        </div>
      </div>

      <div class="nav-right">
        <div class="select-wrap">
          <UIMoloSelect
              compact
              :model-value="selectedModuleId"
              :disabled="!modules || modules.length === 0 ? 'Нет модулей' : 'Выбрать модуль...'"
              :parent="modules"
              children="name"
              valueKey="_id"
              @update:model-value="selectModule"
          />
        </div>
        <section class="btn-group">
          <UIMoloButton
              v-if="selectedModuleId && appStore.getEnterpriseId()"
              class="small action"
              :disabled="clearingCache"
              title="Сбросить кеш скомпилированного кода"
              @click="clearModuleCache"
          >
            <UIMoloLoaders v-if="clearingCache" btnLoader />
            <span v-else>Очистить кеш</span>
          </UIMoloButton>

          <UIMoloButton
              :loading="loading"
              class="small confirm save-btn"
              @click="saveModule"
          >
            {{ isEditing ? 'Обновить' : 'Сохранить' }}
          </UIMoloButton>
        </section>
      </div>
    </header>

    <main class="ide-layout">
      <section class="editor-pane">
        <div class="ide-tab-bar">
          <button
              class="tab-btn"
              :class="{ active: activeMainTab === 'code' }"
              @click="activeMainTab = 'code'"
          >
            <span class="tab-icon">📄</span>
            <span>Основной код ({{ formData.fileName || 'index' }}.{{ formData.format }})</span>
          </button>

          <button
              class="tab-btn"
              :class="{ active: activeMainTab === 'files' }"
              @click="activeMainTab = 'files'"
          >
            <span class="tab-icon">📁</span>
            <span>Файлы компонента</span>
            <span class="tab-count">{{ moduleFiles.length }}</span>
          </button>

          <button
              class="tab-btn"
              :class="{ active: activeMainTab === 'deps' }"
              @click="activeMainTab = 'deps'"
          >
            <span class="tab-icon">📦</span>
            <span>Зависимости (NPM)</span>
            <span class="tab-count">{{ Object.keys(formData.dependencies || {}).length }}</span>
          </button>
        </div>

        <div class="tab-content-area">
          <div v-show="activeMainTab === 'code'" class="monaco-full-height">
            <UIMoloMonaco
                ref="monacoEditorRef"
                :initial-code="formData.code"
                :language="editorLanguage"
                :files="editorFiles"
                :module-id="selectedModuleId"
                :enterprise-id="appStore.getEnterpriseId()"
                :on-save="saveModule"
                @update:code="(code) => (formData.code = code)"
            />
          </div>

          <div v-show="activeMainTab === 'files'" class="files-view-wrap">
            <div class="subview-header">
              <span class="view-title">Файлы текущего модуля</span>
              <UIMoloButton class="small confirm" @click="openFileEditor()">
                + Добавить файл
              </UIMoloButton>
            </div>

            <div v-if="loadingFiles" class="subview-loader">
              <UIMoloLoaders wndLoader />
            </div>

            <div v-else-if="clientFiles.length === 0 && serverFiles.length === 0" class="subview-empty">
              <span>У этого модуля нет дополнительных файлов. Создайте компоненты, хелперы или стили.</span>
            </div>

            <div v-else class="file-grid">
              <div v-for="file in moduleFiles" :key="file.path" class="file-card">
                <div class="file-card-top">
                  <img
                      v-if="file.format === 'vue'"
                      :src="vueIcon"
                      class="ext-icon"
                      alt=""
                  />
                  <img
                      v-else-if="file.format === 'ts'"
                      :src="tsIcon"
                      class="ext-icon"
                      alt=""
                  />
                  <img v-else :src="jsIcon" class="ext-icon" alt="" />

                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-tag" :class="{ server: file.isServerFile }">
                    {{ file.isServerFile ? 'Server' : file.format }}
                  </span>
                </div>

                <div class="file-card-path">{{ file.path }}</div>

                <div class="btn-group">
                  <UIMoloButton class="small" @click="openFileEditor(file)">
                    Изменить
                  </UIMoloButton>
                  <UIMoloButton class="small close" @click="deleteFile(file.path)">
                    ✕
                  </UIMoloButton>
                </div>
              </div>
            </div>
          </div>

          <div v-show="activeMainTab === 'deps'" class="deps-view-wrap">
            <div class="deps-container">
              <div class="deps-header-row">
                <div class="dep-switch-tabs">
                  <UIMoloButton
                      class="small"
                      :class="activeDepTab === 'dependencies' ? 'confirm' : 'default'"
                      @click="activeDepTab = 'dependencies'"
                  >
                    dependencies
                  </UIMoloButton>
                  <UIMoloButton
                      class="small"
                      :class="activeDepTab === 'devDependencies' ? 'confirm' : 'default'"
                      @click="activeDepTab = 'devDependencies'"
                  >
                    devDependencies
                  </UIMoloButton>
                </div>

                <div class="dep-add-inline">
                  <UIMoloInput
                      v-model="newDepName"
                      compact
                      placeholder="Имя пакета (напр. lodash)"
                  />
                  <UIMoloInput
                      v-model="newDepVersion"
                      compact
                      placeholder="Версия (latest)"
                  />
                  <UIMoloButton
                      class="small confirm"
                      :disabled="!newDepName || loadingDEP"
                      @click="addDependency"
                  >
                    <UIMoloLoaders v-if="loadingDEP" btnLoader />
                    <span v-else>+ Установить</span>
                  </UIMoloButton>
                </div>
              </div>

              <div class="dep-list-table">
                <div class="dep-row-head">
                  <span>Пакет</span>
                  <span>Версия</span>
                  <span></span>
                </div>

                <div
                    v-for="(version, pkg) in currentDeps"
                    :key="pkg"
                    class="dep-row-item"
                >
                  <span class="pkg-name">📦 {{ pkg }}</span>
                  <span class="pkg-ver">{{ version }}</span>
                  <button class="dep-del-btn" title="Удалить пакет" @click="removeDependency(pkg as string)">
                    ✕
                  </button>
                </div>

                <div v-if="Object.keys(currentDeps).length === 0" class="subview-empty">
                  Нет установленных пакетов в этой секции
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer class="ide-status-bar">
          <div class="status-left">
            <span>● {{ isEditing ? 'Синхронизировано' : 'Черновик' }}</span>
            <span>Формат: <b>{{ formData.format.toUpperCase() }}</b></span>
            <span>Кодировка: UTF-8</span>
          </div>
          <div class="status-right">
            <span>Всего файлов: {{ moduleFiles.length + 1 }}</span>
          </div>
        </footer>
      </section>

      <aside class="sidebar-pane">
        <UIMoloSection>
          <template #header>
            <span class="pane-sec-title">Параметры модуля</span>
          </template>
          <template #main>
            <div class="form-vertical-stack">
              <UIMoloInput
                  v-model="formData.name"
                  compact
                  lRequired
                  tLabel="Название модуля"
                  placeholder="Мой компонент"
              />

              <div class="grid-two-col">
                <UIMoloInput
                    v-model="formData.fileName"
                    compact
                    lRequired
                    tLabel="Имя файла"
                    placeholder="MyComponent"
                />
                <UIMoloSelect
                    v-model="formData.format"
                    compact
                    :parent="availableFormats"
                    children="label"
                    tLabel="Формат"
                    valueKey="value"
                />
              </div>

              <UIMoloInput
                  v-model="formData.description"
                  compact
                  tLabel="Описание назначения"
                  placeholder="Что выполняет модуль..."
              />

              <UIMoloInput
                  v-model="tagsInput"
                  compact
                  tLabel="Теги (через запятую)"
                  placeholder="ui, chart, report"
              />

              <div class="custom-check-row">
                <label class="check-box-label">
                  <input v-model="formData.isPublic" type="checkbox" />
                  <span>Публичный доступ в каталоге</span>
                </label>
              </div>
            </div>
          </template>
        </UIMoloSection>

        <UIMoloSection>
          <template #header>
            <div class="menu-head-between">
              <span class="pane-sec-title">Интеграция в меню</span>
              <button class="add-loc-btn" title="Создать новое место" @click="openCreateLocationModal">
                + Место
              </button>
            </div>
          </template>
          <template #main>
            <div class="form-vertical-stack">
              <UIMoloSelect
                  v-model="selectedGroupId"
                  compact
                  :disabled="!locations || locations.length === 0 ? 'Нет доступных групп' : 'Выберите группу...'"
                  :parent="locations"
                  children="groupTitle"
                  tLabel="Группа меню"
                  valueKey="groupId"
              />

              <UIMoloSelect
                  v-if="availableParents.length"
                  v-model="selectedParentId"
                  compact
                  :parent="availableParents"
                  children="title"
                  disabled="Корень группы (опционально)"
                  tLabel="Родительский раздел"
                  valueKey="id"
              />

              <UIMoloButton
                  class="small full confirm"
                  :disabled="!selectedGroupId || adding"
                  @click="addModuleToMenu"
              >
                <UIMoloLoaders v-if="adding" btnLoader />
                <span v-else>Закрепить в меню</span>
              </UIMoloButton>
            </div>
          </template>
        </UIMoloSection>

        <UIMoloSection>
          <template #header>
            <span class="pane-sec-title">Иконка / Превью</span>
          </template>
          <template #main>
            <div class="preview-box">
              <div v-if="formData.previewImage" class="img-frame">
                <img :src="formData.previewImage" alt="Превью" />
                <button class="del-preview-badge" title="Удалить" @click="removePreview">✕</button>
              </div>
              <div v-else class="img-placeholder">
                <span>Нет изображения</span>
              </div>

              <div class="img-upload-input">
                <UIMoloInput
                    compact
                    accept="image/*"
                    type="file"
                    @change="handleImageUpload"
                />
              </div>
            </div>
          </template>
        </UIMoloSection>
      </aside>
    </main>

    <UIMoloModal
        v-model="showFileEditor"
        :title="editingFilePath ? 'Редактирование файла' : 'Создание нового файла'"
        :confirm-text="editingFilePath ? 'Обновить' : 'Создать'"
        cancel-text="Отмена"
        width="780px"
        :loading="loadingUPD"
        @confirm="saveFile"
        @cancel="closeFileEditor"
    >
      <template #body>
        <div class="file-modal-layout">
          <div class="grid-three-col">
            <UIMoloInput
                v-model="fileForm.name"
                compact
                lRequired
                placeholder="Button"
                tLabel="Имя файла"
            />
            <UIMoloInput
                v-model="fileForm.path"
                compact
                placeholder="components/Button"
                tLabel="Путь"
            />
            <UIMoloSelect
                v-model="fileForm.format"
                compact
                :parent="fileFormats"
                children="label"
                tLabel="Формат"
                valueKey="value"
            />
          </div>

          <div class="modal-monaco-box">
            <UIMoloMonaco
                :initial-code="fileForm.code"
                :language="fileEditorLanguage"
                :module-id="selectedModuleId"
                :enterprise-id="appStore.getEnterpriseId()"
                @update:code="(code) => (fileForm.code = code)"
            />
          </div>
        </div>
      </template>
    </UIMoloModal>

    <UIMoloModal
        v-model="menuLocationModalOpen"
        title="Создание места в меню"
        confirm-text="Создать место"
        cancel-text="Отмена"
        width="550px"
        close-on-overlay
        @confirm="handleSaveLocation"
    >
      <template #body>
        <div class="form-vertical-stack">
          <div class="grid-two-col">
            <UIMoloInput
                v-model="modalLocationForm.title"
                compact
                tLabel="Название места"
                lRequired
                placeholder="Склад"
            />
            <UIMoloInput
                v-model="modalLocationForm.placeName"
                compact
                tLabel="Ключ маршрута"
                lRequired
                placeholder="storage"
            />
          </div>

          <UIMoloSelect
              v-model="modalLocationForm.parentId"
              compact
              :parent="parentLocationOptions"
              children="title"
              tLabel="Родительский раздел"
              valueKey="id"
          />

          <UIMoloInput
              v-model.number="modalLocationForm.order"
              compact
              tLabel="Порядковый номер"
              type="number"
              placeholder="0"
          />
        </div>
      </template>
    </UIMoloModal>
  </div>
</template>

<style scoped>
.creator-workspace {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 90vh;
  background: var(--half_opacity_bg);
  color: #e0e0e0;
  box-sizing: border-box;
  overflow: hidden;
}

.top-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  background: var(--half_opacity_bg);
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
  gap: 12px;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.04);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--half_opacity_border);
}

.quick-nav-actions {
  display: flex;
  gap: 6px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-wrap {
  width: 220px;
}

.ide-layout {
  flex: 1 1 0%;
  display: flex;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.editor-pane {
  flex: 1 1 0%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--half_opacity_border);
  background: var(--half_opacity_bg);
}

.ide-tab-bar {
  display: flex;
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: none;
  border: none;
  border-right: 1px solid var(--half_opacity_border);
  color: #8c8c9e;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
}

.tab-btn.active {
  background: #1a1b26;
  color: #6496ff;
  font-weight: 600;
  border-bottom: 2px solid #6496ff;
}

.tab-count {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
}

.tab-content-area {
  flex: 1 1 0%;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.monaco-full-height {
  width: 100%;
  height: 100%;
}

.files-view-wrap,
.deps-view-wrap {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.view-title {
  font-size: 14px;
  font-weight: 600;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.file-card {
  background: #1e1e26;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ext-icon {
  width: 16px;
  height: 16px;
}

.file-name {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-tag {
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 4px;
  background: #2b2b38;
  color: #8c8c9e;
}

.file-tag.server {
  background: #2a3c5a;
  color: #80b3ff;
}

.file-card-path {
  font-size: 10px;
  color: #7b7b8f;
  font-family: monospace;
}

.deps-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deps-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.dep-switch-tabs {
  display: flex;
  gap: 6px;
}

.dep-add-inline {
  display: flex;
  gap: 8px;
  align-items: center;
}

.dep-list-table {
  background: #16161d;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  overflow: hidden;
}

.dep-row-head {
  display: grid;
  grid-template-columns: 1fr 140px 40px;
  padding: 8px 12px;
  font-size: 11px;
  color: #8c8c9e;
  border-bottom: 1px solid var(--half_opacity_border);
  text-transform: uppercase;
}

.dep-row-item {
  display: grid;
  grid-template-columns: 1fr 140px 40px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  font-size: 12px;
}

.pkg-name {
  font-weight: 500;
  font-family: monospace;
}

.pkg-ver {
  color: #4ade80;
  font-family: monospace;
}

.dep-del-btn {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
}

.dep-del-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
}

.subview-empty {
  padding: 30px;
  text-align: center;
  color: #7b7b8f;
  font-size: 12px;
}

.ide-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  background: var(--half_opacity_bg);
  border-top: 1px solid var(--half_opacity_border);
  font-size: 10px;
  color: #6e6e7e;
  flex-shrink: 0;
}

.status-left,
.status-right {
  display: flex;
  gap: 12px;
}

.sidebar-pane {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  overflow-y: auto;
}

.pane-sec-title {
  font-size: 12px;
  font-weight: 700;
  color: #c7c7c7;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.form-vertical-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.grid-three-col {
  display: grid;
  grid-template-columns: 1fr 1fr 120px;
  gap: 8px;
}

.custom-check-row {
  padding-top: 4px;
}

.check-box-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #aaa;
  cursor: pointer;
}

.menu-head-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.add-loc-btn {
  background: none;
  border: none;
  color: #6496ff;
  font-size: 11px;
  cursor: pointer;
}

.add-loc-btn:hover {
  text-decoration: underline;
}

.preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.img-frame {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--half_opacity_border);
}

.img-frame img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.del-preview-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 1px 4px;
  font-size: 10px;
}

.img-placeholder {
  width: 100%;
  height: 60px;
  border: 1px dashed var(--half_opacity_border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #666;
}

.img-upload-input {
  width: 100%;
}

.file-modal-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-monaco-box {
  height: 380px;
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  overflow: hidden;
}

@media (max-width: 900px) {
  .ide-layout {
    flex-direction: column;
  }
  .sidebar-pane {
    width: 100%;
    max-height: 280px;
    border-top: 1px solid var(--half_opacity_border);
  }
  .editor-pane {
    border-right: none;
  }
}
</style>