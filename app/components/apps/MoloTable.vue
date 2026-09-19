<script lang="ts" setup>
import {nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch} from 'vue'
import type {FUniver, Univer} from '@univerjs/presets'
import {createUniver, LocaleType, mergeLocales} from '@univerjs/presets'
import {UniverSheetsCorePreset} from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreRuRU from '@univerjs/preset-sheets-core/locales/ru-RU'
import excelIcon from '~~/app/assets/icons/excel.png'
import '@univerjs/preset-sheets-core/lib/index.css'
import * as XLSX from 'xlsx'

const props = defineProps<{
  modelValue?: Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', data: Record<string, any>): void
}>()

const containerEl = ref<HTMLElement | null>(null)

let univerInstance: Univer | null = null
let univerAPIInstance: FUniver | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let commandUnsub: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let lastEmitted: any = null

const IMPORT_DEFAULT_ROW_H = 20
const IMPORT_DEFAULT_COL_W = 64

function flushEmit(workbook?: any) {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  const snapshot = (workbook ?? univerAPIInstance?.getActiveWorkbook())?.save()
  if (!snapshot) return
  lastEmitted = snapshot
  emit('update:modelValue', snapshot)
}

function scheduleEmit() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => flushEmit(), 500)
}

function replaceWorkbook(data: Record<string, any>) {
  const api = univerAPIInstance
  if (!api) return null
  try {
    const oldId = api.getActiveWorkbook()?.getId()
    if (oldId) (api as any).disposeUnit?.(oldId)
    return api.createWorkbook(data)
  } catch (e) {
    console.error('Не удалось загрузить таблицу', e)
    return null
  }
}

// ===== Экспорт в XLSX =====
function sheetToWs(sheet: any): XLSX.WorkSheet {
  const cellData = sheet.cellData || {}
  const colData = sheet.columnData || {}
  const rowData = sheet.rowData || {}
  const defW = sheet.defaultColumnWidth || 88
  const defH = sheet.defaultRowHeight || 24

  const ws: XLSX.WorkSheet = {}
  let maxR = 0
  let maxC = 0

  for (const rKey of Object.keys(cellData)) {
    const row = cellData[rKey] || {}
    for (const cKey of Object.keys(row)) {
      const cell = row[cKey]
      const empty = !cell || cell.v === undefined || cell.v === null || cell.v === ''
      if (!cell || (empty && !cell.f)) continue

      const r = Number(rKey)
      const c = Number(cKey)
      maxR = Math.max(maxR, r)
      maxC = Math.max(maxC, c)

      let out: XLSX.CellObject
      if (cell.t === 3) {
        out = {t: 'b', v: cell.v === true || cell.v === 1 || cell.v === 'TRUE'}
      } else if (typeof cell.v === 'number' || (cell.t === 2 && Number.isFinite(Number(cell.v)))) {
        out = {t: 'n', v: Number(cell.v)}
      } else {
        out = {t: 's', v: String(cell.v ?? '')}
      }
      if (cell.f) out.f = String(cell.f).replace(/^=/, '')
      ws[XLSX.utils.encode_cell({r, c})] = out
    }
  }

  const merges = (sheet.mergeData || []).map((m: any) => ({
    s: {r: m.startRow, c: m.startColumn},
    e: {r: m.endRow, c: m.endColumn},
  }))
  merges.forEach((m: any) => {
    maxR = Math.max(maxR, m.e.r)
    maxC = Math.max(maxC, m.e.c)
  })
  Object.keys(rowData).forEach(k => { if (rowData[k]?.h) maxR = Math.max(maxR, Number(k)) })
  Object.keys(colData).forEach(k => { if (colData[k]?.w) maxC = Math.max(maxC, Number(k)) })

  ws['!ref'] = XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: maxR, c: maxC}})
  if (merges.length) ws['!merges'] = merges

  ws['!cols'] = Array.from({length: maxC + 1}, (_, c) => ({
    wpx: colData[c]?.w ?? defW,
    hidden: colData[c]?.hd === 1,
  }))
  ws['!rows'] = Array.from({length: maxR + 1}, (_, r) => ({
    hpx: rowData[r]?.h ?? rowData[r]?.ah ?? defH,
    hidden: rowData[r]?.hd === 1,
  }))

  return ws
}

function exportToXlsx() {
  const data = univerAPIInstance?.getActiveWorkbook()?.save()
  if (!data) return

  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const id of data.sheetOrder || []) {
    const sheet = data.sheets?.[id]
    if (!sheet) continue
    let name = String(sheet.name || 'Лист').replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Лист'
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)}_${used.size}`
    used.add(name.toLowerCase())
    XLSX.utils.book_append_sheet(wb, sheetToWs(sheet), name)
  }
  if (!wb.SheetNames.length) return

  const fileName = String(data.name || 'table').replace(/[\\/:*?"<>|]/g, '_')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

// ===== Импорт XLSX =====
function wsToSheet(ws: XLSX.WorkSheet, id: string, name: string) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')

  const cellData: Record<number, Record<number, any>> = {}
  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue
    const cell = ws[addr] as XLSX.CellObject
    if (!cell || ((cell.v === undefined || cell.v === null) && !cell.f)) continue

    const {r, c} = XLSX.utils.decode_cell(addr)
    const out: Record<string, any> = {}
    if (cell.t === 'n') {
      out.v = cell.v
      out.t = 2
    } else if (cell.t === 'b') {
      out.v = cell.v ? 1 : 0
      out.t = 3
    } else if (cell.t === 'e') {
      out.v = cell.w ?? '#ERROR'
      out.t = 1
    } else {
      out.v = cell.v instanceof Date ? cell.v.toISOString() : String(cell.v ?? '')
      out.t = 1
    }
    if (cell.f) out.f = `=${cell.f}`
    if (!cellData[r]) cellData[r] = {}
    cellData[r][c] = out
  }

  const mergeData = (ws['!merges'] || []).map((m: any) => ({
    startRow: m.s.r,
    endRow: m.e.r,
    startColumn: m.s.c,
    endColumn: m.e.c,
  }))

  const columnData: Record<number, any> = {}
  ;(ws['!cols'] || []).forEach((col: XLSX.ColInfo, i: number) => {
    if (!col) return
    const w = col.wpx ?? (col.wch != null ? col.wch * 7 + 5 : col.width != null ? col.width * 7 + 5 : undefined)
    if (w || col.hidden) columnData[i] = {...(w ? {w: Math.round(w)} : {}), ...(col.hidden ? {hd: 1} : {})}
  })

  const rowData: Record<number, any> = {}
  ;(ws['!rows'] || []).forEach((row: XLSX.RowInfo, i: number) => {
    if (!row) return
    const h = row.hpx ?? (row.hpt != null ? (row.hpt * 96) / 72 : undefined)
    if (h || row.hidden) rowData[i] = {...(h ? {h: Math.round(h)} : {}), ...(row.hidden ? {hd: 1} : {})}
  })

  return {
    id,
    name,
    cellData,
    rowCount: Math.max(range.e.r + 1 + 20, 100),
    columnCount: Math.max(range.e.c + 1 + 5, 26),
    defaultRowHeight: IMPORT_DEFAULT_ROW_H,
    defaultColumnWidth: IMPORT_DEFAULT_COL_W,
    mergeData,
    columnData,
    rowData,
  }
}

function triggerExcelImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xlsx,.xls,.csv,.ods'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file || !univerAPIInstance) return

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, {type: 'array', cellStyles: true})

      const sheets: Record<string, any> = {}
      const sheetOrder: string[] = []
      wb.SheetNames.forEach((sheetName, i) => {
        const id = `sheet_${i + 1}`
        sheets[id] = wsToSheet(wb.Sheets[sheetName], id, sheetName)
        sheetOrder.push(id)
      })

      const workbook = replaceWorkbook({
        id: `wb_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        sheetOrder,
        sheets,
      })
      flushEmit(workbook)
    } catch (e) {
      console.error('Ошибка импорта таблицы', e)
      alert('Не удалось прочитать файл. Проверьте, что это валидная таблица (.xlsx, .xls, .csv)')
    }
  }
  input.click()
}

// Пересчёт размеров Univer под текущий контейнер
function resizeUniver() {
  if (!univerAPIInstance || !containerEl.value) return
  try {
    const w = containerEl.value.clientWidth
    const h = containerEl.value.clientHeight
    if (w <= 0 || h <= 0) return
    // В разных версиях Univer доступны разные методы ресайза — вызываем, что есть
    const api: any = univerAPIInstance
    api.resize?.()
    const wb: any = api.getActiveWorkbook?.()
    wb?.resize?.()
    // Резервный путь: через события окна (Univer слушает window.resize)
    window.dispatchEvent(new Event('resize'))
  } catch (e) {
    console.warn('Univer resize:', e)
  }
}

onMounted(async () => {
  if (!containerEl.value) return

  // Ждём, пока родитель (tab-panel / tab-content) применит финальные размеры
  await nextTick()

  const {univer, univerAPI} = createUniver({
    locale: LocaleType.RU_RU,
    locales: {
      [LocaleType.RU_RU]: mergeLocales(UniverPresetSheetsCoreRuRU),
    },
    presets: [
      UniverSheetsCorePreset({
        container: containerEl.value,
      }),
    ],
  })

  univerInstance = univer
  univerAPIInstance = univerAPI

  const hasData = props.modelValue && Object.keys(props.modelValue).length > 0
  const workbook = univerAPI.createWorkbook(hasData ? props.modelValue! : {name: 'Новая таблица'})
  lastEmitted = hasData ? toRaw(props.modelValue) : null

  const sub: any = univerAPI.onCommandExecuted((command: any) => {
    if (command?.type === 2) scheduleEmit()
  })
  commandUnsub = () => (typeof sub === 'function' ? sub() : sub?.dispose?.())
  void workbook

  // Пересчитываем размеры после монтирования и при любом изменении контейнера.
  // Это критично: v-show в родителе даёт 0×0 при первом монтировании.
  resizeObserver = new ResizeObserver(() => resizeUniver())
  resizeObserver.observe(containerEl.value)

  // И разово — после того как браузер отрисует layout
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      resizeUniver()
    })
  })

  setTimeout(() => {
    resizeUniver()
  }, 300)
})

watch(() => props.modelValue, (val) => {
  if (!univerAPIInstance || !val || Object.keys(val).length === 0) return
  if (toRaw(val) === lastEmitted) return
  lastEmitted = toRaw(val)
  replaceWorkbook(val)
})

onBeforeUnmount(() => {
  if (saveTimeout) flushEmit()
  try {
    resizeObserver?.disconnect()
  } catch { /* noop */ }
  resizeObserver = null
  try {
    commandUnsub?.()
  } catch { /* уже освобождено */ }
  commandUnsub = null
  try {
    univerAPIInstance?.dispose()
  } catch (e) {
    console.warn('Univer API dispose:', e)
  }
  try {
    univerInstance?.dispose()
  } catch { /* уже освобождено вместе с API */ }
  univerAPIInstance = null
  univerInstance = null
})
</script>

<template>
  <div class="molo-sheet-wrapper">
    <div class="sheet-toolbar">
      <div class="toolbar-group">
        <button class="toolbar-btn" title="Экспорт в Excel (.xlsx)" @click="exportToXlsx">
          <img :src="excelIcon" alt="" style="width: 15px;">
        </button>
        <button class="toolbar-btn" title="Импорт из Excel" @click="triggerExcelImport">
          <span class="toolbar-icon">📂</span>
        </button>
      </div>
      <div class="toolbar-sep"/>
      <div class="toolbar-group">
        <span class="toolbar-hint">Поддерживаются форматы: <b>.xlsx, .xls, .csv</b></span>
      </div>
    </div>
    <div ref="containerEl" class="molo-sheet-root"/>
  </div>
</template>

<style scoped>
/* Обёртка: flex-колонка, забирает всю высоту панели, сама не скроллится */
.molo-sheet-wrapper {
  display: flex;
  flex-direction: column;

  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;

  background: #fff;
  overflow: hidden;
  box-sizing: border-box;
}

.sheet-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #fafbfc;
  border-bottom: 1px solid #d7dbe0;
  flex-shrink: 0;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-sep {
  width: 1px;
  align-self: stretch;
  background: #d7dbe0;
  margin: 2px 8px;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: #f8f9fa;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #1f2328;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}

.toolbar-btn:hover {
  background: #eef3ff;
  border-color: #a9c6ff;
}

.toolbar-hint {
  font-size: 11px;
  color: #6b7280;
}

/* Контейнер Univer: только flex:1 + min-height:0.
   НИКАКОГО min-height в пикселях — он ломал растягивание на всю панель. */
.molo-sheet-root {
  flex: 1 1 0;
  width: 100%;
  min-width: 0;
  min-height: 0;

  position: relative;
  overflow: hidden;
}

/* Внутренние обёртки Univer заполняют контейнер */
.molo-sheet-root :deep(.univer),
.molo-sheet-root :deep(.univer-app),
.molo-sheet-root :deep(.univer-container),
.molo-sheet-root :deep(.univer-sheet-container) {
  width: 100% !important;
  height: 100% !important;
}
</style>