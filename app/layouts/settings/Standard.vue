<script lang="ts" setup>
import { useAppStore } from '~~/stores/appStore'

const props = defineProps<{
  enterpriseId?: string // больше не используется, оставлен для обратной совместимости
}>()

const emit = defineEmits(['saved', 'cancel'])

const { addNotification } = useNotifications('Стандарты')
const { addLog } = useLogger('Стандарты')
const store = useAppStore()

const loadingSave = ref(false)
const loadingStandards = ref(false)
const settingDefault = ref(false)

const showEditor = ref(false)
const editingId = ref<string | null>(null)

const standards = ref<any[]>([])
const deleteStandardModalOpen = ref(false)
const standardToDelete = ref<any>(null)

// Тип стандарта
const standardType = ref<'table' | 'card' | 'list'>('table')

// Данные для конструктора таблицы (новая структура MoloTable)
const tableRows = ref<any[]>([
  {
    cells: [
      {
        content: 'Веб-платформа',
        colspan: 1,
        rowspan: 1,
        hidden: false,
        style: {
          textAlign: 'left',
          verticalAlign: 'top',
          fontWeight: 'bold',
          fontStyle: 'normal',
          fontSize: 13,
          backgroundColor: '',
          textColor: '#000000',
          borderTop: '',
          borderBottom: '',
          borderLeft: '',
          borderRight: ''
        }
      },
      {
        content: 'Активен',
        colspan: 1,
        rowspan: 1,
        hidden: false,
        style: {
          textAlign: 'center',
          verticalAlign: 'top',
          fontWeight: 'normal',
          fontStyle: 'normal',
          fontSize: 13,
          backgroundColor: '#e6f7e6',
          textColor: '#000000',
          borderTop: '',
          borderBottom: '',
          borderLeft: '',
          borderRight: ''
        }
      },
      {
        content: 'Анна (PM)\nОлег (Dev)\nМария (Design)',
        colspan: 1,
        rowspan: 1,
        hidden: false,
        style: {
          textAlign: 'left',
          verticalAlign: 'top',
          fontWeight: 'normal',
          fontStyle: 'normal',
          fontSize: 13,
          backgroundColor: '',
          textColor: '#000000',
          borderTop: '',
          borderBottom: '',
          borderLeft: '',
          borderRight: ''
        }
      },
      {
        content: '75%',
        colspan: 1,
        rowspan: 1,
        hidden: false,
        style: {
          textAlign: 'center',
          verticalAlign: 'top',
          fontWeight: 'normal',
          fontStyle: 'normal',
          fontSize: 13,
          backgroundColor: '',
          textColor: '#000000',
          borderTop: '',
          borderBottom: '',
          borderLeft: '',
          borderRight: ''
        }
      }
    ],
    backgroundColor: ''
  }
])

const tableStyles = ref<any>({})

// Данные для карточек
const cardSettings = ref({
  titleField: '',
  subtitleField: '',
  fields: [] as string[],
  columns: 3,
  avatarField: '',
  showFooter: true,
  showStatus: true
})

// Данные для списка
const listSettings = ref({
  titleField: '',
  subtitleField: '',
  showIcon: true,
  showDivider: true
})

// Общие настройки
const commonSettings = ref({
  showSearch: true,
  showFilters: true,
  showPagination: true,
  itemsPerPage: 20,
  emptyStateMessage: 'Нет данных для отображения',
  emptyStateIcon: '📭'
})

const form = ref({
  name: '',
  description: '',
  isDefault: false
})

// Создание пустой ячейки с дефолтными стилями
function createEmptyCell(content = '') {
  return {
    content,
    colspan: 1,
    rowspan: 1,
    hidden: false,
    style: {
      textAlign: 'left',
      verticalAlign: 'top',
      fontWeight: 'normal',
      fontStyle: 'normal',
      fontSize: 13,
      backgroundColor: '',
      textColor: '#000000',
      borderTop: '',
      borderBottom: '',
      borderLeft: '',
      borderRight: ''
    }
  }
}

// Создание пустой строки
function createEmptyRow(colCount = 3) {
  return {
    cells: Array.from({ length: colCount }, () => createEmptyCell('')),
    backgroundColor: ''
  }
}

// Загрузка стандартов (глобальные, без enterpriseId)
async function loadStandards() {
  loadingStandards.value = true
  try {
    const response = await $fetch('/api/standards')
    standards.value = response.standards || []
    addLog('success', `Загружено ${standards.value.length} стандартов`)
  } catch (e: any) {
    console.error('Ошибка загрузки стандартов:', e)
    addLog('error', `Ошибка загрузки: ${e?.message || e}`)
    addNotification('error', 'Не удалось загрузить стандарты')
  } finally {
    loadingStandards.value = false
  }
}

// Создание нового стандарта
function create(type: 'table' | 'card' | 'list') {
  editingId.value = null
  standardType.value = type
  form.value = { name: '', description: '', isDefault: false }

  // Сброс таблицы (3 колонки, 1 строка)
  tableRows.value = [createEmptyRow(3)]
  tableStyles.value = {}

  // Сброс карточек
  cardSettings.value = {
    titleField: '',
    subtitleField: '',
    fields: [],
    columns: 3,
    avatarField: '',
    showFooter: true,
    showStatus: true
  }

  // Сброс списка
  listSettings.value = {
    titleField: '',
    subtitleField: '',
    showIcon: true,
    showDivider: true
  }

  // Сброс общих настроек
  commonSettings.value = {
    showSearch: true,
    showFilters: true,
    showPagination: true,
    itemsPerPage: 20,
    emptyStateMessage: 'Нет данных для отображения',
    emptyStateIcon: '📭'
  }

  showEditor.value = true
}

// Редактирование
function edit(standard: any) {
  editingId.value = standard._id
  standardType.value = standard.type || 'table'
  form.value = {
    name: standard.name,
    description: standard.description || '',
    isDefault: standard.isDefault || false
  }

  // Загружаем данные в зависимости от типа
  if (standardType.value === 'table') {
    tableRows.value = standard.tableRows?.length ? standard.tableRows : [createEmptyRow(3)]
  } else {
    tableRows.value = []
  }

  tableStyles.value = standard.styles || {}
  cardSettings.value = standard.cardSettings || {
    titleField: '', subtitleField: '', fields: [], columns: 3,
    avatarField: '', showFooter: true, showStatus: true
  }
  listSettings.value = standard.listSettings || {
    titleField: '', subtitleField: '', showIcon: true, showDivider: true
  }
  commonSettings.value = standard.commonSettings || {
    showSearch: true, showFilters: true, showPagination: true,
    itemsPerPage: 20, emptyStateMessage: 'Нет данных для отображения', emptyStateIcon: '📭'
  }
  showEditor.value = true
}

// Сохранение
async function save() {
  if (!form.value.name) {
    addNotification('warning', 'Введите название')
    return
  }

  const body: any = {
    name: form.value.name,
    description: form.value.description,
    type: standardType.value,
    isDefault: form.value.isDefault,
    styles: tableStyles.value,
    commonSettings: commonSettings.value
  }

  if (standardType.value === 'table') {
    body.tableRows = tableRows.value
  } else if (standardType.value === 'card') {
    body.cardSettings = cardSettings.value
  } else if (standardType.value === 'list') {
    body.listSettings = listSettings.value
  }

  try {
    loadingSave.value = true
    const url = editingId.value ? `/api/standards/${editingId.value}` : '/api/standards'
    const method = editingId.value ? 'PUT' : 'POST'

    const response = await $fetch(url, { method, body })
    addNotification('success', `Стандарт "${response.standard.name}" сохранён`)
    showEditor.value = false
    await loadStandards()
    emit('saved', response.standard)
  } catch (e: any) {
    console.error('Ошибка сохранения:', e)
    addNotification('error', e?.data?.message || 'Ошибка сохранения')
  } finally {
    loadingSave.value = false
  }
}

// Удаление
async function confirmDeleteStandard() {
  if (!standardToDelete.value) return

  try {
    await $fetch(`/api/standards/${standardToDelete.value._id}`, { method: 'DELETE' })
    addNotification('info', 'Стандарт удалён')
    await loadStandards()
  } catch (e: any) {
    console.error('Ошибка удаления:', e)
    addNotification('error', e?.data?.message || 'Ошибка удаления')
  } finally {
    deleteStandardModalOpen.value = false
    standardToDelete.value = null
  }
}

// Установка по умолчанию
async function setAsDefault(standard: any) {
  if (settingDefault.value) return

  settingDefault.value = true
  try {
    await $fetch(`/api/standards/${standard._id}`, {
      method: 'PUT',
      body: { isDefault: true }
    })
    addNotification('success', `"${standard.name}" установлен по умолчанию`)
    await loadStandards()
  } catch (e: any) {
    console.error('Ошибка установки стандарта по умолчанию:', e)
    addNotification('error', e?.data?.message || 'Ошибка')
  } finally {
    settingDefault.value = false
  }
}

function openDeleteModal(standard: any) {
  standardToDelete.value = standard
  deleteStandardModalOpen.value = true
}

function cancelEdit() {
  showEditor.value = false
  editingId.value = null
  emit('cancel')
}

onMounted(() => {
  loadStandards()
})
</script>

<template>
  <div class="standards-layout">
    <!-- Левая панель - список стандартов -->
    <MoloSection style="width: 420px">
      <template #header>
        <div class="sidebar-header">
          <span>Стандарты отображения</span>
        </div>
      </template>
      <template #main>
        <div class="create-section">
          <h4>Создать стандарт</h4>
          <div class="create-buttons">
            <MoloButton class="action small" @click="create('table')">📊 Таблица</MoloButton>
            <MoloButton class="action small" @click="create('card')">🃏 Карточки</MoloButton>
            <MoloButton class="action small" @click="create('list')">📋 Список</MoloButton>
          </div>
        </div>
        <div class="standards-list">
          <div class="list-header">
            <span>Стандарты</span>
            <span class="count-badge">{{ standards.length }}</span>
          </div>
          <div v-if="loadingStandards" class="loading-state">
            <MoloLoaders btnLoader />
            <small>Загрузка...</small>
          </div>
          <div v-else-if="standards.length === 0" class="empty-state">
            <p>📭 Нет стандартов</p>
            <small>Создайте первый стандарт</small>
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
                  <span class="std-type-badge">👁️ Не редактируемый</span>
                </div>
              </div>
            </div>
            <div class="std-actions">
              <MoloButton class="action small" title="Редактировать" @click.stop="edit(std)">✎</MoloButton>
              <MoloButton v-if="!std.isDefault" class="action small" title="По умолчанию"
                          :disabled="settingDefault" @click.stop="setAsDefault(std)">⭐</MoloButton>
              <MoloButton class="close small" title="Удалить" @click.stop="openDeleteModal(std)">×</MoloButton>
            </div>
          </div>
        </div>
      </template>
    </MoloSection>

    <!-- Правая панель - редактор -->
    <div v-if="showEditor" class="standards-editor">
      <MoloSection>
        <template #header>
          <span>{{ editingId ? 'Редактирование стандарта' : 'Новый стандарт' }}</span>
          <div class="editor-actions">
            <MoloButton class="close small" @click="cancelEdit">Отмена</MoloButton>
            <MoloButton class="confirm small" @click="save" :disabled="loadingSave">
              <MoloLoaders btnLoader v-if="loadingSave" />
              <span v-else>Сохранить</span>
            </MoloButton>
          </div>
        </template>
        <template #main>
          <div class="form-grid">
            <MoloInput v-model="form.name" tLabel="Название" lRequired/>
            <MoloInput v-model="form.description" tLabel="Описание"/>
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.isDefault">
              <span>Сделать стандартом по умолчанию</span>
            </label>
          </div>

          <!-- КОНСТРУКТОР ТАБЛИЦ -->
          <div v-if="standardType === 'table'" class="constructor-wrapper">
            <MoloTable v-model="tableRows"/>
          </div>

          <!-- Настройки для карточек -->
          <div v-if="standardType === 'card'" class="card-settings">
            <h4>Настройка карточек</h4>
            <MoloInput v-model="cardSettings.titleField" tLabel="Поле для заголовка"/>
            <MoloInput v-model="cardSettings.subtitleField" tLabel="Поле для подзаголовка"/>
            <MoloInput v-model.number="cardSettings.columns" tLabel="Колонок в ряду" type="number" min="1" max="6"/>
            <label class="checkbox-label">
              <input type="checkbox" v-model="cardSettings.showFooter"> Показывать футер
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="cardSettings.showStatus"> Показывать статус
            </label>
          </div>

          <!-- Настройки для списка -->
          <div v-if="standardType === 'list'" class="list-settings">
            <h4>Настройка списка</h4>
            <MoloInput v-model="listSettings.titleField" tLabel="Поле для заголовка"/>
            <MoloInput v-model="listSettings.subtitleField" tLabel="Поле для подзаголовка"/>
            <label class="checkbox-label">
              <input type="checkbox" v-model="listSettings.showIcon"> Показывать иконку
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="listSettings.showDivider"> Показывать разделители
            </label>
          </div>
        </template>
      </MoloSection>
    </div>

    <MoloModal
        v-model="deleteStandardModalOpen"
        title="Удаление стандарта"
        confirm-text="Удалить"
        cancel-text="Отмена"
        close-on-overlay
        @confirm="confirmDeleteStandard"
    >
      <template #body>
        <p>Вы действительно хотите удалить "{{ standardToDelete?.name }}"?</p>
        <p style="color: #ef4444; font-size: 13px;">Это действие необратимо.</p>
      </template>
    </MoloModal>
  </div>
</template>

<style scoped>
.standards-layout {
  display: flex;
  gap: 20px;
  padding: 20px;
  min-height: 100%;
}

.create-section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
}

.create-buttons {
  display: flex;
  gap: 10px;
}

.standards-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 12px;
  font-weight: 600;
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
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.standard-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.standard-item.is-default {
  border-left: 3px solid #f59e0b;
}

.std-main {
  display: flex;
  gap: 10px;
  flex: 1;
}

.std-type-icon {
  font-size: 20px;
}

.std-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.std-meta {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.std-type-badge, .default-badge {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 8px;
}

.std-type-badge {
  display: flex;
  align-items: center;
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
}

.default-badge {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.std-actions {
  display: flex;
  gap: 4px;
}

.standards-editor {
  flex: 2;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.editor-actions {
  display: flex;
  gap: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.constructor-wrapper {
  height: 500px;
}

.card-settings, .list-settings, .common-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
}
</style>