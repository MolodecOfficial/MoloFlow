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

const localTabFields = ref<any[]>(props.tabFields || [])
const localTab = ref<any>(null)          // полный объект таба (для групп)
const availableTabs = ref<any[]>([])

const effectiveEnterpriseId = computed(() => props.enterpriseId || (route.query.enterpriseId as string) || '')
const effectiveTabId = ref(props.tabId || (route.query.tabId as string) || '')

watch(effectiveTabId, (newId) => {
  if (newId) localStorage.setItem('lastStandardTabId', newId)
}, { immediate: true })

const form = ref({
  name: '',
  description: '',
  type: 'table',
  isDefault: false,
  settings: {
    // общие
    useGroupsAsColumns: false,
    groupCellFormat: 'inline', // 'inline' или 'block'
    // для обычной таблицы
    columns: [] as { field: string; label: string; width?: string; align?: string; sortable?: boolean }[],
    tableDensity: 'normal',
    tableStriped: true,
    tableHoverable: true,
    // карточки
    cardTitle: '',
    cardSubtitle: '',
    cardFields: [] as string[],
    cardColumns: 3,
    cardAvatarField: '',
    cardShowFooter: true,
    cardShowStatus: true,
    // список
    listTitle: '',
    listSubtitle: '',
    listShowIcon: true,
    listShowDivider: true,
    // общие
    showSearch: true,
    showFilters: true,
    showPagination: true,
    itemsPerPage: 20,
    emptyStateMessage: 'Нет данных для отображения',
    emptyStateIcon: '📭'
  }
})

const previewStandard = computed(() => ({
  _id: editingId.value || 'preview',
  name: form.value.name,
  type: form.value.type,
  isDefault: form.value.isDefault,
  settings: { ...form.value.settings },
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
    localTab.value = tab
    if (tab && tab.groups) {
      const allFields: any[] = []
      for (const group of tab.groups) {
        if (group.fields) allFields.push(...group.fields)
      }
      localTabFields.value = allFields
    } else {
      localTabFields.value = []
    }
  } catch (e) {
    localTabFields.value = props.tabFields || []
  }
}

async function loadAvailableTabs() {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseId}/tabs`)
    availableTabs.value = response.tabs || []
    if (!effectiveTabId.value && availableTabs.value.length > 0) {
      effectiveTabId.value = availableTabs.value[0]._id
      await selectTab(effectiveTabId.value)
    }
  } catch (e) {
    addNotification('error', 'Ошибка загрузки вкладок')
  }
}

function selectTab(tabId: string) {
  if (!tabId) {
    effectiveTabId.value = ''
    standards.value = []
    localTabFields.value = []
    localTab.value = null
    return
  }
  effectiveTabId.value = tabId
  loadTabFields(tabId)
  loadStandards()
}

async function loadStandards() {
  const tabId = effectiveTabId.value
  if (!tabId) return
  loading.value = true
  try {
    const { standards: data } = await $fetch(`/api/enterprises/${getEnterpriseId()}/standards?tabId=${tabId}`)
    standards.value = data || []
  } catch (e) {
    addNotification('error', 'Ошибка загрузки стандартов')
  } finally {
    loading.value = false
  }
}

function create(viewType: string) {
  const fields = localTabFields.value
  editingId.value = null
  form.value = {
    name: '',
    description: '',
    type: viewType,
    isDefault: false,
    settings: {
      useGroupsAsColumns: false,
      groupCellFormat: 'inline',
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

function edit(standard: any) {
  const fields = localTabFields.value
  editingId.value = standard._id
  form.value = {
    name: standard.name,
    description: standard.description || '',
    type: standard.type,
    isDefault: standard.isDefault,
    settings: {
      useGroupsAsColumns: standard.settings?.useGroupsAsColumns ?? false,
      groupCellFormat: standard.settings?.groupCellFormat ?? 'inline',
      columns: standard.settings?.columns || standard.tableSettings?.columns || fields.map(f => ({ field: f.key, label: f.label, width: 'auto', align: 'left', sortable: true })),
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

async function remove(id: string) {
  if (!confirm('Удалить стандарт?')) return
  try {
    await $fetch(`/api/enterprises/${getEnterpriseId()}/standards/${id}`, { method: 'DELETE' })
    await loadStandards()
    addNotification('info', 'Стандарт удалён')
  } catch (e) {
    addNotification('error', 'Ошибка удаления')
  }
}

async function setAsDefault(standard: any) {
  try {
    await $fetch(`/api/enterprises/${getEnterpriseId()}/standards/${standard._id}`, {
      method: 'PUT',
      body: { isDefault: true, tabId: effectiveTabId.value, type: standard.type }
    })
    addNotification('success', `"${standard.name}" установлен по умолчанию`)
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
    <div class="standards-sidebar">
      <div class="sidebar-header">
        <h2>Стандарты отображения</h2>
        <p class="sidebar-subtitle">Настройте внешний вид записей</p>
      </div>

      <div class="tab-selector">
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

      <div v-if="effectiveTabId" class="create-section">
        <h4>Новый стандарт</h4>
        <div class="create-buttons">
          <MoloButton @click="create('table')">📊 Таблица</MoloButton>
          <MoloButton @click="create('card')">🃏 Карточки</MoloButton>
          <MoloButton @click="create('list')">📋 Список</MoloButton>
        </div>
      </div>

      <div class="standards-list">
        <div class="list-header">
          <span>Стандарты</span>
          <span class="count-badge">{{ standards.length }}</span>
        </div>
        <div v-if="standards.length === 0 && !loading" class="empty-state">
          <p>Нет стандартов</p>
        </div>
        <div v-for="std in standards" :key="std._id" class="standard-item" :class="{ active: editingId === std._id, 'is-default': std.isDefault }">
          <div class="std-main" @click="edit(std)">
            <div class="std-type-icon">{{ std.type === 'table' ? '📊' : std.type === 'card' ? '🃏' : '📋' }}</div>
            <div class="std-info">
              <div class="std-name">{{ std.name }}</div>
              <div class="std-meta">
                <span class="std-type-badge">{{ std.type === 'table' ? 'Таблица' : std.type === 'card' ? 'Карточки' : 'Список' }}</span>
                <span v-if="std.isDefault" class="default-badge">По умолчанию</span>
              </div>
            </div>
          </div>
          <div class="std-actions">
            <MoloButton class="std-action-btn" @click.stop="edit(std)">✎</MoloButton>
            <MoloButton v-if="!std.isDefault" class="std-action-btn" @click.stop="setAsDefault(std)">⭐</MoloButton>
            <MoloButton class="std-action-btn danger" @click.stop="remove(std._id)">×</MoloButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditor" class="standards-editor">
      <div class="editor-container">
        <div class="editor-form">
          <div class="form-header">
            <h3>{{ editingId ? 'Редактирование' : 'Новый' }} стандарт</h3>
            <section class="editor-actions">
              <MoloButton class="close" @click="showEditor = false">×</MoloButton>
              <MoloButton class="confirm" @click="save">Сохранить</MoloButton>
            </section>
          </div>

          <div class="form-section">
            <h4>Основное</h4>
            <div class="form-grid">
              <MoloInput v-model="form.name" tLabel="Название" lRequired/>
              <MoloInput v-model="form.description" tLabel="Описание" />
            </div>
            <MoloSelect
                v-model="form.type"
                :parent="[{label:'📊 Таблица', value:'table'},{label:'🃏 Карточки', value:'card'},{label:'📋 Список', value:'list'}]"
                children="label"
                valueKey="value"
                tLabel="Тип"
            />
            <label class="checkbox-label"><input type="checkbox" v-model="form.isDefault"> По умолчанию</label>
          </div>

          <!-- Таблица -->
          <div v-if="form.type === 'table'" class="form-section">
            <h4>Настройки таблицы</h4>

            <label class="checkbox-label">
              <input type="checkbox" v-model="form.settings.useGroupsAsColumns">
              <span><strong>Колонки по группам</strong> — каждая группа вкладки = колонка таблицы</span>
            </label>

            <div v-if="form.settings.useGroupsAsColumns" class="form-row">
              <MoloSelect
                  v-model="form.settings.groupCellFormat"
                  :parent="[{label:'В одну строку (через запятую)', value:'inline'}, {label:'Каждое поле с новой строки', value:'block'}]"
                  children="label"
                  valueKey="value"
                  tLabel="Формат ячейки"
              />
              <p class="section-hint">Поля группы будут отображаться в одной ячейке</p>
            </div>

            <template v-if="!form.settings.useGroupsAsColumns">
              <div class="form-row">
                <MoloSelect
                    v-model="form.settings.tableDensity"
                    :parent="[{label:'Компактная', value:'compact'},{label:'Нормальная', value:'normal'},{label:'Просторная', value:'spacious'}]"
                    children="label" valueKey="value" tLabel="Плотность"
                />
              </div>
              <div class="checkbox-group">
                <label class="checkbox-label"><input type="checkbox" v-model="form.settings.tableStriped"> Полосатая</label>
                <label class="checkbox-label"><input type="checkbox" v-model="form.settings.tableHoverable"> Подсветка строк</label>
              </div>

              <div class="columns-editor">
                <div class="columns-header">
                  <h5>Колонки</h5>
                  <button class="add-btn" @click="form.settings.columns.push({ field: '', label: '', width: 'auto', align: 'left', sortable: true })">+</button>
                </div>
                <div class="columns-list">
                  <div v-for="(col, idx) in form.settings.columns" :key="idx" class="column-item">
                    <MoloSelect
                        v-model="col.field"
                        :parent="localTabFields"
                        children="label"
                        valueKey="key"
                        disabled="Выберите поле"
                        tLabel="Выберите поле"
                        lRequired
                    />
                    <MoloInput v-model="col.label" placeholder="Заголовок" tLabel="Заголовок"/>
                    <MoloButton class="remove-btn" @click="form.settings.columns.splice(idx, 1)">*</MoloButton>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Карточки / Список без изменений -->
          <div v-if="form.type === 'card'" class="form-section">
            <h4>🃏 Карточки</h4>
            <div class="form-grid">
              <MoloSelect v-model="form.settings.cardTitle" :parent="localTabFields.map(f=>({label:f.label,value:f.key}))" children="label" valueKey="value" tLabel="Заголовок" />
              <MoloSelect v-model="form.settings.cardSubtitle" :parent="localTabFields.map(f=>({label:f.label,value:f.key}))" children="label" valueKey="value" tLabel="Подзаголовок" />
              <MoloSelect v-model="form.settings.cardColumns" :parent="[{label:'1',value:1},{label:'2',value:2},{label:'3',value:3},{label:'4',value:4}]" children="label" valueKey="value" tLabel="Колонок" />
            </div>
            <div class="fields-checkboxes">
              <label v-for="f in localTabFields" :key="f.key" class="checkbox-label"><input type="checkbox" :value="f.key" v-model="form.settings.cardFields"> {{ f.label }}</label>
            </div>
          </div>

          <div v-if="form.type === 'list'" class="form-section">
            <h4>📋 Список</h4>
            <div class="form-grid">
              <MoloSelect v-model="form.settings.listTitle" :parent="localTabFields.map(f=>({label:f.label,value:f.key}))" children="label" valueKey="value" tLabel="Заголовок" />
              <MoloSelect v-model="form.settings.listSubtitle" :parent="localTabFields.map(f=>({label:f.label,value:f.key}))" children="label" valueKey="value" tLabel="Подзаголовок" />
            </div>
          </div>
        </div>

        <div class="editor-preview">
          <div class="preview-header">
            <h4>Предпросмотр</h4>
          </div>
          <MockDataPreview
              :fields="localTabFields"
              :groups="localTab?.groups || []"
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
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
  color: rgba(255, 255, 255, 0.5);
}

.tab-selector {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.create-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.create-section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.create-buttons {
  display: flex;
  gap: 8px;
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
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.count-badge {
  padding: 2px 8px;
  background: rgba(100, 150, 255, 0.2);
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
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.standard-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.standard-item.active {
  background: rgba(100, 150, 255, 0.1);
  border-color: rgba(100, 150, 255, 0.3);
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
  background: rgba(255, 255, 255, 0.05);
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
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
}

.default-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
  border-radius: 8px;
}

.std-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.std-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.std-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.std-action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
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
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-width: 400px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.form-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--half_opacity_bg);
  border-radius: 16px;
  border: 1px solid var(--half_opacity_border);
}

.form-section h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
}

.section-hint {
  margin: 0 0 16px 0;
  font-size: 12px;
  color: #8e8e9e;
}

.form-section h5 {
  margin: 16px 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6496ff;
}

.columns-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.add-btn {
  padding: 6px 12px;
  background: rgba(100, 150, 255, 0.2);
  border: 1px solid rgba(100, 150, 255, 0.3);
  border-radius: 8px;
  color: #6496ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.add-btn:hover {
  background: rgba(100, 150, 255, 0.3);
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
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.column-item label {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.column-item select,
.column-item input {
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  width: 100%;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #ef4444;
  cursor: pointer;
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.fields-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.preview-header h4 {
  margin: 0 0 4px 0;
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