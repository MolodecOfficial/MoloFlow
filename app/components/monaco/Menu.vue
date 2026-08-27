<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { FileNode } from '~~/app/composables/monaco/filesystem'
import { useMonacoFiles } from '~~/app/composables/useMonacoFiles'
import type { MonacoComponent, MonacoComposable } from '~~/app/composables/useMonacoFiles'

export interface InsertPayload {
  /** import-строка, которую нужно вставить в начало файла (если её там ещё нет) */
  importStatement: string
  /** сниппет использования, который вставляется в позицию курсора */
  snippet: string
}

const props = defineProps<{
  files: FileNode[]
  position: { x: number; y: number }
  onInsert: (payload: InsertPayload) => void
  onClose: () => void
}>()

const searchQuery = ref('')
const activeTab = ref<'composables' | 'components'>('composables')
const selectedIndex = ref(0)
const containerRef = ref<HTMLElement | null>(null)

// Используем singleton-хук для анализа файлов.
// updateFiles сам подмешивает глобальную библиотеку проекта (см. globalCatalog.ts) —
// сюда прилетают уже файлы модуля, а результат содержит и то, и другое, помечая isGlobal.
const { composables, components, updateFiles } = useMonacoFiles()

watch(
    () => props.files,
    (newFiles) => updateFiles(newFiles || []),
    { immediate: true }
)

// ---------------------------------------------------------------
// Поиск
// ---------------------------------------------------------------

const filteredComposables = computed(() => {
  if (!searchQuery.value) return composables.value
  const query = searchQuery.value.toLowerCase()
  return composables.value.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.path.toLowerCase().includes(query)
  )
})

const filteredComponents = computed(() => {
  if (!searchQuery.value) return components.value
  const query = searchQuery.value.toLowerCase()
  return components.value.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.path.toLowerCase().includes(query)
  )
})

const currentItems = computed<(MonacoComposable | MonacoComponent)[]>(() =>
    activeTab.value === 'composables' ? filteredComposables.value : filteredComponents.value
)

// Счётчики "из модуля / из проекта" для подписи в шапке
const composableSplit = computed(() => splitBySource(composables.value))
const componentSplit = computed(() => splitBySource(components.value))

function splitBySource<T extends { isGlobal?: boolean }>(items: T[]) {
  const own = items.filter(i => !i.isGlobal).length
  return { own, global: items.length - own, total: items.length }
}

// Показывать ли разделитель-заголовок группы перед этим элементом
function showDivider(list: (MonacoComposable | MonacoComponent)[], index: number): boolean {
  const item = list[index]
  if (!item?.isGlobal) return false
  const prev = list[index - 1]
  return index === 0 || !prev?.isGlobal
}

// Сброс выделения при смене вкладки или поиска
watch([searchQuery, activeTab], () => {
  selectedIndex.value = 0
})

// Прокрутка к выделенному элементу при навигации с клавиатуры
watch(selectedIndex, () => {
  nextTick(() => {
    const el = containerRef.value?.querySelector(
        `.menu-item[data-index="${selectedIndex.value}"]`
    ) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
})

// ---------------------------------------------------------------
// Вставка
// ---------------------------------------------------------------

function toKebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function insertComposable(item: MonacoComposable) {
  // Импорт не вставляем — композаблы уже доступны в коде модуля без импорта
  // (глобально прокинуты через рантайм), вставляем только сниппет использования.
  props.onInsert({
    importStatement: '',
    snippet: `${item.name}()`
  })
  props.onClose()
}

function insertComponent(item: MonacoComponent) {
  const attrs = item.props?.length
      ? ' ' + item.props.slice(0, 3).map(p => `:${toKebabCase(p)}=""`).join(' ')
      : ''
  // Аналогично — компонент уже зарегистрирован глобально, import не нужен.
  props.onInsert({
    importStatement: '',
    snippet: `<${item.name}${attrs} />`
  })
  props.onClose()
}

function insertItem(item: MonacoComposable | MonacoComponent) {
  if (activeTab.value === 'composables') {
    insertComposable(item as MonacoComposable)
  } else {
    insertComponent(item as MonacoComponent)
  }
}

function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const icons: Record<string, string> = {
    vue: '🧩',
    ts: '📘',
    js: '📄',
    jsx: '⚛️',
    tsx: '⚛️',
    css: '🎨',
    scss: '🎨',
    json: '📋'
  }
  return icons[ext || ''] || '📄'
}

function highlightText(text: string, query: string): string {
  if (!query) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

// ---------------------------------------------------------------
// Клавиатура
// ---------------------------------------------------------------

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    props.onClose()
    return
  }

  if (e.key === 'Tab') {
    e.preventDefault()
    activeTab.value = activeTab.value === 'composables' ? 'components' : 'composables'
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (currentItems.value.length) {
      selectedIndex.value = Math.min(selectedIndex.value + 1, currentItems.value.length - 1)
    }
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (currentItems.value.length) {
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    }
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    const item = currentItems.value[selectedIndex.value]
    if (item) {
      insertItem(item)
    }
  }
}

// Автофокус на поиске
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  nextTick(() => {
    const searchInput = containerRef.value?.querySelector('.search-input') as HTMLInputElement
    searchInput?.focus()
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Закрытие при клике вне меню
function handleOutsideClick(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    props.onClose()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
})

// Корректировка позиции, чтобы меню не выходило за экран
const adjustedPosition = computed(() => {
  const { x, y } = props.position
  const padding = 10
  const menuWidth = 480
  const menuHeight = 420

  let adjustedX = x
  let adjustedY = y

  if (x + menuWidth > window.innerWidth - padding) {
    adjustedX = window.innerWidth - menuWidth - padding
  }
  if (y + menuHeight > window.innerHeight - padding) {
    adjustedY = window.innerHeight - menuHeight - padding
  }
  if (adjustedX < padding) adjustedX = padding
  if (adjustedY < padding) adjustedY = padding

  return { x: adjustedX, y: adjustedY }
})
</script>

<template>
  <div
      ref="containerRef"
      class="monaco-menu-popup"
      :style="{ left: adjustedPosition.x + 'px', top: adjustedPosition.y + 'px' }"
  >
    <div class="menu-header">
      <UIMoloInput
          v-model="searchQuery"
          type="text"
          placeholder="Поиск компонентов и композаблов..."
          class="search-input"
      />
      <div class="tabs">
        <UIMoloButton
            class="small"
            :class="{ confirm: activeTab === 'composables' }"
            @click="activeTab = 'composables'"
        >
          ⚡ Композаблы
          <span class="tab-count">{{ composableSplit.total }}</span>
        </UIMoloButton>
        <UIMoloButton
            class="small"
            :class="{ confirm: activeTab === 'components' }"
            @click="activeTab = 'components'"
        >
          🧩 Компоненты
          <span class="tab-count">{{ componentSplit.total }}</span>
        </UIMoloButton>
      </div>
    </div>

    <div class="menu-body">
      <div v-if="activeTab === 'composables'" class="items-list">
        <template v-for="(item, index) in filteredComposables" :key="item.filePath + '::' + item.name">
          <div v-if="showDivider(filteredComposables, index)" class="group-divider">
            <span>Библиотека проекта</span>
          </div>
          <div
              :data-index="index"
              class="menu-item"
              :class="{ selected: index === selectedIndex }"
              @click="insertComposable(item as MonacoComposable)"
              @mouseenter="selectedIndex = index"
          >
            <div class="item-icon">⚡</div>
            <div class="item-content">
              <div class="item-name-row">
                <span class="item-name" v-html="highlightText(item.name, searchQuery)"></span>
                <span v-if="item.isGlobal" class="item-badge">проект</span>
              </div>
              <div class="item-path">{{ item.path }}</div>
              <div v-if="(item as MonacoComposable).imports?.length" class="item-params">
                params: {{ (item as MonacoComposable).imports.join(', ') }}
              </div>
            </div>
          </div>
        </template>
        <div v-if="filteredComposables.length === 0" class="empty-state">
          {{ searchQuery ? 'Ничего не найдено' : (composables.length === 0 ? 'Композаблы не найдены ни в модуле, ни в проекте' : 'Нет композаблов') }}
        </div>
      </div>

      <div v-if="activeTab === 'components'" class="items-list">
        <template v-for="(item, index) in filteredComponents" :key="item.filePath + '::' + item.name">
          <div v-if="showDivider(filteredComponents, index)" class="group-divider">
            <span>Библиотека проекта</span>
          </div>
          <div
              :data-index="index"
              class="menu-item"
              :class="{ selected: index === selectedIndex }"
              @click="insertComponent(item as MonacoComponent)"
              @mouseenter="selectedIndex = index"
          >
            <div class="item-icon">{{ getFileIcon(item.path + '.vue') }}</div>
            <div class="item-content">
              <div class="item-name-row">
                <span class="item-name" v-html="highlightText(item.name, searchQuery)"></span>
                <span v-if="item.isGlobal" class="item-badge">проект</span>
              </div>
              <div class="item-path">{{ item.path }}</div>
              <div v-if="(item as MonacoComponent).props?.length" class="item-params">
                props: {{ (item as MonacoComponent).props!.join(', ') }}
              </div>
            </div>
          </div>
        </template>
        <div v-if="filteredComponents.length === 0" class="empty-state">
          {{ searchQuery ? 'Ничего не найдено' : (components.length === 0 ? 'Компоненты не найдены ни в модуле, ни в проекте' : 'Нет компонентов') }}
        </div>
      </div>
    </div>

    <div class="menu-footer">
      <span class="hint">↑↓ навигация · Enter — вставить · Tab — вкладка · Esc — закрыть</span>
    </div>
  </div>
</template>

<style scoped>
.monaco-menu-popup {
  position: fixed;
  z-index: 9999;
  width: 480px;
  max-height: 420px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(97, 175, 239, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 300px;
  backdrop-filter: blur(14px);
  animation: menuIn 0.14s ease-out;
}

@keyframes menuIn {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.menu-header {
  padding: 12px 16px;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  border-radius: 6px;
  color: #abb2bf;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: #61afef;
  box-shadow: 0 0 0 3px rgba(97, 175, 239, 0.12);
}

.search-input::placeholder {
  color: #5a5a6e;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-top: 10px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #5a5a6e;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  font-family: inherit;
}

.tab:hover {
  color: #abb2bf;
  background: #24283b;
}

.tab.active {
  color: #e5e9f0;
  background: #3b4261;
}

.tab-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  font-family: monospace;
}

.menu-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  max-height: 300px;
}

.items-list {
  display: flex;
  flex-direction: column;
}

.group-divider {
  padding: 10px 16px 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #4b5266;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
}

.group-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #2a2e42;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.1s;
  border-left: 2px solid transparent;
}

.menu-item:hover,
.menu-item.selected {
  background: #3b4261;
  border-left-color: #61afef;
}

.item-icon {
  font-size: 18px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-name {
  font-weight: 500;
  color: #abb2bf;
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-name :deep(mark) {
  background: #e5c07b;
  color: #1a1b26;
  border-radius: 2px;
  padding: 0 2px;
}

.item-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(97, 175, 239, 0.15);
  color: #61afef;
  border: 1px solid rgba(97, 175, 239, 0.3);
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
}

.item-path {
  font-size: 11px;
  color: #5a5a6e;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-params {
  font-size: 11px;
  color: #98c379;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #5a5a6e;
  font-size: 13px;
  line-height: 1.5;
}

.menu-footer {
  padding: 8px 16px;
  border-top: 1px solid #2a2e42;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.hint {
  font-size: 11px;
  color: #5a5a6e;
}

</style>