<script lang="ts" setup>
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'

const props = defineProps<{
  columns: any[]
  data: any[]
  groups?: any[]
  settings?: any
  styles?: Record<string, any>
}>()

const emit = defineEmits<{
  rowClick: [row: any]
  cellClick: [value: any, column: any, row: any]
  dataImported: [data: any[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

// Стили таблицы из стандарта
const tableStyles = computed(() => ({
  backgroundColor: props.styles?.tableBackground || 'transparent',
  color: props.styles?.tableTextColor || 'inherit',
  borderRadius: props.styles?.tableBorderRadius || '12px',
  border: props.styles?.tableBorder || 'none',
}))

const headerStyles = computed(() => ({
  backgroundColor: props.styles?.tableHeaderBackground || 'rgba(255, 255, 255, 0.04)',
  color: props.styles?.tableHeaderTextColor || 'rgba(255, 255, 255, 0.85)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
}))

const cellPadding = computed(() => {
  const density = props.settings?.density || 'normal'
  switch (density) {
    case 'compact': return '10px 16px'
    case 'spacious': return '16px 24px'
    default: return '12px 20px'
  }
})

// Подготовка данных для экспорта (плоская таблица)
const exportData = computed(() => {
  const rows: any[] = []

  for (const group of (props.groups || [])) {
    if (!group.fields || group.fields.length === 0) continue

    for (const field of group.fields) {
      rows.push({
        'Группа': group.name,
        'Поле (ключ)': field.key,
        'Название поля': field.label,
        'Описание / Значение': field.description || '—',
        'Обязательное': field.required ? 'Да' : 'Нет',
        'Уникальное': field.isUnique ? 'Да' : 'Нет',
        'Тип': field.type || 'string',
        'Ссылка': field.link || ''
      })
    }
  }

  return rows
})

// Экспорт в Excel
function exportToExcel() {
  if (exportData.value.length === 0) {
    alert('Нет данных для экспорта')
    return
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData.value)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Структура полей')

  // Автоширина колонок
  const maxWidth = 30
  worksheet['!cols'] = [
    { wch: 20 }, // Группа
    { wch: 25 }, // Поле (ключ)
    { wch: 25 }, // Название поля
    { wch: 50 }, // Описание
    { wch: 10 }, // Обязательное
    { wch: 10 }, // Уникальное
    { wch: 12 }, // Тип
    { wch: 30 }  // Ссылка
  ]

  XLSX.writeFile(workbook, `"Экспорт_таблицы"_${new Date().toISOString().slice(0, 19)}.xlsx`)
}

// Импорт из Excel
function importFromExcel(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  const reader = new FileReader()

  reader.onload = (e) => {
    const data = e.target?.result
    const workbook = XLSX.read(data, { type: 'binary' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const importedRows = XLSX.utils.sheet_to_json(worksheet)

    if (importedRows.length === 0) {
      alert('Файл пуст или имеет неверный формат')
      return
    }

    // Конвертируем импортированные данные в структуру полей
    const updatedGroups = [...(props.groups || [])]

    for (const row of importedRows as any[]) {
      const groupName = row['Группа']
      const fieldKey = row['Поле (ключ)']
      const fieldLabel = row['Название поля']
      const description = row['Описание / Значение']
      const required = row['Обязательное'] === 'Да'
      const isUnique = row['Уникальное'] === 'Да'
      const type = row['Тип'] || 'string'
      const link = row['Ссылка'] || ''

      if (!groupName || !fieldKey || !fieldLabel) continue

      let group = updatedGroups.find(g => g.name === groupName)
      if (!group) {
        group = { name: groupName, description: '', fields: [] }
        updatedGroups.push(group)
      }

      const existingFieldIndex = group.fields.findIndex((f: any) => f.key === fieldKey)
      const fieldData = {
        key: fieldKey,
        label: fieldLabel,
        description: description !== '—' ? description : '',
        required,
        isUnique,
        type,
        link,
        isArray: false,
        isSearchable: true,
        isFilterable: true,
        isSortable: true,
        isReadonly: false,
        isHidden: false,
        order: existingFieldIndex >= 0 ? group.fields[existingFieldIndex].order : group.fields.length
      }

      if (existingFieldIndex >= 0) {
        group.fields[existingFieldIndex] = fieldData
      } else {
        group.fields.push(fieldData)
      }
    }

    emit('dataImported', updatedGroups)
    alert(`Импортировано ${importedRows.length} полей`)
  }

  reader.readAsBinaryString(file)
  input.value = '' // сброс input
}

// Триггер файлового инпута
function triggerFileInput() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="tables-container">
    <!-- Кнопки экспорта/импорта -->
    <div class="export-import-bar">
      <MoloButton class="action" @click="exportToExcel" title="Экспорт в Excel">
        <img src="/excel.png"/>
        Экспорт в Excel
      </MoloButton>
      <MoloButton class="action" @click="triggerFileInput" title="Импорт из Excel">
        📂 Импорт из Excel
      </MoloButton>
      <input
          ref="fileInput"
          type="file"
          accept=".xlsx, .xls, .csv"
          style="display: none"
          @change="importFromExcel"
      />
    </div>

    <div v-for="(group, idx) in groups" :key="idx" class="table-section">
      <div class="table-header">
        <h3 class="table-title">{{ group.name }}</h3>
        <p v-if="group.description" class="table-description">{{ group.description }}</p>
      </div>
      <div class="table-wrapper">
        <table
            class="molo-table"
            :class="{
            'table-striped': settings?.tableStriped !== false,
            'table-hoverable': settings?.tableHoverable !== false,
            'table-bordered': settings?.bordered,
            'table-compact': settings?.density === 'compact',
            'table-spacious': settings?.density === 'spacious'
          }"
            :style="tableStyles"
        >
          <thead>
          <tr>
            <th :style="headerStyles">Поле</th>
            <th :style="headerStyles">Описание</th>
          </tr>
          </thead>
          <tbody>
          <template v-if="group.fields && group.fields.length && group.fields[0].label !== 'Нет данных'">
            <tr v-for="field in group.fields" :key="field.key">
              <td class="table-cell field-label-cell">
                <div class="cell-content">
                  <span class="field-label">{{ field.label }}</span>
                </div>
              </td>
              <td class="table-cell field-description-cell">
                <div class="cell-content">
                  <span class="field-description">{{ field.description || '—' }}</span>
                </div>
              </td>
            </tr>
          </template>
          <tr v-else class="empty-row">
            <td colspan="2" class="empty-cell">
              <div class="empty-content">
                <span class="empty-icon">{{ settings?.emptyStateIcon || '📭' }}</span>
                <p>{{ settings?.emptyStateMessage || 'Нет полей для отображения' }}</p>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tables-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

  .export-import-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  width: 100%;
  align-items: center;
}
.action img {
  width: 12px;
  height: 16px;
  vertical-align: middle;
}

.table-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.01em;
}

.table-description {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.4;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  border-radius: 4px;
  backdrop-filter: blur(2px);
  border: 1px solid var(--half_opacity_border);
}

.molo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  min-width: 380px;
}

/* Заголовки */
.molo-table th {
  text-align: left;
  font-weight: 500;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: v-bind(cellPadding);
  transition: background 0.2s ease;
}

/* Ячейки */
.molo-table td {
  padding: v-bind(cellPadding);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  vertical-align: top;
  transition: background 0.2s ease;
}

/* Полосатая подсветка */
.table-striped tbody tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.02);
}

/* Hover строк */
.table-hoverable tbody tr:hover {
  background-color: rgba(100, 150, 255, 0.08);
  cursor: default;
}

/* Плотность */
.table-compact th,
.table-compact td {
  padding: 8px 12px;
}

.table-spacious th,
.table-spacious td {
  padding: 16px 24px;
}

/* Бордеры */
.table-bordered th,
.table-bordered td {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.table-cell {
  text-align: right;
}

/* Содержимое ячеек */
.cell-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  text-align: right;
}

.field-label {
  text-align: right;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.875rem;
}

.field-description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  line-height: 1.4;
  word-break: break-word;
}

/* Пустое состояние */
.empty-row td {
  text-align: center;
  padding: 48px 20px;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.empty-icon {
  font-size: 42px;
  opacity: 0.5;
}

.empty-content p {
  margin: 0;
  font-size: 0.875rem;
}

/* Адаптив */
@media (max-width: 640px) {
  .table-title {
    font-size: 1.1rem;
  }
  .table-description {
    font-size: 0.7rem;
  }
  .field-label,
  .field-description {
    font-size: 0.8rem;
  }
}
</style>