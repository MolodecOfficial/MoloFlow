<!-- standard.vue -->
<script lang="ts" setup>
import MockDataPreview from '~~/app/components/MockDataPreview.vue'

const props = defineProps<{
  enterpriseId?: string
  tabId?: string
  tabFields?: any[]
}>()

const emit = defineEmits(['saved', 'cancel'])

const route = useRoute()
const { addNotification } = useNotifications('Стандарты')
const standards = ref<any[]>([])
const loading = ref(false)
const showEditor = ref(false)
const editingId = ref<string | null>(null)

// Локальные поля вкладки (загружаются по tabId)
const localTabFields = ref<any[]>(props.tabFields || [])

// Список вкладок для выбора
const availableTabs = ref<any[]>([])

// ID предприятия и вкладки
const effectiveEnterpriseId = computed(() => {
  return props.enterpriseId || (route.query.enterpriseId as string) || ''
})

const effectiveTabId = ref(props.tabId || (route.query.tabId as string) || '')

// Сохраняем tabId в localStorage
watch(effectiveTabId, (newId) => {
  if (newId) localStorage.setItem('lastStandardTabId', newId)
}, { immediate: true })

// Форма стандарта
const form = ref({
  name: '',
  description: '',
  type: 'table',
  isDefault: false,
  settings: {
    columns: [] as { field: string; label: string; width?: string; align?: string; sortable?: boolean }[],
    tableDensity: 'normal',
    tableStriped: true,
    tableHoverable: true,
    cardTitle: '',
    cardSubtitle: '',
    cardFields: [] as string[],
    cardColumns: 3,
    cardAvatarField: '',
    cardShowFooter: true,
    cardShowStatus: true,
    listTitle: '',
    listSubtitle: '',
    listShowIcon: true,
    listShowDivider: true,
    showSearch: true,
    showFilters: true,
    showPagination: true,
    itemsPerPage: 20,
    emptyStateMessage: 'Нет данных для отображения',
    emptyStateIcon: '📭'
  }
})

// Превью стандарта
const previewStandard = computed(() => ({
  _id: editingId.value || 'preview',
  name: form.value.name,
  type: form.value.type,
  isDefault: form.value.isDefault,
  tableSettings: {
    columns: form.value.settings.columns,
    density: form.value.settings.tableDensity,
    striped: form.value.settings.tableStriped,
    hoverable: form.value.settings.tableHoverable
  },
  cardSettings: {
    title: form.value.settings.cardTitle,
    subtitle: form.value.settings.cardSubtitle,
    fields: form.value.settings.cardFields,
    columns: form.value.settings.cardColumns,
    avatarField: form.value.settings.cardAvatarField,
    showFooter: form.value.settings.cardShowFooter,
    showStatus: form.value.settings.cardShowStatus
  },
  listSettings: {
    title: form.value.settings.listTitle,
    subtitle: form.value.settings.listSubtitle,
    showIcon: form.value.settings.listShowIcon,
    showDivider: form.value.settings.listShowDivider
  },
  showSearch: form.value.settings.showSearch,
  showFilters: form.value.settings.showFilters,
  showPagination: form.value.settings.showPagination,
  itemsPerPage: form.value.settings.itemsPerPage,
  emptyStateMessage: form.value.settings.emptyStateMessage,
  emptyStateIcon: form.value.settings.emptyStateIcon
}))

function getEnterpriseId() {
  if (effectiveEnterpriseId.value) return effectiveEnterpriseId.value
  const str = localStorage.getItem('currentEnterprise')
  return str ? JSON.parse(str)._id : ''
}

async function loadTabFields(tabId: string) {
  if (!tabId) return
  try {
    const res = await $fetch(`/api/enterprises/${getEnterpriseId()}/tabs/${tabId}`)
    const tab = res.tab
    if (tab && tab.groups) {
      // Собираем все поля из групп в плоский массив
      const allFields: any[] = []
      for (const group of tab.groups) {
        if (group.fields && Array.isArray(group.fields)) {
          allFields.push(...group.fields)
        }
      }
      localTabFields.value = allFields
    } else {
      localTabFields.value = []
    }
  } catch (e) {
    localTabFields.value = props.tabFields || []
  }
}
// Загрузка списка вкладок
async function loadAvailableTabs() {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) {
    addNotification('error', 'Не удалось определить предприятие')
    return
  }
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseId}/tabs`)
    availableTabs.value = response.tabs || []

    if (!effectiveTabId.value && availableTabs.value.length > 0) {
      effectiveTabId.value = availableTabs.value[0]._id
      await selectTab(effectiveTabId.value)
    }
  } catch (e) {
    addNotification('error', 'Ошибка загрузки списка вкладок')
  }
}


function selectTab(tabId: string) {
  if (!tabId) {
    // Если вкладка не выбрана – очищаем стандарты
    effectiveTabId.value = ''
    standards.value = []
    localTabFields.value = []
    return
  }
  effectiveTabId.value = tabId
  loadTabFields(tabId)
  loadStandards()
}

// Загрузка стандартов
async function loadStandards() {
  const tabId = effectiveTabId.value
  if (!tabId) return
  loading.value = true
  try {
    const { standards: data } = await $fetch(`/api/enterprises/${getEnterpriseId()}/standards?tabId=${tabId}`)
    standards.value = data || []
  } catch (e) {
    addNotification('error', 'Ошибка загрузки стандартов')
    standards.value = []
  } finally {
    loading.value = false
  }
}

// Создание нового стандарта
function create(viewType: string) {
  const fields = localTabFields.value
  editingId.value = null
  form.value = {
    name: '',
    description: '',
    type: viewType,
    isDefault: false,
    settings: {
      columns: fields.map(f => ({ field: f.key, label: f.label, width: 'auto', align: 'left', sortable: true })),
      tableDensity: 'normal',
      tableStriped: true,
      tableHoverable: true,
      cardTitle: fields[0]?.key || '',
      cardSubtitle: fields[1]?.key || '',
      cardFields: fields.map(f => f.key),
      cardColumns: 3,
      cardAvatarField: '',
      cardShowFooter: true,
      cardShowStatus: true,
      listTitle: fields[0]?.key || '',
      listSubtitle: fields[1]?.key || '',
      listShowIcon: true,
      listShowDivider: true,
      showSearch: true,
      showFilters: true,
      showPagination: true,
      itemsPerPage: 20,
      emptyStateMessage: 'Нет данных для отображения',
      emptyStateIcon: '📭'
    }
  }
  showEditor.value = true
}

// Редактирование стандарта
function edit(standard: any) {
  const fields = localTabFields.value
  editingId.value = standard._id
  form.value = {
    name: standard.name,
    description: standard.description || '',
    type: standard.type,
    isDefault: standard.isDefault,
    settings: {
      columns: standard.settings?.columns ||
          standard.tableSettings?.columns ||
          fields.map(f => ({ field: f.key, label: f.label, width: 'auto', align: 'left', sortable: true })),
      tableDensity: standard.settings?.tableDensity || standard.tableSettings?.density || 'normal',
      tableStriped: standard.settings?.tableStriped ?? standard.tableSettings?.striped ?? true,
      tableHoverable: standard.settings?.tableHoverable ?? standard.tableSettings?.hoverable ?? true,
      cardTitle: standard.settings?.cardTitle || standard.cardSettings?.title || fields[0]?.key || '',
      cardSubtitle: standard.settings?.cardSubtitle || standard.cardSettings?.subtitle || fields[1]?.key || '',
      cardFields: standard.settings?.cardFields || standard.cardSettings?.fields || fields.map(f => f.key),
      cardColumns: standard.settings?.cardColumns || standard.cardSettings?.columns || 3,
      cardAvatarField: standard.settings?.cardAvatarField || standard.cardSettings?.avatarField || '',
      cardShowFooter: standard.settings?.cardShowFooter ?? standard.cardSettings?.showFooter ?? true,
      cardShowStatus: standard.settings?.cardShowStatus ?? standard.cardSettings?.showStatus ?? true,
      listTitle: standard.settings?.listTitle || standard.listSettings?.title || fields[0]?.key || '',
      listSubtitle: standard.settings?.listSubtitle || standard.listSettings?.subtitle || fields[1]?.key || '',
      listShowIcon: standard.settings?.listShowIcon ?? standard.listSettings?.showIcon ?? true,
      listShowDivider: standard.settings?.listShowDivider ?? standard.listSettings?.showDivider ?? true,
      showSearch: standard.settings?.showSearch ?? standard.showSearch ?? true,
      showFilters: standard.settings?.showFilters ?? standard.showFilters ?? true,
      showPagination: standard.settings?.showPagination ?? standard.showPagination ?? true,
      itemsPerPage: standard.settings?.itemsPerPage || standard.itemsPerPage || 20,
      emptyStateMessage: standard.settings?.emptyStateMessage || standard.emptyStateMessage || 'Нет данных для отображения',
      emptyStateIcon: standard.settings?.emptyStateIcon || standard.emptyStateIcon || '📭'
    }
  }
  showEditor.value = true
}

// Сохранение стандарта
async function save() {
  if (!form.value.name) return addNotification('warning', 'Введите название')
  const tabId = effectiveTabId.value
  if (!tabId) return addNotification('error', 'Не указана вкладка')

  const body = {
    name: form.value.name,
    description: form.value.description,
    type: form.value.type,
    isDefault: form.value.isDefault,
    tabId,
    enterpriseId: getEnterpriseId(),
    settings: form.value.settings
  }

  const url = editingId.value
      ? `/api/enterprises/${getEnterpriseId()}/standards/${editingId.value}`
      : `/api/enterprises/${getEnterpriseId()}/standards`

  try {
    const response = await $fetch(url, { method: editingId.value ? 'PUT' : 'POST', body })
    addNotification('success', `Стандарт "${response.standard.name}" сохранён`)
    showEditor.value = false
    await loadStandards()
    emit('saved', response.standard)
  } catch (e: any) {
    addNotification('error', e?.data?.message || 'Ошибка сохранения')
  }
}

// Удаление стандарта
async function remove(id: string) {
  if (!confirm('Удалить стандарт? Это действие нельзя отменить.')) return
  try {
    await $fetch(`/api/enterprises/${getEnterpriseId()}/standards/${id}`, { method: 'DELETE' })
    await loadStandards()
    addNotification('info', 'Стандарт удалён')
  } catch (e) {
    addNotification('error', 'Ошибка удаления')
  }
}

// Установить как стандарт по умолчанию
async function setAsDefault(standard: any) {
  try {
    await $fetch(`/api/enterprises/${getEnterpriseId()}/standards/${standard._id}`, {
      method: 'PUT',
      body: { isDefault: true, tabId: effectiveTabId.value, type: standard.type }
    })
    addNotification('success', `"${standard.name}" установлен как стандарт по умолчанию`)
    await loadStandards()
  } catch (e) {
    addNotification('error', 'Ошибка установки стандарта')
  }
}

onMounted(async () => {
  await loadAvailableTabs()

  if (!effectiveTabId.value) {
    const saved = localStorage.getItem('lastStandardTabId')
    if (saved) effectiveTabId.value = saved
  }

  if (effectiveTabId.value) {
    await loadTabFields(effectiveTabId.value)
    await loadStandards()
  } else {
    await loadAvailableTabs()
    await loadStandards()
  }
})
</script>

<template>
  <div class="standards-layout">
    <!-- Боковая панель -->
    <div class="standards-sidebar">
      <div class="sidebar-header">
        <h2>Стандарты отображения</h2>
        <p class="sidebar-subtitle">Создавайте и управляйте стандартами для вкладок</p>
      </div>

      <!-- Выбор вкладки -->
      <div class="tab-selector">
        <label></label>
        <MoloSelect
            v-model="effectiveTabId"
            :parent="availableTabs"
            valueKey="_id"
            children="name"
            tLabel="Привязать к вкладке"
            clearable
            @update:model-value="selectTab"
        />
      </div>

      <!-- Кнопки создания -->
      <div v-if="effectiveTabId" class="create-section">
        <h4>Создать новый стандарт</h4>
        <div class="create-buttons">
          <button class="create-btn table-btn" @click="create('table')">
            <span class="btn-icon">📊</span>
            <span class="btn-label">Таблица</span>
          </button>
          <button class="create-btn card-btn" @click="create('card')">
            <span class="btn-icon">🃏</span>
            <span class="btn-label">Карточки</span>
          </button>
          <button class="create-btn list-btn" @click="create('list')">
            <span class="btn-icon">📋</span>
            <span class="btn-label">Список</span>
          </button>
        </div>
      </div>

      <!-- Список стандартов -->
      <div class="standards-list">
        <div class="list-header">
          <span>Доступные стандарты</span>
          <span class="count-badge">{{ standards.length }}</span>
        </div>

        <div v-if="standards.length === 0 && !loading" class="empty-state">
          <div class="empty-icon">📭</div>
          <p>Нет созданных стандартов</p>
          <p class="empty-hint">Выберите вкладку и создайте первый стандарт</p>
        </div>

        <div
            v-for="std in standards"
            :key="std._id"
            class="standard-item"
            :class="{
            active: editingId === std._id,
            'is-default': std.isDefault
          }"
        >
          <div class="std-main" @click="edit(std)">
            <div class="std-type-icon">
              {{ std.type === 'table' ? '📊' : std.type === 'card' ? '🃏' : '📋' }}
            </div>
            <div class="std-info">
              <div class="std-name">{{ std.name }}</div>
              <div class="std-meta">
                <span class="std-type-badge">{{ std.type === 'table' ? 'Таблица' : std.type === 'card' ? 'Карточки' : 'Список' }}</span>
                <span v-if="std.isDefault" class="default-badge">По умолчанию</span>
              </div>
            </div>
          </div>

          <div class="std-actions">
            <div class="std-action-menu">
              <button class="std-action-btn" title="Редактировать" @click.stop="edit(std)">✎</button>
              <button v-if="!std.isDefault" class="std-action-btn" title="Сделать по умолчанию" @click.stop="setAsDefault(std)">⭐</button>
              <button class="std-action-btn danger" title="Удалить" @click.stop="remove(std._id)">×</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Редактор стандарта -->
    <div v-if="showEditor" class="standards-editor">
      <div class="editor-container">
        <!-- Форма -->
        <div class="editor-form">
          <div class="form-header">
            <h3>{{ editingId ? 'Редактирование стандарта' : 'Новый стандарт' }}</h3>
            <section class="editor-actions">
              <MoloButton class="close" @click="showEditor = false">×</MoloButton>
              <MoloButton class="confirm" block @click="save">
                {{ editingId ? 'Обновить' : 'Создать' }} стандарт
              </MoloButton>
            </section>
          </div>

          <div class="form-section">
            <h4>Основная информация</h4>
            <div class="form-grid">
              <MoloInput v-model="form.name" tLabel="Название стандарта *" placeholder="Например: Стандартная таблица" />
              <MoloInput v-model="form.description" tLabel="Описание" placeholder="Для чего используется этот стандарт" />
            </div>

            <div class="form-row">
              <MoloSelect
                  v-model="form.type"
                  :parent="[
                  {label:'📊 Таблица', value:'table'},
                  {label:'🃏 Карточки', value:'card'},
                  {label:'📋 Список', value:'list'}
                ]"
                  children="label"
                  valueKey="value"
                  tLabel="Тип отображения"
              />

              <label class="checkbox-label">
                <input type="checkbox" v-model="form.isDefault">
                <span>Использовать по умолчанию</span>
              </label>
            </div>
          </div>

          <!-- Настройки таблицы -->
          <div v-if="form.type === 'table'" class="form-section">
            <h4>📊 Настройки таблицы</h4>

            <div class="form-row">
              <MoloSelect
                  v-model="form.settings.tableDensity"
                  :parent="[
                  {label:'Компактная', value:'compact'},
                  {label:'Нормальная', value:'normal'},
                  {label:'Просторная', value:'spacious'}
                ]"
                  children="label"
                  valueKey="value"
                  tLabel="Плотность"
              />
            </div>

            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.settings.tableStriped">
                <span>Полосатая таблица</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.settings.tableHoverable">
                <span>Подсветка строк при наведении</span>
              </label>
            </div>

            <div class="columns-editor">
              <div class="columns-header">
                <h5>Колонки таблицы</h5>
                <button class="add-btn" @click="form.settings.columns.push({ field: '', label: '', width: 'auto', align: 'left', sortable: true })">
                  + Добавить колонку
                </button>
              </div>

              <div class="columns-list">
                <div v-for="(col, idx) in form.settings.columns" :key="idx" class="column-item">
                  <div class="column-field">
                    <label>Поле</label>
                    <select v-model="col.field">
                      <option value="">Выберите поле</option>
                      <option v-for="f in localTabFields" :key="f.key" :value="f.key">{{ f.label }}</option>
                    </select>
                  </div>
                  <div class="column-label">
                    <label>Заголовок</label>
                    <input v-model="col.label" placeholder="Заголовок" />
                  </div>
                  <button class="remove-btn" @click="form.settings.columns.splice(idx, 1)" title="Удалить колонку">×</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Настройки карточек -->
          <div v-if="form.type === 'card'" class="form-section">
            <h4>🃏 Настройки карточек</h4>

            <div class="form-grid">
              <MoloSelect
                  v-model="form.settings.cardTitle"
                  :parent="localTabFields.map(f => ({ label: f.label, value: f.key }))"
                  children="label"
                  tLabel="Поле заголовка"
                  valueKey="value"
              />
              <MoloSelect
                  v-model="form.settings.cardSubtitle"
                  :parent="localTabFields.map(f => ({ label: f.label, value: f.key }))"
                  children="label"
                  tLabel="Поле подзаголовка"
                  valueKey="value"
              />
              <MoloSelect
                  v-model="form.settings.cardColumns"
                  :parent="[
                  {label:'1 колонка', value:1},
                  {label:'2 колонки', value:2},
                  {label:'3 колонки', value:3},
                  {label:'4 колонки', value:4}
                ]"
                  tLabel="Колонок в сетке"
                  valueKey="value"
                  children="label"
              />
            </div>

            <div class="fields-selector">
              <h5>Показываемые поля в карточке</h5>
              <div class="fields-checkboxes">
                <label v-for="f in localTabFields" :key="f.key" class="checkbox-label field-checkbox">
                  <input type="checkbox" :value="f.key" v-model="form.settings.cardFields">
                  <span>{{ f.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Настройки списка -->
          <div v-if="form.type === 'list'" class="form-section">
            <h4>📋 Настройки списка</h4>

            <div class="form-grid">
              <MoloSelect
                  v-model="form.settings.listTitle"
                  :parent="localTabFields.map(f => ({ label: f.label, value: f.key }))"
                  children="label"
                  tLabel="Поле заголовка"
                  valueKey="value"
              />
              <MoloSelect
                  v-model="form.settings.listSubtitle"
                  :parent="localTabFields.map(f => ({ label: f.label, value: f.key }))"
                  children="label"
                  tLabel="Поле подзаголовка"
                  valueKey="value"
              />
            </div>
          </div>
        </div>

        <!-- Превью -->
        <div class="editor-preview">
          <div class="preview-header">
            <h4>Предпросмотр</h4>
          </div>
          <MockDataPreview
              :fields="localTabFields"
              :viewType="form.type"
              :standard="previewStandard"
              :rowsCount="4"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Основной макет */
.standards-layout {
  display: flex;
  gap: 24px;
  height: 100%;
  padding: 24px;
  color: #e0e0e0;
}

/* Боковая панель */
.standards-sidebar {
  width: 340px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.03);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.sidebar-header h2 {
  margin: 0 0 6px 0;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.sidebar-subtitle {
  margin: 0;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
}

.tab-selector {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.tab-selector label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
}

.create-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.create-section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
}

.create-buttons {
  display: flex;
  gap: 8px;
}

.create-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: #fff;
}

.create-btn:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(100,150,255,0.3);
  transform: translateY(-2px);
}

.btn-icon {
  font-size: 24px;
}

.btn-label {
  font-size: 11px;
  font-weight: 500;
}

.standards-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
}

.count-badge {
  padding: 2px 8px;
  background: rgba(100,150,255,0.2);
  color: #6496ff;
  border-radius: 12px;
  font-size: 11px;
}

.standard-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.standard-item:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.1);
}

.standard-item.active {
  background: rgba(100,150,255,0.1);
  border-color: rgba(100,150,255,0.3);
}

.standard-item.is-default {
  border-left: 3px solid #ffc107;
}

.std-main {
  display: flex;
  gap: 10px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.std-type-icon {
  font-size: 20px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  flex-shrink: 0;
}

.std-info {
  min-width: 0;
}

.std-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.std-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.std-type-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  color: rgba(255,255,255,0.7);
}

.default-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255,193,7,0.2);
  color: #ffc107;
  border-radius: 8px;
}

.std-actions {
  display: flex;
  align-items: center;
}

.std-action-menu {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.standard-item:hover .std-action-menu {
  opacity: 1;
}

.std-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.std-action-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

.std-action-btn.danger:hover {
  background: rgba(239,68,68,0.2);
  border-color: rgba(239,68,68,0.3);
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: rgba(255,255,255,0.6);
}

.empty-hint {
  margin-top: 8px !important;
  font-size: 12px !important;
  color: rgba(255,255,255,0.4) !important;
}

/* Редактор */
.standards-editor {
  flex: 1;
  min-width: 0;
}

.editor-container {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.editor-form {
  flex: 1;
  min-width: 400px;
  background: rgba(255,255,255,0.03);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(255,255,255,0.08);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.form-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  font-size: 18px;
}

.close-btn:hover {
  background: rgba(239,68,68,0.2);
  color: #ef4444;
}

.form-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--half_opacity_bg);
  border-radius: 16px;
  border: 1px solid var(--half_opacity_border);
}

.form-section h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 600;
}

.form-section h5 {
  margin: 16px 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255,255,255,0.8);
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6496ff;
}

.columns-editor {
  margin-top: 16px;
}

.columns-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.add-btn {
  padding: 6px 12px;
  background: rgba(100,150,255,0.2);
  border: 1px solid rgba(100,150,255,0.3);
  border-radius: 8px;
  color: #6496ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.add-btn:hover {
  background: rgba(100,150,255,0.3);
}

.columns-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column-item {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 12px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.05);
}

.column-item label {
  display: block;
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 4px;
}

.column-item select,
.column-item input {
  padding: 6px 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  width: 100%;
}

.column-field { flex: 2; }
.column-label { flex: 2; }

.remove-btn {
  padding: 6px 8px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 6px;
  color: #ef4444;
  cursor: pointer;
}

.remove-btn:hover {
  background: rgba(239,68,68,0.2);
}

.fields-selector {
  margin-top: 16px;
}

.fields-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.field-checkbox {
  padding: 8px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
}

.editor-actions {
  display: flex;
  justify-content: end;
  gap: 12px;
}

.editor-preview {
  flex: 1.2;
  min-width: 400px;
  position: sticky;
  top: 24px;
  align-self: flex-start;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.preview-header {
  margin-bottom: 16px;
}

.preview-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .standards-layout {
    flex-direction: column;
    padding: 16px;
  }
  .standards-sidebar {
    width: 100%;
    max-height: 400px;
  }
  .editor-container {
    flex-direction: column;
  }
  .editor-form {
    min-width: 100%;
  }
  .editor-preview {
    position: static;
    min-width: 100%;
  }
}
</style>