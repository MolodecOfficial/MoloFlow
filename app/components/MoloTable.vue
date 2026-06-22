<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {colToName, type TableRow, useTableData} from '~~/app/composables/MoloTable/useTableData'
import {useSelection} from '~~/app/composables/MoloTable/useSelection'
import {useEditing} from '~~/app/composables/MoloTable/useEditing'
import {useZoom} from '~~/app/composables/MoloTable/useZoom'
import {useResize} from '~~/app/composables/MoloTable/useResize'
import {useScroll} from '~~/app/composables/MoloTable/useScroll'
import {useExcel} from '~~/app/composables/MoloTable/useExcel'

// ===== Пропсы и эмиты =====
const props = defineProps<{
  modelValue?: TableRow[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', rows: TableRow[]): void
}>()

// ===== Константы =====
const MIN_COL_WIDTH = 40
const MIN_ROW_HEIGHT = 20
const DEFAULT_COL_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 22

// ===== Реактивные параметры =====
const rowsCount = ref(200)
const colsCount = ref(50)
const borderColor = ref('#000000')
const excelContainer = ref<HTMLElement | null>(null)

// Ширина колонок и высота строк
const columnWidths = ref<number[]>([])
const rowHeights = ref<number[]>([])

function initColumnWidths() {
  const widths = [...columnWidths.value]
  for (let i = widths.length; i < colsCount.value; i++) {
    widths[i] = DEFAULT_COL_WIDTH
  }
  columnWidths.value = widths
}

function initRowHeights() {
  const heights = [...rowHeights.value]
  for (let i = heights.length; i < rowsCount.value; i++) {
    heights[i] = DEFAULT_ROW_HEIGHT
  }
  rowHeights.value = heights
}

initColumnWidths()
initRowHeights()

// ===== Композаблы =====
const {
  cells,
  spanMap,
  getCellForRender,
  getMasterCell,
  updateCellContent,
  applyStyleToSelected,
  applyBorder,
  removeAllBorders,
  mergeSelected,
  unmergeCell,
  getCurrentStyle,
  toRows,
  loadFromExcel,
  rebuildSpanMap,
} = useTableData(props.modelValue)

const {
  selectedSet,
  activeCell,
  isSelected,
  selectCell,
  startDrag,
  dragOver,
  stopDrag,
} = useSelection()

const {
  editingCell,
  editingContent,
  startEditing,
  saveEditing,
  cancelEditing,
  setInputRef,
} = useEditing()

const {
  zoomLevel,
  zoomIn,
  zoomOut,
  resetZoom,
  handleWheelZoom,
} = useZoom()

const {startResizeColumn, startResizeRow} = useResize(
    columnWidths,
    rowHeights,
    MIN_COL_WIDTH,
    MIN_ROW_HEIGHT
)

const {
  scrollTop,
  scrollLeft,
  containerHeight,
  containerWidth,
  colOffsets,
  rowOffsets,
  visibleRows,
  visibleCols,
  handleScroll,
  updateContainerSize,
  virtualTop,
  virtualLeft,
} = useScroll(colsCount, rowsCount, columnWidths, rowHeights)

const {
  fileInput,
  exportToExcel,
  onImportClick,
  onImportFile,
} = useExcel(
    colsCount,
    rowsCount,
    columnWidths,
    rowHeights,
    getCellForRender,
    loadFromExcel
)

// ===== Общая ширина/высота таблицы =====
const totalWidth = computed(() => {
  return colOffsets.value[colsCount.value] || 0
})

const totalHeight = computed(() => {
  return rowOffsets.value[rowsCount.value] || 0
})

// ===== Копирование/вставка =====
async function copyCells() {
  const sorted = Array.from(selectedSet.value).map(k => k.split(',').map(Number))
  if (sorted.length === 0) return
  const minRow = Math.min(...sorted.map(s => s[0]))
  const maxRow = Math.max(...sorted.map(s => s[0]))
  const minCol = Math.min(...sorted.map(s => s[1]))
  const maxCol = Math.max(...sorted.map(s => s[1]))
  const lines: string[] = []
  for (let r = minRow; r <= maxRow; r++) {
    const line: string[] = []
    for (let c = minCol; c <= maxCol; c++) {
      const cell = getCellForRender(r, c)
      line.push(cell.content)
    }
    lines.push(line.join('\t'))
  }
  await navigator.clipboard.writeText(lines.join('\n'))
}

async function pasteCells() {
  if (!activeCell.value) return
  const text = await navigator.clipboard.readText()
  const lines = text.split(/\r?\n/)
  const startRow = activeCell.value.row
  const startCol = activeCell.value.col
  for (let i = 0; i < lines.length; i++) {
    const rowCells = lines[i].split('\t')
    for (let j = 0; j < rowCells.length; j++) {
      updateCellContent(startRow + i, startCol + j, rowCells[j])
    }
  }
  emitUpdate()
}

// ===== Обёртки для тулбара =====
function mergeSelectedCells() {
  if (selectedSet.value.size < 2) return
  const result = mergeSelected(selectedSet.value)
  if (result) {
    const {row, col} = result
    selectedSet.value = new Set([`${row},${col}`])
    activeCell.value = {row, col}
  }
  emitUpdate()
}

function unmergeCurrentCell() {
  if (!activeCell.value) return
  const {row, col} = activeCell.value
  const result = unmergeCell(row, col)
  if (result) {
    selectedSet.value = new Set([`${row},${col}`])
    activeCell.value = {row, col}
  }
  emitUpdate()
}

function applyBorderToSelected(borderType: 'borderTop' | 'borderBottom' | 'borderLeft' | 'borderRight') {
  applyBorder(selectedSet.value, borderType, borderColor.value)
  emitUpdate()
}

function applyAllBorders() {
  const borderValue =
      `1px solid ${borderColor.value}`

  const updated = {
    ...cells.value
  }

  for (const key of selectedSet.value) {

    const [row, col] =
        key.split(',').map(Number)

    const addr =
        getAddress(row, col)

    const cell =
        updated[addr] ??
        createEmptyCell()

    updated[addr] = {
      ...cell,
      style: {
        ...cell.style,
        borderTop: borderValue,
        borderBottom: borderValue,
        borderLeft: borderValue,
        borderRight: borderValue
      }
    }
  }

  cells.value = updated

  rebuildSpanMap()

  emitUpdate()
}

function removeAllBordersFromSelected() {
  removeAllBorders(selectedSet.value)
  emitUpdate()
}

function toggleBold() {
  const current = getCurrentStyle(selectedSet.value)?.fontWeight
  applyStyleToSelected(selectedSet.value, 'fontWeight', current === 'bold' ? 'normal' : 'bold')
  emitUpdate()
}

function toggleItalic() {
  const current = getCurrentStyle(selectedSet.value)?.fontStyle
  applyStyleToSelected(selectedSet.value, 'fontStyle', current === 'italic' ? 'normal' : 'italic')
  emitUpdate()
}

function setTextAlign(value: 'left' | 'center' | 'right') {
  applyStyleToSelected(selectedSet.value, 'textAlign', value)
  emitUpdate()
}

function setVerticalAlign(value: 'top' | 'middle' | 'bottom') {
  applyStyleToSelected(selectedSet.value, 'verticalAlign', value)
  emitUpdate()
}

function setFontSize(value: number) {
  applyStyleToSelected(selectedSet.value, 'fontSize', value)
  emitUpdate()
}

function setBgColor(value: string) {
  applyStyleToSelected(selectedSet.value, 'backgroundColor', value)
  emitUpdate()
}

function setTextColor(value: string) {
  applyStyleToSelected(selectedSet.value, 'textColor', value)
  emitUpdate()
}

// ===== Вычисляемые свойства =====
const currentTextAlign = computed(() => getCurrentStyle(selectedSet.value)?.textAlign || 'left')
const currentVerticalAlign = computed(() => getCurrentStyle(selectedSet.value)?.verticalAlign || 'top')
const currentFontWeight = computed(() => getCurrentStyle(selectedSet.value)?.fontWeight === 'bold')
const currentFontStyle = computed(() => getCurrentStyle(selectedSet.value)?.fontStyle === 'italic')
const currentFontSize = computed(() => getCurrentStyle(selectedSet.value)?.fontSize || 13)
const currentBgColor = computed(() => getCurrentStyle(selectedSet.value)?.backgroundColor || '')
const currentTextColor = computed(() => getCurrentStyle(selectedSet.value)?.textColor || '#000000')

// ===== Эмит изменений =====
let emitTimeout: ReturnType<typeof setTimeout> | null = null

function emitUpdate() {
  if (emitTimeout) {
    clearTimeout(emitTimeout)
    emitTimeout = null
  }
  emitTimeout = setTimeout(() => {
    const rows = toRows()
    emit('update:modelValue', rows)
    emitTimeout = null
  }, 100)
}

function scrollToCell(
    row: number,
    col: number
) {
  if (!excelContainer.value) return

  const el = excelContainer.value

  const top =
      rowOffsets.value[row] ?? 0

  const left =
      colOffsets.value[col] ?? 0

  const rowHeight =
      rowHeights.value[row] ??
      DEFAULT_ROW_HEIGHT

  const colWidth =
      columnWidths.value[col] ??
      DEFAULT_COL_WIDTH

  if (top < el.scrollTop) {
    el.scrollTop = top
  } else if (
      top + rowHeight >
      el.scrollTop + el.clientHeight
  ) {
    el.scrollTop =
        top +
        rowHeight -
        el.clientHeight
  }

  if (left < el.scrollLeft) {
    el.scrollLeft = left
  } else if (
      left + colWidth >
      el.scrollLeft + el.clientWidth
  ) {
    el.scrollLeft =
        left +
        colWidth -
        el.clientWidth
  }
}

// ===== Обработка клавиш =====
function keyHandler(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'c') {
    e.preventDefault()
    copyCells()
    return
  }
  if (e.ctrlKey && e.key === 'v') {
    e.preventDefault()
    pasteCells()
    return
  }
  if (!activeCell.value) return
  let {row, col} = activeCell.value
  switch (e.key) {
    case 'ArrowUp':
      if (row > 0) row--;
      break
    case 'ArrowDown':
      if (row < rowsCount.value - 1) row++;
      break
    case 'ArrowLeft':
      if (col > 0) col--;
      break
    case 'ArrowRight':
      if (col < colsCount.value - 1) col++;
      break
    default:
      return
  }
  e.preventDefault()
  selectCell(row, col)

  scrollToCell(row, col)

  // Прокручиваем к выбранной ячейке
  if (excelContainer.value) {
    const el = excelContainer.value
    const rowOffset = rowOffsets.value[row] || 0
    const colOffset = colOffsets.value[col] || 0
    if (rowOffset < el.scrollTop) {
      el.scrollTop = rowOffset
    } else if (rowOffset + (rowHeights.value[row] || DEFAULT_ROW_HEIGHT) > el.scrollTop + el.clientHeight) {
      el.scrollTop = rowOffset + (rowHeights.value[row] || DEFAULT_ROW_HEIGHT) - el.clientHeight
    }
    if (colOffset < el.scrollLeft) {
      el.scrollLeft = colOffset
    } else if (colOffset + (columnWidths.value[col] || DEFAULT_COL_WIDTH) > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = colOffset + (columnWidths.value[col] || DEFAULT_COL_WIDTH) - el.clientWidth
    }
  }
}

// ===== Динамическое добавление строк/колонок =====
function onScroll(el: HTMLElement) {
  handleScroll(el)

  // Добавляем строки при приближении к концу
  const totalH = rowOffsets.value[rowsCount.value] || 0
  if (totalH - scrollTop.value - containerHeight.value < 300) {
    rowsCount.value += 100
    initRowHeights()
  }

  // Добавляем колонки при приближении к концу
  const totalW = colOffsets.value[colsCount.value] || 0
  if (totalW - scrollLeft.value - containerWidth.value < 300) {
    colsCount.value += 30
    initColumnWidths()
  }
}

// ===== Жизненный цикл =====
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('keydown', keyHandler)

  if (selectedSet.value.size === 0) {
    selectedSet.value = new Set(['0,0'])
    activeCell.value = {row: 0, col: 0}
  }

  if (excelContainer.value) {
    const el = excelContainer.value
    updateContainerSize(el.clientHeight, el.clientWidth)

    resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        updateContainerSize(entries[0].contentRect.height, entries[0].contentRect.width)
      }
    })
    resizeObserver.observe(el)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', keyHandler)
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div class="excel-wrapper">
    <!-- Панель инструментов -->
    <div class="excel-toolbar">
      <section class="actions-bar">
        <span>Ячейки</span>
        <section class="actions">
          <MoloButton class="transparent" @click="mergeSelectedCells">
            <img class="img-edit" src="/excel/merge_cells.png" width="20" height="20"/>
          </MoloButton>
          <MoloButton class="transparent" v-if="activeCell" @click="unmergeCurrentCell">
            <img class="img-edit" src="/excel/unmerge_cells.png" width="20" height="20"/>
          </MoloButton>
        </section>
      </section>

      <div class="toolbar-divider"></div>

      <section class="actions-bar">
        <span>Текст</span>
        <section class="actions">
          <MoloButton class="transparent fit" @click="setTextAlign('left')"
                      :class="{ confirm: currentTextAlign === 'left' }">
            <img class="img-edit" src="/excel/align_left.png"/>
          </MoloButton>
          <MoloButton class="transparent" @click="setTextAlign('center')"
                      :class="{ confirm: currentTextAlign === 'center' }">
            <img class="img-edit" src="/excel/align_center.png"/>
          </MoloButton>
          <MoloButton class="transparent" @click="setTextAlign('right')"
                      :class="{ confirm: currentTextAlign === 'right' }">
            <img class="img-edit" src="/excel/align_right.png"/>
          </MoloButton>
        </section>
        <section class="actions">
          <MoloButton class="transparent" @click="setVerticalAlign('top')"
                      :class="{ confirm: currentVerticalAlign === 'top' }">
            <img class="img-edit" src="/excel/align_top.png"/>
          </MoloButton>
          <MoloButton class="transparent" @click="setVerticalAlign('middle')"
                      :class="{ confirm: currentVerticalAlign === 'middle' }">
            <img class="img-edit" src="/excel/align_middle.png"/>
          </MoloButton>
          <MoloButton class="transparent" @click="setVerticalAlign('bottom')"
                      :class="{ confirm: currentVerticalAlign === 'bottom' }">
            <img class="img-edit" src="/excel/align_bottom.png"/>
          </MoloButton>
        </section>
      </section>

      <div class="toolbar-divider"></div>

      <section class="actions-bar">
        <span>Границы</span>
        <section class="actions">
          <MoloButton class="transparent" @click="applyBorderToSelected('borderLeft')">
            <img class="img-edit" src="/excel/border_left.png" width="20" height="20"/>
          </MoloButton>
          <MoloButton class="transparent" @click="applyBorderToSelected('borderTop')">
            <img class="img-edit" src="/excel/border_top.png" width="20" height="20"/>
          </MoloButton>
          <MoloButton class="transparent" @click="applyAllBorders">
            <img class="img-edit" src="/excel/border_all.png" width="20" height="20"/>
          </MoloButton>
        </section>
        <section class="actions">
          <MoloButton class="transparent" @click="applyBorderToSelected('borderBottom')">
            <img class="img-edit" src="/excel/border_bottom.png" width="20" height="20"/>
          </MoloButton>
          <MoloButton class="transparent" @click="applyBorderToSelected('borderRight')">
            <img class="img-edit" src="/excel/border_right.png" width="20" height="20"/>
          </MoloButton>
          <MoloButton class="transparent" @click="removeAllBordersFromSelected">
            <img class="img-edit" src="/excel/border_none.png" width="20" height="20"/>
          </MoloButton>
        </section>
      </section>

      <div class="toolbar-divider"></div>

      <section class="actions-bar">
        <span>Работа с текстом</span>
        <section class="actions">
          <MoloButton class="action small" @click="toggleBold" :class="{ confirm: currentFontWeight }">
            <strong>B</strong></MoloButton>
          <MoloButton class="action small" @click="toggleItalic" :class="{ confirm: currentFontStyle }"><em>I</em>
          </MoloButton>
          <input class="font-input" type="number" :value="currentFontSize"
                 @change="setFontSize(parseInt(($event.target as HTMLInputElement).value))"/>
        </section>
      </section>

      <div class="toolbar-divider"></div>

      <section class="actions-bar">
        <span>Работа с ячейкой</span>
        <section class="actions">
          <label class="color-label">🎨 Фон <input type="color" :value="currentBgColor"
                                                  @input="setBgColor(($event.target as HTMLInputElement).value)"/></label>
          <label class="color-label">✏️ Текст <input type="color" :value="currentTextColor"
                                                     @input="setTextColor(($event.target as HTMLInputElement).value)"/></label>
        </section>
      </section>

      <div class="toolbar-divider"></div>

      <section class="actions-bar">
        <span>Импорт / Экспорт</span>
        <section class="actions">
          <MoloButton class="action small fit" @click="exportToExcel">
            <img class="btn-image" src="/excel.png" alt=""/>
          </MoloButton>
          <MoloButton class="action small fit" @click="onImportClick">
            📂
          </MoloButton>
          <input ref="fileInput" type="file" accept=".xlsx,.xls" @change="onImportFile" style="display: none"/>
        </section>
      </section>

      <section class="actions-bar scale" style="margin-left: auto">
        <span>Масштаб</span>
        <section class="actions">
          <MoloButton class="action small" @click="zoomOut" title="Уменьшить (Ctrl + колесо)">
            <span style="font-size:16px;">−</span>
          </MoloButton>
          <span class="zoom-value">{{ Math.round(zoomLevel * 100) }}%</span>
          <MoloButton class="action small" @click="zoomIn" title="Увеличить (Ctrl + колесо)">
            <span style="font-size:16px;">+</span>
          </MoloButton>
          <MoloButton class="action small" @click="resetZoom" title="Сбросить масштаб">
            <span style="font-size:12px;">↺</span>
          </MoloButton>
        </section>
      </section>
    </div>

    <!-- Контейнер таблицы -->
    <div
        ref="excelContainer"
        class="excel-container"
        @scroll="onScroll($event.target as HTMLElement)"
        @wheel="handleWheelZoom"
    >
      <div
          class="excel-zoom-wrapper"
          :style="{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top left',
                    width: totalWidth + 'px',
                    height: totalHeight + 'px'
                }"
      >
        <table
            class="excel-table"
            @mouseup="stopDrag"
            :style="{
      transform: `translate(${virtualLeft}px, ${virtualTop}px)`
  }"
        >
          <thead>
          <tr>
            <th class="corner"></th>
            <th
                v-for="col in visibleCols"
                :key="col"
                class="resizable-col"
                :style="{
                                    width: (columnWidths[col] || DEFAULT_COL_WIDTH) + 'px',
                                    minWidth: (columnWidths[col] || DEFAULT_COL_WIDTH) + 'px',
                                }"
            >
              {{ colToName(col) }}
              <div class="col-resize-handle" @mousedown="startResizeColumn(col, $event)"></div>
            </th>
          </tr>
          </thead>
          <tbody>
          <tr  v-for="row in visibleRows"
               :key="row"
               :style="{
      height: (rowHeights[row] || DEFAULT_ROW_HEIGHT) + 'px'
  }">
            <th class="row-header" :style="{ height: (rowHeights[row] || DEFAULT_ROW_HEIGHT) + 'px' }">
              {{ row + 1 }}
              <div class="row-resize-handle" @mousedown="startResizeRow(row, $event)"></div>
            </th>
            <td
                v-for="col in visibleCols"
                :key="`${row}-${col}`"
                v-show="!getCellForRender(row,col).hidden"
                :rowspan="getCellForRender(row, col).rowspan"
                :colspan="getCellForRender(row, col).colspan"
                :class="{
                                    selected: isSelected(row, col),
                                    active: activeCell?.row === row && activeCell?.col === col,
                                }"
                :style="{
    background: getCellForRender(row,col).style.backgroundColor || '',
    color: getCellForRender(row,col).style.textColor || '#000',

    textAlign: getCellForRender(row,col).style.textAlign,

    verticalAlign:
        getCellForRender(row,col).style.verticalAlign === 'middle'
            ? 'middle'
            : getCellForRender(row,col).style.verticalAlign,

    fontWeight: getCellForRender(row,col).style.fontWeight,
    fontStyle: getCellForRender(row,col).style.fontStyle,
    fontSize: getCellForRender(row,col).style.fontSize + 'px',

    borderTop: getCellForRender(row,col).style.borderTop,
    borderBottom: getCellForRender(row,col).style.borderBottom,
    borderLeft: getCellForRender(row,col).style.borderLeft,
    borderRight: getCellForRender(row,col).style.borderRight,
}"
                @mousedown="startDrag(row, col)"
                @mouseenter="dragOver(row, col)"
                @click="selectCell(row, col, $event)"
                @dblclick="
                                    () => {
                                        const master = getMasterCell(row, col)
                                        const cell = getCellForRender(master.row, master.col)
                                        startEditing(master.row, master.col, cell.content)
                                    }
                                "
            >
              <div v-if="editingCell?.row === row && editingCell?.col === col" class="cell-editing">
                <input
                    :ref="setInputRef"
                    type="text"
                    v-model="editingContent"
                    @blur="
                                            () => {
                                                const result = saveEditing()
                                                if (result) {
                                                    updateCellContent(result.row, result.col, result.content)
                                                    emitUpdate()
                                                }
                                            }
                                        "
                    @keydown.enter.prevent="
                                            () => {
                                                const result = saveEditing()
                                                if (result) {
                                                    updateCellContent(result.row, result.col, result.content)
                                                    emitUpdate()
                                                }
                                            }
                                        "
                    @keydown.escape.prevent="cancelEditing"
                    class="cell-input"
                    :style="{
                                            fontSize: getCellForRender(row, col).style.fontSize + 'px',
                                            fontWeight: getCellForRender(row, col).style.fontWeight,
                                            fontStyle: getCellForRender(row, col).style.fontStyle,
                                            color: getCellForRender(row, col).style.textColor,
                                            background: getCellForRender(row, col).style.backgroundColor || 'white',
                                        }"
                />
              </div>
              <div v-else class="cell-content"
                   :class="[
        `h-${getCellForRender(row,col).style.textAlign}`,
        `v-${getCellForRender(row,col).style.verticalAlign}`
    ]">
                {{ getCellForRender(row, col).content }}
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
.excel-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--half_opacity_bg);
  color: #202124;
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  font-family: Calibri, "Segoe UI", Arial, sans-serif;
  position: relative;
}

.cell-content {
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  width: 100%;
  min-height: 100%;
  direction: ltr !important;
  unicode-bidi: normal !important;
  text-align: left;
}

.cell-content,
.cell-content *,
[contenteditable="true"],
[contenteditable="true"] * {
  direction: ltr !important;
  unicode-bidi: normal !important;
}

.excel-toolbar {
  display: flex;
  align-items: start;
  gap: 8px;
  min-height: 42px;
  padding: 6px 10px;
  background: var(--half_opacity_bg);
  border-bottom: 1px solid var(--half_opacity_border);
  position: sticky;
  top: 0;
  z-index: 100;
  flex-wrap: wrap;
}

.actions-bar {
  display: flex;
  flex-direction: column;
  color: white;
  font-size: 12px;
  gap: 5px;
}

.actions-bar .actions {
  display: flex;
  gap: 5px;
}

.actions-bar .actions.excel {
  display: flex;
  flex-direction: column;
}

/* FIX: убрали абсолютное позиционирование для .scale, теперь он в потоке */
.actions-bar.scale {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.toolbar-divider {
  width: 1px;
  height: 50px;
  background: #c8c8c8;
  margin: 0 4px;
}

.excel-toolbar button {
  height: 30px;
  min-width: 36px;
  border: 1px solid #c8c8c8;
  background: var(--half_opacity_bg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: 0.1s;
}

.color-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: white;
  font-size: 12px;
  background: var(--half_opacity_bg);
  padding: 4px 8px;
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  cursor: pointer;
}

.color-label input {
  width: 28px;
  height: 24px;
  border: none;
  cursor: pointer;
  background: transparent;
}

.excel-container {
  flex: 1;
  overflow: auto;
  background: white;
  position: relative;
}

.excel-table {
  border-collapse: separate;
  border-spacing: 0;
}

.excel-table td, .excel-table th {
  border: 1px solid #d9d9d9;
}

.corner {
  width: 50px;
  min-width: 50px;
  height: 25px;
  background: #f3f3f3;
  position: sticky;
  left: 0;
  top: 0;
  z-index: 40;
}

.excel-table thead th {
  height: 25px;
  background: #f3f3f3;
  color: #444;
  font-weight: 600;
  font-size: 12px;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 30;
  user-select: none;
}

.resizable-col {
  position: relative;
}

.col-resize-handle {
  position: absolute;
  right: -5px;
  top: 0;
  width: 10px;
  height: 100%;
  cursor: col-resize;
  z-index: 9999;
  background: transparent;
}

.col-resize-handle:hover {
  background: rgba(30, 138, 208, 0.5);
}

.row-header {
  position: relative;
  width: 50px;
  min-width: 50px;
  background: #f3f3f3;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  left: 0;
  z-index: 20;
  user-select: none;
  vertical-align: middle;
}

.row-resize-handle {
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 100%;
  height: 10px;
  cursor: row-resize;
  z-index: 9999;
  background: transparent;
}

.row-resize-handle:hover {
  background: rgba(30, 138, 208, 0.5);
}

.excel-table td {
  position: relative;
  padding: 4px;
  font-size: 13px;
  cursor: cell;
  background: white;
  overflow: hidden;
  text-overflow: ellipsis;
}

.selected {
  background: #eaf2ff !important;
}

.selected::after {
  content: '';
  position: absolute;
  inset: -1px;
  border: 2px solid #217346;
  pointer-events: none;
  z-index: 10;
}

.active {
  position: relative;
}

.active::before {
  content: '';
  position: absolute;
  inset: -2px;
  border: 2px solid #217346;
  pointer-events: none;
  z-index: 20;
}

.active::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  right: -5px;
  bottom: -5px;
  background: #217346;
  border: 1px solid #fff;
  box-sizing: border-box;
  z-index: 999;
}

.font-input {
  width: 50px;
  padding: 4px;
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  background: var(--half_opacity_bg);
  color: white;
}

.btn-image {
  background-size: cover;
  width: 15px;
}

.zoom-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 50px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 4px;
  height: 30px;
}

.excel-zoom-wrapper {
  transition: transform 0.1s ease;
  will-change: transform;
}

.cell-content.h-left {
  text-align: left;
}

.cell-content.h-center {
  text-align: center;
}

.cell-content.h-right {
  text-align: right;
}

.cell-content.v-top {
  display: flex;
  align-items: flex-start;
}

.cell-content.v-middle {
  display: flex;
  align-items: center;
}

.cell-content.v-bottom {
  display: flex;
  align-items: flex-end;
}

.cell-content.h-left.v-top,
.cell-content.h-left.v-middle,
.cell-content.h-left.v-bottom {
  justify-content: flex-start;
}

.cell-content.h-center.v-top,
.cell-content.h-center.v-middle,
.cell-content.h-center.v-bottom {
  justify-content: center;
}

.cell-content.h-right.v-top,
.cell-content.h-right.v-middle,
.cell-content.h-right.v-bottom {
  justify-content: flex-end;
}
</style>