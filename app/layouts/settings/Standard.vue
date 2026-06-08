<script lang="ts" setup>
import MockDataPreview from '~~/app/components/MockDataPreview.vue'
import { useAppStore } from '~~/stores/appStore'

const props = defineProps<{
  enterpriseId?: string
  tabId: string
  tabFields?: any[]
}>()

const emit = defineEmits(['saved', 'cancel'])

const { addNotification } = useNotifications('Стандарты')
const { addLog } = useLogger('Стандарты')
const store = useAppStore()

const loadingSave = ref(false)
const loadingStandardsLocal = ref(false)
const settingDefault = ref(false)

const showEditor = ref(false)
const editingId = ref<string | null>(null)

const localTabFields = ref<any[]>(props.tabFields || [])
const localTab = ref<any>(null)
const standards = ref<any[]>([])

// Модальное окно удаления стандарта
const deleteStandardModalOpen = ref(false)
const standardToDelete = ref<any>(null)

// Загрузка полей вкладки
async function loadTabFields() {
  if (!props.tabId) return
  addLog('info', `Загрузка полей для вкладки...`)
  try {
    const tab = await store.loadTabById(props.tabId, true)
    localTab.value = tab
    if (tab && tab.groups) {
      const allFields: any[] = []
      for (const group of tab.groups) if (group.fields) allFields.push(...group.fields)
      localTabFields.value = allFields
      addLog('success', `Загружено ${allFields.length} полей`)
    } else {
      localTabFields.value = []
    }
  } catch (e) {
    addLog('error', `Ошибка загрузки полей: ${e}`)
    localTabFields.value = props.tabFields || []
  }
}

// Загрузка стандартов для текущей вкладки
async function loadStandards() {
  if (!props.tabId) return
  loadingStandardsLocal.value = true
  addLog('info', `Загрузка стандартов для вкладки...`)
  try {
    const loaded = await store.loadStandards(props.tabId, true)
    standards.value = [...loaded]
    addLog('success', `Загружено ${standards.value.length} стандартов`)
    if (editingId.value) {
      const updatedStandard = standards.value.find(s => s._id === editingId.value)
      if (updatedStandard) edit(updatedStandard)
    }
  } catch (e) {
    addLog('error', `Ошибка загрузки стандартов: ${e}`)
    standards.value = []
  } finally {
    loadingStandardsLocal.value = false
  }
}

const form = ref({
  name: '',
  description: '',
  type: 'table',
  isDefault: false,
  settings: {
    useGroupsAsColumns: false,
    groupCellFormat: 'inline',
    groupShowFieldLabels: false,
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
  },
  styles: {
    tableBackground: '',
    tableTextColor: '',
    tableBorderRadius: '',
    tableBorder: '',
    tableHeaderBackground: '',
    tableHeaderTextColor: '',
    tableCellPadding: '',
    cardBackground: '',
    cardTextColor: '',
    cardBorderRadius: '',
    cardBorderColor: '',
    cardPadding: '',
    listBackground: '',
    listTextColor: '',
    listBorderColor: '',
    listBorderRadius: '',
    listPadding: ''
  }
})

const previewStandard = computed(() => ({
  _id: editingId.value || 'preview',
  name: form.value.name,
  type: form.value.type,
  isDefault: form.value.isDefault,
  settings: { ...form.value.settings, groupShowFieldLabels: form.value.settings.groupShowFieldLabels },
  styles: form.value.styles || {},
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

function create(viewType: string) {
  const fields = localTabFields.value
  editingId.value = null
  form.value = {
    name: '', description: '', type: viewType, isDefault: false,
    settings: {
      useGroupsAsColumns: false, groupCellFormat: 'inline', groupShowFieldLabels: false,
      columns: fields.map(f => ({ field: f.key, label: f.label, width: 'auto', align: 'left', sortable: true })),
      tableDensity: 'normal', tableStriped: true, tableHoverable: true,
      cardTitle: fields[0]?.key || '', cardSubtitle: fields[1]?.key || '',
      cardFields: fields.map(f => f.key), cardColumns: 3, cardAvatarField: '',
      cardShowFooter: true, cardShowStatus: true,
      listTitle: fields[0]?.key || '', listSubtitle: fields[1]?.key || '',
      listShowIcon: true, listShowDivider: true,
      showSearch: true, showFilters: true, showPagination: true, itemsPerPage: 20,
      emptyStateMessage: 'Нет данных для отображения', emptyStateIcon: '📭'
    },
    styles: {
      tableBackground: '', tableTextColor: '', tableBorderRadius: '', tableBorder: '',
      tableHeaderBackground: '', tableHeaderTextColor: '', tableCellPadding: '',
      cardBackground: '', cardTextColor: '', cardBorderRadius: '', cardBorderColor: '', cardPadding: '',
      listBackground: '', listTextColor: '', listBorderColor: '', listBorderRadius: '', listPadding: ''
    }
  }
  showEditor.value = true
}

function edit(standard: any) {
  const fields = localTabFields.value
  editingId.value = standard._id
  form.value = {
    name: standard.name, description: standard.description || '', type: standard.type,
    isDefault: standard.isDefault || false,
    settings: {
      useGroupsAsColumns: standard.settings?.useGroupsAsColumns ?? false,
      groupCellFormat: standard.settings?.groupCellFormat ?? 'inline',
      groupShowFieldLabels: standard.settings?.groupShowFieldLabels ?? false,
      columns: standard.settings?.columns || standard.tableSettings?.columns || fields.map(f => ({
        field: f.key, label: f.label, width: 'auto', align: 'left', sortable: true
      })),
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
    },
    styles: standard.styles || {}
  }
  showEditor.value = true
}

async function save() {
  if (!form.value.name) {
    addNotification('warning', 'Введите название')
    return
  }
  const tabId = props.tabId
  if (!tabId) {
    addNotification('error', 'Не указана вкладка')
    return
  }

  if (form.value.isDefault) {
    standards.value.forEach(s => { if (s._id !== editingId.value) s.isDefault = false })
  }

  const body = {
    name: form.value.name, description: form.value.description, type: form.value.type,
    isDefault: form.value.isDefault, tabId, enterpriseId: props.enterpriseId || store.getEnterpriseId(),
    settings: form.value.settings, styles: form.value.styles
  }

  try {
    loadingSave.value = true
    const response = await store.saveStandard(body, editingId.value)
    addNotification('success', `Стандарт "${response.name}" сохранён`)
    showEditor.value = false
    editingId.value = null
    await loadStandards()
    emit('saved', response)
  } catch (e: any) {
    addNotification('error', e?.data?.message || 'Ошибка сохранения')
  } finally {
    loadingSave.value = false
  }
}

// Открыть модальное окно удаления
function openDeleteModal(standard: any) {
  standardToDelete.value = standard
  deleteStandardModalOpen.value = true
}

// Подтверждение удаления стандарта
async function confirmDeleteStandard() {
  if (!standardToDelete.value) return
  const tabId = props.tabId
  if (!tabId) return

  try {
    await store.deleteStandard(standardToDelete.value._id, tabId)
    addNotification('info', 'Стандарт удалён')
    await loadStandards()
  } catch (e) {
    addNotification('error', 'Ошибка удаления')
  } finally {
    deleteStandardModalOpen.value = false
    standardToDelete.value = null
  }
}

async function setAsDefault(standard: any) {
  const tabId = props.tabId
  if (!tabId) return
  if (settingDefault.value) return
  settingDefault.value = true

  standards.value = standards.value.map(s => ({ ...s, isDefault: s._id === standard._id }))

  try {
    await store.setDefaultStandard(standard._id, tabId)
    addNotification('success', `"${standard.name}" установлен по умолчанию для этой вкладки`)
    await loadStandards()
    await loadTabFields()
  } catch (e) {
    addNotification('error', 'Ошибка установки стандарта')
    await loadStandards()
  } finally {
    settingDefault.value = false
  }
}

onMounted(async () => {
  addLog('info', 'Инициализация компонента Standard')
  if (!props.tabId) {
    addLog('warning', 'Нет tabId, закрываем окно')
    return
  }
  await loadTabFields()
  await loadStandards()
})

function closeWindow() {
  emit('cancel')
}
</script>

<template>
  <div class="standards-layout">
    <div class="standards-sidebar">
      <div class="sidebar-header">
        <h2>Стандарты отображения</h2>
        <p class="sidebar-subtitle">Для вкладки: {{ localTab?.name || props.tabId }}</p>
      </div>
      <div class="create-section">
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
        <div v-if="loadingStandardsLocal" class="loadingS">
          <MoloLoaders btnLoader />
          <small>Загрузка стандартов...</small>
        </div>
        <div v-else-if="standards.length === 0" class="empty-state">
          <p>📭 Нет стандартов</p>
          <small>Создайте первый стандарт для этой вкладки</small>
        </div>
        <div v-for="std in standards" :key="std._id" class="standard-item"
             :class="{ active: editingId === std._id, 'is-default': std.isDefault }">
          <div class="std-main" @click="edit(std)">
            <div class="std-type-icon">{{ std.type === 'table' ? '📊' : std.type === 'card' ? '🃏' : '📋' }}</div>
            <div class="std-info">
              <div class="std-name">{{ std.name }}</div>
              <div class="std-meta">
                <span class="std-type-badge">{{ std.type === 'table' ? 'Таблица' : std.type === 'card' ? 'Карточки' : 'Список' }}</span>
                <span v-if="std.isDefault" class="default-badge">⭐ По умолчанию</span>
              </div>
            </div>
          </div>
          <div class="std-actions">
            <MoloButton class="action small" title="Редактировать" @click.stop="edit(std)">✎</MoloButton>
            <MoloButton
                v-if="!std.isDefault"
                class="action small"
                title="Сделать стандартом по умолчанию"
                :disabled="settingDefault"
                @click.stop="setAsDefault(std)"
            >⭐</MoloButton>
            <MoloButton class="action small" title="Удалить" @click.stop="openDeleteModal(std)">×</MoloButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditor" class="standards-editor">
      <div class="editor-container">
        <div class="form-header">
          <big>{{ editingId ? 'Редактирование стандарта' : 'Новый стандарт' }}</big>
          <div class="editor-actions">
            <MoloButton class="close" @click="showEditor = false">Отмена</MoloButton>
            <MoloButton class="confirm" @click="save" :disabled="loadingSave">
              <MoloLoaders btnLoader v-if="loadingSave" />
              <span v-else>Сохранить</span>
            </MoloButton>
          </div>
        </div>

        <div class="form-section">
          <big>Основное</big>
          <div class="form-grid">
            <MoloInput v-model="form.name" tLabel="Название" lRequired/>
            <MoloInput v-model="form.description" tLabel="Описание"/>
          </div>
          <MoloSelect
              v-model="form.type"
              :parent="[{label:'📊 Таблица', value:'table'},{label:'🃏 Карточки', value:'card'},{label:'📋 Список', value:'list'}]"
              children="label" valueKey="value" tLabel="Тип"
          />
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.isDefault">
            <span>Сделать стандартом по умолчанию для этой вкладки</span>
          </label>
          <p v-if="form.isDefault" class="section-hint">⚠️ При сохранении этот стандарт станет стандартом по умолчанию только для текущей вкладки</p>
        </div>

        <div v-if="form.type === 'table'" class="form-section">
          <big>Настройки таблицы</big>
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.settings.useGroupsAsColumns">
            <span><strong>Колонки по группам</strong> — каждая группа вкладки = колонка таблицы</span>
          </label>
          <div v-if="form.settings.useGroupsAsColumns" class="form-row">
            <MoloSelect
                v-model="form.settings.groupCellFormat"
                :parent="[{label:'В одну строку (через запятую)', value:'inline'}, {label:'Каждое поле с новой строки', value:'block'}]"
                children="label" valueKey="value" tLabel="Формат ячейки"
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
                <big>Колонки</big>
                <button class="add-btn" @click="form.settings.columns.push({ field: '', label: '', width: 'auto', align: 'left', sortable: true })">+</button>
              </div>
              <div class="columns-list">
                <div v-for="(col, idx) in form.settings.columns" :key="idx" class="column-item">
                  <MoloSelect v-model="col.field" :parent="localTabFields" children="label" valueKey="key" disabled="Выберите поле" tLabel="Выберите поле" lRequired />
                  <MoloInput v-model="col.label" placeholder="Заголовок" tLabel="Заголовок"/>
                  <MoloButton class="remove-btn" @click="form.settings.columns.splice(idx, 1)">×</MoloButton>
                </div>
              </div>
            </div>
          </template>
          <div v-if="form.type === 'table' && form.settings.useGroupsAsColumns" class="form-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.settings.groupShowFieldLabels">
              Показывать названия полей
            </label>
          </div>
        </div>

        <div v-if="form.type === 'card'" class="form-section">
          <big>Карточки</big>
          <div class="form-grid">
            <MoloSelect v-model="form.settings.cardColumns" :parent="[{label:'1',value:1},{label:'2',value:2},{label:'3',value:3},{label:'4',value:4}]" children="label" valueKey="value" tLabel="Колонок"/>
          </div>
        </div>

        <div class="form-section">
          <big>Стилизация</big>
          <p class="section-hint">Оставьте поля пустыми, чтобы использовать стандартный вид</p>
          <div class="form-grid">
            <template v-if="form.type === 'table'">
              <MoloInput v-model="form.styles.tableBackground" tLabel="Фон таблицы (CSS)" placeholder="rgba(0,0,0,0.3)"/>
              <MoloInput v-model="form.styles.tableTextColor" tLabel="Цвет текста" placeholder="white"/>
              <MoloInput v-model="form.styles.tableBorderRadius" tLabel="Радиус скругления" placeholder="10px"/>
              <MoloInput v-model="form.styles.tableBorder" tLabel="Граница" placeholder="1px solid #333"/>
              <MoloInput v-model="form.styles.tableHeaderBackground" tLabel="Фон заголовков" placeholder="rgba(255,255,255,0.05)"/>
              <MoloInput v-model="form.styles.tableHeaderTextColor" tLabel="Цвет текста заголовка"/>
              <MoloInput v-model="form.styles.tableCellPadding" tLabel="Отступ ячейки" placeholder="10px"/>
            </template>
            <template v-if="form.type === 'card'">
              <MoloInput v-model="form.styles.cardBackground" tLabel="Фон карточки" placeholder="rgba(0,0,0,0.3)"/>
              <MoloInput v-model="form.styles.cardTextColor" tLabel="Цвет текста" placeholder="white"/>
              <MoloInput v-model="form.styles.cardBorderRadius" tLabel="Радиус скругления" placeholder="18px"/>
              <MoloInput v-model="form.styles.cardBorderColor" tLabel="Цвет рамки" placeholder="rgba(255,255,255,0.08)"/>
              <MoloInput v-model="form.styles.cardPadding" tLabel="Отступы" placeholder="18px"/>
            </template>
            <template v-if="form.type === 'list'">
              <MoloInput v-model="form.styles.listBackground" tLabel="Фон элемента" placeholder="rgba(255,255,255,0.03)"/>
              <MoloInput v-model="form.styles.listTextColor" tLabel="Цвет текста"/>
              <MoloInput v-model="form.styles.listBorderColor" tLabel="Цвет рамки" placeholder="rgba(255,255,255,0.08)"/>
              <MoloInput v-model="form.styles.listBorderRadius" tLabel="Радиус скругления" placeholder="8px"/>
              <MoloInput v-model="form.styles.listPadding" tLabel="Отступы" placeholder="12px"/>
            </template>
          </div>
        </div>

        <div class="editor-preview">
          <div class="preview-header">
            <big>Предпросмотр</big>
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

    <!-- Модальное окно подтверждения удаления стандарта -->
    <MoloModal
        v-model="deleteStandardModalOpen"
        title="Удаление стандарта"
        confirm-text="Удалить"
        cancel-text="Отмена"
        close-on-overlay
        @confirm="confirmDeleteStandard"
    >
      <template #body>
        <p style="color: white;">Вы действительно хотите удалить выбранный стандарт?</p>
        <p style="color: #ef4444; font-size: 13px;">Это действие необратимо — все настройки стандарта будут потеряны.</p>
      </template>
    </MoloModal>
  </div>
</template>

<style scoped>
/* Ваши стили, они не меняются */
.standards-layout {
  display: flex;
  gap: 24px;
  height: 100%;
  padding: 24px;
  color: #e0e0e0;
}
.standards-sidebar {
  width: 340px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
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
  border-left: 3px solid #f59e0b;
}
.std-main {
  display: flex;
  gap: 10px;
  align-items: center;
  flex: 1;
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
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border-radius: 8px;
}
.std-actions {
  display: flex;
  gap: 5px;
}

.loadingS {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 20px;
}
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.5);
}
.standards-editor {
  flex: 1;
  min-width: 0;
}
.editor-container {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  width: 100%;
}
.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.editor-actions {
  display: flex;
  gap: 12px;
}
.form-section {
  padding: 20px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--half_opacity_bg);
  border-radius: 16px;
  border: 1px solid var(--half_opacity_border);
  & span {
    font-weight: bold;
  }
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
}
.section-hint {
  font-size: 12px;
  color: #8e8e9e;
}
.columns-editor {
  margin-top: 8px;
}
.columns-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.add-btn {
  padding: 4px 12px;
  background: rgba(100, 150, 255, 0.15);
  border: 1px solid rgba(100, 150, 255, 0.3);
  border-radius: 6px;
  color: #6496ff;
  cursor: pointer;
}
.column-item {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  margin-bottom: 8px;
}
.remove-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #ef4444;
  cursor: pointer;
  padding: 0 8px;
  height: 32px;
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
@media (max-width: 900px) {
  .standards-layout { flex-direction: column; }
  .standards-sidebar { width: 100%; max-height: 400px; }
  .editor-preview { position: static; min-width: 100%; }
}
</style>