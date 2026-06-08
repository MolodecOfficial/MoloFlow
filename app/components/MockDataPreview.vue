<!-- MockDataPreview.vue -->
<script lang="ts" setup>
import { computed } from 'vue'
import MoloTable from './MoloTable.vue'
import MoloCard from './MoloCard.vue'
import MoloList from './MoloList.vue'

const props = defineProps<{
  fields: any[]
  groups?: any[]
  viewType: 'table' | 'card' | 'list'
  standard: any
  rowsCount?: number
  realData?: any[]
}>()

// Генерация моковых данных на основе структуры групп
function generateMockFromGroups(groups: any[], index: number): any {
  const entry: any = { _id: `mock_${index}_${Date.now()}_${Math.random()}` }
  for (const group of groups) {
    if (group.fields && group.fields.length) {
      for (const field of group.fields) {
        const key = field.key
        entry[key] = `[${group.name}] ${field.label}`
      }
    }
  }
  return entry
}

// Реальные или моковые данные
const actualData = computed(() => {
  if (props.realData && props.realData.length > 0) {
    return props.realData
  }

  const groups = props.groups || []
  const count = props.rowsCount || 1

  // Для списка - создаём ровно 1 моковую запись для демонстрации структуры
  if (props.viewType === 'list') {
    if (groups.length > 0) {
      return [generateMockFromGroups(groups, 0)]
    }
    return [generateMockFromGroups([{ name: 'Пример', fields: props.fields }], 0)]
  }

  // Для таблицы и карточек - по количеству групп
  if (groups.length > 0) {
    return Array.from({ length: count }, (_, i) => generateMockFromGroups(groups, i))
  }

  return [{ _id: 'mock_1' }]
})

// Подготовка групповых данных для таблицы
const groupedData = computed(() => {
  if (!props.standard?.settings?.useGroupsAsColumns) return actualData.value

  const groups = props.groups || []
  const showLabels = props.standard?.settings?.groupShowFieldLabels ?? false
  const blockFormat = props.standard?.settings?.groupCellFormat === 'block'

  return actualData.value.map((entry: any, idx: number) => {
    const newEntry = { ...entry, _uniqueKey: entry._id || idx }
    for (const group of groups) {
      const groupKey = `_group_${group._id || group.name || idx}`
      const fieldItems: { label: string; value: any }[] = []
      for (const field of group.fields || []) {
        const val = entry[field.key]
        let displayValue = val
        if (Array.isArray(val)) displayValue = val.join(', ')
        if (displayValue === undefined || displayValue === null) displayValue = '—'
        fieldItems.push({
          label: showLabels ? field.label : '',
          value: displayValue
        })
      }
      if (blockFormat) {
        newEntry[groupKey] = fieldItems
      } else {
        newEntry[groupKey] = fieldItems.map(item =>
            item.label ? `${item.label}: ${item.value}` : item.value
        ).join('; ')
      }
    }
    return newEntry
  })
})

// Колонки таблицы
const tableColumns = computed(() => {
  if (props.viewType !== 'table') return []
  if (props.standard?.settings?.useGroupsAsColumns) {
    const groups = props.groups || []
    return groups.map((group, idx) => ({
      field: `_group_${group._id || group.name || idx}`,
      label: group.name,
      width: 'auto',
      align: 'left',
      sortable: false,
      isGroup: true
    }))
  } else {
    const cols = props.standard?.tableSettings?.columns || props.standard?.settings?.columns
    if (cols?.length) return cols
    return props.fields.filter(f => !f.isHidden).map(f => ({
      field: f.key,
      label: f.label,
      width: 'auto',
      align: 'left',
      sortable: true,
      isGroup: false
    }))
  }
})

const cardColumnsCount = computed(() => {
  if (props.standard?.settings?.cardColumns !== undefined && props.standard.settings.cardColumns !== null) {
    const val = Number(props.standard.settings.cardColumns)
    return isNaN(val) ? 3 : Math.max(1, val)
  }
  if (props.standard?.cardSettings?.columns !== undefined && props.standard.cardSettings.columns !== null) {
    const val = Number(props.standard.cardSettings.columns)
    return isNaN(val) ? 3 : Math.max(1, val)
  }
  return 3
})

// Карточки на основе групп - одна карточка на группу
const cardItems = computed(() => {
  const groups = props.groups || []
  if (!groups.length) return []

  return groups.map((group, index) => ({
    _id: group._id || `group_${index}`,
    group,
    fields: group.fields || [],
    entry: generateMockFromGroups([group], index)
  }))
})

// Настройки списка
const listSettings = computed(() => ({
  title: props.standard?.listSettings?.title || props.standard?.settings?.listTitle || '',
  subtitle: props.standard?.listSettings?.subtitle || props.standard?.settings?.listSubtitle || '',
  showIcon: props.standard?.listSettings?.showIcon ?? props.standard?.settings?.listShowIcon ?? true,
  showDivider: props.standard?.listSettings?.showDivider ?? props.standard?.settings?.listShowDivider ?? true
}))

const stylesFromStandard = computed(() => props.standard?.styles || {})
</script>

<template>
  <div class="mock-preview">
    <div class="preview-body">
      <MoloTable
          v-if="viewType === 'table'"
          :columns="tableColumns"
          :data="groupedData"
          :settings="standard"
          :styles="stylesFromStandard"
          :groups="props.groups"
      />

      <div v-else-if="viewType === 'card'" class="cards-grid" :style="{
        display: 'grid',
        gridTemplateColumns: `repeat(${cardColumnsCount}, minmax(0, 1fr))`,
        gap: '16px'
      }">
        <MoloCard
            v-for="card in cardItems"
            :key="card._id"
            :item="card.entry"
            :settings="{ fields: card.fields.map(f => f.key) }"
            :fields="card.fields"
            :styles="stylesFromStandard"
            :group-name="card.group?.name"
            :group-description="card.group?.description"
            :group-image="card.group?.image"
            :group-link="card.group?.link"
        />
      </div>

      <MoloList
          v-else-if="viewType === 'list'"
          :items="actualData"
          :groups="props.groups"
          :settings="listSettings"
          :styles="stylesFromStandard"
      />
    </div>
  </div>
</template>

<style scoped>
.mock-preview {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.preview-body {
  padding: 16px;
}
.cards-grid {
  display: grid;
  gap: 16px;
}
</style>