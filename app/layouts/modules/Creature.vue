<script lang="ts" setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {getMonacoLanguage, initMonaco, buildEditorFiles} from '~~/app/composables/monaco/index'
import {useUserStore} from '~~/stores/userStore'
import {useMenuEditorStore} from '~~/stores/menuEditorStore'
import {useModuleEditorStore} from '~~/stores/moduleEditorStore'
import {useAppStore} from '~~/stores/appStore'
import {storeToRefs} from 'pinia'
import jsIcon from '~~/public/js.png'
import tsIcon from '~~/public/ts.png'
import vueIcon from '~~/public/vue.png'
defineOptions({
  inheritAttrs: false
})
// =============================================
// ПРОПСЫ
// =============================================
const props = defineProps<{
  initialModuleId?: string // передаётся из openWindow
}>()
// =============================================
// EMITS
// =============================================
const emit = defineEmits(['close', 'saved'])
// =============================================
// Храним ссылки на редакторы
// =============================================
let mainEditorInstance: any = null
let fileEditorInstance: any = null
let monacoInstance: any = null
let monacoCtx: any = null
// =============================================
// COMPOSABLES
// =============================================
const {openWindow, updateWindowData, windows, focusWindow, closeWindow} = useWindowManager()
const {addNotification} = useNotifications('Создание модуля')
const {addLog} = useLogger('Создание модуля')
const userStore = useUserStore()
const menuStore = useMenuEditorStore()
const moduleStore = useModuleEditorStore()
const appStore = useAppStore()
// =============================================
// STORE REFS (только общие данные)
// =============================================
const {locations, selectedGroupId, selectedParentId, adding, creating, tree} = storeToRefs(menuStore)

const {modules} = storeToRefs(moduleStore)
// =============================================
// ЛОКАЛЬНОЕ СОСТОЯНИЕ (изолированное для каждого экземпляра)
// =============================================
const enterpriseInfo = ref<any>(null)
const previewWindowId = ref<string | null>(null)
const showDocumentation = ref(false)
const loadingUPD = ref(false)
const loadingDEP = ref(false)
const newDepName = ref('')
const newDepVersion = ref('')
const initialDataLoaded = ref(false)
const menuLocationModalOpen = ref(false)
const menuLocationModalMode = ref<'create' | 'edit'>('create')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
// Локальный выбранный модуль
const selectedModuleId = ref<string | null>(props.initialModuleId || null)
// Локальная форма
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
// Локальные файлы
const moduleFiles = ref<any[]>([])
// Локальное состояние загрузки
const loading = ref(false)
const loadingFiles = ref(false)
const clearingCache = ref(false)
// Локальный редактор файлов
const showFileEditor = ref(false)
const fileForm = ref({
  name: '',
  path: '',
  format: 'vue' as 'vue' | 'js' | 'ts',
  code: '',
  isServer: false
})
const editingFilePath = ref<string | null>(null)
// Локальные зависимости
const activeDepTab = ref<'dependencies' | 'devDependencies'>('dependencies')
// Локальные инпуты для тегов
const tagsInput = ref('')
const composablesInput = ref('')
// =============================================
// КОНСТАНТЫ
// =============================================
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
// Форма для модалки создания места
const modalLocationForm = ref({
  title: '',
  placeName: '',
  type: 'menu' as 'menu' | 'module',
  order: 0,
  requiredRole: ['Управляющий'] as string[],
  parentId: null as string | null
})
// Ref для контейнеров Monaco
const mainMonacoContainer = ref<HTMLElement | null>(null)
const fileMonacoContainer = ref<HTMLElement | null>(null)
// =============================================
// COMPUTED
// =============================================
const currentUser = computed(() => ({
  _id: userStore.userId || 'system',
  name: userStore.userName || 'System',
  role: userStore.userRole || 'system'
}))
const isEditing = computed(() => !!selectedModuleId.value)
const currentDeps = computed(() => {
  if (activeDepTab.value === 'dependencies') {
    return formData.value.dependencies || {}
  }
  return formData.value.devDependencies || {}
})
const clientFiles = computed(() => moduleFiles.value.filter(f => !f.isServerFile))
const serverFiles = computed(() => moduleFiles.value.filter(f => f.isServerFile))
const editorLanguage = computed(() => {
  return getMonacoLanguage(formData.value.format)
})
const fileEditorLanguage = computed(() => {
  return getMonacoLanguage(fileForm.value.format)
})
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
// =============================================
// Рекурсивный сбор папок
// =============================================
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
// =============================================
// PLACEHOLDER
// =============================================
const getPlaceholder = () => {
  if (formData.value.format === 'vue') {
    return `
<script setup>
import { ref } from 'vue'
const message = ref('Привет из динамического модуля!')
const handleClick = () => {
    message.value = 'Работает!'
}
<\/script>
<template>
    <div>
        <h1>{{ message }}</h1>
        <button @click="handleClick">Нажми на меня</button>
    </div>
</template>
<style scoped>
</style>
  `
  }
  if (formData.value.format === 'ts') {
    return `// TypeScript module
export function main(): string {
  return 'Hello from TypeScript!'
}
`
  }
  if (formData.value.format === 'js') {
    return `// JavaScript module
export function main() {
  return 'Hello from JavaScript!'
}
`
  }
  return '// module code...'
}
const getFilePlaceholder = (format: string) => {
  if (format === 'vue') {
    return `<template>
  <div>
    <h1>Новый компонент</h1>
  </div>
</template>
<script setup>
// Ваш код здесь
<\/script>`
  }
  if (format === 'ts') {
    return `// TypeScript файл
export function example(): void {
  console.log('Hello from TypeScript!')
}`
  }
  return `// JavaScript файл
export function example() {
  console.log('Hello from JavaScript!')
}`
}
// =============================================
// МЕТОДЫ ЗАГРУЗКИ ДАННЫХ (локальные)
// =============================================

// ФИКС БАГА №1 (потеря code/isPublic/description/tags/... при выборе модуля):
// раньше форма заполнялась из ОБЛЕГЧЁННОГО списка modules.value (там только
// _id/name/fileName/format), из-за чего всё остальное затиралось дефолтами.
// Теперь — один запрос к новому эндпоинту, отдающему модуль ПОЛНОСТЬЮ
// (мета + code + files + dependencies), и он же убирает 2 лишних round-trip'а
// (/files и /dependencies), из-за которых открытие модуля было медленным
// (см. проблему №3).
const loadFullModuleData = async (id: string): Promise<any | null> => {
  if (!id || !enterpriseInfo.value?._id) return null
  addLog('info', 'Начинаю загрузку полной информации о модуле...')
  try {
    const result: any = await $fetch(
        `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${id}`
    )
    addLog('success', 'Информация о модуле загружена')
    return result?.module || null
  } catch (error) {
    console.error('loadFullModuleData error:', error)
    addLog('error', `Не удалось загрузить полные данные модуля - ${ error?.data?.message ||
    error?.message || error}`)
    addNotification('error', 'Не удалось загрузить полные данные модуля. Смотрите логированиие')
    return null
  }
}

// Точечные догрузки — используются ТОЛЬКО как быстрый рефреш после
// локальных мутаций файлов/зависимостей (saveFile/deleteFile/addDependency/
// removeDependency), где тянуть весь модуль целиком избыточно.
const loadModuleFiles = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return
  loadingFiles.value = true
  addLog('info', 'Загружаю файлы для модуля...')
  try {
    const result = await moduleStore.loadModuleFilesById(
        enterpriseInfo.value._id,
        selectedModuleId.value
    )
    moduleFiles.value = result.files || []
    if (result.mainFile) {
      formData.value.code = result.mainFile.code || ''
    }
    addLog('success', 'Файлы загружены!')
  } catch (error) {
    addLog('error', `Ошибка загрузки файлов для модуля - ${ error?.data?.message ||
    error?.message || error}`)
    console.error('loadModuleFiles error:', error)
  } finally {
    loadingFiles.value = false
  }
}
const loadDependencies = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return
  addLog('info', 'Загружаю зависиомсти для модуля...')

  try {
    const result = await moduleStore.loadModuleDependencies(
        enterpriseInfo.value._id,
        selectedModuleId.value
    )
    formData.value.dependencies = result.dependencies || {}
    formData.value.devDependencies = result.devDependencies || {}
    addLog('success', 'Зависимости загружены!')

  } catch (error) {
    addLog('error', `Ошибка загрузки зависимостей для модуля - ${ error?.data?.message ||
    error?.message || error}`)
    console.error('loadDependencies error:', error)
  }
}
// loadModule теперь ожидает ПОЛНЫЙ объект модуля (с code, если он есть).
// mod.code берётся через `??`, а не `||` — чтобы легитимный пустой код
// ('') не затирался старым значением формы.
const loadModule = (mod: any) => {
  if (!mod) return
  formData.value = {
    name: mod.name || '',
    fileName: mod.fileName || '',
    description: mod.description || '',
    format: mod.format || 'vue',
    code: mod.code ?? formData.value.code ?? '',
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
  moduleFiles.value = []
}
// =============================================
// ВЫБОР МОДУЛЯ
// =============================================
const selectModule = async (id: string | null) => {
  if (id === selectedModuleId.value) return
  selectedModuleId.value = id
  if (!id) {
    resetForm()
    if (mainEditorInstance) {
      mainEditorInstance.setValue(formData.value.code)
    }
    syncEditorFiles()
    return
  }
  // Мгновенно показываем то немногое, что уже есть в лёгком списке
  // (для отзывчивости UI, без ожидания сети), а затем одним запросом
  // догружаем ВСЁ остальное (code/isPublic/description/tags/files/deps/...)
  const lightMod = modules.value.find((m: any) => m._id === id)
  if (lightMod) {
    formData.value.name = lightMod.name || ''
    formData.value.fileName = lightMod.fileName || ''
    formData.value.format = lightMod.format || 'vue'
  }
  loadingFiles.value = true
  try {
    const full = await loadFullModuleData(id)
    if (full) {
      loadModule(full)
      moduleFiles.value = full.files || []
    }
  } finally {
    loadingFiles.value = false
  }
  if (!formData.value.code) {
    formData.value.code = getPlaceholder()
  }
  if (mainEditorInstance) {
    mainEditorInstance.setValue(formData.value.code)
  }
  syncEditorFiles()
}
// =============================================
// СИНХРОНИЗАЦИЯ РЕДАКТОРА
// =============================================
const syncEditorFiles = () => {
  if (!monacoCtx) return
  const files = buildEditorFiles(formData.value, moduleFiles.value)
  monacoCtx.fs.loadFiles(files)
  monacoCtx.vfs.loadModuleFiles({
    code: formData.value.code,
    fileName: formData.value.fileName,
    format: formData.value.format,
    files: moduleFiles.value
  })
}
// =============================================
// СОХРАНЕНИЕ МОДУЛЯ
// =============================================
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
  addLog('info', 'Начинаю сохранение модуля...')
  try {
    if (mainEditorInstance) {
      formData.value.code = mainEditorInstance.getValue()
    }
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
    await moduleStore.loadModules(enterpriseInfo.value._id, true)
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
// =============================================
// РАБОТА С ФАЙЛАМИ
// =============================================
const normalizePath = (name: string, pathInput: string, format: string) => {
  let basePath = pathInput?.trim() || name.trim()
  basePath = basePath.replace(/^\.\//, '')
  if (!basePath.match(/\.[a-z]+$/)) {
    basePath += `.${format}`
  }
  return basePath
}
const saveFile = async () => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) {
    addNotification('error', 'Модуль не выбран')
    return
  }
  if (!fileForm.value.name) {
    addNotification('warning', 'Введите имя файла')
    return
  }
  addLog('info', 'Сохраняю файл...')
  try {
    loadingUPD.value = true
    if (fileEditorInstance) {
      fileForm.value.code = fileEditorInstance.getValue()
    }
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
      code: fileForm.value.code || getFilePlaceholder(fileForm.value.format),
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
    closeFileEditor()
    syncEditorFiles()
  } catch (error: any) {
    console.error('Save file error:', error)
    addNotification('error', error?.message || 'Ошибка сохранения файла')
    addLog('error', error?.message || 'Unknown error')
  } finally {
    loadingUPD.value = false
  }
}
const deleteFile = async (filePath: string) => {
  if (!selectedModuleId.value || !enterpriseInfo.value?._id) return
  addLog('info', 'Удаляю файл...')
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
    syncEditorFiles()
  } catch (error) {
    addLog('error', `Ошибка удаления файла - ${ error?.data?.message ||
    error?.message || error }`)
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
// =============================================
// ЗАВИСИМОСТИ
// =============================================
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
// =============================================
// МЕНЮ
// =============================================
const refreshMenuData = async () => {
  await menuStore.loadLocations()
  await menuStore.loadTree()
  await menuStore.refreshAllMenuData()
}
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
      await menuApi.createGroup(
          modalLocationForm.value.title,
          modalLocationForm.value.placeName,
          modalLocationForm.value.type,
          modalLocationForm.value.order
      )
      addNotification('info', 'Новая группа меню создана')
    }
    await refreshMenuData()
    if (!parentId) {
      const newGroup = locations.value.find(
          (g: any) => g.groupTitle === modalLocationForm.value.title
      )
      if (newGroup) {
        selectedGroupId.value = newGroup.groupId
      }
    }
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
    await refreshMenuData()
    window.dispatchEvent(new CustomEvent('modules-updated'))
  } catch {
    addNotification('error', 'Модуль не добавлен в меню')
  } finally {
    adding.value = false
  }
}
// =============================================
// ПРЕДПРОСМОТР
// =============================================
const openPreviewInWindow = () => {
  let currentCode = formData.value.code
  if (mainEditorInstance) {
    currentCode = mainEditorInstance.getValue()
    formData.value.code = currentCode
  }
  if (!currentCode?.trim()) {
    addNotification('warning', 'Нет кода для предпросмотра')
    return
  }

  // ── Если окно превью уже открыто — просто обновляем данные и фокусируем ──
  if (previewWindowId.value) {
    const existing = windows.value.find(w => w.itemId === previewWindowId.value)
    if (existing) {
      updateWindowData('modules', previewWindowId.value, {
        moduleName: formData.value.name || 'Без названия',
        code: currentCode,
        files: moduleFiles.value,
        dependencies: formData.value.dependencies,
        devDependencies: formData.value.devDependencies,
        moduleId: selectedModuleId.value,
        _updated: Date.now()
      })
      focusWindow(existing.id)
      return
    }
    // Окно было закрыто пользователем — сбрасываем ID
    previewWindowId.value = null
  }

  // ── Создаём новое окно превью ──
  openWindow(
      'modules',
      'preview',
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
        code: currentCode,
        files: moduleFiles.value,
        dependencies: formData.value.dependencies,
        devDependencies: formData.value.devDependencies,
        moduleId: selectedModuleId.value
      }
  )
}
// =============================================
// ИЗОБРАЖЕНИЯ
// =============================================
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
// =============================================
// ВСПОМОГАТЕЛЬНЫЕ
// =============================================
const getEnterpriseId = (): string | null => {
  return appStore.getEnterpriseId()
}
// Инициализация файлового редактора
const initFileEditor = async () => {
  if (!fileMonacoContainer.value) return
  await nextTick()
  const {ctx} = initMonaco(fileMonacoContainer.value!, {
    language: getMonacoLanguage(fileForm.value.format)
  })
  fileEditorInstance = ctx.editor
  monacoInstance = ctx.monaco
  const code = fileForm.value.code || getFilePlaceholder(fileForm.value.format)
  fileEditorInstance.setValue(code)
  watch(fileEditorLanguage, (newLang) => {
    if (fileEditorInstance && monacoInstance) {
      const model = fileEditorInstance.getModel()
      if (model) {
        monacoInstance.editor.setModelLanguage(model, newLang)
      }
    }
  })
}
// =============================================
// WATCHERS
// =============================================
watch(tagsInput, value => {
  formData.value.tags = value.split(',').map(v => v.trim()).filter(Boolean)
})
watch(composablesInput, value => {
  formData.value.composables = value.split(',').map(v => v.trim()).filter(Boolean)
})
watch(
    () => formData.value.format,
    () => {
      if (!isEditing.value) {
        formData.value.code = getPlaceholder()
        if (mainEditorInstance) {
          mainEditorInstance.setValue(formData.value.code)
        }
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
        code: code,
        isEditing: isEditing.value,
        _updated: Date.now()
      })
    }
)
watch(showDocumentation, async () => {
  await nextTick()
  setTimeout(() => {
    mainEditorInstance?.layout?.()
  }, 50)
})
watch(moduleFiles, (newFiles) => {
  if (!previewWindowId.value) return
  updateWindowData('modules', previewWindowId.value, {
    files: newFiles
  })
})
watch(editorLanguage, (newLang) => {
  if (mainEditorInstance && monacoInstance) {
    const model = mainEditorInstance.getModel()
    if (model) {
      monacoInstance.editor.setModelLanguage(model, newLang)
    }
  }
}, {immediate: true})
watch(showFileEditor, async (val) => {
  if (val) {
    await nextTick()
    setTimeout(() => {
      initFileEditor()
    }, 100)
  } else {
    if (fileEditorInstance) {
      fileEditorInstance.dispose()
      fileEditorInstance = null
    }
  }
})

watch(() => formData.value.dependencies, (newDeps) => {
  if (!previewWindowId.value) return
  updateWindowData('modules', previewWindowId.value, {
    dependencies: newDeps,
    _updated: Date.now()
  })
}, { deep: true })

watch(() => formData.value.devDependencies, (newDeps) => {
  if (!previewWindowId.value) return
  updateWindowData('modules', previewWindowId.value, {
    devDependencies: newDeps,
    _updated: Date.now()
  })
}, { deep: true })

// ── При изменении имени модуля — обновляем заголовок превью ──
watch(() => formData.value.name, (newName) => {
  if (!previewWindowId.value) return
  updateWindowData('modules', previewWindowId.value, {
    moduleName: newName || 'Без названия',
    _updated: Date.now()
  })
})


// =============================================
// LIFECYCLE
// =============================================
onMounted(async () => {
  const enterpriseId = getEnterpriseId()
  // Раньше тут был жёсткий `if (!enterpriseId) return` без какого-либо
  // повторного запроса — если окно открывалось до того, как в localStorage
  // появлялось currentEnterprise (например, сразу после логина), список
  // модулей оставался пустым НАВСЕГДА до перезагрузки страницы.
  // Теперь при отсутствии enterpriseId подписываемся на событие
  // 'enterprise-login' (его уже диспатчит остальное приложение,
  // см. MoloMenu.vue) и догружаем список модулей, как только оно придёт.
  if (!enterpriseId) {
    const retryOnLogin = () => {
      const id = getEnterpriseId()
      if (id) {
        enterpriseInfo.value = JSON.parse(localStorage.getItem('currentEnterprise') || 'null')
        moduleStore.loadModules(id, true)
      }
    }
    window.addEventListener('enterprise-login', retryOnLogin, { once: true })
    onUnmounted(() => window.removeEventListener('enterprise-login', retryOnLogin))
    return
  }
  enterpriseInfo.value = JSON.parse(localStorage.getItem('currentEnterprise') || 'null')
  // Загружаем списки
  await Promise.all([
    moduleStore.loadModules(enterpriseId),
    menuStore.loadLocations(),
    menuStore.loadTree()
  ])
  // Если есть initialModuleId — загружаем его ПОЛНОСТЬЮ (см. фикс бага №1:
  // раньше здесь брали объект из облегчённого списка modules.value и теряли
  // code/isPublic/description/tags/dependencies/...)
  if (props.initialModuleId) {
    selectedModuleId.value = props.initialModuleId
    const full = await loadFullModuleData(props.initialModuleId)
    if (full) {
      loadModule(full)
      moduleFiles.value = full.files || []
    } else {
      selectedModuleId.value = null
    }
  }
  if (!selectedModuleId.value) {
    resetForm()
  }
  if (!formData.value.code) {
    formData.value.code = getPlaceholder()
  }
  initialDataLoaded.value = true
  // Инициализация Monaco
  if (mainMonacoContainer.value) {
    const files = buildEditorFiles(formData.value, moduleFiles.value)
    const {ctx} = initMonaco(mainMonacoContainer.value!, {
      language: getMonacoLanguage(formData.value.format),
      moduleId: selectedModuleId.value || undefined,
      enterpriseId: enterpriseId,
      files
    })
    mainEditorInstance = ctx.editor
    monacoInstance = ctx.monaco
    monacoCtx = ctx
    if (formData.value.code) {
      mainEditorInstance.setValue(formData.value.code)
    }
  }
})
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (mainEditorInstance) { mainEditorInstance.dispose(); mainEditorInstance = null }
  if (fileEditorInstance) { fileEditorInstance.dispose(); fileEditorInstance = null }
  monacoInstance = null
  monacoCtx = null

  // Закрываем окно превью вместе с редактором
  if (previewWindowId.value) {
    const existing = windows.value.find(w => w.itemId === previewWindowId.value)
    if (existing) closeWindow(existing.id)
    previewWindowId.value = null
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
              class="small"
              :class="selectedModuleId ? 'default' : 'confirm'"
              @click="selectModule(null)"
          >
            Новый
          </MoloButton>
          <MoloButton
              v-if="formData.format === 'vue'"
              class="small confirm"
              @click="openPreviewInWindow"
          >
            Предпросмотр
          </MoloButton>
          <MoloButton
              class="small"
              :class="showDocumentation ? 'confirm' : 'default'"
              @click="openDocumentation"
          >
            {{ showDocumentation ? 'Скрыть док.' : 'Документация' }}
          </MoloButton>
        </div>
      </div>
      <div class="header-right">
        <MoloSelect
            :model-value="selectedModuleId"
            :disabled="!modules || modules.length === 0 ? 'Нет модулей' : 'Выбрать модуль'"
            :parent="modules"
            children="name"
            class="module-select"
            valueKey="_id"
            @update:model-value="selectModule"
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
        <MoloSection>
          <template #header>
            <section style="display: flex; justify-content: space-between; align-items: center; width: 100%">
              <span>Сохранение</span>
              <div class="editor-actions">
                <MoloButton class="small close" @click="emit('close')">
                  Отмена
                </MoloButton>
                <MoloButton :loading="loading" :disabled="loading" class="small confirm" @click="saveModule">
                  <span v-if="!loading">
                    {{ isEditing ? 'Обновить' : 'Создать' }}
                  </span>
                </MoloButton>
              </div>
            </section>
          </template>
          <template #main>
            <span>Не забывайте сохранять изменения <3</span>
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
            <div ref="mainMonacoContainer" class="code-container"></div>
          </ClientOnly>
        </div>
      </template>
    </MoloSection>
    <hr/>
    <!-- ФАЙЛЫ МОДУЛЯ -->
    <MoloSection>
      <template #header>
        <span>Файлы модуля</span>
        <MoloButton class="confirm small" @click="openFileEditor()">
          Добавить файл
        </MoloButton>
      </template>
      <template #main>
        <div v-if="loadingFiles" class="loader-wrapper">
          <MoloLoaders wndLoader/>
        </div>
        <div class="file-list">
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
                  @click="openFileEditor(file)"
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
    <!-- МОДАЛКА РЕДАКТОРА ФАЙЛОВ -->
    <MoloModal
        v-model="showFileEditor"
        :title="editingFilePath ? 'Редактирование файла' : 'Новый файл'"
        :confirm-text="editingFilePath ? 'Обновить' : 'Создать'"
        cancel-text="Отмена"
        width="700px"
        :loading="loadingUPD"
        @confirm="saveFile"
        @cancel="closeFileEditor"
    >
      <template #body>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-row">
            <MoloInput
                v-model="fileForm.name"
                lRequired
                placeholder="Button"
                tLabel="Имя файла (без расширения)"
            />
            <MoloInput
                v-model="fileForm.path"
                placeholder="components/Button"
                tLabel="Путь (опционально)"
                help-text="Оставьте пустым для автоматического пути"
            />
            <MoloSelect
                v-model="fileForm.format"
                :parent="fileFormats"
                children="label"
                tLabel="Формат"
                valueKey="value"
            />
          </div>
          <div class="file-editor-container">
            <ClientOnly>
              <div ref="fileMonacoContainer" class="file-monaco-editor"></div>
            </ClientOnly>
          </div>
        </div>
      </template>
    </MoloModal>
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
  </div>
  <!-- МОДАЛКА СОЗДАНИЯ МЕСТА В МЕНЮ -->
  <MoloModal
      v-model="menuLocationModalOpen"
      title="Создание места в меню"
      confirm-text="Создать"
      cancel-text="Отмена"
      width="550px"
      close-on-overlay
      @confirm="handleSaveLocation"
      help-text="Вы можете создать вложенное меню, выбрав родительский элемент.
      Если выберите родителя (папку), новое место создастся внутри неё как подменю"
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 250px;
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
  justify-content: space-between;
  gap: 10px;
}
.editor-actions {
  display: flex;
  gap: 5px;
}
.code-container {
  display: flex;
  height: 500px;
  width: 100%;
  overflow: hidden;
}
.file-editor-container {
  display: flex;
  height: 400px;
  width: 100%;
  overflow: hidden;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
}
.file-monaco-editor {
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
.file-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.file-item {
  display: flex;
  gap: 15px;
  justify-content: space-between;
  align-items: center;
  font-family: monospace;
  font-size: 13px;
  padding: 5px 0;
  border-bottom: 1px solid var(--half_opacity_border);
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
.dependencies {
  display: flex;
  flex-direction: row;
  gap: 20px;
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