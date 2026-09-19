<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import excelIcon from '~~/app/assets/icons/excel.png'
import wordIcon from '~~/app/assets/icons/word.png'

type DocType = 'excel' | 'word'
type DocData = Record<string, any> | string

const DOC_ICONS: Record<DocType, string> = {
  excel: excelIcon,
  word: wordIcon,
}

const props = defineProps<{
  enterpriseId?: string
  windowId?: string
}>()
const emit = defineEmits(['close'])

const { addNotification } = useNotifications('Пространство')
const { addLog } = useLogger('Пространство')

interface SpaceDocument {
  id: string
  name: string
  type: DocType
  data: DocData
  createdAt: number
  updatedAt: number
}

const documents = shallowRef<SpaceDocument[]>([])
const openIds = ref<string[]>([])
const activeId = ref<string | null>(null)
const createMenuOpen = ref(false)
const renamingId = ref<string | null>(null)
const pendingDeleteId = ref<string | null>(null)
const renameValue = ref('')
const isModalOpen = ref(false)

const vFocus = {
  mounted: (el: HTMLInputElement) => {
    el.focus()
    el.select()
  },
}

let currentEnt = ''
const legacyKey = (ent: string) => `molo-workspace-docs:${ent}`
const indexKey = () => `molo-workspace-index:${currentEnt}`
const dataKey = (id: string) => `molo-workspace-data:${currentEnt}:${id}`

const dirty = new Set<string>()
const removed = new Set<string>()
let indexDirty = false

const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const lastSavedAt = ref<number | null>(null)
const lastSaveError = ref<string | null>(null)
let persistTimeout: ReturnType<typeof setTimeout> | null = null

function hasUnsaved() {
  return dirty.size > 0 || removed.size > 0 || indexDirty
}

function normalizeData(type: DocType, data: unknown): DocData {
  if (type === 'word') return typeof data === 'string' ? data : ''
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, any>) : {}
}

function emptyData(type: DocType): DocData {
  return type === 'word' ? '' : {}
}

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeToStorageNow(): boolean {
  if (persistTimeout) {
    clearTimeout(persistTimeout)
    persistTimeout = null
  }
  saveState.value = 'saving'
  try {
    for (const id of removed) localStorage.removeItem(dataKey(id))
    for (const id of dirty) {
      const doc = documents.value.find(d => d.id === id)
      if (doc) localStorage.setItem(dataKey(id), JSON.stringify(doc.data))
    }
    if (indexDirty) {
      const index = documents.value.map(({ data, ...meta }) => meta)
      localStorage.setItem(indexKey(), JSON.stringify(index))
    }
    removed.clear()
    dirty.clear()
    indexDirty = false
    saveState.value = 'saved'
    lastSavedAt.value = Date.now()
    lastSaveError.value = null
    return true
  } catch (e) {
    console.error('Не удалось сохранить документы пространства', e)
    saveState.value = 'error'
    lastSaveError.value = e instanceof DOMException && e.name === 'QuotaExceededError'
        ? 'Хранилище браузера переполнено — освободите место или уменьшите размер документов'
        : 'Не удалось сохранить документы'
    return false
  }
}

function schedulePersist() {
  if (persistTimeout) clearTimeout(persistTimeout)
  persistTimeout = setTimeout(() => {
    persistTimeout = null
    writeToStorageNow()
  }, 600)
}

function markDirty(id: string) {
  dirty.add(id)
  indexDirty = true
  schedulePersist()
}

function loadDocuments() {
  if (currentEnt && hasUnsaved()) writeToStorageNow()
  currentEnt = props.enterpriseId || 'default'
  dirty.clear()
  removed.clear()
  indexDirty = false
  openIds.value = []
  activeId.value = null

  try {
    const rawIndex = localStorage.getItem(indexKey())
    if (rawIndex) {
      const metas = JSON.parse(rawIndex) as Omit<SpaceDocument, 'data'>[]
      documents.value = metas.map(m => ({ ...m, data: normalizeData(m.type, readJson(dataKey(m.id))) }))
      return
    }
    const legacy = localStorage.getItem(legacyKey(currentEnt))
    const list = legacy ? (JSON.parse(legacy) as SpaceDocument[]) : []
    documents.value = list.map(d => ({ ...d, data: normalizeData(d.type, d.data) }))
    if (documents.value.length) {
      documents.value.forEach(d => dirty.add(d.id))
      indexDirty = true
      if (writeToStorageNow()) localStorage.removeItem(legacyKey(currentEnt))
    }
  } catch (e) {
    console.error('Не удалось загрузить документы пространства', e)
    documents.value = []
  }
}

function saveNow() {
  const ok = writeToStorageNow()
  if (ok) addNotification('success', 'Изменения сохранены')
  else addNotification('error', lastSaveError.value || 'Не удалось сохранить изменения')
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasUnsaved() && !writeToStorageNow()) {
    e.preventDefault()
    e.returnValue = ''
  }
}

const sortedDocuments = computed(() =>
    [...documents.value].sort((a, b) => b.updatedAt - a.updatedAt)
)

const openDocuments = computed(() =>
    openIds.value
        .map(id => documents.value.find(d => d.id === id))
        .filter((d): d is SpaceDocument => !!d)
)

function patchDoc(id: string, patch: Partial<SpaceDocument>) {
  documents.value = documents.value.map(d => (d.id === id ? { ...d, ...patch } : d))
}

function genId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createDocument(type: DocType) {
  const now = Date.now()
  const doc: SpaceDocument = {
    id: genId(),
    name: type === 'excel' ? 'Новая таблица' : 'Новый документ',
    type,
    data: emptyData(type),
    createdAt: now,
    updatedAt: now
  }
  documents.value = [doc, ...documents.value]
  markDirty(doc.id)
  openDocument(doc.id)
  createMenuOpen.value = false
  addLog('info', `Создан новый ${type === 'excel' ? 'excel' : 'word'}-документ`)
}

function openDocument(id: string) {
  if (!openIds.value.includes(id)) openIds.value.push(id)
  activeId.value = id
}

function closeTab(id: string) {
  const idx = openIds.value.indexOf(id)
  if (idx === -1) return
  openIds.value.splice(idx, 1)
  if (activeId.value === id) {
    activeId.value = openIds.value[openIds.value.length - 1] || null
  }
}

function requestRemove(id: string) {
  pendingDeleteId.value = id
  isModalOpen.value = true
}

function confirmRemove() {
  const id = pendingDeleteId.value
  isModalOpen.value = false
  pendingDeleteId.value = null
  if (!id || !documents.value.some(d => d.id === id)) return

  documents.value = documents.value.filter(d => d.id !== id)
  dirty.delete(id)
  removed.add(id)
  indexDirty = true
  schedulePersist()
  closeTab(id)
  addNotification('success', 'Документ удалён')
}

function cancelRemove() {
  pendingDeleteId.value = null
  isModalOpen.value = false
}

function startRename(doc: SpaceDocument) {
  renamingId.value = doc.id
  renameValue.value = doc.name
}

function confirmRename() {
  const id = renamingId.value
  if (!id) return
  renamingId.value = null
  const name = renameValue.value.trim()
  if (name) {
    patchDoc(id, { name, updatedAt: Date.now() })
    indexDirty = true
    schedulePersist()
  }
}

function updateDocData(id: string, data: DocData) {
  if (!documents.value.some(d => d.id === id)) return
  patchDoc(id, { data, updatedAt: Date.now() })
  markDirty(id)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function docIcon(type: DocType): string {
  return DOC_ICONS[type]
}

watch(activeId, async () => {
  await nextTick()
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
})

watch(() => props.enterpriseId, loadDocuments)

onMounted(() => {
  loadDocuments()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (hasUnsaved()) writeToStorageNow()
})
</script>

<template>
  <div class="workspace">
    <div class="workspace-header">
      <div class="workspace-title">
        <span class="workspace-icon">🗂️</span>
        <span>Пространство - Место Вашего рабочего творчества</span>
      </div>
      <div class="workspace-header-actions">
        <span
            class="save-status"
            :class="saveState"
            :title="lastSaveError || (lastSavedAt ? `Последнее сохранение: ${formatDate(lastSavedAt)}` : '')"
        >
          <template v-if="saveState === 'saving'">Сохранение…</template>
          <template v-else-if="saveState === 'error'">⚠ Не сохранено</template>
          <template v-else-if="lastSavedAt">✓ Сохранено {{ formatDate(lastSavedAt) }}</template>
        </span>
        <UIMoloButton class="small" @click="saveNow">
          Сохранить изменения
        </UIMoloButton>
        <div class="create-menu-wrap">
          <UIMoloButton class="confirm" @click="createMenuOpen = !createMenuOpen">
            Новый документ
          </UIMoloButton>
          <div v-if="createMenuOpen" class="create-menu">
            <button class="create-menu-item" @click="createDocument('excel')">
              <img class="create-menu-icon" :src="docIcon('excel')" style="width: 15px;" alt="" aria-hidden="true" draggable="false">
              <span>Таблица (Excel)</span>
            </button>
            <button class="create-menu-item" @click="createDocument('word')">
              <img class="create-menu-icon" :src="docIcon('word')" style="width: 15px" alt="" aria-hidden="true" draggable="false">
              <span>Документ (Word)</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="workspace-body">
      <aside class="workspace-sidebar">
        <div class="sidebar-heading">
          <span>Документы</span>
          <span class="counter">{{ documents.length }}</span>
        </div>

        <div v-if="documents.length === 0" class="sidebar-empty">
          <p>Пока нет документов</p>
          <UIMoloButton class="confirm small" @click="createMenuOpen = true">Создать первый</UIMoloButton>
        </div>

        <div v-else class="sidebar-list">
          <div
              v-for="doc in sortedDocuments"
              :key="doc.id"
              class="sidebar-item"
              :class="{ active: doc.id === activeId }"
              @click="openDocument(doc.id)"
              @dblclick="startRename(doc)"
          >
            <img class="sidebar-item-icon" :src="docIcon(doc.type)" style="width: 15px" alt="">
            <div class="sidebar-item-info">
              <input
                  v-if="renamingId === doc.id"
                  v-model="renameValue"
                  v-focus
                  class="rename-input"
                  @click.stop
                  @keydown.enter="confirmRename"
                  @keydown.esc="renamingId = null"
                  @blur="confirmRename"
              />
              <span v-else class="sidebar-item-name">{{ doc.name }}</span>
              <span class="sidebar-item-meta">{{ formatDate(doc.updatedAt) }}</span>
            </div>
            <UIMoloButton class="small fit" title="Удалить" @click.stop="requestRemove(doc.id)">✕</UIMoloButton>
          </div>
        </div>
      </aside>

      <section class="workspace-main">
        <div v-if="openDocuments.length === 0" class="empty-state">
          <span class="empty-icon">🗂️</span>
          <h3>Пространство пусто</h3>
          <p>Создайте таблицу или документ, чтобы начать работу</p>
        </div>

        <template v-else>
          <div class="tabs-bar">
            <div
                v-for="doc in openDocuments"
                :key="doc.id"
                class="tab-item"
                :class="{ active: doc.id === activeId }"
                @click="activeId = doc.id"
            >
              <img class="tab-icon" :src="docIcon(doc.type)" alt="" style="width: 15px" aria-hidden="true" draggable="false">
              <span class="tab-name">{{ doc.name }}</span>
              <button class="tab-close" @click.stop="closeTab(doc.id)">✕</button>
            </div>
          </div>

          <div class="tab-content">
            <div
                v-for="doc in openDocuments"
                v-show="doc.id === activeId"
                :key="doc.id"
                class="tab-panel"
            >
              <LazyAppsMoloTable
                  v-if="doc.type === 'excel'"
                  :model-value="doc.data"
                  @update:model-value="(val) => updateDocData(doc.id, val)"
              />
              <LazyAppsMoloDocument
                  v-else
                  :model-value="doc.data"
                  :file-name="doc.name"
                  @update:model-value="(val) => updateDocData(doc.id, val)"
              />
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
  <UIMoloModal
      v-model="isModalOpen"
      title="Удалить документ?"
      modal-text="Вы действительно хотите удалить документ? Это действие необратимо."
      cancel-text="Отмена"
      confirm-text="Удалить"
      @confirm="confirmRemove"
      @cancel="cancelRemove"
  />
</template>

<style scoped>
/* Корень: колонка, тянется от родителя, но не меньше 480px —
   это защита от «родителя без высоты», иначе всё схлопывается */
.workspace {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 480px;
  overflow: hidden;
  color: #e0e0e0;
  box-sizing: border-box;
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
}

.workspace-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
}

.workspace-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.save-status {
  font-size: 11px;
  color: #8e8e9e;
  white-space: nowrap;
}

.save-status.error {
  color: #ef4444;
  font-weight: 600;
}

.create-menu-wrap {
  position: relative;
}

.create-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #1e1e1e;
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  z-index: 20;
}

.create-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: #e0e0e0;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}

.create-menu-item:hover {
  background: rgba(100, 150, 255, 0.12);
}

/* Тело: две колонки, занимает всё оставшееся место */
.workspace-body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.workspace-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--half_opacity_border);
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.sidebar-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #8e8e9e;
}

.sidebar-heading .counter {
  font-size: 11px;
  color: #6e6e7e;
}

.sidebar-empty {
  text-align: center;
  padding: 24px 8px;
  color: #8e8e9e;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.sidebar-item.active {
  background: rgba(100, 150, 255, 0.14);
}

.sidebar-item-icon {
  flex-shrink: 0;
}

.sidebar-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-item-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-item-meta {
  font-size: 10px;
  color: #6e6e7e;
}

.rename-input {
  background: #0f0f14;
  border: 1px solid #6496ff;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  padding: 2px 6px;
  width: 100%;
}

/* Главная область — колонка, обязательно min-height: 0 */
.workspace-main {
  width: 100%;
  height: auto;
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  padding: 14px;
  box-sizing: border-box;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8e8e9e;
  text-align: center;
}

.empty-icon {
  font-size: 42px;
  opacity: 0.6;
}

.tabs-bar {
  display: flex;
  overflow-x: auto;
  flex-shrink: 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 5px;
  padding: 8px 12px;
  border-radius: 10px 10px 0 0;
  background: var(--half_opacity_bg);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  border: 1px solid transparent;
}

.tab-item.active {
  background: var(--half_opacity_bg);
  border-color: var(--half_opacity_border);
  border-bottom-color: transparent;
}

.tab-close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 10px;
}

.tab-close:hover {
  color: #ef4444;
}

/* ВАЖНО: контент вкладок — flex-колонка. Панели больше не absolute,
   поэтому они участвуют в расчёте высоты и НЕ схлопываются в 0 */
.tab-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Панель занимает всё место, скрытая — display: none (v-show) и не мешает */
.tab-panel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Дочерний редактор (MoloTable / MoloDocument) растягивается на панель */
.tab-panel > * {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
}

@media (max-width: 768px) {
  .workspace-body {
    flex-direction: column;
  }

  .workspace-sidebar {
    width: 100%;
    max-height: 180px;
    border-right: none;
    border-bottom: 1px solid var(--half_opacity_border);
  }
}
</style>