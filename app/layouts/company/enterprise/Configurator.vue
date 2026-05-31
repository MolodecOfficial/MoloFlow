<!-- configurator.vue -->
<script lang="ts" setup>
import { onMounted, ref } from 'vue'

const props = defineProps<{
  enterpriseId: string
  windowId?: string
}>()
const emit = defineEmits(['close', 'saved'])

const { openWindow } = useWindowManager()
const { addNotification } = useNotifications('Конфигуратор')
const { addLog } = useLogger('Конфигуратор')

// Состояния
const loading = ref(false)
const tabs = ref<any[]>([])
const selectedTab = ref<any>(null)
const activeSection = ref('tabs')
const currentEnterpriseId = ref('')

// Форма вкладки
const showTabForm = ref(false)
const editingTab = ref<any>(null)
const tabForm = ref({
  name: '',
  slug: '',
  description: '',
  icon: 'folder',
  color: '#6496ff',
  category: 'custom',
  defaultViewType: 'table',
  groups: [] as any[],
  actions: [] as any[],
  permissions: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: false,
    rolesAllowed: [] as string[]
  }
})

// Редактирование группы
const editingGroupIndex = ref<number | null>(null)
const showGroupForm = ref(false)
const groupForm = ref({ name: '', description: '', icon: 'folder', order: 0 })

// Редактирование поля
const showFieldForm = ref(false)
const editingGroupIdForField = ref<number | null>(null)
const editingFieldIndex = ref<number | null>(null)
const fieldForm = ref<any>({
  key: '',
  label: '',
  type: 'string',
  required: false,
  defaultValue: null,
  placeholder: '',
  description: '',
  options: [],
  validation: { min: null, max: null, minLength: null, maxLength: null, pattern: '', customMessage: '' },
  display: {
    showInTable: true,
    showInCard: true,
    showInDetail: true,
    showInQuickView: false,
    width: 1,
    format: '',
    prefix: '',
    suffix: ''
  },
  isArray: false,
  isUnique: false,
  isSearchable: true,
  isFilterable: true,
  isSortable: true,
  isReadonly: false,
  isHidden: false
})
const newOption = ref({ label: '', value: '', color: '#6496ff' })

// Превью
const previewStandard = ref<any>(null)
const previewStandardsList = ref<any[]>([])

// Вспомогательные данные
const categories = [
  { label: 'Сотрудники', value: 'employees' },
  { label: 'Локации', value: 'locations' },
  { label: 'Оборудование', value: 'equipment' },
  { label: 'Документы', value: 'documents' },
  { label: 'Проекты', value: 'projects' },
  { label: 'Клиенты', value: 'clients' },
  { label: 'Продукты', value: 'products' },
  { label: 'Финансы', value: 'finance' },
  { label: 'Прочее', value: 'custom' }
]

const viewTypes = [
  { label: 'Карточки', value: 'card' },
  { label: 'Таблица', value: 'table' },
  { label: 'Список', value: 'list' },
  { label: 'Сетка', value: 'grid' },
  { label: 'Канбан', value: 'kanban' },
  { label: 'Календарь', value: 'calendar' },
  { label: 'Карта', value: 'map' },
  { label: 'Таймлайн', value: 'timeline' }
]

const fieldTypes = [
  { label: 'Текст', value: 'string' },
  { label: 'Число', value: 'number' },
  { label: 'Да/Нет', value: 'boolean' },
  { label: 'Дата', value: 'date' },
  { label: 'Выбор', value: 'select' },
  { label: 'Множественный выбор', value: 'multiselect' },
  { label: 'Файл', value: 'file' },
  { label: 'Изображение', value: 'image' },
  { label: 'Ссылка', value: 'url' },
  { label: 'Почта', value: 'email' },
  { label: 'Телефон', value: 'phone' },
  { label: 'Цвет', value: 'color' }
]

function getEnterpriseId(): string {
  if (props.enterpriseId) return props.enterpriseId
  const str = localStorage.getItem('currentEnterprise')
  return str ? JSON.parse(str)._id : ''
}

// Получить все поля из всех групп (плоский список)
function getAllFields(): any[] {
  const fields: any[] = []
  if (selectedTab.value?.groups) {
    for (const group of selectedTab.value.groups) {
      if (group.fields) fields.push(...group.fields)
    }
  }
  return fields
}

async function loadTabs() {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return
  loading.value = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseId}/tabs`)
    tabs.value = response.tabs || []
  } catch (error: any) {
    addNotification('error', 'Ошибка загрузки вкладок')
  } finally {
    loading.value = false
  }
}

function createNewTab() {
  editingTab.value = null
  tabForm.value = {
    name: '', slug: '', description: '', icon: 'folder', color: '#6496ff',
    category: 'custom', defaultViewType: 'table', groups: [], actions: [],
    permissions: { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: false, rolesAllowed: [] }
  }
  showTabForm.value = true
  activeSection.value = 'tab-editor'
}

function editTab(tab: any) {
  editingTab.value = tab
  tabForm.value = {
    name: tab.name, slug: tab.slug, description: tab.description || '', icon: tab.icon || 'folder',
    color: tab.color || '#6496ff', category: tab.category, defaultViewType: tab.defaultViewType || 'table',
    groups: JSON.parse(JSON.stringify(tab.groups || [])),
    actions: JSON.parse(JSON.stringify(tab.actions || [])),
    permissions: { ...tab.permissions }
  }
  showTabForm.value = true
  activeSection.value = 'tab-editor'
}

function generateSlug() {
  tabForm.value.slug = tabForm.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function saveTab() {
  if (!tabForm.value.name || !tabForm.value.slug) {
    addNotification('warning', 'Заполните название и ключ вкладки')
    return
  }
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return

  loading.value = true
  try {
    const url = editingTab.value ? `/api/enterprises/${enterpriseId}/tabs/${editingTab.value._id}` : `/api/enterprises/${enterpriseId}/tabs`
    const method = editingTab.value ? 'PUT' : 'POST'
    const response = await $fetch(url, { method, body: tabForm.value })
    addNotification('success', `Вкладка "${tabForm.value.name}" сохранена`)
    showTabForm.value = false
    await loadTabs()
    emit('saved', response.tab)
  } catch (error: any) {
    addNotification('error', error?.data?.message || 'Ошибка сохранения')
  } finally {
    loading.value = false
  }
}

async function deleteTab(tabId: string) {
  if (!confirm('Удалить вкладку и все данные? Это необратимо.')) return
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return
  loading.value = true
  try {
    await $fetch(`/api/enterprises/${enterpriseId}/tabs/${tabId}`, { method: 'DELETE' })
    addNotification('success', 'Вкладка удалена')
    await loadTabs()
    if (selectedTab.value?._id === tabId) selectedTab.value = null
  } catch (error: any) {
    addNotification('error', error?.data?.message || 'Ошибка удаления')
  } finally {
    loading.value = false
  }
}

// Управление группами
function addGroup() {
  editingGroupIndex.value = null
  groupForm.value = { name: '', description: '', icon: 'folder', order: tabForm.value.groups.length }
  showGroupForm.value = true
}

function editGroup(index: number) {
  editingGroupIndex.value = index
  const g = tabForm.value.groups[index]
  groupForm.value = { name: g.name, description: g.description || '', icon: g.icon || 'folder', order: g.order ?? index }
  showGroupForm.value = true
}

function saveGroup() {
  if (!groupForm.value.name) {
    addNotification('warning', 'Введите название группы')
    return
  }
  const groupData = { ...groupForm.value, fields: [] }
  if (editingGroupIndex.value !== null) {
    groupData.fields = tabForm.value.groups[editingGroupIndex.value].fields || []
    tabForm.value.groups[editingGroupIndex.value] = groupData
  } else {
    tabForm.value.groups.push(groupData)
  }
  showGroupForm.value = false
}

function removeGroup(index: number) {
  if (confirm('Удалить группу и все её поля?')) {
    tabForm.value.groups.splice(index, 1)
  }
}

function moveGroup(index: number, direction: 'up' | 'down') {
  const groups = [...tabForm.value.groups]
  if (direction === 'up' && index > 0) [groups[index], groups[index - 1]] = [groups[index - 1], groups[index]]
  else if (direction === 'down' && index < groups.length - 1) [groups[index], groups[index + 1]] = [groups[index + 1], groups[index]]
  else return
  groups.forEach((g, idx) => g.order = idx)
  tabForm.value.groups = groups
}

// Управление полями
function addField(groupIndex: number) {
  editingGroupIdForField.value = groupIndex
  editingFieldIndex.value = null
  fieldForm.value = {
    key: '',
    label: '',
    type: 'string',
    required: false,
    defaultValue: null,
    placeholder: '',
    description: '',
    options: [],
    validation: { min: null, max: null, minLength: null, maxLength: null, pattern: '', customMessage: '' },
    display: {
      showInTable: true,
      showInCard: true,
      showInDetail: true,
      showInQuickView: false,
      width: 1,
      format: '',
      prefix: '',
      suffix: ''
    },
    isArray: false,
    isUnique: false,
    isSearchable: true,
    isFilterable: true,
    isSortable: true,
    isReadonly: false,
    isHidden: false
  }
  showFieldForm.value = true
}

function editField(groupIndex: number, fieldIndex: number) {
  editingGroupIdForField.value = groupIndex
  editingFieldIndex.value = fieldIndex
  const field = tabForm.value.groups[groupIndex].fields[fieldIndex]
  fieldForm.value = JSON.parse(JSON.stringify(field))
  showFieldForm.value = true
}

function saveField() {
  if (!fieldForm.value.key || !fieldForm.value.label) {
    addNotification('warning', 'Заполните ключ и название поля')
    return
  }
  const sanitizedKey = fieldForm.value.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (sanitizedKey !== fieldForm.value.key) {
    fieldForm.value.key = sanitizedKey
    addNotification('warning', 'Ключ изменён на латиницу')
    return
  }
  const group = tabForm.value.groups[editingGroupIdForField.value!]
  const isUnique = group.fields.every((f: any, idx: number) => f.key !== sanitizedKey || idx === editingFieldIndex.value)
  if (!isUnique) {
    addNotification('error', 'Поле с таким ключом уже существует в этой группе')
    return
  }
  const fieldData = {
    ...fieldForm.value,
    key: sanitizedKey,
    order: editingFieldIndex.value !== null ? group.fields[editingFieldIndex.value].order : group.fields.length
  }
  if (editingFieldIndex.value !== null) {
    group.fields[editingFieldIndex.value] = fieldData
  } else {
    group.fields.push(fieldData)
  }
  showFieldForm.value = false
}

function removeField(groupIndex: number, fieldIndex: number) {
  if (confirm('Удалить поле?')) {
    tabForm.value.groups[groupIndex].fields.splice(fieldIndex, 1)
  }
}

function moveField(groupIndex: number, fieldIndex: number, direction: 'up' | 'down') {
  const fields = tabForm.value.groups[groupIndex].fields
  if (direction === 'up' && fieldIndex > 0) [fields[fieldIndex], fields[fieldIndex - 1]] = [fields[fieldIndex - 1], fields[fieldIndex]]
  else if (direction === 'down' && fieldIndex < fields.length - 1) [fields[fieldIndex], fields[fieldIndex + 1]] = [fields[fieldIndex + 1], fields[fieldIndex]]
  else return
  fields.forEach((f: any, idx: number) => f.order = idx)
}

function addOption() {
  if (!newOption.value.label || !newOption.value.value) {
    addNotification('warning', 'Заполните метку и значение')
    return
  }
  fieldForm.value.options.push({ ...newOption.value })
  newOption.value = { label: '', value: '', color: '#6496ff' }
}

function removeOption(idx: number) {
  fieldForm.value.options.splice(idx, 1)
}

async function loadPreviewStandards(tab: any) {
  if (!tab?._id) return
  try {
    const res = await $fetch(`/api/enterprises/${getEnterpriseId()}/standards?tabId=${tab._id}`)
    previewStandardsList.value = res.standards || []
    const defaultStd = previewStandardsList.value.find((s: any) => s.isDefault) || previewStandardsList.value[0]
    previewStandard.value = defaultStd || null
  } catch (e) {
    previewStandardsList.value = []
    previewStandard.value = null
  }
}

function openStandardsEditor(tab: any) {
  openWindow('settings', 'standard', null, { width: 1200, height: 800 }, false, null, null, {
    tabId: tab._id,
    enterpriseId: getEnterpriseId()
  })
}

function previewTab(tab: any) {
  selectedTab.value = tab
  activeSection.value = 'preview'
  loadPreviewStandards(tab)
}

function selectTab(tab: any) {
  selectedTab.value = tab
  activeSection.value = 'tab-editor'
  editTab(tab)
}

function getTotalFieldsCount(tab: any): number {
  return tab?.groups?.reduce((acc: number, g: any) => acc + (g.fields?.length || 0), 0) || 0
}

onMounted(() => {
  currentEnterpriseId.value = getEnterpriseId()
  if (currentEnterpriseId.value) loadTabs()
})
</script>

<template>
  <div class="configurator">
    <div class="configurator-header">
      <h2>Конфигуратор предприятия</h2>
      <div class="header-actions">
        <MoloButton class="confirm" @click="createNewTab">Новая вкладка</MoloButton>
      </div>
    </div>

    <div class="section-nav">
      <MoloButton :class="['default', { confirm: activeSection === 'tabs' }]" @click="activeSection = 'tabs'">Вкладки</MoloButton>
      <MoloButton v-if="showTabForm" :class="['default', { confirm: activeSection === 'tab-editor' }]" @click="activeSection = 'tab-editor'">Редактор</MoloButton>
      <MoloButton :class="['default', { confirm: activeSection === 'preview' && selectedTab }]" :disabled="!selectedTab" @click="activeSection = 'preview'">Предпросмотр</MoloButton>
    </div>

    <hr />

    <div class="configurator-content">
      <!-- Список вкладок -->
      <div v-if="activeSection === 'tabs'" class="section-content">
        <div class="tabs-grid">
          <div v-for="tab in tabs" :key="tab._id" class="tab-card" @click="selectTab(tab)">
            <section class="card-info">
              <div :style="{ background: tab.color || '#6496ff' }" class="tab-icon">
                <span class="material-icons">{{ tab.name.charAt(0) }}</span>
              </div>
              <div class="tab-info">
                <h3>{{ tab.name }}</h3>
                <p>{{ tab.description || 'Нет описания' }}</p>
                <div class="tab-meta">
                  <span class="meta-badge">{{ categories.find(c => c.value === tab.category)?.label || tab.category }}</span>
                  <span class="meta-count">{{ getTotalFieldsCount(tab) }} полей</span>
                  <span class="meta-count">{{ tab.groups?.length || 0 }} групп</span>
                </div>
              </div>
            </section>
            <div class="tab-actions">
              <MoloButton class="action-btn-small" title="Редактировать" @click.stop="editTab(tab)">✎</MoloButton>
              <MoloButton class="action-btn-small" title="Стандарты" @click.stop="openStandardsEditor(tab)">🎨</MoloButton>
              <MoloButton class="action-btn-small" title="Предпросмотр" @click.stop="previewTab(tab)">👁</MoloButton>
              <MoloButton class="action-btn-small" title="Удалить" @click.stop="deleteTab(tab._id)">×</MoloButton>
            </div>
          </div>

          <div v-if="tabs.length === 0 && !loading" class="empty-state">
            <p>Нет созданных вкладок</p>
            <MoloButton class="confirm" @click="createNewTab">Создать первую вкладку</MoloButton>
          </div>
        </div>
      </div>

      <!-- Редактор вкладки -->
      <div v-if="activeSection === 'tab-editor' && showTabForm" class="section-content">
        <div class="tab-editor">
          <h3>{{ editingTab ? 'Редактирование' : 'Создание' }} вкладки</h3>

          <div class="editor-section">
            <h4>Основные настройки</h4>
            <div class="form-grid">
              <MoloInput v-model="tabForm.name" tLabel="Название вкладки *" @input="generateSlug" />
              <MoloInput v-model="tabForm.slug" tLabel="Ключ (slug) *" />
              <MoloInput v-model="tabForm.description" tLabel="Описание" />
              <MoloInput v-model="tabForm.color" tLabel="Цвет" type="color" />
              <MoloSelect v-model="tabForm.category" :parent="categories" children="label" tLabel="Категория" valueKey="value" />
              <MoloSelect v-model="tabForm.defaultViewType" :parent="viewTypes" children="label" tLabel="Тип отображения по умолчанию" valueKey="value" />
            </div>
          </div>

          <!-- Группы полей -->
          <div class="editor-section">
            <div class="section-header">
              <div>
                <h4>Группы полей</h4>
                <p class="section-desc">Каждая группа станет колонкой в таблице (если в стандарте включена опция «Колонки по группам»)</p>
              </div>
              <MoloButton class="confirm" @click="addGroup">+ Добавить группу</MoloButton>
            </div>

            <div v-if="tabForm.groups.length === 0" class="empty-fields">Нет групп</div>

            <div v-for="(group, gIdx) in tabForm.groups" :key="gIdx" class="group-card">
              <div class="group-header">
                <div class="group-order">
                  <button :disabled="gIdx === 0" @click="moveGroup(gIdx, 'up')">▲</button>
                  <button :disabled="gIdx === tabForm.groups.length - 1" @click="moveGroup(gIdx, 'down')">▼</button>
                </div>
                <div class="group-info">
                  <h5>{{ group.name }}</h5>
                  <p>{{ group.description || 'Нет описания' }}</p>
                  <span class="field-count">{{ group.fields?.length || 0 }} полей</span>
                </div>
                <div class="group-actions">
                  <MoloButton class="action-btn-small" @click="editGroup(gIdx)">✎</MoloButton>
                  <MoloButton class="action-btn-small" @click="removeGroup(gIdx)">×</MoloButton>
                </div>
              </div>

              <div class="group-fields">
                <div class="fields-header">
                  <span>Поля этой группы</span>
                  <MoloButton class="confirm small" @click="addField(gIdx)">+ Добавить поле</MoloButton>
                </div>

                <div v-if="!group.fields || group.fields.length === 0" class="empty-fields">Нет полей</div>

                <div v-for="(field, fIdx) in (group.fields || [])" :key="fIdx" class="field-item">
                  <div class="field-order">
                    <button :disabled="fIdx === 0" @click="moveField(gIdx, fIdx, 'up')">▲</button>
                    <button :disabled="fIdx === (group.fields?.length || 0) - 1" @click="moveField(gIdx, fIdx, 'down')">▼</button>
                  </div>
                  <div class="field-icon">{{ fieldTypes.find(t => t.value === field.type)?.label[0] || 'T' }}</div>
                  <div class="field-info">
                    <div class="field-name">
                      <span class="field-key">{{ field.key }}</span>
                      <span class="field-separator">—</span>
                      <span class="field-label">{{ field.label }}</span>
                    </div>
                    <div class="field-meta">
                      <span class="field-type-badge">{{ fieldTypes.find(t => t.value === field.type)?.label || field.type }}</span>
                      <span v-if="field.required" class="field-badge required">Обязательное</span>
                    </div>
                  </div>
                  <div class="field-actions">
                    <MoloButton class="action-btn-small" @click="editField(gIdx, fIdx)">✎</MoloButton>
                    <MoloButton class="action-btn-small delete" @click="removeField(gIdx, fIdx)">×</MoloButton>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="info-box">
            <div class="info-icon">ℹ️</div>
            <div class="info-text">
              <strong>Как это работает:</strong>
              <ul>
                <li><strong>Группа</strong> = название колонки (если стандарт это поддерживает)</li>
                <li><strong>Поля внутри группы</strong> — строки этой колонки для каждой записи</li>
                <li>В стандарте отображения можно включить режим «Колонки по группам», тогда таблица будет строиться не по отдельным полям, а по группам</li>
              </ul>
            </div>
          </div>

          <div class="editor-actions">
            <MoloButton class="confirm" @click="saveTab">💾 {{ editingTab ? 'Обновить' : 'Создать' }} вкладку</MoloButton>
            <MoloButton @click="showTabForm = false; activeSection = 'tabs'">Отмена</MoloButton>
          </div>
        </div>
      </div>

      <!-- Предпросмотр -->
      <div v-if="activeSection === 'preview' && selectedTab" class="section-content">
        <div class="preview-page">
          <div class="preview-toolbar">
            <h3>Предпросмотр вкладки: {{ selectedTab.name }}</h3>
            <div class="preview-controls">
              <MoloSelect
                  v-model="previewStandard"
                  :parent="previewStandardsList"
                  children="name"
                  tLabel="Стандарт отображения"
                  valueKey="_id"
                  clearable
              />
              <MoloButton class="default" @click="openStandardsEditor(selectedTab)">Управление стандартами</MoloButton>
            </div>
          </div>

          <MockDataPreview
              :fields="getAllFields()"
              :groups="selectedTab?.groups || []"
              :viewType="previewStandard?.type || selectedTab.defaultViewType || 'table'"
              :standard="previewStandard"
              :rowsCount="5"
          />

          <div class="preview-note">
            <p>Предпросмотр со стандартом «{{ previewStandard?.name || 'по умолчанию' }}». Реальные данные появятся после заполнения записей.</p>
            <p v-if="previewStandard?.settings?.useGroupsAsColumns"><strong>Колонки соответствуют группам вкладки.</strong></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Модалки -->
    <div v-if="showGroupForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ editingGroupIndex !== null ? 'Редактирование' : 'Новая' }} группа</h3>
        <p class="modal-desc">Название группы станет заголовком колонки в таблице (при соответствующем стандарте)</p>
        <MoloInput v-model="groupForm.name" tLabel="Название группы *" />
        <MoloInput v-model="groupForm.description" tLabel="Описание" />
        <div class="modal-actions">
          <MoloButton class="confirm" @click="saveGroup">Сохранить</MoloButton>
          <MoloButton @click="showGroupForm = false">Отмена</MoloButton>
        </div>
      </div>
    </div>

    <div v-if="showFieldForm" class="modal-overlay">
      <div class="modal modal-large">
        <h3>{{ editingFieldIndex !== null ? 'Редактирование' : 'Новое' }} поле</h3>
        <p class="modal-desc">Поле — строка внутри колонки-группы</p>
        <div class="form-grid">
          <MoloInput v-model="fieldForm.key" tLabel="Ключ поля *" placeholder="например: project_name" />
          <MoloInput v-model="fieldForm.label" tLabel="Название поля *" placeholder="например: Название проекта" />
          <MoloSelect v-model="fieldForm.type" :parent="fieldTypes" children="label" tLabel="Тип поля" valueKey="value" />
          <MoloInput v-model="fieldForm.placeholder" tLabel="Подсказка" />
          <MoloInput v-model="fieldForm.description" tLabel="Описание" />
        </div>
        <div v-if="['select', 'multiselect'].includes(fieldForm.type)" class="options-editor">
          <h6>Варианты выбора</h6>
          <div class="options-list">
            <div v-for="(opt, idx) in fieldForm.options" :key="idx" class="option-item">
              <span :style="{ background: opt.color }" class="option-color"></span>
              <span>{{ opt.label }} ({{ opt.value }})</span>
              <MoloButton @click="removeOption(idx)">×</MoloButton>
            </div>
          </div>
          <div class="add-option">
            <MoloInput v-model="newOption.label" tLabel="Метка" />
            <MoloInput v-model="newOption.value" tLabel="Значение" />
            <MoloInput v-model="newOption.color" tLabel="Цвет" type="color" />
            <MoloButton class="confirm" @click="addOption">+</MoloButton>
          </div>
        </div>
        <div class="field-flags">
          <h6>Дополнительно</h6>
          <div class="flags-grid">
            <label><input v-model="fieldForm.required" type="checkbox" /> Обязательное</label>
            <label><input v-model="fieldForm.isArray" type="checkbox" /> Массив</label>
            <label><input v-model="fieldForm.isUnique" type="checkbox" /> Уникальное</label>
            <label><input v-model="fieldForm.isSearchable" type="checkbox" /> Поиск</label>
            <label><input v-model="fieldForm.isFilterable" type="checkbox" /> Фильтр</label>
            <label><input v-model="fieldForm.isSortable" type="checkbox" /> Сортировка</label>
          </div>
        </div>
        <div class="modal-actions">
          <MoloButton class="confirm" @click="saveField">Сохранить поле</MoloButton>
          <MoloButton @click="showFieldForm = false">Отмена</MoloButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.configurator {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #e0e0e0;
  padding: 20px;
  gap: 15px;
  font-family: 'Inter', system-ui, sans-serif;
}

.configurator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 12px;
}

.section-nav {
  display: flex;
  gap: 12px;
  overflow-x: auto;
}

.tabs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.tab-card {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 14px;
  cursor: pointer;
  transition: 0.2s;
}

.tab-card:hover {
  background: #1c1c22;
  border-color: #3a3a44;
}

.card-info {
  display: flex;
  flex-direction: row;
  gap: 10px;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.tab-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 24px;
  flex-shrink: 0;
}

.tab-info {
  flex: 1;
  min-width: 0;
}

.tab-info h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.tab-info p {
  margin: 0 0 10px;
  font-size: 13px;
  color: #8e8e9e;
}

.tab-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-badge, .meta-count {
  font-size: 11px;
  padding: 2px 10px;
  background: #25252c;
  border-radius: 20px;
  color: #bbb;
}

.tab-actions {
  display: flex;
  gap: 6px;
  flex-direction: row;
  align-items: flex-start;
}

.editor-section {
  background: #141418;
  border: 1px solid #25252c;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.section-header h4 {
  margin: 0 0 4px 0;
}

.section-desc {
  margin: 0;
  font-size: 12px;
  color: #8e8e9e;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.group-card {
  background: #0c0c10;
  border: 1px solid #25252c;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.group-order {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-order button {
  background: none;
  border: 1px solid #3a3a44;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  padding: 2px 6px;
}

.group-info {
  flex: 1;
}

.group-info h5 {
  margin: 0;
  font-size: 15px;
}

.group-info p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8e8e9e;
}

.field-count {
  font-size: 11px;
  color: #6496ff;
  background: rgba(100, 150, 255, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
  margin-top: 4px;
}

.fields-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px 0 10px;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: #0f0f14;
  border-radius: 10px;
  margin-bottom: 6px;
}

.field-order {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field-order button {
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
}

.field-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #25252c;
  border-radius: 8px;
  font-size: 14px;
  flex-shrink: 0;
}

.field-info {
  flex: 1;
}

.field-name {
  font-size: 13px;
}

.field-key {
  font-family: monospace;
  background: #25252c;
  padding: 2px 6px;
  border-radius: 6px;
  color: #6496ff;
}

.field-separator {
  margin: 0 4px;
  color: #555;
}

.field-label {
  color: #ccc;
}

.field-meta {
  margin-top: 4px;
  display: flex;
  gap: 8px;
}

.field-type-badge {
  font-size: 10px;
  background: #25252c;
  padding: 2px 8px;
  border-radius: 12px;
}

.field-badge.required {
  background: #aa2e2e;
  color: white;
}

.field-badge.unique {
  background: #2e7daa;
  color: white;
}

.action-btn-small {
  background: none;
  border: 1px solid var(--half_opacity_border);
  cursor: pointer;
  color: #bbb;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
}

.action-btn-small:hover {
  background: rgba(255, 255, 255, 0.1);
}

.action-btn-small.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.empty-fields {
  text-align: center;
  padding: 20px;
  color: #8e8e9e;
}

.empty-state {
  text-align: center;
  padding: 40px;
}

.info-box {
  background: rgba(100, 150, 255, 0.1);
  border: 1px solid rgba(100, 150, 255, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}

.info-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.info-text {
  font-size: 13px;
  color: #b0c4de;
}

.info-text strong {
  color: #6496ff;
}

.info-text ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.info-text li {
  margin-bottom: 4px;
}

.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #1a1a1f;
  border: 1px solid #3a3a44;
  border-radius: 20px;
  padding: 24px;
  width: 500px;
  max-width: 90%;
}

.modal-large {
  width: 700px;
}

.modal-desc {
  font-size: 12px;
  color: #8e8e9e;
  margin: 0 0 16px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.options-list {
  margin: 10px 0;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  background: #0f0f14;
  margin-bottom: 4px;
  border-radius: 8px;
}

.option-color {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.add-option {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.flags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
}

.flags-grid label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.preview-page {
  background: #141418;
  border: 1px solid #25252c;
  border-radius: 14px;
  padding: 20px;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.preview-toolbar h3 {
  margin: 0;
}

.preview-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.preview-note {
  margin-top: 16px;
  padding: 12px;
  background: rgba(100, 150, 255, 0.1);
  border: 1px solid rgba(100, 150, 255, 0.2);
  border-radius: 8px;
  font-size: 13px;
  color: #b0c4de;
}

.preview-note p {
  margin: 4px 0;
}

.small {
  font-size: 12px;
  padding: 4px 12px;
}
</style>