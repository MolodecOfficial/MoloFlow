<!-- MockDataPreview.vue -->
<script lang="ts" setup>
import { computed } from 'vue'
import MoloTable from './MoloTable.vue'
import MoloCard from './MoloCard.vue'
import MoloList from './MoloList.vue'

const props = defineProps<{
  fields: any[]
  viewType: 'table' | 'card' | 'list'
  standard: any
  rowsCount?: number
}>()

// Генерация мок-данных
function generateMockEntry(fields: any[], index: number): any {
  const entry: any = { _id: `mock_${index}` }
  for (const field of fields) {
    const key = field.key
    switch (field.type) {
      case 'text':
      case 'string':
        entry[key] = `Значение ${index + 1} ${field.label || key}`
        break
      case 'number':
        entry[key] = Math.floor(Math.random() * 1000)
        break
      case 'boolean':
        entry[key] = index % 2 === 0
        break
      case 'date':
        entry[key] = new Date(Date.now() - index * 86400000).toISOString().split('T')[0]
        break
      case 'email':
        entry[key] = `user${index + 1}@example.com`
        break
      case 'phone':
        entry[key] = `+7 900 ${1000000 + index}`
        break
      case 'url':
        entry[key] = `https://example.com/${index + 1}`
        break
      case 'select':
        entry[key] = field.options?.[0]?.value || 'option1'
        break
      case 'multiselect':
        entry[key] = field.options?.slice(0, 2).map((o: any) => o.value) || []
        break
      default:
        entry[key] = `demo_${key}_${index}`
    }
  }
  return entry
}

const mockData = computed(() => {
  const count = props.rowsCount || 3
  return Array.from({ length: count }, (_, i) => generateMockEntry(props.fields, i))
})

// Колонки таблицы
const tableColumns = computed(() => {
  if (props.viewType !== 'table') return []
  const columns = props.standard?.tableSettings?.columns || props.standard?.settings?.columns
  if (columns?.length) return columns
  return props.fields.filter(f => !f.isHidden).map(f => ({
    field: f.key, label: f.label, width: 'auto', align: 'left', sortable: true
  }))
})

// Настройки карточки
const cardSettings = computed(() => ({
  title: props.standard?.cardSettings?.title ||
      props.standard?.settings?.cardTitle ||
      props.fields[0]?.key || '',
  subtitle: props.standard?.cardSettings?.subtitle ||
      props.standard?.settings?.cardSubtitle ||
      props.fields[1]?.key || '',
  fields: props.standard?.cardSettings?.fields ||
      props.standard?.settings?.cardFields ||
      props.fields.map(f => f.key),
  columns: props.standard?.cardSettings?.columns ||
      props.standard?.settings?.cardColumns || 3,
  avatarField: props.standard?.cardSettings?.avatarField ||
      props.standard?.settings?.cardAvatarField || '',
  showFooter: props.standard?.cardSettings?.showFooter ??
      props.standard?.settings?.cardShowFooter ?? true,
  showStatus: props.standard?.cardSettings?.showStatus ??
      props.standard?.settings?.cardShowStatus ?? true
}))

// Настройки списка
const listSettings = computed(() => ({
  title: props.standard?.listSettings?.title ||
      props.standard?.settings?.listTitle ||
      props.fields[0]?.key || '',
  subtitle: props.standard?.listSettings?.subtitle ||
      props.standard?.settings?.listSubtitle ||
      props.fields[1]?.key || '',
  showIcon: props.standard?.listSettings?.showIcon ??
      props.standard?.settings?.listShowIcon ?? true,
  showDivider: props.standard?.listSettings?.showDivider ??
      props.standard?.settings?.listShowDivider ?? true
}))
</script>

<template>
  <div class="mock-preview">
    <div class="preview-header">
      <span class="preview-badge">🔍 Предпросмотр {{ viewType === 'table' ? 'таблицы' : viewType === 'card' ? 'карточек' : 'списка' }}</span>
      <span class="mock-info">Демо-данные, {{ mockData.length }} {{ mockData.length === 1 ? 'запись' : mockData.length < 5 ? 'записи' : 'записей' }}</span>
    </div>
    <div class="preview-body">
      <!-- Таблица -->
      <MoloTable
          v-if="viewType === 'table'"
          :columns="tableColumns"
          :data="mockData"
          :settings="standard"
          @row-click="() => {}"
      />

      <!-- Карточки -->
      <div
          v-else-if="viewType === 'card'"
          class="cards-grid"
          :style="{ gridTemplateColumns: `repeat(${cardSettings.columns}, 1fr)` }"
      >
        <MoloCard
            v-for="item in mockData"
            :key="item._id"
            :item="item"
            :settings="cardSettings"
            :fields="fields"
            @click="() => {}"
        />
      </div>

      <!-- Список -->
      <MoloList
          v-else-if="viewType === 'list'"
          :items="mockData"
          :settings="listSettings"
          @item-click="() => {}"
      />
    </div>
  </div>
</template>

<style scoped>
.mock-preview {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.preview-badge {
  color: #6496ff;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.mock-info {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.preview-body {
  padding: 16px;
}

.cards-grid {
  display: grid;
  gap: 16px;
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>