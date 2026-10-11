<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { useDirectoryInterpolator } from '~/composables/useDirectoryInterpolator'
import MoloSticker from '~/components/ui/MoloSticker.vue'

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select'

interface DepartmentItem {
  _id?: string
  key: string
  name: string
  description?: string
}

interface FieldSchema {
  key: string
  label: string
  placeholder?: string
  required?: boolean
  type?: FieldType
  options?: Array<{ label: string; value: string | number }>
  span?: 1 | 2
}

interface DirectoryMeta {
  label: string
  value: string
  sticker: string
  codeLabel: string
  codePlaceholder: string
  titleLabel: string
  titlePlaceholder: string
  groupByKey?: string
  fields: FieldSchema[]
}

interface DirectoryItem {
  _id: string
  code: string
  title: string
  description?: string
  parentId: string | null
  attributes: Record<string, any>
  createdAt: string
}

const props = defineProps<{
  enterpriseId?: string
  windowId?: string
}>()

const appStore = useAppStore()
const interpolator = useDirectoryInterpolator()
const { addNotification } = useNotifications('Справочники')

// ─────────────────────────────────────────────────────────────
// РЕЕСТР ОТДЕЛОВ С КЛЮЧАМИ
// ─────────────────────────────────────────────────────────────
const departments = ref<DepartmentItem[]>([
  { key: 'it', name: 'IT и разработка' },
  { key: 'admin', name: 'Руководство и менеджмент' },
  { key: 'finance', name: 'Бухгалтерия и финансы' },
  { key: 'sales', name: 'Отдел продаж' },
  { key: 'logistics', name: 'Склад и логистика' }
])

const isAddDeptModalOpen = ref(false)
const newDeptForm = ref({
  key: '',
  name: '',
  description: ''
})

// Модалка удаления отдела
const deleteDeptModalOpen = ref(false)
const deptToDelete = ref<DepartmentItem | null>(null)
const deletingDeptLoading = ref(false)

// Фильтруем элементы, чтобы не попадали пустые/битые объекты
const validDepartments = computed(() => {
  return departments.value.filter((d) => Boolean(d && (d.key || d.name)))
})

const departmentOptions = computed(() =>
    validDepartments.value.map((d) => ({
      label: `${d.name || 'Без названия'} [${d.key || 'no-key'}]`,
      value: d.name || ''
    }))
)

// Все сотрудники компании для подсчета людей в отделах
const allEmployeesList = ref<DirectoryItem[]>([])

const STATIC_CONFIG = computed<Record<string, DirectoryMeta>>(() => ({
  departments: {
    label: 'Сотрудники и отделы',
    value: 'departments',
    sticker: 'departments',
    codeLabel: 'Табельный номер / ID',
    codePlaceholder: 'EMP-01',
    titleLabel: 'ФИО Сотрудника',
    titlePlaceholder: 'Иванов Иван Иванович',
    groupByKey: 'department',
    fields: [
      {
        key: 'department',
        label: 'Отдел компании',
        type: 'select',
        required: true,
        options: departmentOptions.value
      },
      { key: 'role', label: 'Должность / Роль', placeholder: 'Ведущий инженер' },
      { key: 'phone', label: 'Контактный телефон', placeholder: '+7 (999) 000-00-00' },
      { key: 'birthDate', label: 'Дата рождения', type: 'date' }
    ]
  },
  counterparties: {
    label: 'Контрагенты',
    value: 'counterparties',
    sticker: 'counterparties',
    codeLabel: 'ИНН',
    codePlaceholder: '10 или 12 цифр',
    titleLabel: 'Наименование / ФИО',
    titlePlaceholder: 'ООО "Компания"',
    fields: [
      { key: 'kpp', label: 'КПП', placeholder: '770101001' },
      { key: 'phone', label: 'Телефон', placeholder: '+7...' }
    ]
  },
  bank_accounts: {
    label: 'Банковские реквизиты',
    value: 'bank_accounts',
    sticker: 'bank',
    codeLabel: 'БИК Банка',
    codePlaceholder: '044525225',
    titleLabel: 'Наименование банка',
    titlePlaceholder: 'ПАО СБЕРБАНК',
    fields: [
      { key: 'accountNumber', label: 'Расчётный счёт', placeholder: '40702810...', required: true }
    ]
  },
  nomenclature: {
    label: 'Номенклатура',
    value: 'nomenclature',
    sticker: 'nomenclature',
    codeLabel: 'Артикул / SKU',
    codePlaceholder: 'ART-01',
    titleLabel: 'Наименование',
    titlePlaceholder: 'Товар',
    fields: [
      { key: 'unit', label: 'Ед. изм.', placeholder: 'шт', required: true }
    ]
  },
  glossary: {
    label: 'Глоссарий',
    value: 'glossary',
    sticker: 'glossary',
    codeLabel: 'Аббревиатура',
    codePlaceholder: 'SLA',
    titleLabel: 'Термин',
    titlePlaceholder: 'Service Level Agreement',
    fields: []
  }
}))

const currentType = ref('departments')
const customDirectories = ref<DirectoryMeta[]>([])

const allConfigs = computed(() => {
  const map: Record<string, DirectoryMeta> = { ...STATIC_CONFIG.value }
  for (const c of customDirectories.value) {
    map[c.value] = c
  }
  return map
})

const directoryTypes = computed(() =>
    Object.values(allConfigs.value).map((cfg) => ({ label: cfg.label, value: cfg.value }))
)

const currentMeta = computed(() => allConfigs.value[currentType.value] || STATIC_CONFIG.value.departments)

const items = ref<DirectoryItem[]>([])
const loading = ref(false)
const syncing = ref(false)
const searchQuery = ref('')
const selectedItem = ref<DirectoryItem | null>(null)
const selectedSectionFilter = ref<string>('all')

const itemModalOpen = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)

const itemForm = ref({
  code: '',
  title: '',
  description: '',
  departmentKey: '',
  attributes: {} as Record<string, any>
})

const deleteModalOpen = ref(false)
const itemToDelete = ref<DirectoryItem | null>(null)

// Модальное окно просмотра людей по отделу
const deptPeopleModalOpen = ref(false)
const viewingDept = ref<DepartmentItem | null>(null)
const deptEmployees = ref<DirectoryItem[]>([])

function getEntId(): string {
  if (props.enterpriseId) return String(props.enterpriseId)
  if (appStore.getEnterpriseId()) return String(appStore.getEnterpriseId())
  const fromStorage = localStorage.getItem('currentEnterprise')
  if (fromStorage) {
    try {
      const parsed = JSON.parse(fromStorage)
      return String(parsed._id || parsed.id || parsed.inn || '')
    } catch {}
  }
  return ''
}

// ─────────────────────────────────────────────────────────────
// УПРАВЛЕНИЕ И УДАЛЕНИЕ ОТДЕЛОВ
// ─────────────────────────────────────────────────────────────
function openAddDepartmentModal() {
  newDeptForm.value = {
    key: '',
    name: '',
    description: ''
  }
  isAddDeptModalOpen.value = true
}

async function saveNewDepartment() {
  const name = String(newDeptForm.value.name || '').trim()
  if (!name) {
    addNotification('warning', 'Укажите название отдела')
    return
  }

  const generatedKey = (
      String(newDeptForm.value.key || '').trim() ||
      name
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
  ).toLowerCase()

  const enterpriseId = getEntId()

  try {
    const saved = await $fetch<DepartmentItem>('/api/directory/departments', {
      method: 'POST',
      body: {
        enterpriseId,
        key: generatedKey,
        name,
        description: newDeptForm.value.description
      }
    })

    const idx = departments.value.findIndex((d) => String(d?.key || '').toLowerCase() === generatedKey)
    if (idx !== -1) {
      departments.value[idx] = saved
    } else {
      departments.value.push(saved)
    }

    localStorage.setItem(`depts_${enterpriseId}`, JSON.stringify(departments.value))
    addNotification('success', `Отдел «${name}» [${generatedKey}] сохранён!`)

    if (itemModalOpen.value) {
      itemForm.value.attributes.department = name
      itemForm.value.departmentKey = generatedKey
      itemForm.value.attributes.departmentKey = generatedKey
    }

    isAddDeptModalOpen.value = false
  } catch {
    const newDept: DepartmentItem = { key: generatedKey, name }
    departments.value.push(newDept)
    localStorage.setItem(`depts_${enterpriseId}`, JSON.stringify(departments.value))
    addNotification('success', `Отдел «${name}» сохранён локально`)
    isAddDeptModalOpen.value = false
  }
}

// Инициализация удаления отдела
function requestDeleteDepartment(dept: DepartmentItem, e?: Event) {
  if (e) e.stopPropagation()
  deptToDelete.value = dept
  deleteDeptModalOpen.value = true
}

// Подтверждение удаления отдела
async function confirmDeleteDepartment() {
  if (!deptToDelete.value) return
  const enterpriseId = getEntId()
  const targetKey = String(deptToDelete.value.key || '').trim().toLowerCase()
  const targetName = String(deptToDelete.value.name || '').trim()

  deletingDeptLoading.value = true
  try {
    await $fetch(`/api/directory/departments/${targetKey}`, {
      method: 'DELETE',
      query: { enterpriseId }
    })

    // Удаляем из локального массива отделов
    departments.value = departments.value.filter(
        (d) => String(d?.key || '').toLowerCase() !== targetKey
    )

    // Обновляем localStorage
    localStorage.setItem(`depts_${enterpriseId}`, JSON.stringify(departments.value))

    // Очищаем привязку в открытой форме, если был выбран этот отдел
    if (itemForm.value.attributes?.department === targetName || itemForm.value.departmentKey === targetKey) {
      itemForm.value.attributes.department = ''
      itemForm.value.departmentKey = ''
      delete itemForm.value.attributes.departmentKey
    }

    // Закрываем модалки инспекции, если был открыт этот же отдел
    if (viewingDept.value?.key === targetKey) {
      deptPeopleModalOpen.value = false
      viewingDept.value = null
    }

    addNotification('success', `Отдел «${targetName}» успешно удалён`)
    deleteDeptModalOpen.value = false
    deptToDelete.value = null

    // Обновляем список записей и сотрудников
    interpolator.invalidateCache()
    await loadItems()
    await loadAllEmployees()
  } catch (err: any) {
    addNotification('error', err?.data?.message || err?.message || 'Не удалось удалить отдел')
  } finally {
    deletingDeptLoading.value = false
  }
}

async function loadDepartments() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  try {
    const list = await $fetch<DepartmentItem[]>('/api/directory/departments', {
      query: { enterpriseId }
    })
    if (Array.isArray(list) && list.length > 0) {
      departments.value = list.filter((item) => Boolean(item && (item.key || item.name)))
      return
    }
  } catch {}

  const saved = localStorage.getItem(`depts_${enterpriseId}`)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        departments.value = parsed.filter((item) => Boolean(item && (item.key || item.name)))
      }
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────
// ПОИСК ЛЮДЕЙ ПО ОТДЕЛУ И БЕЗОПАСНЫЙ ПОДСЧЕТ
// ─────────────────────────────────────────────────────────────
async function loadAllEmployees() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return
  try {
    const res = await $fetch<DirectoryItem[]>('/api/directory/items', {
      query: { enterpriseId, directorySlug: 'departments' }
    })
    allEmployeesList.value = Array.isArray(res) ? res : []
  } catch {}
}

function getDepartmentHeadcount(dept: DepartmentItem | undefined | null): number {
  if (!dept) return 0

  const targetKey = String(dept.key ?? '').trim().toLowerCase()
  const targetName = String(dept.name ?? '').trim().toLowerCase()

  if (!targetKey && !targetName) return 0

  return (allEmployeesList.value || []).filter((emp) => {
    if (!emp) return false
    const attrs = emp.attributes || {}
    const empDept = String(attrs.department ?? '').trim().toLowerCase()
    const empDeptKey = String(attrs.departmentKey ?? '').trim().toLowerCase()

    const matchByKey = Boolean(targetKey && empDeptKey === targetKey)
    const matchByName = Boolean(targetName && empDept === targetName)

    return matchByKey || matchByName
  }).length
}

function inspectDepartmentPeople(dept: DepartmentItem | undefined | null) {
  if (!dept) return
  viewingDept.value = dept

  const targetKey = String(dept.key ?? '').trim().toLowerCase()
  const targetName = String(dept.name ?? '').trim().toLowerCase()

  deptEmployees.value = (allEmployeesList.value || []).filter((emp) => {
    if (!emp) return false
    const attrs = emp.attributes || {}
    const empDept = String(attrs.department ?? '').trim().toLowerCase()
    const empDeptKey = String(attrs.departmentKey ?? '').trim().toLowerCase()

    const matchByKey = Boolean(targetKey && empDeptKey === targetKey)
    const matchByName = Boolean(targetName && empDept === targetName)

    return matchByKey || matchByName
  })

  deptPeopleModalOpen.value = true
}

// ─────────────────────────────────────────────────────────────
// АВТОПОДСТАНОВКА ПО ID СОТРУДНИКА
// ─────────────────────────────────────────────────────────────
async function handleLookupEmployeeById(targetCode?: string) {
  const codeToLookup = String(targetCode || itemForm.value.code || '').trim()
  if (!codeToLookup) {
    addNotification('warning', 'Сначала введите ID сотрудника')
    return
  }

  const employee = await interpolator.findEmployeeById(codeToLookup)
  if (!employee) {
    addNotification('warning', `Сотрудник с ID «${codeToLookup}» не найден`)
    return
  }

  itemForm.value.title = employee.title || ''

  if (employee.phone) itemForm.value.attributes.phone = employee.phone
  if (employee.role) {
    itemForm.value.attributes.role = employee.role
    itemForm.value.attributes.profession = employee.role
  }
  if (employee.department) {
    itemForm.value.attributes.department = employee.department
    const foundDept = departments.value.find(
        (d) => String(d?.name || '').toLowerCase() === String(employee.department || '').toLowerCase()
    )
    if (foundDept && foundDept.key) {
      itemForm.value.departmentKey = foundDept.key
      itemForm.value.attributes.departmentKey = foundDept.key
    }
  }
  if (employee.raw?.birthDate) {
    itemForm.value.attributes.birthDate = employee.raw.birthDate
  }

  addNotification('info', `Данные «${employee.title}» успешно подставлены!`)
}

async function onCodeFieldBlur() {
  if (String(itemForm.value.code || '').trim() && !String(itemForm.value.title || '').trim()) {
    await handleLookupEmployeeById()
  }
}

watch(
    () => itemForm.value.attributes.department,
    (newDeptName) => {
      if (newDeptName) {
        const cleanTarget = String(newDeptName).toLowerCase()
        const found = departments.value.find((d) => String(d?.name || '').toLowerCase() === cleanTarget)
        if (found && found.key) {
          itemForm.value.departmentKey = found.key
          itemForm.value.attributes.departmentKey = found.key
        }
      }
    }
)

/* Создание нового справочника */
const createDirModalOpen = ref(false)
const newDirForm = ref({
  title: '',
  slug: '',
  aliases: '',
  codeLabel: 'Код / ID',
  titleLabel: 'Наименование',
  fields: [] as FieldSchema[]
})

function addCustomField() {
  newDirForm.value.fields.push({
    key: `field_${Date.now()}`,
    label: '',
    type: 'text',
    span: 1
  })
}

function removeCustomField(idx: number) {
  newDirForm.value.fields.splice(idx, 1)
}

function openCreateDirectoryModal() {
  newDirForm.value = {
    title: '',
    slug: '',
    aliases: '',
    codeLabel: 'ID Сотрудника',
    titleLabel: 'ФИО Сотрудника',
    fields: [
      { key: 'birthDate', label: 'Дата рождения', type: 'date', span: 1 },
      { key: 'phone', label: 'Телефон', type: 'text', span: 1 },
      { key: 'role', label: 'Должность', type: 'text', span: 1 }
    ]
  }
  createDirModalOpen.value = true
}

async function saveNewDirectory() {
  if (!String(newDirForm.value.title || '').trim()) {
    addNotification('warning', 'Укажите название справочника')
    return
  }

  const generatedSlug =
      String(newDirForm.value.slug || '').trim() ||
      String(newDirForm.value.title || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_') ||
      `dir_${Date.now()}`

  const parsedAliases = String(newDirForm.value.aliases || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

  parsedAliases.push(String(newDirForm.value.title || '').trim().toLowerCase())
  parsedAliases.push(generatedSlug.toLowerCase())

  const enterpriseId = getEntId()
  try {
    await $fetch('/api/directory/definitions', {
      method: 'POST',
      body: {
        enterpriseId,
        slug: generatedSlug,
        title: newDirForm.value.title,
        aliases: Array.from(new Set(parsedAliases)),
        codeLabel: newDirForm.value.codeLabel,
        titleLabel: newDirForm.value.titleLabel,
        fields: newDirForm.value.fields
      }
    })

    addNotification('success', `Справочник «${newDirForm.value.title}» создан!`)
    createDirModalOpen.value = false
    await loadDefinitions()
    currentType.value = generatedSlug
  } catch {
    addNotification('error', 'Не удалось сохранить справочник')
  }
}

async function loadDefinitions() {
  const list = await interpolator.fetchDefinitions()
  customDirectories.value = (list || []).map((d) => ({
    label: d.title,
    value: d.slug,
    sticker: 'folder',
    codeLabel: d.codeLabel || 'Код / ID',
    codePlaceholder: '001',
    titleLabel: d.titleLabel || 'Наименование',
    titlePlaceholder: 'Введите значение...',
    groupByKey: d.groupByKey,
    fields: (d.fields || []) as FieldSchema[]
  }))
}

async function loadItems() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  loading.value = true
  try {
    const data = await $fetch<DirectoryItem[]>('/api/directory/items', {
      query: {
        enterpriseId,
        directorySlug: currentType.value,
        search: String(searchQuery.value || '').trim() || undefined
      }
    })
    items.value = Array.isArray(data) ? data : []

    if (currentType.value === 'departments') {
      allEmployeesList.value = items.value
    }

    if (selectedItem.value) {
      selectedItem.value = items.value.find((i) => i._id === selectedItem.value?._id) || items.value[0] || null
    } else if (items.value.length > 0) {
      selectedItem.value = items.value[0]
    }
  } catch {
    addNotification('error', 'Не удалось загрузить записи')
  } finally {
    loading.value = false
  }
}

const groupedSections = computed(() => {
  const groupKey = currentMeta.value.groupByKey
  if (!groupKey) {
    return [{ title: 'Все записи', items: items.value }]
  }

  const map = new Map<string, DirectoryItem[]>()
  for (const item of items.value) {
    const rawVal = item.attributes?.[groupKey]
    const sectionName = rawVal ? String(rawVal) : 'Общее'
    const list = map.get(sectionName) || []
    list.push(item)
    map.set(sectionName, list)
  }

  const result: Array<{ title: string; items: DirectoryItem[] }> = []
  for (const [title, list] of map.entries()) {
    if (selectedSectionFilter.value === 'all' || selectedSectionFilter.value === title) {
      result.push({ title, items: list })
    }
  }
  return result
})

const availableSectionTabs = computed(() => {
  const groupKey = currentMeta.value.groupByKey
  if (!groupKey) return []
  const set = new Set<string>()
  for (const item of items.value) {
    const rawVal = item.attributes?.[groupKey]
    if (rawVal) set.add(String(rawVal))
  }
  return Array.from(set)
})

function initAttributesDefaults(): Record<string, any> {
  const attrs: Record<string, any> = {}
  for (const field of currentMeta.value.fields) {
    if (field.type === 'select' && field.options?.length) {
      attrs[field.key] = field.options[0].value
    } else if (field.type === 'boolean') {
      attrs[field.key] = false
    } else {
      attrs[field.key] = ''
    }
  }
  return attrs
}

function openCreateModal(prefillSection?: string) {
  isEditing.value = false
  editingId.value = null
  const defaults = initAttributesDefaults()

  if (prefillSection && currentMeta.value.groupByKey && prefillSection !== 'all') {
    defaults[currentMeta.value.groupByKey] = prefillSection
  }

  const defaultDept = departments.value[0]?.name || ''
  const defaultKey = departments.value[0]?.key || ''

  itemForm.value = {
    code: '',
    title: '',
    description: '',
    departmentKey: defaultKey,
    attributes: {
      ...defaults,
      department: defaults.department || defaultDept,
      departmentKey: defaultKey
    }
  }
  itemModalOpen.value = true
}

function openEditModal(item: DirectoryItem) {
  isEditing.value = true
  editingId.value = item._id

  const mergedAttrs = { ...initAttributesDefaults(), ...(item.attributes || {}) }
  const deptKey = item.attributes?.departmentKey || ''

  itemForm.value = {
    code: item.code || '',
    title: item.title,
    description: item.description || '',
    departmentKey: deptKey,
    attributes: mergedAttrs
  }
  itemModalOpen.value = true
}

async function saveItem() {
  if (!String(itemForm.value.title || '').trim()) {
    addNotification('warning', `Укажите «${currentMeta.value.titleLabel}»`)
    return
  }

  if (itemForm.value.attributes?.department) {
    const targetDeptName = String(itemForm.value.attributes.department).toLowerCase()
    const d = departments.value.find((x) => String(x?.name || '').toLowerCase() === targetDeptName)
    if (d && d.key) {
      itemForm.value.attributes.departmentKey = d.key
    }
  }

  const enterpriseId = getEntId()
  try {
    if (isEditing.value && editingId.value) {
      await $fetch(`/api/directory/items/${editingId.value}`, {
        method: 'PATCH',
        body: itemForm.value
      })
      addNotification('success', 'Запись обновлена')
    } else {
      await $fetch('/api/directory/items', {
        method: 'POST',
        body: {
          enterpriseId,
          directorySlug: currentType.value,
          ...itemForm.value
        }
      })
      addNotification('success', 'Запись сохранена')
    }
    itemModalOpen.value = false
    interpolator.invalidateCache(currentType.value)
    await loadItems()
    await loadAllEmployees()
  } catch {
    addNotification('error', 'Ошибка сохранения записи')
  }
}

async function syncEnterpriseData() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  syncing.value = true
  try {
    const res = await $fetch<{ success: boolean; importedCount: number }>('/api/directory/enterprise-sync', {
      method: 'POST',
      body: { enterpriseId }
    })
    addNotification('success', `Синхронизировано: ${res.importedCount}`)
    await loadItems()
    await loadAllEmployees()
  } catch {
    addNotification('error', 'Ошибка синхронизации')
  } finally {
    syncing.value = false
  }
}

function requestDelete(item: DirectoryItem) {
  itemToDelete.value = item
  deleteModalOpen.value = true
}

async function confirmDelete() {
  if (!itemToDelete.value) return
  try {
    await $fetch(`/api/directory/items/${itemToDelete.value._id}`, { method: 'DELETE' })
    addNotification('success', 'Запись удалена')
    deleteModalOpen.value = false
    if (selectedItem.value?._id === itemToDelete.value._id) {
      selectedItem.value = null
    }
    interpolator.invalidateCache(currentType.value)
    itemToDelete.value = null
    await loadItems()
    await loadAllEmployees()
  } catch {
    addNotification('error', 'Не удалось удалить запись')
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const q = String(searchQuery.value || '').trim().toLowerCase()
    if (q) {
      const matchingDept = departments.value.find(
          (d) => String(d?.key || '').toLowerCase() === q || `dept:${String(d?.key || '').toLowerCase()}` === q
      )
      if (matchingDept?.name) {
        searchQuery.value = matchingDept.name
      }
    }
    loadItems()
  }, 250)
})

watch(currentType, () => {
  selectedItem.value = null
  selectedSectionFilter.value = 'all'
  searchQuery.value = ''
  loadItems()
})

onMounted(async () => {
  await loadDepartments()
  await loadDefinitions()
  await loadItems()
  await loadAllEmployees()
})
</script>

<template>
  <div class="directory-app">
    <header class="directory-header">
      <div class="header-left">
        <MoloSticker :name="currentMeta.sticker" :size="16" glow />
        <span class="header-title">Справочник:</span>
        <div class="type-select-wrap">
          <UIMoloSelect
              v-model="currentType"
              compact
              :parent="directoryTypes"
              children="label"
              valueKey="value"
          />
        </div>
        <section class="btn-group">
          <UIMoloButton
              class="small"
              title="Добавить новый отдел с ключом"
              @click="openAddDepartmentModal"
          >
            + Отдел
          </UIMoloButton>
          <UIMoloButton class="small confirm" title="Создать новый справочник" @click="openCreateDirectoryModal">
            + Справочник
          </UIMoloButton>
        </section>
      </div>

      <div class="header-right">
        <div class="search-box">
          <UIMoloInput
              v-model="searchQuery"
              compact
              placeholder="Поиск по ФИО, ID, ключу отдела..."
          />
        </div>
        <section class="btn-group">
          <UIMoloButton
              v-if="currentType === 'departments' || currentType === 'bank_accounts'"
              class="small"
              :disabled="syncing"
              :loading="syncing"
              @click="syncEnterpriseData"
          >
            {{ syncing ? 'Синхронизация...' : 'Синхронизировать' }}
          </UIMoloButton>
          <UIMoloButton class="small confirm" @click="openCreateModal()">
            Добавить
          </UIMoloButton>
        </section>
      </div>
    </header>

    <!-- Полоса реестра отделов с ключами, подсчетом и кнопкой удаления -->
    <div class="departments-quick-strip">
      <span class="strip-label">Отделы:</span>
      <div class="dept-chips-list">
        <div
            v-for="dept in validDepartments"
            :key="dept.key || dept.name"
            class="dept-chip"
            :title="`Ключ отдела: [${dept.key}]. Нажмите для просмотра людей.`"
            @click="inspectDepartmentPeople(dept)"
        >
          <span class="dept-name">{{ dept.name }}</span>
          <span class="dept-key-badge">{{ dept.key }}</span>
          <span class="dept-count-badge">{{ getDepartmentHeadcount(dept) }} чел.</span>
        </div>
      </div>
    </div>

    <!-- Полоса фильтрации по секциям справочника -->
    <div v-if="availableSectionTabs.length > 1" class="sections-filter-bar">
      <button
          class="section-tab-btn"
          :class="{ active: selectedSectionFilter === 'all' }"
          @click="selectedSectionFilter = 'all'"
      >
        Все категории ({{ items.length }})
      </button>
      <button
          v-for="tab in availableSectionTabs"
          :key="tab"
          class="section-tab-btn"
          :class="{ active: selectedSectionFilter === tab }"
          @click="selectedSectionFilter = tab"
      >
        {{ tab }}
      </button>
    </div>

    <main class="directory-body">
      <section class="items-list-pane">
        <UIMoloLoaders v-if="loading" wndLoader />

        <div v-else-if="items.length === 0" class="empty-placeholder">
          <MoloSticker :name="currentMeta.sticker || 'folder'" :size="36" glow />
          <span>В справочнике «{{ currentMeta.label }}» еще нет записей</span>
          <UIMoloButton class="small confirm" @click="openCreateModal()">
            Добавить первую запись
          </UIMoloButton>
        </div>

        <div v-else class="sections-container">
          <div
              v-for="section in groupedSections"
              :key="section.title"
              class="directory-section-block"
          >
            <div class="section-header-row">
              <div class="section-title-wrap">
                <span class="section-title">{{ section.title }}</span>
                <span class="section-badge">{{ section.items.length }}</span>
              </div>
              <button
                  class="section-quick-add"
                  title="Добавить в эту группу"
                  @click="openCreateModal(section.title)"
              >
                + добавить запись
              </button>
            </div>

            <div class="items-grid">
              <div
                  v-for="item in section.items"
                  :key="item._id"
                  class="directory-item-card"
                  :class="{ active: selectedItem?._id === item._id }"
                  @click="selectedItem = item"
                  @dblclick="openEditModal(item)"
              >
                <div class="card-head">
                  <div class="user-inline-wrap">
                    <div class="user-dot">{{ (item.title || 'С')[0].toUpperCase() }}</div>
                    <span class="item-title" :title="item.title">{{ item.title }}</span>
                  </div>
                  <span v-if="item.code" class="badge-pill">ID: {{ item.code }}</span>
                </div>

                <div class="card-badges">
                  <span v-if="item.attributes?.department" class="badge-pill dept-pill">
                    {{ item.attributes.department }}
                    <small v-if="item.attributes?.departmentKey">[{{ item.attributes.departmentKey }}]</small>
                  </span>

                  <span
                      v-for="field in currentMeta.fields.filter((f) => f.key !== 'department').slice(0, 2)"
                      :key="field.key"
                      class="badge-pill"
                  >
                    <small>{{ field.label }}:</small>
                    {{ item.attributes?.[field.key] || '—' }}
                  </span>
                </div>

                <p v-if="item.description" class="item-desc">{{ item.description }}</p>

                <div class="card-actions btn-group">
                  <UIMoloButton class="small icon-action-btn" title="Редактировать" @click.stop="openEditModal(item)">
                    <MoloSticker name="edit" :size="12" />
                  </UIMoloButton>
                  <UIMoloButton class="small close icon-action-btn" title="Удалить" @click.stop="requestDelete(item)">
                    <MoloSticker name="trash" :size="12" />
                  </UIMoloButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Детализация справа -->
      <aside class="item-detail-pane">
        <UIMoloSection>
          <template #header>
            <strong>Карточка: {{ currentMeta.label }}</strong>
          </template>
          <template #main>
            <div v-if="selectedItem" class="detail-content">
              <div class="field-preview">
                <span class="field-label">{{ currentMeta.titleLabel }}</span>
                <span class="field-value highlight">{{ selectedItem.title }}</span>
              </div>

              <div class="field-preview">
                <span class="field-label">{{ currentMeta.codeLabel }}</span>
                <span class="field-value code-mono">{{ selectedItem.code || '—' }}</span>
              </div>

              <div v-if="selectedItem.attributes?.department" class="field-preview">
                <span class="field-label">Привязанный отдел</span>
                <span class="field-value highlight-dept">
                  {{ selectedItem.attributes.department }}
                  <span v-if="selectedItem.attributes?.departmentKey" class="dept-key-tag">
                    ключ: {{ selectedItem.attributes.departmentKey }}
                  </span>
                </span>
              </div>

              <div class="attributes-stack">
                <div
                    v-for="field in currentMeta.fields.filter((f) => f.key !== 'department')"
                    :key="field.key"
                    class="field-preview"
                >
                  <span class="field-label">{{ field.label }}</span>
                  <span class="field-value">
                    <template v-if="field.type === 'boolean'">
                      {{ selectedItem.attributes?.[field.key] ? 'Да' : 'Нет' }}
                    </template>
                    <template v-else>
                      {{ selectedItem.attributes?.[field.key] ?? '—' }}
                    </template>
                  </span>
                </div>
              </div>

              <div class="field-preview">
                <span class="field-label">Примечание</span>
                <p class="field-text">{{ selectedItem.description || 'Нет примечаний' }}</p>
              </div>

              <div class="action-row">
                <UIMoloButton class="small confirm full" @click="openEditModal(selectedItem)">
                  Редактировать запись
                </UIMoloButton>
              </div>
            </div>

            <div v-else class="no-selection">
              <span>Выберите запись слева для просмотра</span>
            </div>
          </template>
        </UIMoloSection>
      </aside>
    </main>

    <!-- Модалка создания/редактирования записи -->
    <UIMoloModal
        v-model="itemModalOpen"
        :title="isEditing ? `Редактирование: ${currentMeta.label}` : `Добавление: ${currentMeta.label}`"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        width="660px"
        @confirm="saveItem"
    >
      <template #body>
        <div class="modal-dynamic-form">
          <div class="form-grid">
            <div class="grid-col col-2 code-lookup-box">
              <div class="input-with-lookup">
                <UIMoloInput
                    v-model="itemForm.code"
                    compact
                    :tLabel="currentMeta.codeLabel"
                    :placeholder="currentMeta.codePlaceholder"
                    @blur="onCodeFieldBlur"
                    @keyup.enter="handleLookupEmployeeById()"
                />
                <UIMoloButton
                    class="small confirm"
                    title="Найти данные сотрудника по ID и подставить"
                    @click="handleLookupEmployeeById()"
                >
                  Подтянуть данные
                </UIMoloButton>
              </div>
            </div>

            <div class="grid-col col-2">
              <UIMoloInput
                  v-model="itemForm.title"
                  compact
                  lRequired
                  :tLabel="currentMeta.titleLabel"
                  :placeholder="currentMeta.titlePlaceholder"
              />
            </div>

            <div class="grid-col col-2 custom-field-group">
              <div class="field-sublabel-row">
                <label class="field-sublabel">Отдел компании / подразделение</label>
                <button type="button" class="btn-text-link" @click="openAddDepartmentModal">
                  + Создать отдел с ключом
                </button>
              </div>
              <div class="dept-select-dual">
                <select v-model="itemForm.attributes.department" class="native-dept-select">
                  <option value="">Без отдела</option>
                  <option v-for="d in validDepartments" :key="d.key || d.name" :value="d.name">
                    {{ d.name }} [ключ: {{ d.key }}]
                  </option>
                </select>
                <span v-if="itemForm.departmentKey" class="selected-key-pill">
                  Ключ: <b>{{ itemForm.departmentKey }}</b>
                </span>
              </div>
            </div>

            <div
                v-for="field in currentMeta.fields.filter((f) => f.key !== 'department')"
                :key="field.key"
                class="grid-col"
                :class="`col-${field.span || 1}`"
            >
              <UIMoloSelect
                  v-if="field.type === 'select'"
                  v-model="itemForm.attributes[field.key]"
                  compact
                  :tLabel="field.label"
                  :parent="field.options || []"
                  children="label"
                  valueKey="value"
              />

              <div v-else-if="field.type === 'date'" class="custom-field-group">
                <label class="field-sublabel">{{ field.label }}</label>
                <input
                    v-model="itemForm.attributes[field.key]"
                    type="date"
                    class="native-date-input"
                />
              </div>

              <div v-else-if="field.type === 'boolean'" class="custom-field-group-check">
                <label class="checkbox-inline">
                  <input
                      v-model="itemForm.attributes[field.key]"
                      type="checkbox"
                  />
                  <span>{{ field.label }}</span>
                </label>
              </div>

              <UIMoloInput
                  v-else
                  v-model="itemForm.attributes[field.key]"
                  compact
                  :type="field.type === 'number' ? 'number' : 'text'"
                  :lRequired="field.required"
                  :tLabel="field.label"
                  :placeholder="field.placeholder || ''"
              />
            </div>

            <div class="grid-col col-2">
              <UIMoloInput
                  v-model="itemForm.description"
                  compact
                  tLabel="Примечание / Дополнительно"
                  placeholder="Заметки по записи..."
              />
            </div>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- Модалка создания нового отдела с КЛЮЧОМ -->
    <UIMoloModal
        v-model="isAddDeptModalOpen"
        title="Создать отдел"
        confirm-text="Сохранить отдел"
        cancel-text="Отмена"
        width="480px"
        @confirm="saveNewDepartment"
    >
      <template #body>
        <div class="dept-create-body">
          <UIMoloInput
              v-model="newDeptForm.name"
              compact
              lRequired
              tLabel="Название отдела"
              placeholder="Например: IT и разработка"
          />
          <UIMoloInput
              v-model="newDeptForm.key"
              compact
              lRequired
              tLabel="Ключ поиска отдела (латиница/код)"
              placeholder="it, dev, sales, acc"
          />
          <UIMoloInput
              v-model="newDeptForm.description"
              compact
              tLabel="Описание"
              placeholder="Задачи и регламент отдела..."
          />
        </div>
      </template>
    </UIMoloModal>

    <!-- Модалка: Кто в отделе и сколько их (с кнопкой удаления) -->
    <UIMoloModal
        v-model="deptPeopleModalOpen"
        :title="`Отдел: ${viewingDept?.name || '—'}`"
        cancel-text="Закрыть"
        width="620px"
    >
      <template #body>
        <div class="dept-inspect-container">
          <div class="dept-summary-card">
            <div>
              <strong style="color: white">Ключ для поиска:</strong> <code>{{ viewingDept?.key || '—' }}</code>
            </div>
            <div class="total-headcount">
              Всего сотрудников: <b>{{ deptEmployees.length }} чел.</b>
            </div>
          </div>

          <div v-if="deptEmployees.length === 0" class="empty-dept-msg">
            В этом отделе пока нет привязанных сотрудников
          </div>

          <div v-else class="dept-employees-list">
            <div
                v-for="emp in deptEmployees"
                :key="emp._id"
                class="emp-mini-card"
            >
              <div class="emp-mini-left">
                <div class="emp-mini-avatar">{{ (emp.title || 'С')[0].toUpperCase() }}</div>
                <div class="emp-mini-info">
                  <span class="emp-name">{{ emp.title }}</span>
                  <span class="emp-meta">
                    <span v-if="emp.code" class="emp-tag">ID: {{ emp.code }}</span>
                    <span v-if="emp.attributes?.role" class="emp-tag role">{{ emp.attributes.role }}</span>
                    <span v-if="emp.attributes?.phone">📞 {{ emp.attributes.phone }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Нижняя панель действий над отделом -->
          <div class="dept-inspect-footer">
            <UIMoloButton
                class="small close"
                title="Удалить этот отдел из реестра"
                @click="requestDeleteDepartment(viewingDept!)"
            >
              Удалить этот отдел
            </UIMoloButton>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- Модалка удаления ЗАПИСИ СПРАВОЧНИКА -->
    <UIMoloModal
        v-model="deleteModalOpen"
        title="Удаление записи"
        :modal-text="`Удалить «${itemToDelete?.title}» из справочника?`"
        confirm-text="Удалить"
        cancel-text="Отмена"
        @confirm="confirmDelete"
        @cancel="itemToDelete = null"
    />

    <!-- Модалка удаления ОТДЕЛА -->
    <UIMoloModal
        v-model="deleteDeptModalOpen"
        title="Удаление отдела"
        :modal-text="`Вы уверены, что хотите удалить отдел «${deptToDelete?.name}» [${deptToDelete?.key}]? У привязанных сотрудников отдел будет сброшен.`"
        confirm-text="Удалить отдел"
        cancel-text="Отмена"
        :loading="deletingDeptLoading"
        @confirm="confirmDeleteDepartment"
        @cancel="deleteDeptModalOpen = false; deptToDelete = null"
    />

    <!-- Конструктор нового справочника -->
    <UIMoloModal
        v-model="createDirModalOpen"
        title="Создать свой справочник"
        confirm-text="Создать"
        cancel-text="Отмена"
        width="720px"
        @confirm="saveNewDirectory"
    >
      <template #body>
        <div class="custom-dir-form">
          <div class="form-grid">
            <div class="grid-col col-2">
              <UIMoloInput
                  v-model="newDirForm.title"
                  compact
                  lRequired
                  tLabel="Название справочника"
                  placeholder="Например: Дни рождения"
              />
            </div>
            <div class="grid-col col-1">
              <UIMoloInput
                  v-model="newDirForm.slug"
                  compact
                  tLabel="Код/Slug латиницей"
                  placeholder="birthdays"
              />
            </div>
            <div class="grid-col col-1">
              <UIMoloInput
                  v-model="newDirForm.aliases"
                  compact
                  tLabel="Синонимы для {@} через запятую"
                  placeholder="ДР, ДниРождения, Birthday"
              />
            </div>
          </div>

          <div class="fields-builder-section">
            <div class="builder-head">
              <strong>Атрибуты (колонки) справочника</strong>
              <button class="add-field-link" @click="addCustomField">+ Добавить колонку</button>
            </div>

            <div v-for="(field, idx) in newDirForm.fields" :key="field.key" class="builder-row">
              <UIMoloInput compact v-model="field.label" placeholder="Название (Дата рождения)" />
              <UIMoloInput compact v-model="field.key" placeholder="birthDate" />
              <select v-model="field.type" class="inline-select">
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="date">Дата</option>
                <option value="boolean">Флаг (Да/Нет)</option>
              </select>
              <UIMoloButton class="close small" @click="removeCustomField(idx)">✕</UIMoloButton>
            </div>
          </div>
        </div>
      </template>
    </UIMoloModal>
  </div>
</template>

<style scoped>
.directory-app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--half_opacity_bg);
  color: #e0e0e0;
  overflow: hidden;
}

.directory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title {
  font-size: 13px;
  font-weight: 700;
  color: #8c8c9e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.type-select-wrap {
  width: 250px;
}

.search-box {
  width: 280px;
}

.departments-quick-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--half_opacity_border);
  overflow-x: auto;
  flex-shrink: 0;
}

.strip-label {
  font-size: 11px;
  text-transform: uppercase;
  color: #8c8c9e;
  font-weight: 600;
}

.dept-chips-list {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dept-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.dept-chip:hover {
  background: rgba(100, 150, 255, 0.15);
  border-color: #6496ff;
}

.dept-chip-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 50%;
  color: #bbb;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: 2px;
}

.dept-chip-del:hover {
  background: #ef4444;
  color: #fff;
}

.dept-key-badge {
  font-family: monospace;
  font-size: 10px;
  background: rgba(100, 150, 255, 0.2);
  color: #8fb1ff;
  padding: 1px 4px;
  border-radius: 3px;
}

.dept-count-badge {
  font-size: 10.5px;
  color: #34d399;
  font-weight: 600;
}

.sections-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.15);
  border-bottom: 1px solid var(--half_opacity_border);
  overflow-x: auto;
  flex-shrink: 0;
}

.section-tab-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  color: #aaa;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.section-tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.section-tab-btn.active {
  background: rgba(100, 150, 255, 0.18);
  border-color: #6496ff;
  color: #fff;
  font-weight: 600;
}

.directory-body {
  flex: 1 1 0%;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.items-list-pane {
  flex: 1 1 0%;
  min-height: 0;
  padding: 14px 16px;
  overflow-y: auto;
  border-right: 1px solid var(--half_opacity_border);
}

.sections-container {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.directory-section-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.3px;
}

.section-badge {
  font-size: 11px;
  background: rgba(100, 150, 255, 0.15);
  color: #8fb1ff;
  padding: 1px 7px;
  border-radius: 10px;
  font-family: monospace;
}

.section-quick-add {
  background: none;
  border: none;
  color: #6496ff;
  font-size: 11.5px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.section-quick-add:hover {
  background: rgba(100, 150, 255, 0.1);
  text-decoration: underline;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.directory-item-card {
  padding: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.15s ease;
}

.directory-item-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(100, 150, 255, 0.4);
}

.directory-item-card.active {
  background: rgba(100, 150, 255, 0.12);
  border-color: #6496ff;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.user-inline-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.user-dot {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #3872ef;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-title {
  font-weight: 600;
  font-size: 13.5px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge-pill {
  font-size: 10.5px;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  color: #9cb3d9;
}

.badge-pill.dept-pill {
  background: rgba(100, 150, 255, 0.12);
  color: #bfdbfe;
}

.badge-pill.dept-pill small {
  color: #60a5fa;
  font-family: monospace;
}

.item-desc {
  margin: 0;
  font-size: 11.5px;
  color: #7b7b8f;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}

.item-detail-pane {
  width: 340px;
  flex-shrink: 0;
  padding: 14px;
  overflow-y: auto;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attributes-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.field-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field-label {
  font-size: 10.5px;
  color: #7b7b8f;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-value {
  font-size: 13px;
  color: #d1d5db;
  word-break: break-word;
}

.field-value.highlight {
  font-weight: 700;
  font-size: 15px;
  color: #fff;
}

.highlight-dept {
  color: #93c5fd;
  font-weight: 600;
}

.dept-key-tag {
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  color: #aaa;
  font-family: monospace;
}

.field-value.code-mono {
  font-family: monospace;
  color: #8fb1ff;
}

.field-text {
  margin: 0;
  font-size: 12px;
  color: #a0a0b0;
  line-height: 1.4;
  white-space: pre-wrap;
}

.empty-placeholder,
.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #7b7b8f;
  text-align: center;
  font-size: 13px;
  height: 100%;
}

.modal-dynamic-form {
  padding: 4px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.grid-col.col-1 {
  grid-column: span 1;
}

.grid-col.col-2 {
  grid-column: span 2;
}

.input-with-lookup {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.input-with-lookup :deep(.input-container) {
  flex: 1;
}

.dept-select-dual {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-key-pill {
  font-size: 11.5px;
  color: #93c5fd;
  white-space: nowrap;
  font-family: monospace;
}

.custom-field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-sublabel-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-sublabel {
  font-size: 12px;
  color: #8c8c9e;
}

.btn-text-link {
  background: none;
  border: none;
  color: #6496ff;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

.btn-text-link:hover {
  text-decoration: underline;
}

.native-dept-select,
.native-date-input {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--half_opacity_border);
  color: #fff;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  width: 100%;
}

.native-dept-select option {
  background: #1e1e24;
  color: #fff;
}

.native-dept-select:focus,
.native-date-input:focus {
  border-color: #6496ff;
}

.custom-field-group-check {
  display: flex;
  align-items: center;
  height: 100%;
  padding-top: 18px;
}

.checkbox-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #ddd;
}

.custom-dir-form,
.dept-create-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dept-inspect-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dept-summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid var(--half_opacity_border);
  font-size: 13px;
}

.dept-summary-card code {
  color: #8fb1ff;
  background: rgba(100, 150, 255, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.total-headcount {
  color: white;
}

.total-headcount b {
  color: #34d399;
  font-size: 14px;
}

.empty-dept-msg {
  padding: 20px;
  text-align: center;
  color: #8c8c9e;
  font-size: 13px;
}

.dept-employees-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 350px;
  overflow-y: auto;
}

.emp-mini-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
}

.emp-mini-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.emp-mini-avatar {
  width: 28px;
  height: 28px;
  background: #3872ef;
  color: #fff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
}

.emp-mini-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.emp-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.emp-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #8c8c9e;
}

.emp-tag {
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
}

.emp-tag.role {
  color: #93c5fd;
}

.dept-inspect-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.fields-builder-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 12px;
}

.builder-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #a0a0b0;
}

.add-field-link {
  background: none;
  border: none;
  color: #6496ff;
  font-size: 12px;
  cursor: pointer;
}

.builder-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-select {
  background: #222;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 6px 10px;
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
}

.full {
  width: 100%;
}
</style>