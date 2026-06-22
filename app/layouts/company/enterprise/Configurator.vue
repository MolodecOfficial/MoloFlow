<script lang="ts" setup>
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'
import MoloModal from '~/components/MoloModal.vue'
import {useAppStore} from '~~/stores/appStore'

const props = defineProps<{
  enterpriseId: string
  windowId?: string
}>()
const emit = defineEmits(['close', 'saved'])

const {openWindow} = useWindowManager()
const {addNotification} = useNotifications('Конфигуратор')
const {addLog} = useLogger('Конфигуратор')

const store = useAppStore()

const loading = ref(false)
const selectedTab = ref<any>(null)
const activeSection = ref('tabs')
const currentEnterpriseId = ref('')

const deleteTabModalOpen = ref(false)
const tabToDelete = ref<any>(null)

const groupModalOpen = ref(false)
const editingGroupIndex = ref<number | null>(null)
const groupForm = ref({
  name: '',
  description: '',
  icon: 'folder',
  order: 0,
  image: null as string | null,
  link: ''
})

const groupImagePreview = ref<string | null>(null)

const deleteGroupModalOpen = ref(false)
const groupToDeleteIndex = ref<number | null>(null)

const fieldModalOpen = ref(false)
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
  link: '',
  validation: {min: null, max: null, minLength: null, maxLength: null, pattern: '', customMessage: ''},
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
  isHidden: false,
  _manualKey: false // флаг ручного редактирования ключа
})
const newOption = ref({label: '', value: '', color: '#6496ff'})

const deleteFieldModalOpen = ref(false)
const deleteFieldParams = ref<{ groupIndex: number; fieldIndex: number } | null>(null)

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

const previewStandard = ref<any>(null)
const previewStandardsList = ref<any[]>([])

const viewTypes = [
  {label: 'Карточки', value: 'card'},
  {label: 'Таблица', value: 'table'},
  {label: 'Список', value: 'list'},
]

const tabs = computed(() => store.tabs)
const tabsLoading = computed(() => store.tabsLoading)

// Транслитерация кириллицы в латиницу
function transliterate(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  }
  return text.replace(/[а-яё]/gi, (ch) => {
    const lower = ch.toLowerCase()
    const translit = map[lower] || lower
    return ch === lower ? translit : translit.charAt(0).toUpperCase() + translit.slice(1)
  })
}

// Автогенерация ключа из названия
function generateKeyFromLabel(label: string): string {
  if (!label) return ''
  let generated = label
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]/g, '_') // любые символы кроме букв и цифр в _
      .replace(/_+/g, '_')             // дубли _ в один
      .replace(/^_|_$/g, '')           // _ в начале и конце долой

  generated = transliterate(generated)
  return generated || 'field'
}

// Следим за изменением label и генерируем ключ, если не ручной режим
watch(() => fieldForm.value.label, (newLabel) => {
  if (fieldForm.value._manualKey) return
  fieldForm.value.key = generateKeyFromLabel(newLabel)
})

// Следим за ручным изменением ключа — включаем ручной режим
let manualKeyWatcherStop: (() => void) | null = null

function setupManualKeyWatcher() {
  if (manualKeyWatcherStop) manualKeyWatcherStop()
  const stop = watch(() => fieldForm.value.key, (newKey, oldKey) => {
    if (newKey !== oldKey && !fieldForm.value._manualKey && oldKey !== undefined) {
      fieldForm.value._manualKey = true
    }
  })
  manualKeyWatcherStop = stop
}

function getEnterpriseId(): string {
  if (props.enterpriseId) return props.enterpriseId
  return store.getEnterpriseId() || ''
}

function handleGroupImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.[0]) return

  const file = input.files[0]
  const reader = new FileReader()

  reader.onload = (e) => {
    groupImagePreview.value = e.target?.result as string
    groupForm.value.image = e.target?.result as string
  }

  reader.readAsDataURL(file)
}

function removeGroupImage() {
  groupImagePreview.value = null
  groupForm.value.image = null
}

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

  if (store.tabsLoaded) {
    addLog('info', 'Вкладки уже загружены, использую кэш')
    return
  }

  loading.value = true
  try {
    await store.loadTabs(false)
  } catch (error: any) {
    addNotification('error', 'Ошибка загрузки вкладок')
  } finally {
    loading.value = false
  }
}

function createNewTab() {
  editingTab.value = null
  tabForm.value = {
    name: '',
    slug: '',
    description: '',
    category: 'custom',
    defaultViewType: 'table',
    groups: [],
    actions: [],
    permissions: {canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: false, rolesAllowed: []}
  }
  showTabForm.value = true
  activeSection.value = 'tab-editor'
}

function editTab(tab: any) {
  editingTab.value = tab
  tabForm.value = {
    name: tab.name,
    slug: tab.slug,
    description: tab.description || '',
    category: tab.category,
    defaultViewType: tab.defaultViewType || 'table',
    groups: JSON.parse(JSON.stringify(tab.groups || [])),
    actions: JSON.parse(JSON.stringify(tab.actions || [])),
    permissions: {...tab.permissions}
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
    const savedTab = await store.saveTab(tabForm.value, editingTab.value?._id)
    addNotification('success', `Вкладка "${tabForm.value.name}" сохранена`)
    showTabForm.value = false
    emit('saved', savedTab)
    activeSection.value = 'tabs'
  } catch (error: any) {
    addNotification('error', error?.data?.message || 'Ошибка сохранения')
  } finally {
    loading.value = false
  }
}

async function deleteTab(tabId: string) {
  tabToDelete.value = tabs.value.find(t => t._id === tabId)
  deleteTabModalOpen.value = true
}

async function confirmDeleteTab() {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return
  loading.value = true
  try {
    await store.deleteTab(tabToDelete.value._id)
    addNotification('success', 'Вкладка удалена')
    if (selectedTab.value?._id === tabToDelete.value._id) selectedTab.value = null
  } catch (error: any) {
    addNotification('error', error?.data?.message || 'Ошибка удаления')
  } finally {
    loading.value = false
    deleteTabModalOpen.value = false
    tabToDelete.value = null
  }
}

function openGroupModal(index: number | null = null) {
  editingGroupIndex.value = index
  groupImagePreview.value = null

  if (index !== null) {
    const group = tabForm.value.groups[index]
    groupForm.value = {
      name: group.name,
      description: group.description || '',
      icon: group.icon || 'folder',
      order: group.order ?? index,
      image: group.image || null,
      link: group.link || ''
    }
    if (group.image) {
      groupImagePreview.value = group.image
    }
  } else {
    groupForm.value = {
      name: '',
      description: '',
      icon: 'folder',
      order: tabForm.value.groups.length,
      image: null,
      link: ''
    }
  }
  groupModalOpen.value = true
}

function saveGroup() {
  if (!groupForm.value.name) {
    addNotification('warning', 'Введите название группы')
    return
  }
  const groupData = {
    ...groupForm.value,
    fields: [],
    image: groupForm.value.image || null
  }
  if (editingGroupIndex.value !== null) {
    groupData.fields = tabForm.value.groups[editingGroupIndex.value].fields || []
    tabForm.value.groups[editingGroupIndex.value] = groupData
  } else {
    tabForm.value.groups.push(groupData)
  }
  groupModalOpen.value = false
  groupImagePreview.value = null
}

function confirmDeleteGroup(index: number) {
  groupToDeleteIndex.value = index
  deleteGroupModalOpen.value = true
}

function deleteGroupConfirmed() {
  if (groupToDeleteIndex.value !== null) {
    tabForm.value.groups.splice(groupToDeleteIndex.value, 1)
    groupToDeleteIndex.value = null
  }
  deleteGroupModalOpen.value = false
}

function moveGroup(index: number, direction: 'up' | 'down') {
  const groups = [...tabForm.value.groups]
  if (direction === 'up' && index > 0) [groups[index], groups[index - 1]] = [groups[index - 1], groups[index]]
  else if (direction === 'down' && index < groups.length - 1) [groups[index], groups[index + 1]] = [groups[index + 1], groups[index]]
  else return
  groups.forEach((g, idx) => g.order = idx)
  tabForm.value.groups = groups
}

function openFieldModal(groupIndex: number, fieldIndex: number | null = null) {
  editingGroupIdForField.value = groupIndex
  editingFieldIndex.value = fieldIndex

  // Сбрасываем флаг ручного редактирования
  fieldForm.value._manualKey = false

  if (fieldIndex !== null) {
    const field = tabForm.value.groups[groupIndex].fields[fieldIndex]
    fieldForm.value = {
      ...JSON.parse(JSON.stringify(field)),
      _manualKey: true // при редактировании существующего поля - ручной режим
    }
  } else {
    fieldForm.value = {
      key: '',
      label: '',
      type: 'string',
      required: false,
      defaultValue: null,
      placeholder: '',
      description: '',
      options: [],
      link: '',
      validation: {min: null, max: null, minLength: null, maxLength: null, pattern: '', customMessage: ''},
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
      isHidden: false,
      _manualKey: false
    }
  }
  newOption.value = {label: '', value: '', color: '#6496ff'}
  setupManualKeyWatcher()
  fieldModalOpen.value = true
}

function saveField() {
  if (!fieldForm.value.key || !fieldForm.value.label) {
    addNotification('warning', 'Заполните ключ и название поля')
    return
  }

  // Очищаем ключ от недопустимых символов
  let sanitizedKey = fieldForm.value.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (sanitizedKey !== fieldForm.value.key) {
    fieldForm.value.key = sanitizedKey
    addNotification('warning', 'Ключ изменён: только латиница, цифры и _')
    return
  }

  const group = tabForm.value.groups[editingGroupIdForField.value!]
  const isUnique = group.fields.every((f: any, idx: number) => f.key !== sanitizedKey || idx === editingFieldIndex.value)
  if (!isUnique) {
    addNotification('error', 'Поле с таким ключом уже существует в этой группе')
    return
  }

  // Убираем служебное поле _manualKey перед сохранением
  const {_manualKey, ...cleanField} = fieldForm.value

  const fieldData = {
    ...cleanField,
    key: sanitizedKey,
    order: editingFieldIndex.value !== null ? group.fields[editingFieldIndex.value].order : group.fields.length
  }

  if (editingFieldIndex.value !== null) {
    group.fields[editingFieldIndex.value] = fieldData
  } else {
    group.fields.push(fieldData)
  }
  fieldModalOpen.value = false
}

function confirmDeleteField(groupIndex: number, fieldIndex: number) {
  deleteFieldParams.value = {groupIndex, fieldIndex}
  deleteFieldModalOpen.value = true
}

function deleteFieldConfirmed() {
  if (deleteFieldParams.value) {
    const {groupIndex, fieldIndex} = deleteFieldParams.value
    tabForm.value.groups[groupIndex].fields.splice(fieldIndex, 1)
    deleteFieldParams.value = null
  }
  deleteFieldModalOpen.value = false
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
  fieldForm.value.options.push({...newOption.value})
  newOption.value = {label: '', value: '', color: '#6496ff'}
}

function removeOption(idx: number) {
  fieldForm.value.options.splice(idx, 1)
}

async function loadPreviewStandards(tab: any) {
  if (!tab?._id) return
  const standards = await store.loadStandardsForTab(tab._id)
  previewStandardsList.value = standards
  const defaultStd = previewStandardsList.value.find((s: any) => s.isDefault) || previewStandardsList.value[0]
  previewStandard.value = defaultStd || null
}

function openStandardsEditor(tab: any) {
  openWindow('settings', 'standard', null, {width: 1200, height: 800}, false, null, null, {
    tabId: tab._id,
    enterpriseId: getEnterpriseId()
  })
}

function selectTab(tab: any) {
  selectedTab.value = tab
  activeSection.value = 'tab-editor'
  editTab(tab)
  store.preloadTabData(tab._id)
}

async function previewTab(tab: any) {
  selectedTab.value = tab
  activeSection.value = 'preview'
  await loadPreviewStandards(tab)
}

function getTotalFieldsCount(tab: any): number {
  return tab?.groups?.reduce((acc: number, g: any) => acc + (g.fields?.length || 0), 0) || 0
}

function backToTabs() {
  activeSection.value = 'tabs'
  showTabForm.value = false
  selectedTab.value = null
}

onMounted(async () => {
  currentEnterpriseId.value = getEnterpriseId()
  if (currentEnterpriseId.value) {
    await loadTabs()
  }
})

onUnmounted(() => {
  if (manualKeyWatcherStop) manualKeyWatcherStop()
})
</script>

<template>
  <div class="configurator">
    <div class="configurator-header">
      <div class="header-left">
        <MoloButton v-if="activeSection !== 'tabs'" class="back-btn" @click="backToTabs">
          ← Назад к вкладкам
        </MoloButton>
        <span>{{
            activeSection === 'tabs' ? 'Конфигуратор предприятия' :
                activeSection === 'tab-editor' ? (editingTab ? 'Редактирование вкладки' : 'Создание вкладки') :
                    'Предпросмотр вкладки'
          }}</span>
      </div>
      <div class="header-actions">
        <MoloButton v-if="activeSection === 'tabs'" class="confirm" @click="createNewTab">
          Новая вкладка
        </MoloButton>
        <MoloButton v-if="activeSection === 'tabs'" class="confirm" @click="openStandardsEditor">
          Вкладка стандартов
        </MoloButton>
      </div>
    </div>

    <hr/>

    <div class="configurator-content">
      <div v-if="activeSection === 'tabs'" class="section-content tabs-section">
        <MoloLoaders wndLoader v-if="loading || tabsLoading"/>
        <div v-else-if="tabs.length === 0" class="empty-state">
          <div class="empty-icon">📁</div>
          <p>Нет созданных вкладок</p>
        </div>
        <div v-else class="tabs-grid">
          <MoloSection v-for="tab in tabs" :key="tab._id" class="tab-card">
            <template #header>
              <div class="card-info" @click="selectTab(tab)">
                <div :style="{ background: tab.color || '#6496ff' }" class="tab-icon">
                  <span>{{ tab.name.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="tab-info">
                  <h3>{{ tab.name }}</h3>
                  <p>{{ tab.description || 'Нет описания' }}</p>
                  <div class="tab-meta">
                    <span class="meta-count">📋 {{ getTotalFieldsCount(tab) }} полей</span>
                    <span class="meta-count">📂 {{ tab.groups?.length || 0 }} групп</span>
                  </div>
                </div>
              </div>
            </template>
            <template #main>
              <div class="tab-actions">
                <section class="actions">
                  <MoloButton class="action small" title="Редактировать" @click.stop="selectTab(tab)">✎</MoloButton>
                  <MoloButton class="action small" title="Предпросмотр" @click.stop="previewTab(tab)">👁</MoloButton>
                </section>
                <MoloButton class="action small close" title="Удалить" @click.stop="deleteTab(tab._id)">×</MoloButton>
              </div>
            </template>

          </MoloSection>
        </div>
      </div>

      <div v-if="activeSection === 'tab-editor' && showTabForm" class="section-content editor-section-content">
        <div class="tab-editor">
          <MoloSection>
            <template #header>
              <span>Основные настройки</span>
              <div class="editor-actions">
                <MoloButton @click="backToTabs" class="close small">Отмена</MoloButton>
                <MoloButton class="confirm small" @click="saveTab" :disabled="loading">
                  <MoloLoaders btnLoader v-if="loading"/>
                  <span v-else>{{ editingTab ? 'Обновить' : 'Создать' }} вкладку</span>
                </MoloButton>
              </div>
            </template>
            <template #main>
              <div class="form-grid">
                <MoloInput v-model="tabForm.name" tLabel="Название вкладки" lRequired @input="generateSlug"/>
                <MoloInput v-model="tabForm.slug" tLabel="Ключ (slug)" lRequired/>
                <MoloInput v-model="tabForm.description" tLabel="Описание"/>
                <MoloSelect v-model="tabForm.defaultViewType" :parent="viewTypes" children="label"
                            tLabel="Тип отображения по умолчанию" valueKey="value"/>
              </div>
            </template>
          </MoloSection>

          <MoloSection>
            <template #header>
              <div class="editor-header">
                <span>Группы полей</span>
                <p class="section-desc">Каждая группа станет отдельной колонкой в таблице</p>
              </div>
              <MoloButton class="confirm" @click="openGroupModal()">
                Добавить группу
              </MoloButton>
            </template>
            <template #main>
              <div v-if="tabForm.groups.length === 0" class="empty-fields">
                <span>📭</span>
                <p>Нет групп</p>
              </div>

              <div class="group-section">
                <div v-for="(group, gIdx) in tabForm.groups" :key="gIdx" class="group-card">
                  <div class="group-header">
                    <div class="group-order">
                      <button :disabled="gIdx === 0" @click="moveGroup(gIdx, 'up')">▲</button>
                      <button :disabled="gIdx === tabForm.groups.length - 1" @click="moveGroup(gIdx, 'down')">▼</button>
                    </div>
                    <div class="group-info">
                      <div class="group-name">
                        <span class="group-icon">📁</span>
                        <strong>{{ group.name }}</strong>
                      </div>
                      <span class="group-desc">{{ group.description || 'Нет описания' }}</span>
                      <span class="field-count">🔢 {{ group.fields?.length || 0 }} полей</span>
                    </div>
                    <div class="group-actions">
                      <MoloButton class="action small" @click="openGroupModal(gIdx)">✎</MoloButton>
                      <MoloButton class="action small" @click="confirmDeleteGroup(gIdx)">×</MoloButton>
                    </div>
                  </div>

                  <div class="group-fields">
                    <div class="fields-header">
                      <span>Поля группы</span>
                      <MoloButton class="confirm small" @click="openFieldModal(gIdx, null)">Добавить поле</MoloButton>
                    </div>

                    <div v-if="!group.fields || group.fields.length === 0" class="empty-fields">
                      <span>📭</span>
                      <p>Нет полей</p>
                    </div>

                    <div v-for="(field, fIdx) in (group.fields || [])" :key="fIdx" class="field-item">
                      <div class="field-order">
                        <button :disabled="fIdx === 0" @click="moveField(gIdx, fIdx, 'up')">▲</button>
                        <button :disabled="fIdx === (group.fields?.length || 0) - 1"
                                @click="moveField(gIdx, fIdx, 'down')">▼
                        </button>
                      </div>
                      <div class="field-icon">
                        <span>{{ field.label ? field.label[0] : '' }}</span>
                        <span>{{ field.label ? field.label.slice(-1) : '' }}</span>
                      </div>
                      <div class="field-info">
                        <div class="field-name">
                          <span class="field-key">{{ field.key }}</span>
                          <span class="field-separator">—</span>
                          <span class="field-label">{{ field.label }}</span>
                        </div>
                        <div class="field-meta">
                          <span class="field-type-badge">{{ field.description }}</span>
                          <span v-if="field.required" class="field-badge required">Обязательное</span>
                          <span v-if="field.isUnique" class="field-badge unique">Уникальное</span>
                        </div>
                      </div>
                      <div class="field-actions">
                        <MoloButton class="small action" @click="openFieldModal(gIdx, fIdx)">✎</MoloButton>
                        <MoloButton class="small action" @click="confirmDeleteField(gIdx, fIdx)">×</MoloButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </MoloSection>
        </div>
      </div>

      <MoloSection v-if="activeSection === 'preview' && selectedTab">
        <template #header>
          <span>Предпросмотр: {{ selectedTab.name }}</span>
        </template>
        <template #main>
          <MockDataPreview
              :fields="getAllFields()"
              :groups="selectedTab?.groups || []"
              :viewType="previewStandard?.type || selectedTab.defaultViewType || 'table'"
              :standard="previewStandard"
              :rowsCount="selectedTab?.groups.length"
          />

          <div class="preview-note">
            <p>💡 Предпросмотр со стандартом «{{ previewStandard?.name || 'по умолчанию' }}»</p>
            <p v-if="previewStandard?.settings?.useGroupsAsColumns">📌 Колонки соответствуют группам вкладки</p>
          </div>
        </template>
      </MoloSection>
    </div>

    <!-- Модалки остаются без изменений -->
    <MoloModal
        v-model="deleteTabModalOpen"
        title="Удаление вкладки"
        confirm-text="Удалить"
        cancel-text="Отмена"
        close-on-overlay
        @confirm="confirmDeleteTab"
        help-text="Это действие необратимо — удалятся все записи."
    >
      <template #body>
        <p style="color: white;">Вы действительно хотите удалить вкладку <strong>{{ tabToDelete?.name }}</strong>?</p>
      </template>
    </MoloModal>

    <MoloModal
        v-model="groupModalOpen"
        :title="editingGroupIndex !== null ? 'Редактирование группы' : 'Новая группа'"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        close-on-overlay
        @confirm="saveGroup"
    >
      <template #body>
        <div class="group-form">
          <div class="group-image-section">
            <div class="group-image-preview" @click="() => {}">
              <img
                  v-if="groupImagePreview"
                  :src="groupImagePreview"
                  alt="Group preview"
                  class="group-preview-img"
              />
              <div v-else class="group-image-placeholder">
                <span>📁</span>
              </div>
            </div>
            <div class="group-image-actions">
              <MoloInput
                  type="file"
                  accept="image/*"
                  tLabel="Загрузить фото"
                  size="small"
                  @change="handleGroupImageUpload"
              />
              <MoloButton
                  v-if="groupImagePreview"
                  class="action small"
                  @click="removeGroupImage"
              >
                Удалить
              </MoloButton>
            </div>
          </div>

          <MoloInput v-model="groupForm.name" tLabel="Название группы" lRequired/>
          <MoloInput v-model="groupForm.description" tLabel="Описание"/>
          <MoloInput v-model="groupForm.link" tLabel="Внешняя ссылка"/>
        </div>
      </template>
    </MoloModal>

    <MoloModal
        v-model="deleteGroupModalOpen"
        title="Удаление группы"
        confirm-text="Удалить"
        cancel-text="Отмена"
        close-on-overlay
        @confirm="deleteGroupConfirmed"
        modal-text="Вы действительно хотите удалить группу и все её поля и записи? Это действие нельзя отменить"
    >
    </MoloModal>

    <MoloModal
        v-model="fieldModalOpen"
        :title="editingFieldIndex !== null ? 'Редактирование поля' : 'Новое поле'"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        width="650px"
        close-on-overlay
        @confirm="saveField"
        help-text="Внимание! Ключ поля должен быть обязательно со строчной буквы. Есть вероятность, что Ваше поле не сохранится!"
    >
      <template #body>
        <div class="modal-field-grid">
          <MoloInput v-model="fieldForm.label" tLabel="Название" lRequired placeholder="Название проекта"/>
          <MoloInput v-model="fieldForm.key" tLabel="Ключ" lRequired placeholder="project_name"
                     help-text="Автоматически генерируется из названия, можно редактировать вручную"/>
          <MoloInput v-model="fieldForm.description" tLabel="Описание"/>
          <MoloInput v-model="fieldForm.link" tLabel="Ссылка"/>
        </div>

        <div v-if="['select', 'multiselect'].includes(fieldForm.type)" class="options-editor">
          <label>Варианты выбора</label>
          <div class="options-list">
            <div v-for="(opt, idx) in fieldForm.options" :key="idx" class="option-item">
              <span :style="{ background: opt.color }" class="option-color"></span>
              <span>{{ opt.label }} ({{ opt.value }})</span>
              <button class="option-remove" @click="removeOption(idx)">×</button>
            </div>
          </div>
          <div class="add-option">
            <MoloInput v-model="newOption.label" tLabel="Метка" size="small"/>
            <MoloInput v-model="newOption.value" tLabel="Значение" size="small"/>
            <MoloInput v-model="newOption.color" tLabel="Цвет" type="color" size="small"/>
            <MoloButton class="confirm small" @click="addOption">+</MoloButton>
          </div>
        </div>

        <div class="field-flags">
          <label>Дополнительно</label>
          <div class="flags-grid">
            <label><input v-model="fieldForm.required" type="checkbox"/> Обязательное</label>
            <label><input v-model="fieldForm.isArray" type="checkbox"/> Массив</label>
            <label><input v-model="fieldForm.isUnique" type="checkbox"/> Уникальное</label>
            <label><input v-model="fieldForm.isSearchable" type="checkbox"/> Поиск</label>
            <label><input v-model="fieldForm.isFilterable" type="checkbox"/> Фильтр</label>
            <label><input v-model="fieldForm.isSortable" type="checkbox"/> Сортировка</label>
          </div>
        </div>
      </template>
    </MoloModal>

    <MoloModal
        v-model="deleteFieldModalOpen"
        title="Удаление поля"
        confirm-text="Удалить"
        cancel-text="Отмена"
        close-on-overlay
        @confirm="deleteFieldConfirmed"
        modal-text="Вы уверены, что хотите удалить это поле? Данные, связанные с ним, будут потеряны."
    >
    </MoloModal>
  </div>
</template>

<style scoped>
.configurator {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  color: #e0e0e0;
  padding: 20px;
  gap: 15px;
  box-sizing: border-box;
  overflow: hidden;
}

.configurator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 12px;
  gap: 10px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.back-btn {
  background: none;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.configurator-header span {
  font-weight: bold;
  font-size: 24px;
}

.configurator-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px;
}

/* Секция с вкладками — адаптивная сетка с красивым переносом */
.tabs-section {
  overflow-y: auto;
}

.tabs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
  padding: 4px;
}

/* Адаптация для маленьких экранов */
@media (max-width: 1200px) {
  .tabs-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}

@media (max-width: 768px) {
  .tabs-grid {
    grid-template-columns: 1fr;
  }
}

.tab-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tab-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card-info {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.tab-icon {
  width: 48px;
  height: 48px;
  min-width: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 20px;
  font-weight: bold;
  flex-shrink: 0;
}

.tab-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.tab-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-info p {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #8e8e9e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-count {
  font-size: 11px;
  background: #25252c;
  border-radius: 20px;
  color: #bbb;
  white-space: nowrap;
}

.tab-actions {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
}

.actions {
  display: flex;
  gap: 10px;
}

/* Редактор вкладок */
.editor-section-content {
  overflow-y: auto;
}

.tab-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px;
}

.editor-section {
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  flex-direction: column;
}

.editor-header span {
  font-size: 18px;
  font-weight: 600;
}

.section-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8e8e9e;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.group-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-card {
  border-bottom: 3px solid var(--half_opacity_border);
}

.group-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.group-order {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-order button {
  background: none;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 10px;
}

.group-order button:hover:not(:disabled) {
  background: #3a3a44;
}

.group-order button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.group-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 4px;
}

.group-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-icon {
  font-size: 14px;
}

.group-desc {
  font-size: 11px;
  color: #8e8e9e;
}

.field-count {
  font-size: 10px;
  color: #6496ff;
  background: rgba(100, 150, 255, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
  width: fit-content;
}

.group-actions {
  display: flex;
  gap: 6px;
}
.fields-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--half_opacity_bg);
  border-radius: 10px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.field-item:hover {
  background: rgba(28, 85, 199, 0.05);
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
  font-size: 10px;
  padding: 2px;
}

.field-order button:hover:not(:disabled) {
  color: #fff;
}

.field-order button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.field-icon {
  width: 40px;
  height: 40px;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2a2a35, #1e1e28);
  border-radius: 10px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.field-icon span {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  text-transform: uppercase;
}

.field-icon span:first-child {
  font-size: 16px;
  color: #6496ff;
}

.field-icon span:last-child {
  font-size: 11px;
  color: rgba(100, 150, 255, 0.6);
  align-self: flex-end;
  margin-bottom: 7px;
}

.group-image-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.group-image-preview {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  background: #25252c;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.group-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-image-placeholder {
  font-size: 32px;
  opacity: 0.6;
}

.group-image-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.field-info {
  flex: 1;
  min-width: 150px;
}

.field-name {
  font-size: 13px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.field-key {
  font-family: monospace;
  background: #25252c;
  padding: 2px 6px;
  border-radius: 6px;
  color: #6496ff;
  font-size: 11px;
}

.field-separator {
  margin: 0 4px;
  color: #555;
}

.field-label {
  color: #ccc;
  font-size: 13px;
}

.field-meta {
  margin-top: 4px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.field-type-badge {
  font-size: 10px;
  background: #25252c;
  padding: 2px 8px;
  border-radius: 12px;
  color: #aaa;
}

.field-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 12px;
}

.field-badge.required {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.field-badge.unique {
  background: rgba(100, 150, 255, 0.2);
  color: #6496ff;
}

.field-actions {
  display: flex;
  gap: 6px;
}

.empty-fields {
  text-align: center;
  color: #8e8e9e;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.empty-fields span {
  font-size: 32px;
  opacity: 0.5;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;

}

.modal-field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.options-editor {
  margin-top: 16px;
}

.options-editor label {
  font-size: 12px;
  color: #8e8e9e;
  margin-bottom: 8px;
  display: block;
}

.options-list {
  margin: 8px 0;
  max-height: 150px;
  overflow: auto;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #0f0f14;
  margin-bottom: 4px;
  border-radius: 6px;
  font-size: 12px;
}

.option-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.option-remove {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  margin-left: auto;
  font-size: 14px;
}

.add-option {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.field-flags {
  margin-top: 16px;
}

.field-flags label {
  font-size: 12px;
  color: #8e8e9e;
  margin-bottom: 8px;
  display: block;
}

.flags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.flags-grid label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: normal;
  color: #ccc;
  cursor: pointer;
  margin: 0;
}

.preview-section-content {
  overflow-y: auto;
}

.preview-page {
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
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

.preview-toolbar span {
  font-size: 22px;
}

.preview-note {
  margin-top: 16px;
  padding: 12px;
  background: rgba(100, 150, 255, 0.08);
  border: 1px solid rgba(100, 150, 255, 0.15);
  border-radius: 8px;
  font-size: 12px;
  color: #b0c4de;
}

.preview-note p {
  margin: 4px 0;
}

/* Адаптивность */
@media (max-width: 768px) {
  .configurator {
    padding: 12px;
  }

  .modal-field-grid {
    grid-template-columns: 1fr;
  }

  .group-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>