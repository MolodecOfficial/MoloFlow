<!-- app/components/directory/DirectorySuggestDropdown.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DirectoryLookupItem, CustomDirectoryDefinition } from '~/composables/useDirectoryInterpolator'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  query: string
  items: DirectoryLookupItem[]
  definitions?: CustomDirectoryDefinition[]
}>()

const emit = defineEmits<{
  (e: 'select', item: DirectoryLookupItem, fieldValue?: string): void
  (e: 'close'): void
}>()

const selectedIndex = ref(0)
const expandedItemId = ref<string | null>(null)

const BASE_SLUG_LABELS: Record<string, string> = {
  departments: 'Сотрудники',
  counterparties: 'Контрагенты',
  bank_accounts: 'Банки / Счета',
  nomenclature: 'Товары и услуги',
  glossary: 'Глоссарий'
}

const getDirectoryTitle = (slug: string): string => {
  if (BASE_SLUG_LABELS[slug]) return BASE_SLUG_LABELS[slug]
  const custom = props.definitions?.find((d) => d.slug === slug)
  return custom?.title || slug
}

const filteredItems = computed(() => {
  const q = (props.query || '').toLowerCase().trim()
  if (!q) return props.items.slice(0, 20)

  // Словарь алиасов для проверки по синонимам
  const aliasToSlugMap = new Map<string, string>()
  props.definitions?.forEach((def) => {
    aliasToSlugMap.set(def.slug.toLowerCase(), def.slug)
    aliasToSlugMap.set(def.title.toLowerCase(), def.slug)
    def.aliases?.forEach((alias) => aliasToSlugMap.set(alias.toLowerCase(), def.slug))
  })

  return props.items
      .filter((item) => {
        const dirTitle = getDirectoryTitle(item.directorySlug).toLowerCase()
        const matchTitle = item.title.toLowerCase().includes(q)
        const matchCode = item.code.toLowerCase().includes(q)
        const matchDirectory = dirTitle.includes(q) || item.directorySlug.toLowerCase().includes(q)

        // Проверка совпадения по алиасам справочника
        const customDef = props.definitions?.find((d) => d.slug === item.directorySlug)
        const matchAlias = customDef?.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false

        // Поиск по атрибутам карточки (дата, телефон, описание и т.д.)
        const matchFields = item.availableFields?.some(
            (f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)
        )

        return matchTitle || matchCode || matchDirectory || matchAlias || matchFields
      })
      .slice(0, 20)
})

watch(
    () => filteredItems.value.length,
    () => {
      selectedIndex.value = 0
      expandedItemId.value = null
    }
)

function selectCurrent(fieldVal?: string) {
  if (filteredItems.value.length > 0 && filteredItems.value[selectedIndex.value]) {
    emit('select', filteredItems.value[selectedIndex.value], fieldVal)
  }
}

function toggleExpand(id: string, e: MouseEvent) {
  e.stopPropagation()
  expandedItemId.value = expandedItemId.value === id ? null : id
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.visible) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    selectedIndex.value = (selectedIndex.value + 1) % Math.max(1, filteredItems.value.length)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    selectedIndex.value =
        (selectedIndex.value - 1 + filteredItems.value.length) % Math.max(1, filteredItems.value.length)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (filteredItems.value.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      selectCurrent()
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('close')
  }
}

defineExpose({
  handleKeyDown,
  selectCurrent
})
</script>

<template>
  <Teleport to="body">
    <div
        v-if="visible && filteredItems.length > 0"
        class="molo-suggest-dropdown"
        :style="{ left: `${x}px`, top: `${y + 6}px` }"
        @mousedown.prevent
    >
      <div class="suggest-header">
        <span>База сущностей и реквизитов</span>
        <span class="suggest-hint">Нажмите «Реквизиты» для выбора поля</span>
      </div>

      <div class="suggest-list">
        <div
            v-for="(item, idx) in filteredItems"
            :key="item.id || idx"
            class="suggest-item-wrapper"
        >
          <div
              class="suggest-item"
              :class="{ active: idx === selectedIndex }"
              @click="emit('select', item)"
              @mouseenter="selectedIndex = idx"
          >
            <div class="item-avatar">
              {{ (item.title || 'С')[0].toUpperCase() }}
            </div>

            <div class="item-details">
              <div class="item-title-line">
                <span class="item-name" :title="item.title">{{ item.title }}</span>
                <span class="item-category">
                  {{ getDirectoryTitle(item.directorySlug) }}
                </span>
              </div>

              <div class="item-meta-line">
                <span v-if="item.code" class="meta-tag code">Код: {{ item.code }}</span>
                <span
                    v-for="f in item.availableFields.filter(f => f.key !== 'title' && f.key !== 'code').slice(0, 2)"
                    :key="f.key"
                    class="meta-tag"
                >
                  {{ f.label }}: {{ f.value }}
                </span>
              </div>
            </div>

            <button
                v-if="item.availableFields && item.availableFields.length > 1"
                class="props-expand-btn"
                title="Выбрать отдельный реквизит"
                @click="toggleExpand(item.id, $event)"
            >
              {{ expandedItemId === item.id ? '▲' : 'Реквизиты ▼' }}
            </button>
          </div>

          <!-- Вложенный список реквизитов выбранной карточки -->
          <div v-if="expandedItemId === item.id" class="subprops-panel">
            <span class="subprops-title">Вставить конкретное значение:</span>
            <div class="subprops-grid">
              <button
                  v-for="f in item.availableFields"
                  :key="f.key"
                  class="subprop-btn"
                  @click="emit('select', item, f.value)"
              >
                <small>{{ f.label }}:</small>
                <strong>{{ f.value }}</strong>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.molo-suggest-dropdown {
  position: fixed;
  z-index: 10050;
  width: 460px;
  max-height: 420px;
  background: #181920;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  font-family: inherit;
  animation: fadeIn 0.1s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.suggest-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-weight: 600;
  color: #8c8c9e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.suggest-hint {
  font-size: 10.5px;
  color: #6496ff;
  text-transform: none;
}

.suggest-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.suggest-item-wrapper {
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.suggest-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.1s ease;
  flex-shrink: 0;
}

.suggest-item.active {
  background: rgba(100, 150, 255, 0.16);
}

.item-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #3872ef;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.item-title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: #f1f1f5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-category {
  font-size: 10px;
  color: #8a8a9e;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.item-meta-line {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.meta-tag {
  font-size: 11px;
  white-space: nowrap;
  color: #9cb3d9;
}

.meta-tag.code {
  color: #8c8c9e;
  font-family: monospace;
}

.props-expand-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #aaa;
  border-radius: 4px;
  font-size: 10px;
  padding: 4px 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.props-expand-btn:hover {
  background: rgba(100, 150, 255, 0.2);
  color: #fff;
  border-color: #6496ff;
}

.subprops-panel {
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.subprops-title {
  font-size: 10.5px;
  color: #8c8c9e;
}

.subprops-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.subprop-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.1s ease;
}

.subprop-btn:hover {
  background: rgba(100, 150, 255, 0.18);
  border-color: #6496ff;
}

.subprop-btn small {
  font-size: 9.5px;
  color: #7b7b8f;
}

.subprop-btn strong {
  font-size: 11.5px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
</style>