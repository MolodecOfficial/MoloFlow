<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAppStore } from '~~/stores/appStore'

type FieldType = 'text' | 'number' | 'select' | 'boolean'

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
  attributes: Record<string, string | number | boolean | null>
  createdAt: string
}

const props = defineProps<{
  enterpriseId?: string
  windowId?: string
}>()

const appStore = useAppStore()
const { addNotification } = useNotifications('Справочники')
const { addLog } = useLogger('Справочники')

const DIRECTORY_CONFIG: Record<string, DirectoryMeta> = {
  departments: {
    label: '👥 Сотрудники и отделы',
    value: 'departments',
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
        span: 1,
        options: [
          { label: '💻 IT и разработка', value: 'IT и разработка' },
          { label: '🛡️ Руководство и менеджмент', value: 'Руководство' },
          { label: '💰 Бухгалтерия и финансы', value: 'Бухгалтерия и финансы' },
          { label: '📦 Склад и логистика', value: 'Склад и логистика' },
          { label: '🤝 Отдел продаж', value: 'Отдел продаж' }
        ]
      },
      {
        key: 'role',
        label: 'Роль доступа в системе',
        type: 'select',
        required: true,
        span: 1,
        options: [
          { label: 'Администратор', value: 'Администратор' },
          { label: 'Управляющий', value: 'Управляющий' },
          { label: 'Программист', value: 'Программист' },
          { label: 'Бухгалтер', value: 'Бухгалтер' },
          { label: 'Сотрудник', value: 'Сотрудник' },
          { label: 'Наблюдатель', value: 'Наблюдатель' }
        ]
      },
      { key: 'phone', label: 'Контактный телефон', placeholder: '+7 (999) 000-00-00', span: 1 },
      { key: 'email', label: 'Рабочий Email', placeholder: 'emp@company.ru', span: 1 }
    ]
  },
  bank_accounts: {
    label: '🏛️ Банковские счета',
    value: 'bank_accounts',
    codeLabel: 'БИК Банка',
    codePlaceholder: '044525225',
    titleLabel: 'Название банка',
    titlePlaceholder: 'ПАО СБЕРБАНК',
    groupByKey: 'currency',
    fields: [
      { key: 'accountNumber', label: 'Расчётный счёт', placeholder: '40702810...', required: true, span: 2 },
      { key: 'corrAccount', label: 'Корр. счёт', placeholder: '30101810...', required: true, span: 2 },
      {
        key: 'currency',
        label: 'Валюта счёта',
        type: 'select',
        required: true,
        span: 1,
        options: [
          { label: 'RUB (Рубли)', value: 'RUB' },
          { label: 'USD (Доллары)', value: 'USD' },
          { label: 'EUR (Евро)', value: 'EUR' },
          { label: 'CNY (Юани)', value: 'CNY' }
        ]
      },
      { key: 'swift', label: 'SWIFT-код', placeholder: 'SABRRUMM', span: 1 }
    ]
  },
  counterparties: {
    label: '🤝 Контрагенты',
    value: 'counterparties',
    codeLabel: 'ИНН',
    codePlaceholder: '10 или 12 цифр',
    titleLabel: 'Наименование / ФИО',
    titlePlaceholder: 'ООО "Вектор" или ИП Иванов',
    groupByKey: 'type',
    fields: [
      {
        key: 'type',
        label: 'Категория',
        type: 'select',
        required: true,
        span: 1,
        options: [
          { label: 'Поставщики', value: 'Поставщики' },
          { label: 'Клиенты', value: 'Клиенты' },
          { label: 'Подрядчики', value: 'Подрядчики' }
        ]
      },
      { key: 'kpp', label: 'КПП', placeholder: '770101001', span: 1 },
      { key: 'ogrn', label: 'ОГРН / ОГРНИП', placeholder: '1027700000000', span: 1 },
      { key: 'phone', label: 'Телефон', placeholder: '+7 (999) 000-00-00', span: 1 },
      { key: 'legalAddress', label: 'Юридический адрес', placeholder: 'г. Москва, ул...', span: 2 }
    ]
  },
  nomenclature: {
    label: '📦 Номенклатура и товары',
    value: 'nomenclature',
    codeLabel: 'Артикул / SKU',
    codePlaceholder: 'ART-0042',
    titleLabel: 'Наименование',
    titlePlaceholder: 'Кабель витая пара UTP Cat5e',
    groupByKey: 'category',
    fields: [
      {
        key: 'category',
        label: 'Категория',
        type: 'select',
        required: true,
        span: 1,
        options: [
          { label: 'Товары', value: 'Товары' },
          { label: 'Услуги', value: 'Услуги' },
          { label: 'Оборудование', value: 'Оборудование' }
        ]
      },
      { key: 'unit', label: 'Ед. измерения', placeholder: 'шт, м, ч, кг', required: true, span: 1 },
      {
        key: 'vatRate',
        label: 'Ставка НДС',
        type: 'select',
        required: true,
        span: 1,
        options: [
          { label: 'Без НДС', value: '0' },
          { label: '20%', value: '20' }
        ]
      },
      { key: 'basePrice', label: 'Базовая цена', type: 'number', placeholder: '0.00', span: 1 }
    ]
  },
  glossary: {
    label: '📖 Глоссарий и термины',
    value: 'glossary',
    codeLabel: 'Аббревиатура',
    codePlaceholder: 'SLA',
    titleLabel: 'Термин',
    titlePlaceholder: 'Service Level Agreement',
    fields: [
      { key: 'category', label: 'Тематика термина', placeholder: 'IT, Финансы...', span: 2 }
    ]
  }
}

const directoryTypes = computed(() =>
    Object.values(DIRECTORY_CONFIG).map(cfg => ({ label: cfg.label, value: cfg.value }))
)

const currentType = ref('departments')
const currentMeta = computed(() => DIRECTORY_CONFIG[currentType.value] || DIRECTORY_CONFIG.departments)

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
  attributes: {} as Record<string, string | number | boolean | null>
})

const deleteModalOpen = ref(false)
const itemToDelete = ref<DirectoryItem | null>(null)

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

async function loadItems() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  loading.value = true
  try {
    const data = await $fetch<DirectoryItem[]>('/api/directory/items', {
      query: {
        enterpriseId,
        directorySlug: currentType.value,
        search: searchQuery.value.trim() || undefined
      }
    })
    items.value = Array.isArray(data) ? data : []

    if (selectedItem.value) {
      selectedItem.value = items.value.find(i => i._id === selectedItem.value?._id) || items.value[0] || null
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
    const sectionName = rawVal ? String(rawVal) : 'Общее / Вне отделов'

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
    attrs[field.key] = field.type === 'select' && field.options?.length ? field.options[0].value : ''
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

  itemForm.value = {
    code: '',
    title: '',
    description: '',
    attributes: defaults
  }
  itemModalOpen.value = true
}

function openEditModal(item: DirectoryItem) {
  isEditing.value = true
  editingId.value = item._id

  const mergedAttrs = { ...initAttributesDefaults(), ...(item.attributes || {}) }
  itemForm.value = {
    code: item.code || '',
    title: item.title,
    description: item.description || '',
    attributes: mergedAttrs
  }
  itemModalOpen.value = true
}

async function saveItem() {
  if (!itemForm.value.title.trim()) {
    addNotification('warning', `Укажите «${currentMeta.value.titleLabel}»`)
    return
  }

  for (const f of currentMeta.value.fields) {
    if (f.required) {
      const val = itemForm.value.attributes[f.key]
      if (val === undefined || val === null || String(val).trim() === '') {
        addNotification('warning', `Поле «${f.label}» обязательно`)
        return
      }
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
      addNotification('success', 'Сотрудник добавлен')
    }
    itemModalOpen.value = false
    await loadItems()
  } catch {
    addNotification('error', 'Ошибка сохранения записи')
  }
}

async function syncEnterpriseData() {
  const enterpriseId = getEntId()
  if (!enterpriseId) return

  syncing.value = true
  try {
    const res = await $fetch<{ success: boolean; importedCount: number }>(
        '/api/directory/enterprise-sync',
        { method: 'POST', body: { enterpriseId } }
    )
    addNotification('success', `Синхронизировано: ${res.importedCount}`)
    await loadItems()
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
    itemToDelete.value = null
    await loadItems()
  } catch {
    addNotification('error', 'Не удалось удалить запись')
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadItems()
  }, 250)
})

watch(currentType, () => {
  selectedItem.value = null
  selectedSectionFilter.value = 'all'
  searchQuery.value = ''
  loadItems()
})

onMounted(() => {
  loadItems()
})
</script>

<template>
  <div class="directory-app">
    <header class="directory-header">
      <div class="header-left">
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
      </div>

      <div class="header-right">
        <div class="search-box">
          <UIMoloInput
              v-model="searchQuery"
              compact
              placeholder="Быстрый поиск..."
          />
        </div>
        <section class="btn-group">
          <UIMoloButton
              class="small"
              :disabled="syncing"
              @click="syncEnterpriseData"
              :loading="syncing"
          >
            {{ syncing ? 'Синхронизация...' : 'Синхронизировать' }}
          </UIMoloButton>
          <UIMoloButton class="small confirm" @click="openCreateModal()">
            Добавить
          </UIMoloButton>
        </section>
      </div>
    </header>

    <!-- Полоса фильтрации по отделам -->
    <div v-if="availableSectionTabs.length > 1" class="sections-filter-bar">
      <button
          class="section-tab-btn"
          :class="{ active: selectedSectionFilter === 'all' }"
          @click="selectedSectionFilter = 'all'"
      >
        Все отделы ({{ items.length }})
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
      <!-- Список секций -->
      <section class="items-list-pane">
        <UIMoloLoaders v-if="loading" wndLoader />

        <div v-else-if="items.length === 0" class="empty-placeholder">
          <span>Сотрудники еще не добавлены в отделы</span>
          <UIMoloButton class="small confirm" @click="openCreateModal()">
            Добавить первого сотрудника
          </UIMoloButton>
        </div>

        <div v-else class="sections-container">
          <div
              v-for="section in groupedSections"
              :key="section.title"
              class="directory-section-block"
          >
            <!-- Шапка отдела -->
            <div class="section-header-row">
              <div class="section-title-wrap">
                <span class="section-title">{{ section.title }}</span>
                <span class="section-badge">{{ section.items.length }} чел.</span>
              </div>
              <button
                  class="section-quick-add"
                  title="Добавить сотрудника в этот отдел"
                  @click="openCreateModal(section.title)"
              >
                + добавить сотрудника
              </button>
            </div>

            <!-- Карточки сотрудников отдела -->
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
                  <span v-if="item.attributes?.role" class="item-role-tag">
                    {{ item.attributes.role }}
                  </span>
                </div>

                <!-- Контакты и табельный номер -->
                <div class="card-badges">
                  <span v-if="item.code" class="badge-pill">ID: {{ item.code }}</span>
                  <span v-if="item.attributes?.phone" class="badge-pill">📞 {{ item.attributes.phone }}</span>
                </div>

                <p v-if="item.description" class="item-desc">{{ item.description }}</p>

                <div class="btn-group">
                  <UIMoloButton class="small" title="Редактировать" @click.stop="openEditModal(item)">Изменить</UIMoloButton>
                  <UIMoloButton class="small close" title="Удалить" @click.stop="requestDelete(item)">Удалить</UIMoloButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Детализация -->
      <aside class="item-detail-pane">
        <UIMoloSection>
          <template #header>
            <strong>Карточка сотрудника</strong>
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

              <div class="attributes-stack">
                <div
                    v-for="field in currentMeta.fields"
                    :key="field.key"
                    class="field-preview"
                >
                  <span class="field-label">{{ field.label }}</span>
                  <span class="field-value">
                    {{ selectedItem.attributes?.[field.key] ?? '—' }}
                  </span>
                </div>
              </div>

              <div class="field-preview">
                <span class="field-label">Дополнительно</span>
                <p class="field-text">{{ selectedItem.description || 'Нет примечаний' }}</p>
              </div>

              <div class="action-row">
                <UIMoloButton class="small confirm full" @click="openEditModal(selectedItem)">
                  Редактировать данные
                </UIMoloButton>
              </div>
            </div>

            <div v-else class="no-selection">
              <span>Выберите сотрудника слева</span>
            </div>
          </template>
        </UIMoloSection>
      </aside>
    </main>

    <!-- Модалка -->
    <UIMoloModal
        v-model="itemModalOpen"
        :title="isEditing ? `Редактирование: ${currentMeta.label}` : `Добавление: ${currentMeta.label}`"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        width="640px"
        @confirm="saveItem"
    >
      <template #body>
        <div class="modal-dynamic-form">
          <div class="form-grid">
            <div class="grid-col col-2">
              <UIMoloInput
                  v-model="itemForm.title"
                  compact
                  lRequired
                  :tLabel="currentMeta.titleLabel"
                  :placeholder="currentMeta.titlePlaceholder"
              />
            </div>
            <div class="grid-col col-2">
              <UIMoloInput
                  v-model="itemForm.code"
                  compact
                  :tLabel="currentMeta.codeLabel"
                  :placeholder="currentMeta.codePlaceholder"
              />
            </div>

            <div
                v-for="field in currentMeta.fields"
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
                  placeholder="Заметки по сотруднику..."
              />
            </div>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- Модалка удаления -->
    <UIMoloModal
        v-model="deleteModalOpen"
        title="Удаление сотрудника"
        :modal-text="`Удалить запись «${itemToDelete?.title}» из справочника?`"
        confirm-text="Удалить"
        cancel-text="Отмена"
        @confirm="confirmDelete"
        @cancel="itemToDelete = null"
    />
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
  gap: 12px;
  flex-shrink: 0;
}

.header-left, .header-right {
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
  width: 220px;
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

.btn-group {
  display: flex;
  justify-content: end;
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

.item-role-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(56, 114, 239, 0.2);
  color: #8fb1ff;
  border: 1px solid rgba(56, 114, 239, 0.3);
  flex-shrink: 0;
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
  gap: 4px;
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

.full {
  width: 100%;
}
</style>