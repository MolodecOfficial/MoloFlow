<!-- MockDataPreview.vue -->
<script lang="ts" setup>
import { computed } from 'vue'
import MoloTable from './MoloTable.vue'
import MoloCard from './MoloCard.vue'
import MoloList from './MoloList.vue'

const props = defineProps<{
  fields: any[]
  groups?: any[]       // массив групп { name, fields, ... }
  viewType: 'table' | 'card' | 'list'
  standard: any
  rowsCount?: number
}>()

function generateMockEntry(fields: any[], index: number): any {
  const entry: any = { _id: `mock_${index}` }
  for (const field of fields) {
    const key = field.key
    switch (field.type) {
      case 'text': case 'string': entry[key] = `Значение ${index+1} ${field.label}`; break
      case 'number': entry[key] = Math.floor(Math.random()*1000); break
      case 'boolean': entry[key] = index%2===0; break
      case 'date': entry[key] = new Date(Date.now()-index*86400000).toISOString().split('T')[0]; break
      case 'email': entry[key] = `user${index+1}@example.com`; break
      case 'phone': entry[key] = `+7 900 ${1000000+index}`; break
      case 'url': entry[key] = `https://example.com/${index+1}`; break
      case 'select': entry[key] = field.options?.[0]?.value || 'option1'; break
      case 'multiselect': entry[key] = field.options?.slice(0,2).map(o=>o.value) || []; break
      default: entry[key] = `demo_${key}_${index}`
    }
  }
  return entry
}

const mockData = computed(() => {
  const count = props.rowsCount || 3
  const flatFields = props.fields
  return Array.from({ length: count }, (_, i) => generateMockEntry(flatFields, i))
})

// Если включены группы-колонки, строим колонки из групп
const tableColumns = computed(() => {
  if (props.viewType !== 'table') return []
  if (props.standard?.settings?.useGroupsAsColumns) {
    const groups = props.groups || []
    return groups.map(group => ({
      field: `_group_${group._id}`,
      label: group.name,
      width: 'auto',
      align: 'left',
      sortable: false
    }))
  } else {
    const cols = props.standard?.tableSettings?.columns || props.standard?.settings?.columns
    if (cols?.length) return cols
    return props.fields.filter(f => !f.isHidden).map(f => ({
      field: f.key,
      label: f.label,
      width: 'auto',
      align: 'left',
      sortable: true
    }))
  }
})

// Для grouped-table преобразуем данные: добавляем поля _group_<id>
const groupedMockData = computed(() => {
  if (!props.standard?.settings?.useGroupsAsColumns) return mockData.value
  const groups = props.groups || []
  return mockData.value.map(entry => {
    const newEntry = { ...entry }
    for (const group of groups) {
      const groupKey = `_group_${group._id}`
      const parts: string[] = []
      for (const field of (group.fields || [])) {
        const val = entry[field.key]
        const label = field.label
        if (props.standard.settings.groupCellFormat === 'block') {
          parts.push(`${label}: ${val}`)
        } else {
          parts.push(`${label}: ${val}`)
        }
      }
      newEntry[groupKey] = props.standard.settings.groupCellFormat === 'block'
          ? parts.join('\n')
          : parts.join('; ')
    }
    return newEntry
  })
})

const cardSettings = computed(() => ({
  title: props.standard?.cardSettings?.title || props.standard?.settings?.cardTitle || props.fields[0]?.key || '',
  subtitle: props.standard?.cardSettings?.subtitle || props.standard?.settings?.cardSubtitle || props.fields[1]?.key || '',
  fields: props.standard?.cardSettings?.fields || props.standard?.settings?.cardFields || props.fields.map(f=>f.key),
  columns: props.standard?.cardSettings?.columns || props.standard?.settings?.cardColumns || 3,
  avatarField: props.standard?.cardSettings?.avatarField || props.standard?.settings?.cardAvatarField || '',
  showFooter: props.standard?.cardSettings?.showFooter ?? props.standard?.settings?.cardShowFooter ?? true,
  showStatus: props.standard?.cardSettings?.showStatus ?? props.standard?.settings?.cardShowStatus ?? true
}))

const listSettings = computed(() => ({
  title: props.standard?.listSettings?.title || props.standard?.settings?.listTitle || props.fields[0]?.key || '',
  subtitle: props.standard?.listSettings?.subtitle || props.standard?.settings?.listSubtitle || props.fields[1]?.key || '',
  showIcon: props.standard?.listSettings?.showIcon ?? props.standard?.settings?.listShowIcon ?? true,
  showDivider: props.standard?.listSettings?.showDivider ?? props.standard?.settings?.listShowDivider ?? true
}))
</script>

<template>
  <div class="mock-preview">
    <div class="preview-header">
      <span class="preview-badge">🔍 {{ viewType === 'table' ? 'Таблица' : viewType === 'card' ? 'Карточки' : 'Список' }}</span>
      <span class="mock-info">Демо-данные, {{ mockData.length }} записей</span>
    </div>
    <div class="preview-body">
      <MoloTable
          v-if="viewType === 'table'"
          :columns="tableColumns"
          :data="groupedMockData"
          :settings="standard"
          @row-click="()=>{}"
      />

      <div v-else-if="viewType === 'card'" class="cards-grid" :style="{ gridTemplateColumns: `repeat(${cardSettings.columns}, 1fr)` }">
        <MoloCard v-for="item in mockData" :key="item._id" :item="item" :settings="cardSettings" :fields="fields" @click="()=>{}" />
      </div>

      <MoloList v-else-if="viewType === 'list'" :items="mockData" :settings="listSettings" @item-click="()=>{}" />
    </div>
  </div>
</template>

<style scoped>
.mock-preview {
  background: rgba(0,0,0,0.3);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
}
.preview-header {
  display: flex; justify-content: space-between; padding: 14px 20px;
  background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 13px;
}
.preview-badge { color: #6496ff; font-weight: 600; }
.mock-info { color: rgba(255,255,255,0.4); font-size: 12px; }
.preview-body { padding: 16px; }
.cards-grid { display: grid; gap: 16px; }
</style>