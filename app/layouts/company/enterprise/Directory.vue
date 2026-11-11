<!-- components/directory/Directory.vue -->
<script lang="ts" setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '~~/stores/appStore'
import { buildAuthHeaders } from '~~/server/utils/authContext'
import { useDirectoryInterpolator } from '~/composables/useDirectoryInterpolator'
import { useLogger } from '~/composables/useLogger'
import { useNotifications } from '~/composables/useNotifications'

type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'file' | 'link'

interface FieldOption {
  label: string
  value: string | number
}

interface FieldSchema {
  key: string
  label: string
  placeholder?: string
  required?: boolean
  type?: FieldType
  options?: FieldOption[]
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
  isCustom?: boolean
}

interface DepartmentItem {
  _id?: string
  key: string
  name: string
  description?: string
}

interface DirectoryItem {
  _id: string
  code: string
  title: string
  description?: string
  parentId?: string | null
  attributes: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

const props = defineProps<{
  enterpriseId?: string
  windowId?: string
}>()

const appStore = useAppStore()
const interpolator = useDirectoryInterpolator()
const { addNotification } = useNotifications('Справочники')
const { addLog } = useLogger('Справочники')

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const BASE_CONFIG: Record<string, DirectoryMeta> = {
  departments: {
    label: 'Сотрудники',
    value: 'departments',
    sticker: 'departments',
    codeLabel: 'Табельный номер / ID',
    codePlaceholder: 'EMP-001',
    titleLabel: 'ФИО сотрудника',
    titlePlaceholder: 'Иванов Иван Иванович',
    groupByKey: 'department',
    fields: [
      { key: 'avatar', label: 'Фотография', type: 'file' },
      { key: 'department', label: 'Отдел', type: 'select', options: [] },
      { key: 'role', label: 'Должность', placeholder: 'Ведущий инженер' },
      { key: 'phone', label: 'Телефон', placeholder: '+7 (999) 000-00-00' },
      { key: 'birthDate', label: 'Дата рождения', type: 'date' },
      { key: 'isProbation', label: 'Испытательный срок', type: 'boolean' }
    ]
  },
  counterparties: {
    label: 'Контрагенты',
    value: 'counterparties',
    sticker: 'counterparties',
    codeLabel: 'ИНН',
    codePlaceholder: '7701234567',
    titleLabel: 'Наименование / ФИО',
    titlePlaceholder: 'ООО «Компания»',
    fields: [
      { key: 'logo', label: 'Логотип / Документ', type: 'file' },
      { key: 'website', label: 'Веб-сайт', type: 'link', placeholder: 'https://example.com' },
      { key: 'kpp', label: 'КПП', placeholder: '770101001' },
      { key: 'phone', label: 'Телефон', placeholder: '+7...' },
      { key: 'isVerified', label: 'Проверен', type: 'boolean' }
    ]
  },
  bank_accounts: {
    label: 'Банковские счета',
    value: 'bank_accounts',
    sticker: 'bank',
    codeLabel: 'БИК банка',
    codePlaceholder: '044525225',
    titleLabel: 'Наименование банка',
    titlePlaceholder: 'Название банка',
    fields: [
      { key: 'accountNumber', label: 'Расчётный счёт', required: true },
      { key: 'isMain', label: 'Основной счёт', type: 'boolean' }
    ]
  },
  nomenclature: {
    label: 'Номенклатура',
    value: 'nomenclature',
    sticker: 'nomenclature',
    codeLabel: 'Артикул / SKU',
    codePlaceholder: 'ART-001',
    titleLabel: 'Наименование',
    titlePlaceholder: 'Товар или услуга',
    fields: [
      { key: 'photo', label: 'Изображение товара', type: 'file' },
      { key: 'productUrl', label: 'Ссылка на товар', type: 'link', placeholder: 'https://...' },
      { key: 'unit', label: 'Единица измерения', placeholder: 'шт.', required: true },
      { key: 'inStock', label: 'В наличии', type: 'boolean' }
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
    fields: [
      { key: 'sourceUrl', label: 'Источник / Справка', type: 'link', placeholder: 'https://wiki.org/...' }
    ]
  }
}

const currentType = ref('departments')
const loadedDefinitions = ref<any[]>([])
const departments = ref<DepartmentItem[]>([])
const items = ref<DirectoryItem[]>([])
const allEmployeesList = ref<DirectoryItem[]>([])

const loading = ref(false)
const saving = ref(false)
const departmentsLoading = ref(false)
const searchQuery = ref('')
const selectedItem = ref<DirectoryItem | null>(null)
const selectedSectionFilter = ref('all')
const sortMode = ref<'title' | 'newest' | 'oldest'>('title')

const itemModalOpen = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)

const deleteModalOpen = ref(false)
const itemToDelete = ref<DirectoryItem | null>(null)
const deleting = ref(false)

const createDirModalOpen = ref(false)
const editingDefinitionSlug = ref<string | null>(null)
const definitionSaving = ref(false)

const isAddDeptModalOpen = ref(false)
const deleteDeptModalOpen = ref(false)
const deptPeopleModalOpen = ref(false)
const deptToDelete = ref<DepartmentItem | null>(null)
const viewingDept = ref<DepartmentItem | null>(null)
const deptEmployees = ref<DirectoryItem[]>([])
const deletingDeptLoading = ref(false)

const newDeptForm = ref({
  key: '',
  name: '',
  description: ''
})

const newDirForm = ref({
  title: '',
  slug: '',
  aliases: '',
  codeLabel: 'Код / ID',
  titleLabel: 'Наименование',
  fields: [] as FieldSchema[]
})

const itemForm = ref({
  code: '',
  title: '',
  description: '',
  departmentKey: '',
  attributes: {} as Record<string, any>
})

let searchTimer: ReturnType<typeof setTimeout> | null = null

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function getEntId(): string {
  if (props.enterpriseId) return String(props.enterpriseId)
  const storeId = appStore.getEnterpriseId?.()
  if (storeId) return String(storeId)

  if (typeof localStorage === 'undefined') return ''
  const raw = localStorage.getItem('currentEnterprise')
  if (!raw) return ''

  try {
    const parsed = JSON.parse(raw)
    return String(parsed?._id || parsed?.id || parsed?.enterpriseId || '')
  } catch {
    return raw
  }
}

// Заголовки для авторизованных запросов
function getReqHeaders() {
  const entId = getEntId()
  const headers = buildAuthHeaders(appStore.currentUser?._id)
  if (entId) {
    headers['x-enterprise-id'] = entId
  }
  return headers
}

function transliterate(value: string): string {
  const dictionary: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd',
    е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
    о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya'
  }

  return value
      .toLowerCase()
      .split('')
      .map(char => dictionary[char] ?? char)
      .join('')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
}

function normalizeSlug(value: string): string {
  return transliterate(value.trim()).replace(/_+/g, '_')
}

function normalizeKey(value: string): string {
  return transliterate(value.trim()).replace(/^_+|_+$/g, '')
}

function errorMessage(error: any, fallback: string): string {
  return error?.data?.message ||
      error?.response?._data?.message ||
      error?.message ||
      fallback
}

function notifyError(error: any, fallback: string) {
  addNotification('error', errorMessage(error, fallback))
}

function invalidate(slug?: string) {
  interpolator.invalidateCache(slug)
}

function getInitials(value: string): string {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join('')
}

function formatDate(value: any): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function isImageValue(val: any): boolean {
  if (typeof val !== 'string') return false
  return val.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(val)
}

function getItemImage(item: DirectoryItem | null | undefined): string | null {
  if (!item?.attributes) return null
  const attrs = item.attributes

  const standard = attrs.photo || attrs.avatar || attrs.logo || attrs.image || attrs.cover
  if (isImageValue(standard)) return standard

  for (const field of currentMeta.value.fields) {
    if (field.type === 'file' && isImageValue(attrs[field.key])) {
      return attrs[field.key]
    }
  }

  for (const val of Object.values(attrs)) {
    if (isImageValue(val)) return String(val)
  }

  return null
}

function formatUrl(url: any): string {
  if (!url || typeof url !== 'string') return ''
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
}

function displayValue(value: any, field?: FieldSchema): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field?.type === 'boolean') return value ? 'Да' : 'Нет'
  if (field?.type === 'date') return formatDate(value)
  if (field?.type === 'file') {
    if (typeof value === 'string' && value.startsWith('data:')) {
      return 'Прикреплённый файл'
    }
    return String(value)
  }
  if (field?.type === 'link') {
    return String(value)
  }

  if (field?.type === 'select') {
    const option = field.options?.find(opt => String(opt.value) === String(value))
    return option?.label || String(value)
  }

  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function handleFileUpload(e: Event, key: string) {
  const input = e.target as HTMLInputElement
  if (!input.files || !input.files[0]) return

  const file = input.files[0]
  if (file.size > 10 * 1024 * 1024) {
    addNotification('warning', 'Размер файла не должен превышать 10 МБ')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    itemForm.value.attributes[key] = event.target?.result as string
  }
  reader.readAsDataURL(file)
}

function removeFile(key: string) {
  itemForm.value.attributes[key] = ''
}

/* -------------------------------------------------------------------------- */
/* COMPUTED & CONFIG RESOLUTION                                               */
/* -------------------------------------------------------------------------- */

const departmentOptions = computed(() =>
    departments.value.map(dept => ({
      label: dept.name,
      value: dept.name
    }))
)

// Собираем полную конфигурацию всех справочников (базовые + кастомные)
// При этом данные из БД ПЕРЕКРЫВАЮТ дефолтные поля BASE_CONFIG
const allConfigs = computed<Record<string, DirectoryMeta>>(() => {
  const result: Record<string, DirectoryMeta> = {}

  // 1. Сначала кладем базовые
  for (const [slug, baseMeta] of Object.entries(BASE_CONFIG)) {
    result[slug] = {
      ...baseMeta,
      fields: baseMeta.fields.map(f => f.key === 'department' ? { ...f, options: departmentOptions.value } : { ...f })
    }
  }

  // 2. Накладываем всё, что сохранено в БД (включая обновленные базовые справочники!)
  for (const def of loadedDefinitions.value) {
    const slug = def.slug
    const base = BASE_CONFIG[slug]

    const fields = (def.fields || []).map((f: any) => {
      const fieldObj: FieldSchema = {
        key: f.key,
        label: f.label,
        type: f.type || 'text',
        required: Boolean(f.required),
        placeholder: f.placeholder || '',
        span: Number(f.span) === 2 ? 2 : 1,
        options: f.key === 'department' ? departmentOptions.value : (f.options || [])
      }
      return fieldObj
    })

    result[slug] = {
      label: def.title || base?.label || slug,
      value: slug,
      sticker: base?.sticker || def.icon || 'folder',
      codeLabel: def.codeLabel || base?.codeLabel || 'Код / ID',
      codePlaceholder: base?.codePlaceholder || '001',
      titleLabel: def.titleLabel || base?.titleLabel || 'Наименование',
      titlePlaceholder: base?.titlePlaceholder || 'Введите значение',
      groupByKey: def.groupByKey ?? base?.groupByKey,
      fields,
      isCustom: !base
    }
  }

  return result
})

const currentMeta = computed(() =>
    allConfigs.value[currentType.value] || allConfigs.value.departments
)

const directoryTypes = computed(() => Object.values(allConfigs.value))
const isEmployeeDirectory = computed(() => currentType.value === 'departments')

const visibleFields = computed(() =>
    currentMeta.value.fields.filter(field =>
        !(isEmployeeDirectory.value && field.key === 'department')
    )
)

const filteredItems = computed(() => {
  let result = [...items.value]

  if (selectedSectionFilter.value !== 'all' && currentMeta.value.groupByKey) {
    result = result.filter(item =>
        String(item.attributes?.[currentMeta.value.groupByKey!] || 'Общее') === selectedSectionFilter.value
    )
  }

  const query = searchQuery.value.trim().toLocaleLowerCase('ru')
  if (query) {
    result = result.filter(item => {
      const values = [
        item.title,
        item.code,
        item.description,
        ...Object.values(item.attributes || {})
      ]
      return values.some(val =>
          String(val ?? '').toLocaleLowerCase('ru').includes(query)
      )
    })
  }

  if (sortMode.value === 'title') {
    result.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  } else if (sortMode.value === 'newest') {
    result.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
  } else {
    result.sort((a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    )
  }

  return result
})

const availableSectionTabs = computed(() => {
  const key = currentMeta.value.groupByKey
  if (!key) return []

  return [...new Set(items.value.map(item =>
      String(item.attributes?.[key] || 'Общее')
  ))].sort((a, b) => a.localeCompare(b, 'ru'))
})

const totalEmployees = computed(() => allEmployeesList.value.length)
const selectedDepartmentCount = computed(() =>
    viewingDept.value ? getDepartmentHeadcount(viewingDept.value) : 0
)
const customDirectoryCount = computed(() =>
    Object.values(allConfigs.value).filter(d => d.isCustom).length
)
const directoryCounts = computed(() => ({
  total: items.value.length,
  filtered: filteredItems.value.length
}))

/* -------------------------------------------------------------------------- */
/* API CALLS & ACTIONS                                                        */
/* -------------------------------------------------------------------------- */

async function loadDepartments() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  departmentsLoading.value = true
  try {
    const result = await $fetch<DepartmentItem[]>('/api/directory/departments', {
      headers: getReqHeaders(),
      query: { enterpriseId }
    })
    departments.value = Array.isArray(result)
        ? result.filter(item => item && (item.key || item.name))
        : []
  } catch (error: any) {
    departments.value = []
    addLog('error', `Ошибка загрузки отделов: ${errorMessage(error, 'Неизвестная ошибка')}`)
  } finally {
    departmentsLoading.value = false
  }
}

async function loadAllEmployees() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  try {
    const result = await $fetch<DirectoryItem[]>('/api/directory/items', {
      headers: getReqHeaders(),
      query: { enterpriseId, directorySlug: 'departments' }
    })
    allEmployeesList.value = Array.isArray(result) ? result : []
  } catch (error: any) {
    addLog('warning', `Не удалось загрузить сотрудников: ${errorMessage(error, 'Ошибка')}`)
  }
}

function getDepartmentHeadcount(dept: DepartmentItem | null | undefined): number {
  if (!dept) return 0
  const key = String(dept.key || '').trim().toLowerCase()
  const name = String(dept.name || '').trim().toLowerCase()

  return allEmployeesList.value.filter(employee => {
    const attrs = employee.attributes || {}
    const empKey = String(attrs.departmentKey || (employee as any).departmentKey || '').trim().toLowerCase()
    const empDept = String(attrs.department || '').trim().toLowerCase()

    return (empKey && empKey === key) || (empDept && empDept === name)
  }).length
}

function inspectDepartmentPeople(dept: DepartmentItem) {
  viewingDept.value = dept
  deptEmployees.value = allEmployeesList.value.filter(employee => {
    const attrs = employee.attributes || {}
    return (
        String(attrs.departmentKey || '').toLowerCase() === String(dept.key || '').toLowerCase() ||
        String(attrs.department || '').toLowerCase() === String(dept.name || '').toLowerCase()
    )
  })
  deptPeopleModalOpen.value = true
}

function openAddDepartmentModal() {
  newDeptForm.value = { key: '', name: '', description: '' }
  isAddDeptModalOpen.value = true
}

async function saveNewDepartment() {
  const name = newDeptForm.value.name.trim()
  if (!name) {
    addNotification('warning', 'Укажите название отдела')
    return
  }

  const key = normalizeKey(newDeptForm.value.key || name)
  if (!key) {
    addNotification('warning', 'Не удалось сформировать ключ отдела')
    return
  }

  const duplicate = departments.value.some(dept =>
      dept.key.toLowerCase() === key ||
      dept.name.toLowerCase() === name.toLowerCase()
  )
  if (duplicate) {
    addNotification('warning', 'Отдел с таким названием или ключом уже существует')
    return
  }

  const enterpriseId = getEntId()
  if (!enterpriseId) {
    addNotification('error', 'Не определено предприятие')
    return
  }

  try {
    const saved = await $fetch<DepartmentItem>('/api/directory/departments', {
      method: 'POST',
      headers: getReqHeaders(),
      body: {
        enterpriseId,
        key,
        name,
        description: newDeptForm.value.description.trim()
      }
    })

    departments.value.push(saved || {
      key,
      name,
      description: newDeptForm.value.description
    })

    isAddDeptModalOpen.value = false
    addNotification('success', `Отдел «${name}» создан`)
    await loadAllEmployees()
  } catch (error: any) {
    notifyError(error, 'Не удалось создать отдел')
  }
}

function requestDeleteDepartment(dept: DepartmentItem) {
  deptToDelete.value = dept
  deleteDeptModalOpen.value = true
}

async function confirmDeleteDepartment() {
  if (!deptToDelete.value) return
  const dept = deptToDelete.value
  const enterpriseId = getEntId()

  deletingDeptLoading.value = true
  try {
    await $fetch(`/api/directory/departments/${encodeURIComponent(dept.key)}`, {
      method: 'DELETE',
      headers: getReqHeaders(),
      query: { enterpriseId }
    })

    departments.value = departments.value.filter(item => item.key !== dept.key)

    if (itemForm.value.attributes.department === dept.name) {
      itemForm.value.attributes.department = ''
      itemForm.value.departmentKey = ''
      itemForm.value.attributes.departmentKey = ''
    }

    deleteDeptModalOpen.value = false
    deptPeopleModalOpen.value = false
    deptToDelete.value = null

    addNotification('success', `Отдел «${dept.name}» удалён`)
    await Promise.all([
      loadAllEmployees(),
      currentType.value === 'departments' ? loadItems() : Promise.resolve()
    ])
  } catch (error: any) {
    notifyError(error, 'Не удалось удалить отдел')
  } finally {
    deletingDeptLoading.value = false
  }
}

async function loadDefinitions() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  try {
    const res = await $fetch<any[]>('/api/directory/definitions', {
      headers: getReqHeaders(),
      query: { enterpriseId }
    })
    loadedDefinitions.value = Array.isArray(res) ? res : []
  } catch (error: any) {
    addLog('error', `Ошибка загрузки определений: ${errorMessage(error, 'Ошибка')}`)
  }
}

function openCreateDirectoryModal() {
  editingDefinitionSlug.value = null
  newDirForm.value = {
    title: '',
    slug: '',
    aliases: '',
    codeLabel: 'Код / ID',
    titleLabel: 'Наименование',
    fields: [
      { key: 'phone', label: 'Телефон', type: 'text', span: 1 },
      { key: 'website', label: 'Ссылка на ресурс', type: 'link', span: 1 },
      { key: 'photo', label: 'Фотография', type: 'file', span: 1 }
    ]
  }
  createDirModalOpen.value = true
}

function openEditDefinition() {
  const currentSlug = currentType.value
  const config = currentMeta.value
  const def = loadedDefinitions.value.find(d => d.slug === currentSlug)

  editingDefinitionSlug.value = currentSlug
  newDirForm.value = {
    title: config.label,
    slug: currentSlug,
    aliases: (def?.aliases || []).join(', '),
    codeLabel: config.codeLabel,
    titleLabel: config.titleLabel,
    fields: config.fields.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type || 'text',
      required: Boolean(field.required),
      placeholder: field.placeholder || '',
      span: field.span === 2 ? 2 : 1,
      options: field.options ? JSON.parse(JSON.stringify(field.options)) : []
    }))
  }
  createDirModalOpen.value = true
}

function addCustomField() {
  newDirForm.value.fields.push({
    key: '',
    label: '',
    type: 'text',
    required: false,
    span: 1
  })
}

function removeCustomField(index: number) {
  newDirForm.value.fields.splice(index, 1)
}

function normalizeFields(): FieldSchema[] | null {
  const keys = new Set<string>()
  const fields: FieldSchema[] = []

  for (const field of newDirForm.value.fields) {
    const label = String(field.label || '').trim()
    const key = normalizeKey(field.key || label)

    if (!label) {
      addNotification('warning', 'У каждой колонки должно быть название')
      return null
    }
    if (!key) {
      addNotification('warning', `Не удалось сформировать ключ поля «${label}»`)
      return null
    }
    if (['code', 'title', 'description', 'attributes', '_id'].includes(key)) {
      addNotification('warning', `Ключ «${key}» зарезервирован системой`)
      return null
    }
    if (keys.has(key)) {
      addNotification('warning', `Поле «${key}» повторяется`)
      return null
    }

    keys.add(key)
    fields.push({
      ...field,
      key,
      label,
      type: field.type || 'text',
      span: field.span === 2 ? 2 : 1,
      required: Boolean(field.required)
    })
  }

  return fields
}

async function saveNewDirectory() {
  const title = newDirForm.value.title.trim()
  const slug = normalizeSlug(newDirForm.value.slug || title)

  if (!title) {
    addNotification('warning', 'Укажите название справочника')
    return
  }
  if (!slug) {
    addNotification('warning', 'Не удалось сформировать системный ключ')
    return
  }

  const fields = normalizeFields()
  if (!fields) return

  const enterpriseId = getEntId()
  if (!enterpriseId) {
    addNotification('error', 'Не определено предприятие')
    return
  }

  const aliases = new Set(
      newDirForm.value.aliases
          .split(',')
          .map(val => val.trim().toLowerCase())
          .filter(Boolean)
  )
  aliases.add(title.toLowerCase())
  aliases.add(slug.toLowerCase())

  definitionSaving.value = true
  try {
    await $fetch('/api/directory/definitions', {
      method: 'POST',
      headers: getReqHeaders(),
      query: { enterpriseId },
      body: {
        enterpriseId,
        slug,
        title,
        aliases: Array.from(aliases),
        codeLabel: newDirForm.value.codeLabel.trim() || 'Код / ID',
        titleLabel: newDirForm.value.titleLabel.trim() || 'Наименование',
        fields
      }
    })

    await loadDefinitions()
    invalidate(slug)

    currentType.value = slug
    createDirModalOpen.value = false
    addNotification('success', `Справочник «${title}» сохранён`)
  } catch (error: any) {
    notifyError(error, 'Не удалось сохранить справочник')
  } finally {
    definitionSaving.value = false
  }
}

function initAttributesDefaults(): Record<string, any> {
  const attributes: Record<string, any> = {}
  for (const field of currentMeta.value.fields) {
    if (field.type === 'boolean') {
      attributes[field.key] = false
    } else if (field.type === 'select') {
      attributes[field.key] = field.options?.[0]?.value ?? ''
    } else {
      attributes[field.key] = ''
    }
  }
  return attributes
}

async function loadItems() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  loading.value = true
  try {
    const result = await $fetch<DirectoryItem[]>('/api/directory/items', {
      headers: getReqHeaders(),
      query: {
        enterpriseId,
        directorySlug: currentType.value,
        search: searchQuery.value.trim() || undefined
      }
    })
    items.value = Array.isArray(result) ? result : []

    if (selectedItem.value) {
      selectedItem.value =
          items.value.find(item => item._id === selectedItem.value?._id) || null
    }
  } catch (error: any) {
    items.value = []
    notifyError(error, 'Не удалось загрузить записи')
  } finally {
    loading.value = false
  }
}

function openCreateModal(section?: string) {
  isEditing.value = false
  editingId.value = null

  const attributes = initAttributesDefaults()
  if (section && section !== 'all' && currentMeta.value.groupByKey) {
    attributes[currentMeta.value.groupByKey] = section
  }

  itemForm.value = {
    code: '',
    title: '',
    description: '',
    departmentKey: '',
    attributes
  }
  itemModalOpen.value = true
}

function openEditModal(item: DirectoryItem) {
  isEditing.value = true
  editingId.value = item._id

  const deptKey = item.attributes?.departmentKey || (item as any).departmentKey || ''
  let deptName = item.attributes?.department || ''

  if (!deptName && deptKey) {
    const found = departments.value.find(d => d.key === deptKey)
    if (found) deptName = found.name
  }

  itemForm.value = {
    code: item.code || '',
    title: item.title || '',
    description: item.description || '',
    departmentKey: deptKey,
    attributes: {
      ...initAttributesDefaults(),
      ...(item.attributes || {}),
      department: deptName,
      departmentKey: deptKey
    }
  }
  itemModalOpen.value = true
}

function validateItem(): boolean {
  if (!itemForm.value.title.trim()) {
    addNotification('warning', `Укажите «${currentMeta.value.titleLabel}»`)
    return false
  }

  for (const field of currentMeta.value.fields) {
    if (!field.required) continue
    const value = itemForm.value.attributes[field.key]
    if (value === null || value === undefined || String(value).trim() === '') {
      addNotification('warning', `Заполните обязательное поле «${field.label}»`)
      return false
    }
  }

  return true
}

async function saveItem() {
  if (saving.value || !validateItem()) return

  const enterpriseId = getEntId()
  if (!enterpriseId) {
    addNotification('error', 'Не определено предприятие')
    return
  }

  const attributes = { ...itemForm.value.attributes }
  let targetDeptKey = itemForm.value.departmentKey || attributes.departmentKey || ''

  if (isEmployeeDirectory.value) {
    if (attributes.department) {
      const selectedDept = departments.value.find(item =>
          item.name.toLowerCase() === String(attributes.department).toLowerCase() ||
          item.key.toLowerCase() === String(attributes.department).toLowerCase()
      )
      if (selectedDept) {
        targetDeptKey = selectedDept.key
        attributes.department = selectedDept.name
        attributes.departmentKey = selectedDept.key
      }
    } else {
      targetDeptKey = ''
      attributes.department = ''
      attributes.departmentKey = ''
    }
  }

  const payload = {
    enterpriseId,
    directorySlug: currentType.value,
    code: itemForm.value.code.trim(),
    title: itemForm.value.title.trim(),
    description: itemForm.value.description.trim(),
    attributes,
    departmentKey: targetDeptKey
  }

  saving.value = true
  try {
    if (isEditing.value && editingId.value) {
      await $fetch(`/api/directory/items/${encodeURIComponent(editingId.value)}`, {
        method: 'PATCH',
        headers: getReqHeaders(),
        query: { enterpriseId },
        body: payload
      })
    } else {
      await $fetch('/api/directory/items', {
        method: 'POST',
        headers: getReqHeaders(),
        query: { enterpriseId },
        body: payload
      })
    }

    itemModalOpen.value = false
    selectedItem.value = null
    invalidate(currentType.value)

    addNotification('success', isEditing.value ? 'Запись обновлена' : 'Запись создана')
    await loadItems()

    if (isEmployeeDirectory.value) {
      await loadAllEmployees()
    }
  } catch (error: any) {
    notifyError(error, 'Не удалось сохранить запись')
  } finally {
    saving.value = false
  }
}

function requestDelete(item: DirectoryItem) {
  itemToDelete.value = item
  deleteModalOpen.value = true
}

async function confirmDelete() {
  if (!itemToDelete.value || deleting.value) return
  const item = itemToDelete.value
  const enterpriseId = getEntId()

  deleting.value = true
  try {
    await $fetch(`/api/directory/items/${encodeURIComponent(item._id)}`, {
      method: 'DELETE',
      headers: getReqHeaders(),
      query: { enterpriseId, directorySlug: currentType.value }
    })

    if (selectedItem.value?._id === item._id) {
      selectedItem.value = null
    }

    deleteModalOpen.value = false
    itemToDelete.value = null
    invalidate(currentType.value)

    addNotification('success', 'Запись удалена')
    await loadItems()

    if (isEmployeeDirectory.value) {
      await loadAllEmployees()
    }
  } catch (error: any) {
    notifyError(error, 'Не удалось удалить запись')
  } finally {
    deleting.value = false
  }
}

function getFieldOptions(field: FieldSchema): FieldOption[] {
  if (field.key === 'department') return departmentOptions.value
  return field.options || []
}

function addSelectOption(field: FieldSchema) {
  if (!field.options) field.options = []
  const index = field.options.length + 1
  field.options.push({
    label: `Вариант ${index}`,
    value: `option_${index}`
  })
}

function removeSelectOption(field: FieldSchema, index: number) {
  field.options?.splice(index, 1)
}

watch(
    () => itemForm.value.attributes.department,
    value => {
      if (!value) {
        itemForm.value.departmentKey = ''
        itemForm.value.attributes.departmentKey = ''
        return
      }
      const department = departments.value.find(item =>
          item.name.toLowerCase() === String(value).toLowerCase() ||
          item.key.toLowerCase() === String(value).toLowerCase()
      )
      if (department) {
        itemForm.value.departmentKey = department.key
        itemForm.value.attributes.departmentKey = department.key
      }
    }
)

watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadItems()
  }, 250)
})

watch(currentType, async () => {
  selectedItem.value = null
  selectedSectionFilter.value = 'all'
  searchQuery.value = ''
  await loadItems()
})

onMounted(async () => {
  addLog('info', 'Инициализация справочников MoloFlow')
  await Promise.all([
    loadDepartments(),
    loadDefinitions(),
    loadAllEmployees()
  ])
  await loadItems()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="directory-app">
    <!-- HEADER -->
    <header class="directory-header">
      <div class="header-main">
        <div class="header-icon">
          <UIMoloSticker name="folder" :size="19" glow />
        </div>

        <div class="header-heading">
          <div class="header-title">Справочники</div>
          <div class="header-subtitle">Единое пространство данных предприятия</div>
        </div>
      </div>

      <div class="btn-group">
        <UIMoloButton
            class="action small"
            @click="openEditDefinition"
        >
          <UIMoloSticker name="settings" :size="14" />
          Настроить
        </UIMoloButton>

        <UIMoloButton class="action small" @click="openCreateDirectoryModal">
          <UIMoloSticker name="file-plus" :size="15" />
          Новый справочник
        </UIMoloButton>

        <UIMoloButton
            v-if="isEmployeeDirectory"
            class="action small"
            @click="openAddDepartmentModal"
        >
          <UIMoloSticker name="plus" :size="15" />
          Отдел
        </UIMoloButton>

        <UIMoloButton class="confirm small" @click="openCreateModal()">
          <UIMoloSticker name="plus" :size="15" />
          Добавить запись
        </UIMoloButton>
      </div>
    </header>

    <!-- MAIN LAYOUT -->
    <div class="directory-layout">
      <!-- SIDEBAR -->
      <aside class="directory-sidebar">
        <div class="sidebar-section">
          <div class="btn-group column">
            <UIMoloButton
                v-for="config in directoryTypes"
                :key="config.value"
                class="full"
                :class="{ confirm: currentType === config.value, action: currentType !== config.value }"
                @click="currentType = config.value"
            >
              <span class="nav-icon">
                <UIMoloSticker :name="config.sticker" :size="15" />
              </span>
              <span class="nav-label">{{ config.label }}</span>
              <span v-if="currentType === config.value" class="nav-active-indicator" />
            </UIMoloButton>
          </div>
        </div>

        <div class="sidebar-bottom">
          <div class="sidebar-stat">
            <span>Пользовательских справочников</span>
            <b>{{ customDirectoryCount }}</b>
          </div>
        </div>
      </aside>

      <!-- CONTENT -->
      <main class="directory-content">
        <!-- STATISTICS -->
        <section class="stats-row">
          <div class="stat-card">
            <div class="stat-icon"><UIMoloSticker name="database" :size="17" /></div>
            <div class="stat-content">
              <span>Всего записей</span>
              <strong>{{ directoryCounts.total }}</strong>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><UIMoloSticker name="filter" :size="17" /></div>
            <div class="stat-content">
              <span>Отображается</span>
              <strong>{{ directoryCounts.filtered }}</strong>
            </div>
          </div>

          <div v-if="isEmployeeDirectory" class="stat-card">
            <div class="stat-icon"><UIMoloSticker name="users" :size="17" /></div>
            <div class="stat-content">
              <span>Сотрудников</span>
              <strong>{{ totalEmployees }}</strong>
            </div>
          </div>

          <div v-if="isEmployeeDirectory" class="stat-card">
            <div class="stat-icon"><UIMoloSticker name="layers" :size="17" /></div>
            <div class="stat-content">
              <span>Отделов</span>
              <strong>{{ departments.length }}</strong>
            </div>
          </div>
        </section>

        <!-- DEPARTMENTS -->
        <section v-if="isEmployeeDirectory" class="departments-panel">
          <div class="panel-heading">
            <div>
              <strong>Структура предприятия</strong>
              <span>Отделы и распределение сотрудников</span>
            </div>

            <UIMoloButton class="transparent small" @click="openAddDepartmentModal">
              <UIMoloSticker name="plus" :size="13" />
              Создать отдел
            </UIMoloButton>
          </div>

          <div v-if="departmentsLoading" class="department-loading">
            <UIMoloLoaders btnLoader />
            <span>Загрузка отделов...</span>
          </div>

          <div v-else-if="departments.length" class="department-chips">
            <UIMoloButton
                v-for="dept in departments"
                :key="dept.key"
                class="action small"
                @click="inspectDepartmentPeople(dept)"
            >
              <UIMoloSticker name="users" :size="13" />
              <span class="department-chip-name">{{ dept.name }}</span>
              <span class="department-chip-count">{{ getDepartmentHeadcount(dept) }}</span>
            </UIMoloButton>
          </div>

          <div v-else class="departments-empty">
            <span>Отделы пока не созданы.</span>
            <UIMoloButton class="transparent small" @click="openAddDepartmentModal">
              Создать первый отдел
            </UIMoloButton>
          </div>
        </section>

        <!-- TOOLBAR -->
        <section class="table-toolbar">
          <div class="toolbar-left">
            <div class="search-input-wrapper">
              <UIMoloInput
                  v-model="searchQuery"
                  compact
                  placeholder="Поиск по названию, коду и атрибутам..."
              />
              <UIMoloButton
                  v-if="searchQuery"
                  class="transparent small search-clear-btn"
                  title="Очистить поиск"
                  @click="searchQuery = ''"
              >
                <UIMoloSticker name="x" :size="13" />
              </UIMoloButton>
            </div>
          </div>

          <div class="toolbar-right">
            <span class="results-count">
              {{ filteredItems.length }} из {{ items.length }}
            </span>

            <div class="sort-select-wrapper">
              <UIMoloSelect v-model="sortMode" compact>
                <option value="title">По названию</option>
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
              </UIMoloSelect>
            </div>

            <UIMoloButton
                class="action small transparent"
                title="Обновить данные"
                :disabled="loading"
                @click="loadItems"
            >
              <UIMoloSticker name="refresh" :size="14" />
            </UIMoloButton>
          </div>
        </section>

        <!-- GROUP FILTERS -->
        <div v-if="availableSectionTabs.length" class="btn-group group-filters">
          <UIMoloButton
              class="small"
              :class="{ confirm: selectedSectionFilter === 'all', action: selectedSectionFilter !== 'all' }"
              @click="selectedSectionFilter = 'all'"
          >
            Все отделы ({{ items.length }})
          </UIMoloButton>

          <UIMoloButton
              v-for="tab in availableSectionTabs"
              :key="tab"
              class="small"
              :class="{ confirm: selectedSectionFilter === tab, action: selectedSectionFilter !== tab }"
              @click="selectedSectionFilter = tab"
          >
            {{ tab }}
          </UIMoloButton>
        </div>

        <!-- TABLE -->
        <section class="table-container">
          <div v-if="loading" class="table-state">
            <UIMoloLoaders wndLoader />
            <span>Загружаем записи...</span>
          </div>

          <div v-else-if="!filteredItems.length" class="table-state empty-state">
            <div class="empty-icon">
              <UIMoloSticker :name="currentMeta.sticker" :size="30" glow />
            </div>
            <strong>{{ searchQuery ? 'Ничего не найдено' : 'Справочник пока пуст' }}</strong>
            <span>{{ searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Добавьте первую запись, чтобы начать работу' }}</span>
            <UIMoloButton v-if="!searchQuery" class="confirm small" @click="openCreateModal()">
              <UIMoloSticker name="plus" :size="14" />
              Создать запись
            </UIMoloButton>
          </div>

          <div v-else class="directory-table-wrap">
            <table class="directory-table">
              <thead>
              <tr>
                <th class="main-column">{{ currentMeta.titleLabel }}</th>
                <th class="code-column">{{ currentMeta.codeLabel }}</th>

                <th v-for="field in visibleFields.slice(0, 5)" :key="field.key">
                  {{ field.label }}
                </th>

                <th class="actions-column">Действия</th>
              </tr>
              </thead>

              <tbody>
              <tr
                  v-for="item in filteredItems"
                  :key="item._id"
                  :class="{ selected: selectedItem?._id === item._id }"
                  @click="selectedItem = item"
                  @dblclick="openEditModal(item)"
              >
                <td class="main-column">
                  <div class="table-title-cell">
                    <div
                        v-if="getItemImage(item)"
                        class="table-avatar-img"
                    >
                      <img :src="getItemImage(item)!" alt="" />
                    </div>
                    <div v-else class="table-avatar">
                      {{ getInitials(item.title) }}
                    </div>

                    <div class="table-title-info">
                      <strong :title="item.title">{{ item.title }}</strong>
                      <small v-if="item.description">{{ item.description }}</small>
                    </div>
                  </div>
                </td>

                <td class="code-column">
                  <code>{{ item.code || '—' }}</code>
                </td>

                <td v-for="field in visibleFields.slice(0, 5)" :key="field.key">
                  <!-- Ссылка (Link) -->
                  <div v-if="field.type === 'link'" class="link-table-cell">
                    <a
                        v-if="item.attributes?.[field.key]"
                        :href="formatUrl(item.attributes?.[field.key])"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="table-link-btn"
                        @click.stop
                    >
                      <UIMoloSticker name="external-link" :size="12" />
                      <span>{{ item.attributes?.[field.key] }}</span>
                    </a>
                    <span v-else class="cell-empty">—</span>
                  </div>

                  <!-- Файл / Фото -->
                  <div v-else-if="field.type === 'file'" class="file-table-cell">
                    <template v-if="item.attributes?.[field.key]">
                      <img
                          v-if="isImageValue(item.attributes?.[field.key])"
                          :src="item.attributes?.[field.key]"
                          class="table-mini-thumb"
                          alt="preview"
                      />
                      <a
                          v-else
                          :href="item.attributes?.[field.key]"
                          download="file"
                          class="file-dl-link"
                          @click.stop
                      >
                        <UIMoloSticker name="download" :size="12" /> Скачать
                      </a>
                    </template>
                    <span v-else class="cell-empty">—</span>
                  </div>

                  <span
                      v-else-if="field.type === 'boolean'"
                      class="boolean-tag"
                      :class="{ positive: item.attributes?.[field.key] }"
                  >
                    {{ item.attributes?.[field.key] ? 'Да' : 'Нет' }}
                  </span>

                  <span v-else class="table-value">
                    {{ displayValue(item.attributes?.[field.key], field) }}
                  </span>
                </td>

                <td class="actions-column">
                  <div class="btn-group row-actions" @click.stop>
                    <UIMoloButton class="action small" title="Редактировать" @click="openEditModal(item)">
                      <UIMoloSticker name="pen" :size="13" />
                    </UIMoloButton>
                    <UIMoloButton class="close small" title="Удалить" @click="requestDelete(item)">
                      <UIMoloSticker name="trash" :size="13" />
                    </UIMoloButton>
                  </div>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <!-- DETAIL PANEL -->
      <aside class="detail-panel">
        <template v-if="selectedItem">
          <div class="detail-header">
            <div>
              <span class="detail-eyebrow">КАРТОЧКА ЗАПИСИ</span>
              <strong>Информация</strong>
            </div>

            <UIMoloButton class="transparent small" title="Закрыть карточку" @click="selectedItem = null">
              <UIMoloSticker name="x" :size="15" />
            </UIMoloButton>
          </div>

          <div class="detail-identity">
            <div
                v-if="getItemImage(selectedItem)"
                class="detail-avatar-img"
            >
              <img :src="getItemImage(selectedItem)!" alt="" />
            </div>
            <div v-else class="detail-avatar">
              {{ getInitials(selectedItem.title) }}
            </div>

            <strong>{{ selectedItem.title }}</strong>
            <span>{{ selectedItem.code || 'Без кода' }}</span>
          </div>
          <hr />

          <div class="detail-fields">
            <div class="detail-field">
              <span>Наименование</span>
              <strong>{{ selectedItem.title }}</strong>
            </div>

            <div class="detail-field">
              <span>{{ currentMeta.codeLabel }}</span>
              <strong class="mono-value">{{ selectedItem.code || '—' }}</strong>
            </div>

            <div v-for="field in currentMeta.fields" :key="field.key" class="detail-field">
              <span>{{ field.label }}</span>

              <!-- Ссылка в карточке -->
              <div v-if="field.type === 'link'" class="detail-link-box">
                <a
                    v-if="selectedItem.attributes?.[field.key]"
                    :href="formatUrl(selectedItem.attributes?.[field.key])"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="detail-url-link"
                >
                  <UIMoloSticker name="link" :size="13" />
                  <span>{{ selectedItem.attributes?.[field.key] }}</span>
                </a>
                <span v-else class="cell-empty">—</span>
              </div>

              <!-- Файл в карточке -->
              <div v-else-if="field.type === 'file'" class="detail-file-box">
                <template v-if="selectedItem.attributes?.[field.key]">
                  <img
                      v-if="isImageValue(selectedItem.attributes?.[field.key])"
                      :src="selectedItem.attributes?.[field.key]"
                      class="detail-img-preview"
                      alt="Превью"
                  />
                  <div class="file-actions-row">
                    <a
                        :href="selectedItem.attributes?.[field.key]"
                        download="file"
                        class="download-btn-link"
                    >
                      <UIMoloSticker name="download" :size="13" />
                      <span>Скачать файл</span>
                    </a>
                  </div>
                </template>
                <span v-else class="cell-empty">Файл не прикреплён</span>
              </div>

              <strong v-else-if="field.key === 'link'">
                <a
                    :href="selectedItem.attributes?.[field.key]"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="color: var(--accent);"
                >
                  {{ displayValue(selectedItem.attributes?.[field.key], field) }}
                </a>
              </strong>

              <strong v-else>
                {{ displayValue(selectedItem.attributes?.[field.key], field) }}
              </strong>
            </div>

            <div class="detail-field">
              <span>Примечание</span>
              <p>{{ selectedItem.description || 'Нет примечаний' }}</p>
            </div>

            <div class="detail-field">
              <span>Создано</span>
              <strong>{{ formatDate(selectedItem.createdAt) }}</strong>
            </div>
          </div>
          <hr />
          <div class="btn-group column">
            <UIMoloButton class="confirm full" @click="openEditModal(selectedItem)">
              <UIMoloSticker name="pen" :size="14" />
              Редактировать
            </UIMoloButton>

            <UIMoloButton class="close full" @click="requestDelete(selectedItem)">
              <UIMoloSticker name="trash" :size="14" />
              Удалить запись
            </UIMoloButton>
          </div>
        </template>

        <div v-else class="detail-empty">
          <div class="detail-empty-icon">
            <UIMoloSticker name="sidebar" :size="25" />
          </div>
          <strong>Карточка записи</strong>
          <span>Выберите строку в таблице, чтобы посмотреть подробную информацию</span>
        </div>
      </aside>
    </div>

    <!-- ITEM MODAL -->
    <UIMoloModal
        v-model="itemModalOpen"
        :title="isEditing ? 'Редактирование записи' : 'Новая запись'"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        width="700px"
        :loading="saving"
        @confirm="saveItem"
    >
      <template #body>
        <div class="editor-form">
          <div class="editor-section-title">
            <span>Основная информация</span>
          </div>

          <div class="editor-grid">
            <div class="editor-field full">
              <UIMoloInput
                  v-model="itemForm.title"
                  compact
                  lRequired
                  :tLabel="currentMeta.titleLabel"
                  :placeholder="currentMeta.titlePlaceholder"
              />
            </div>

            <div class="editor-field full">
              <UIMoloInput
                  v-model="itemForm.code"
                  compact
                  :tLabel="currentMeta.codeLabel"
                  :placeholder="currentMeta.codePlaceholder"
              />
            </div>

            <div v-if="isEmployeeDirectory" class="editor-field full">
              <div class="dept-select-row">
                <UIMoloSelect
                    v-model="itemForm.attributes.department"
                    compact
                    tLabel="Отдел"
                    all="Без отдела"
                    :parent="departments"
                    children="name"
                    value-key="name"
                />

                <UIMoloButton class="action small dept-add-btn" @click="openAddDepartmentModal">
                  <UIMoloSticker name="plus" :size="13" />
                  Отдел
                </UIMoloButton>
              </div>
            </div>
          </div>

          <div v-if="currentMeta.fields.length" class="editor-section">
            <div class="editor-section-title">
              <span>Дополнительные атрибуты</span>
              <small>{{ currentMeta.fields.length }} полей</small>
            </div>

            <div class="editor-grid">
              <div
                  v-for="field in currentMeta.fields.filter(f => !(isEmployeeDirectory && f.key === 'department'))"
                  :key="field.key"
                  class="editor-field"
                  :class="{ full: field.span === 2 || field.type === 'file' }"
              >
                <!-- Ссылка (URL) -->
                <UIMoloInput
                    v-if="field.type === 'link'"
                    v-model="itemForm.attributes[field.key]"
                    compact
                    :tLabel="field.label"
                    :lRequired="field.required"
                    :placeholder="field.placeholder || 'https://example.com'"
                />

                <!-- Загрузка Файла / Фото -->
                <div v-else-if="field.type === 'file'" class="file-uploader-box">
                  <label class="field-label-text">{{ field.label }} <span v-if="field.required" class="required">*</span></label>

                  <div v-if="itemForm.attributes[field.key]" class="file-preview-card">
                    <img
                        v-if="isImageValue(itemForm.attributes[field.key])"
                        :src="itemForm.attributes[field.key]"
                        class="thumb-img-modal"
                        alt="Превью"
                    />
                    <div v-else class="file-badge-preview">
                      <UIMoloSticker name="file" :size="20" />
                      <span>Файл прикреплен</span>
                    </div>

                    <UIMoloButton class="close small" @click="removeFile(field.key)">
                      <UIMoloSticker name="x" :size="12" /> Удалить файл
                    </UIMoloButton>
                  </div>

                  <div v-else class="file-drop-trigger">
                    <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.xlsx,.txt"
                        @change="handleFileUpload($event, field.key)"
                    />
                    <div class="upload-dummy">
                      <UIMoloSticker name="upload" :size="16" />
                      <span>Выберите или перетащите фото / файл</span>
                    </div>
                  </div>
                </div>

                <!-- Select -->
                <UIMoloSelect
                    v-else-if="field.type === 'select'"
                    v-model="itemForm.attributes[field.key]"
                    compact
                    :tLabel="field.label"
                    :lRequired="field.required"
                >
                  <option value="">Выберите значение</option>
                  <option
                      v-for="option in getFieldOptions(field)"
                      :key="String(option.value)"
                      :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </UIMoloSelect>

                <!-- Date -->
                <UIMoloInput
                    v-else-if="field.type === 'date'"
                    v-model="itemForm.attributes[field.key]"
                    date
                    compact
                    :tLabel="field.label"
                    :lRequired="field.required"
                />

                <!-- Number -->
                <UIMoloInput
                    v-else-if="field.type === 'number'"
                    v-model="itemForm.attributes[field.key]"
                    type="number"
                    compact
                    :tLabel="field.label"
                    :lRequired="field.required"
                    :placeholder="field.placeholder"
                />

                <!-- Boolean / Toggle -->
                <UIMoloToggle
                    v-else-if="field.type === 'boolean'"
                    v-model="itemForm.attributes[field.key]"
                    compact
                    :tLabel="field.label"
                    :lRequired="field.required"
                    :label="itemForm.attributes[field.key] ? 'Да' : 'Нет'"
                />

                <!-- Text -->
                <UIMoloInput
                    v-else
                    v-model="itemForm.attributes[field.key]"
                    compact
                    :tLabel="field.label"
                    :lRequired="field.required"
                    :placeholder="field.placeholder || `Введите ${field.label.toLowerCase()}`"
                />
              </div>
            </div>
          </div>

          <div class="editor-section">
            <div class="editor-section-title">
              <span>Дополнительно</span>
            </div>

            <UIMoloInput
                v-model="itemForm.description"
                compact
                tLabel="Примечание"
                placeholder="Дополнительная информация..."
            />
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- CREATE DEPARTMENT -->
    <UIMoloModal
        v-model="isAddDeptModalOpen"
        title="Создание отдела"
        confirm-text="Создать отдел"
        cancel-text="Отмена"
        width="480px"
        @confirm="saveNewDepartment"
    >
      <template #body>
        <div class="editor-form">
          <UIMoloInput v-model="newDeptForm.name" compact lRequired tLabel="Название отдела" placeholder="IT и разработка" />
          <UIMoloInput v-model="newDeptForm.key" compact tLabel="Системный ключ" placeholder="it_development" />
          <UIMoloInput v-model="newDeptForm.description" compact tLabel="Описание" placeholder="Описание подразделения..." />
        </div>
      </template>
    </UIMoloModal>

    <!-- DEPARTMENT PEOPLE -->
    <UIMoloModal
        v-model="deptPeopleModalOpen"
        :title="`Отдел: ${viewingDept?.name || ''}`"
        cancel-text="Закрыть"
        width="600px"
    >
      <template #body>
        <div class="department-detail">
          <div class="department-detail-summary">
            <div>
              <span>Системный ключ</span>
              <code>{{ viewingDept?.key }}</code>
            </div>
            <div>
              <span>Сотрудников</span>
              <strong>{{ selectedDepartmentCount }}</strong>
            </div>
          </div>

          <div v-if="!deptEmployees.length" class="department-no-people">
            В этом отделе пока нет сотрудников
          </div>

          <div v-else class="department-people-list">
            <div v-for="employee in deptEmployees" :key="employee._id" class="department-person">
              <div class="table-avatar">{{ getInitials(employee.title) }}</div>
              <div class="person-info">
                <strong>{{ employee.title }}</strong>
                <span>{{ employee.attributes?.role || 'Должность не указана' }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <UIMoloButton class="close small" @click="requestDeleteDepartment(viewingDept!)">
          <UIMoloSticker name="trash" :size="14" />
          Удалить отдел
        </UIMoloButton>
      </template>
    </UIMoloModal>

    <!-- CREATE / EDIT DIRECTORY -->
    <UIMoloModal
        v-model="createDirModalOpen"
        :title="editingDefinitionSlug ? 'Настройка справочника' : 'Новый справочник'"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        width="760px"
        :loading="definitionSaving"
        @confirm="saveNewDirectory"
    >
      <template #body>
        <div class="editor-form">
          <div class="editor-section-title">
            <span>Основные настройки</span>
          </div>

          <div class="editor-grid">
            <div class="editor-field full">
              <UIMoloInput v-model="newDirForm.title" compact lRequired tLabel="Название" placeholder="Например, Проекты" />
            </div>
            <div class="editor-field">
              <UIMoloInput v-model="newDirForm.slug" compact tLabel="Системный ключ" placeholder="projects" />
            </div>
            <div class="editor-field">
              <UIMoloInput v-model="newDirForm.aliases" compact tLabel="Синонимы через запятую" placeholder="Проекты, Projects" />
            </div>
            <div class="editor-field">
              <UIMoloInput v-model="newDirForm.codeLabel" compact tLabel="Название поля кода" placeholder="Код / ID" />
            </div>
            <div class="editor-field">
              <UIMoloInput v-model="newDirForm.titleLabel" compact tLabel="Название основного поля" placeholder="Наименование" />
            </div>
          </div>

          <div class="editor-section">
            <div class="builder-heading">
              <UIMoloButton class="action small" @click="addCustomField">
                <UIMoloSticker name="plus" :size="13" /> Добавить поле
              </UIMoloButton>
            </div>

            <div v-if="!newDirForm.fields.length" class="no-fields">
              Дополнительных полей пока нет
            </div>

            <div v-for="(field, index) in newDirForm.fields" :key="index" class="field-builder-card">
              <div class="builder-index">{{ String(index + 1).padStart(2, '0') }}</div>

              <div class="builder-inputs">
                <UIMoloInput v-model="field.label" compact placeholder="Название поля" />
                <UIMoloInput v-model="field.key" compact placeholder="field_key" />

                <!-- Выбор типа поля включая Ссылку и Файл / Фото -->
                <UIMoloSelect v-model="field.type" compact>
                  <option value="text">Текст</option>
                  <option value="number">Число</option>
                  <option value="date">Дата</option>
                  <option value="boolean">Да / Нет</option>
                  <option value="select">Список</option>
                  <option value="link">Ссылка (URL)</option>
                  <option value="file">Файл / Фото</option>
                </UIMoloSelect>

                <UIMoloSelect v-model.number="field.span" compact>
                  <option :value="1">1 колонка</option>
                  <option :value="2">2 колонки</option>
                </UIMoloSelect>
              </div>

              <UIMoloButton class="close small" title="Удалить поле" @click="removeCustomField(index)">
                <UIMoloSticker name="trash" :size="14" />
              </UIMoloButton>

              <!-- Настройка вариантов для типа select -->
              <div v-if="field.type === 'select'" class="builder-options">
                <div class="options-heading">
                  <span>Варианты списка</span>
                  <UIMoloButton class="transparent small" @click="addSelectOption(field)">
                    <UIMoloSticker name="plus" :size="12" />
                    Вариант
                  </UIMoloButton>
                </div>

                <div
                    v-for="(option, optionIndex) in field.options || []"
                    :key="optionIndex"
                    class="option-row"
                >
                  <UIMoloInput
                      v-model="option.label"
                      compact
                      placeholder="Название"
                  />
                  <UIMoloInput
                      v-model="option.value"
                      compact
                      placeholder="value"
                  />
                  <UIMoloButton
                      class="close small"
                      @click="removeSelectOption(field, optionIndex)"
                  >
                    <UIMoloSticker name="x" :size="13" />
                  </UIMoloButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- DELETE ITEM -->
    <UIMoloModal
        v-model="deleteModalOpen"
        title="Удаление записи"
        :modal-text="`Удалить «${itemToDelete?.title || ''}»? Это действие нельзя отменить.`"
        confirm-text="Удалить"
        cancel-text="Отмена"
        :loading="deleting"
        @confirm="confirmDelete"
        @cancel="itemToDelete = null"
    />

    <!-- DELETE DEPARTMENT -->
    <UIMoloModal
        v-model="deleteDeptModalOpen"
        title="Удаление отдела"
        :modal-text="`Удалить отдел «${deptToDelete?.name || ''}»? Проверьте привязанные записи сотрудников перед удалением.`"
        confirm-text="Удалить"
        cancel-text="Отмена"
        :loading="deletingDeptLoading"
        @confirm="confirmDeleteDepartment"
        @cancel="deleteDeptModalOpen = false; deptToDelete = null"
    />
  </div>
</template>

<style scoped>
.directory-app {
  --dir-panel: rgba(255, 255, 255, 0.025);
  --dir-border: var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  --dir-text: #e6edf7;
  --dir-muted: #8491a5;
  --dir-blue: #60a5fa;

  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--dir-text);
  background: var(--half_opacity_bg, #07101e);
  font-size: 13px;
}

.directory-app,
.directory-app * {
  box-sizing: border-box;
}

/* HEADER */
.directory-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dir-border);
  background: rgba(0, 0, 0, 0.13);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 11px;
  background: rgba(56, 189, 248, 0.08);
  color: #38bdf8;
}

.header-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.header-subtitle {
  font-size: 11px;
  color: var(--dir-muted);
}

/* LAYOUT */
.directory-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 215px minmax(0, 1fr) 290px;
  overflow: hidden;
}

.directory-sidebar {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 10px 12px;
  border-right: 1px solid var(--dir-border);
  background: rgba(0, 0, 0, 0.11);
  overflow-y: auto;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
}

.nav-icon {
  display: flex;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-active-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.8);
}

.sidebar-bottom {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
}

.sidebar-stat {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 0 5px;
  color: var(--dir-muted);
  font-size: 10px;
}

.sidebar-stat b {
  color: var(--dir-text);
}

/* CONTENT */
.directory-content {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
  gap: 12px;
  overflow: auto;
}

.stats-row {
  display: flex;
  gap: 9px;
  flex-shrink: 0;
}

.stat-card {
  flex: 1;
  min-width: 0;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--dir-border);
  border-radius: 9px;
  background: var(--dir-panel);
}

.stat-icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 7px;
  color: #8ba9ca;
  background: rgba(96, 165, 250, 0.08);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.stat-content span {
  color: var(--dir-muted);
  font-size: 10px;
}

.stat-content strong {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* DEPARTMENTS */
.departments-panel {
  flex-shrink: 0;
  padding: 12px;
  border: 1px solid var(--dir-border);
  border-radius: 9px;
  background: var(--dir-panel);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.panel-heading > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.panel-heading strong {
  font-size: 12px;
}

.panel-heading span {
  color: var(--dir-muted);
  font-size: 10px;
}

.department-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.department-chip-name {
  font-size: 11px;
}

.department-chip-count {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(96, 165, 250, 0.16);
  color: #93c5fd;
  font-size: 10px;
  text-align: center;
}

.departments-empty,
.department-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dir-muted);
  font-size: 11px;
}

/* TOOLBAR */
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 9px;
}

.search-input-wrapper {
  position: relative;
  width: min(400px, 100%);
  min-width: 240px;
  display: flex;
  align-items: center;
}

.search-clear-btn {
  position: absolute;
  right: 6px;
  z-index: 2;
}

.sort-select-wrapper {
  min-width: 140px;
}

.results-count {
  color: var(--dir-muted);
  font-size: 10px;
  white-space: nowrap;
}

/* GROUP FILTERS */
.group-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

/* TABLE */
.table-container {
  flex: 1;
  min-height: 170px;
  border: 1px solid var(--dir-border);
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.09);
  overflow: auto;
}

.directory-table-wrap {
  min-width: 0;
  overflow-x: auto;
}

.directory-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.directory-table th {
  height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dir-border);
  color: #75839a;
  background: rgba(255, 255, 255, 0.02);
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.directory-table td {
  height: 50px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.045);
  color: #bac5d5;
  font-size: 11px;
}

.directory-table tbody tr {
  cursor: pointer;
  transition: background 0.13s ease;
}

.directory-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.035);
}

.directory-table tbody tr.selected {
  background: rgba(56, 189, 248, 0.07);
}

.directory-table tbody tr.selected td:first-child {
  box-shadow: inset 3px 0 0 #38bdf8;
}

.main-column { min-width: 185px; }
.code-column { min-width: 100px; }
.actions-column { width: 115px; text-align: right !important; }

.table-title-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.table-avatar-img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.table-avatar-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.table-avatar {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 7px;
  border: 1px solid rgba(96, 165, 250, 0.25);
  background: rgba(96, 165, 250, 0.09);
  color: #9dc5ff;
  font-size: 10px;
  font-weight: 700;
}

.table-mini-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.file-dl-link,
.table-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #38bdf8;
  text-decoration: none;
  font-size: 11px;
}

.table-link-btn {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-dl-link:hover,
.table-link-btn:hover {
  text-decoration: underline;
}

.table-title-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.table-title-info strong {
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e2eaf5;
  font-size: 11px;
  font-weight: 600;
}

.table-title-info small {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #728097;
  font-size: 9px;
}

.directory-table code,
.mono-value {
  color: #91baff;
  font-family: monospace;
  font-size: 10px;
}

.table-value {
  display: block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boolean-tag {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(244, 63, 94, 0.12);
  color: #fca5a5;
  font-size: 9px;
  border: 1px solid rgba(244, 63, 94, 0.2);
}

.boolean-tag.positive {
  background: rgba(16, 185, 129, 0.12);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.25);
}

.row-actions {
  display: inline-flex;
  justify-content: flex-end;
}

/* EMPTY AND LOADING */
.table-state {
  min-height: 220px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--dir-muted);
  font-size: 11px;
}

.empty-state strong {
  color: #d5deeb;
  font-size: 14px;
}

.empty-state > span {
  max-width: 300px;
  text-align: center;
  line-height: 1.5;
}

.empty-icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border: 1px solid var(--dir-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.025);
  margin-bottom: 3px;
}

/* DETAIL PANEL */
.detail-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
  border-left: 1px solid var(--dir-border);
  background: rgba(0, 0, 0, 0.09);
  overflow-y: auto;
  gap: 15px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-header > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-eyebrow {
  color: #728198;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1px;
}

.detail-header strong {
  font-size: 13.5px;
}

.detail-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.detail-avatar-img {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.detail-avatar-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-avatar {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 14px;
  background: rgba(56, 189, 248, 0.09);
  color: #38bdf8;
  font-size: 18px;
  font-weight: 700;
}

.detail-identity strong {
  max-width: 100%;
  font-size: 13.5px;
  overflow-wrap: anywhere;
}

.detail-identity > span {
  color: var(--dir-muted);
  font-family: monospace;
  font-size: 10px;
}

.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 14px 2px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-field > span {
  color: #75839a;
  font-size: 9px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.detail-field > strong,
.detail-field > p {
  margin: 0;
  color: #d0d9e6;
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.detail-link-box,
.detail-file-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-url-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #38bdf8;
  text-decoration: none;
  font-size: 11.5px;
  overflow-wrap: anywhere;
}

.detail-url-link:hover {
  text-decoration: underline;
}

.detail-img-preview {
  max-width: fit-content;
  max-height: 140px;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--dir-border);
}

.download-btn-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #38bdf8;
  text-decoration: none;
}

.download-btn-link:hover {
  text-decoration: underline;
}

.detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  text-align: center;
}

.detail-empty-icon {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  border: 1px solid var(--dir-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
  color: #8291a8;
}

/* EDITOR FORMS */
.editor-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 2px 1px;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.editor-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--dir-border);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 650;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.editor-field {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.editor-field.full {
  grid-column: span 2;
}

.dept-select-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.dept-select-row > :first-child {
  flex: 1;
  min-width: 0;
}

.dept-add-btn {
  margin-bottom: 1px;
}

/* UI Загрузки Файлов */
.file-uploader-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label-text {
  font-size: 11.5px;
  color: #8c8c9e;
  font-weight: 500;
}

.file-preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--dir-border);
  border-radius: 6px;
}

.thumb-img-modal {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
}

.file-badge-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #38bdf8;
}

.file-drop-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px dashed var(--dir-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.015);
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-drop-trigger:hover {
  background: rgba(56, 189, 248, 0.05);
  border-color: #38bdf8;
}

.file-drop-trigger input[type='file'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-dummy {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8c8c9e;
  pointer-events: none;
}

.field-builder-card {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 30px;
  align-items: start;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--dir-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.018);
}

.builder-index {
  padding-top: 8px;
  color: #6c7c92;
  font-family: monospace;
  font-size: 10px;
}

.builder-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 110px 95px;
  gap: 6px;
  min-width: 0;
}

.builder-options {
  grid-column: 2 / 4;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 8px;
  border-top: 1px solid var(--dir-border);
}

.options-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #9aa8bb;
  font-size: 10px;
}

.option-row {
  display: grid;
  grid-template-columns: 1fr 1fr 28px;
  gap: 6px;
  align-items: center;
}

.department-detail {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.department-detail-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--dir-border);
  border-radius: 8px;
  background: var(--half_opacity_bg);
}

.department-people-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.department-person {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--dir-border);
  border-radius: 7px;
}

.person-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.person-info strong {
  font-size: 11px;
}

.person-info span {
  color: var(--dir-muted);
  font-size: 10px;
}

@media (max-width: 1150px) {
  .directory-layout {
    grid-template-columns: 180px minmax(0, 1fr) 250px;
  }
}

@media (max-width: 850px) {
  .directory-layout {
    grid-template-columns: 160px minmax(0, 1fr);
  }
  .detail-panel {
    display: none;
  }
}
</style>