<!-- components/apps/molo/MoloTable.vue -->
<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'
import type { FUniver, Univer } from '@univerjs/presets'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreRuRU from '@univerjs/preset-sheets-core/locales/ru-RU'
import excelIcon from '~~/app/assets/icons/excel.svg'
import '@univerjs/preset-sheets-core/lib/index.css'
import * as XLSX from 'xlsx'
import { useDirectoryInterpolator, type DirectoryLookupItem } from '~/composables/useDirectoryInterpolator'
import DirectorySuggestDropdown from '~/components/directory/DirectorySuggestDropdown.vue'
import type { ApiImportPayload, ApiSource } from '~/composables/useApiTable'

const props = defineProps<{
  modelValue?: Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', data: Record<string, any>): void
  // Разрешение {@...} делает Workspace (там живёт DirectoryResolutionModal) — как и для MoloDocument
  (e: 'resolve-variable', payload: { rawExpression: string; apply: (replacement: string) => void }): void
}>()

const { fetchAllDirectories } = useDirectoryInterpolator()

const containerEl = ref<HTMLElement | null>(null)
const suggestDropdownRef = ref<InstanceType<typeof DirectorySuggestDropdown> | null>(null)

let univerInstance: Univer | null = null
let univerAPIInstance: FUniver | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let commandUnsub: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let lastEmitted: any = null

/* ── Состояние подсказчика ── */
const suggestVisible = ref(false)
const suggestCoords = reactive({ x: 0, y: 0 })
const suggestQuery = ref('')
const allDirectoryItems = ref<DirectoryLookupItem[]>([])

// Текущее состояние редактируемой ячейки (приходит из событий Univer, а не из DOM)
let editCtx: { row: number; col: number; text: string } | null = null
let lastResolveKey = ''
let editDisposables: Array<{ dispose: () => void } | (() => void)> = []

const IMPORT_DEFAULT_ROW_H = 20
const IMPORT_DEFAULT_COL_W = 64

/* ── Подключённые API-источники ──
   Храним рядом со снимком Univer под отдельным ключом: Univer про него не знает, поэтому
   вырезаем перед createWorkbook и добавляем обратно при каждом сохранении. */
const API_SOURCES_KEY = 'moloApiSources'
const apiModalOpen = ref(false)
const apiSources = ref<ApiSource[]>([])

function readSources(data?: Record<string, any> | null): ApiSource[] {
  const list = data?.[API_SOURCES_KEY]
  return Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
}

function stripSources(data: Record<string, any>): Record<string, any> {
  if (!(API_SOURCES_KEY in data)) return data
  const { [API_SOURCES_KEY]: _omit, ...rest } = data
  return rest
}

function serializeSources(): ApiSource[] {
  return apiSources.value.map((s) => {
    const copy: ApiSource = JSON.parse(JSON.stringify(s))
    if (!copy.saveHeaders) {
      // токены в документ не пишем — только имена заголовков
      copy.needsHeaders = copy.needsHeaders || copy.headers.some(h => h.value)
      copy.headers = copy.headers.map(h => ({ key: h.key, value: '' }))
    }
    return copy
  })
}

function flushEmit(workbook?: any) {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  const base = (workbook ?? univerAPIInstance?.getActiveWorkbook())?.save()
  if (!base) return
  const snapshot = apiSources.value.length ? { ...base, [API_SOURCES_KEY]: serializeSources() } : base
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
    apiSources.value = readSources(data)
    return api.createWorkbook(stripSources(data))
  } catch (e) {
    console.error('Не удалось загрузить таблицу', e)
    return null
  }
}

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
        out = { t: 'b', v: cell.v === true || cell.v === 1 || cell.v === 'TRUE' }
      } else if (typeof cell.v === 'number' || (cell.t === 2 && Number.isFinite(Number(cell.v)))) {
        out = { t: 'n', v: Number(cell.v) }
      } else {
        out = { t: 's', v: String(cell.v ?? '') }
      }
      if (cell.f) out.f = String(cell.f).replace(/^=/, '')
      ws[XLSX.utils.encode_cell({ r, c })] = out
    }
  }

  const merges = (sheet.mergeData || []).map((m: any) => ({
    s: { r: m.startRow, c: m.startColumn },
    e: { r: m.endRow, c: m.endColumn },
  }))
  merges.forEach((m: any) => {
    maxR = Math.max(maxR, m.e.r)
    maxC = Math.max(maxC, m.e.c)
  })
  Object.keys(rowData).forEach(k => { if (rowData[k]?.h) maxR = Math.max(maxR, Number(k)) })
  Object.keys(colData).forEach(k => { if (colData[k]?.w) maxC = Math.max(maxC, Number(k)) })

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } })
  if (merges.length) ws['!merges'] = merges

  ws['!cols'] = Array.from({ length: maxC + 1 }, (_, c) => ({
    wpx: colData[c]?.w ?? defW,
    hidden: colData[c]?.hd === 1,
  }))
  ws['!rows'] = Array.from({ length: maxR + 1 }, (_, r) => ({
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

function triggerExcelImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xlsx,.xls,.csv,.ods'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file || !univerAPIInstance) return

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellStyles: true })

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

function wsToSheet(ws: XLSX.WorkSheet, id: string, name: string) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  const cellData: Record<number, Record<number, any>> = {}

  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue
    const cell = ws[addr] as XLSX.CellObject
    if (!cell || ((cell.v === undefined || cell.v === null) && !cell.f)) continue

    const { r, c } = XLSX.utils.decode_cell(addr)
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
    if (w || col.hidden) columnData[i] = { ...(w ? { w: Math.round(w) } : {}), ...(col.hidden ? { hd: 1 } : {}) }
  })

  const rowData: Record<number, any> = {}
  ;(ws['!rows'] || []).forEach((row: XLSX.RowInfo, i: number) => {
    if (!row) return
    const h = row.hpx ?? (row.hpt != null ? (row.hpt * 96) / 72 : undefined)
    if (h || row.hidden) rowData[i] = { ...(h ? { h: Math.round(h) } : {}), ...(row.hidden ? { hd: 1 } : {}) }
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

/* ───────────────────────── Импорт из API ───────────────────────── */

const API_DATE_FALLBACK_COL_W = 64

// Строка, начинающаяся с «=», не должна превращаться в формулу — кладём её как текстовую ячейку
function toUniverCell(v: any) {
  return typeof v === 'string' && v.startsWith('=') ? { v, t: 1 } : v
}

function uniqueSheetName(wb: any, wanted: string): string {
  const used = new Set<string>((wb.getSheets?.() ?? []).map((s: any) => String(s.getSheetName()).toLowerCase()))
  const base = (String(wanted || 'API').replace(/[\\/?*[\]:]/g, '_').slice(0, 28).trim()) || 'API'
  let name = base
  let i = 2
  while (used.has(name.toLowerCase())) name = `${base} ${i++}`
  return name
}

function ensureSheetCapacity(sheet: any, needRows: number, needCols: number) {
  try {
    const maxRows = sheet.getMaxRows?.() ?? 0
    if (needRows > maxRows) {
      if (sheet.setRowCount) sheet.setRowCount(needRows + 20)
      else sheet.insertRows?.(Math.max(0, maxRows - 1), needRows - maxRows + 20)
    }
    const maxCols = sheet.getMaxColumns?.() ?? 0
    if (needCols > maxCols) {
      if (sheet.setColumnCount) sheet.setColumnCount(needCols + 2)
      else sheet.insertColumns?.(Math.max(0, maxCols - 1), needCols - maxCols + 2)
    }
  } catch (e) {
    console.warn('Не удалось расширить лист', e)
  }
}

function handleApiImport({ source, matrix, target }: ApiImportPayload) {
  const wb: any = univerAPIInstance?.getActiveWorkbook()
  if (!wb) return

  try {
    const cols = matrix.headers.length
    const values: any[][] = [matrix.headers, ...matrix.rows].map(r => r.map(toUniverCell))
    let sheet: any = null
    let anchorRow = 0
    let anchorCol = 0
    let isNewSheet = false
    let isRefresh = false

    // 1. Обновление ранее вставленной таблицы: чистим старый диапазон и пишем на то же место
    if (target === 'refresh' && source.sheetId) {
      sheet = wb.getSheetBySheetId?.(source.sheetId) ?? null
      if (sheet) {
        isRefresh = true
        anchorRow = source.anchorRow ?? 0
        anchorCol = source.anchorCol ?? 0
        if (source.lastRows && source.lastCols) {
          const old = sheet.getRange(anchorRow, anchorCol, source.lastRows, source.lastCols)
          if (old.clearContent) old.clearContent()
          else old.clear?.()
        }
      }
    }

    // 2. Текущий лист, с выделенной ячейки
    if (!sheet && target === 'active') {
      sheet = wb.getActiveSheet()
      const sel = sheet?.getSelection?.()?.getActiveRange?.() ?? sheet?.getActiveRange?.()
      anchorRow = sel?.getRow?.() ?? 0
      anchorCol = sel?.getColumn?.() ?? 0
    }

    // 3. Новый лист (также если лист для обновления был удалён)
    if (!sheet) {
      sheet = wb.create(uniqueSheetName(wb, source.name), values.length + 20, Math.max(cols + 5, 26))
      isNewSheet = true
      anchorRow = 0
      anchorCol = 0
    }

    ensureSheetCapacity(sheet, anchorRow + values.length, anchorCol + cols)
    sheet.getRange(anchorRow, anchorCol, values.length, cols).setValues(values)

    // Оформление шапки и ширины колонок — только при первой вставке, чтобы не затирать ручные правки
    if (!isRefresh) {
      try {
        const head = sheet.getRange(anchorRow, anchorCol, 1, cols)
        head.setFontWeight?.('bold')
        head.setBackground?.('#f1f3f5')
        const sample = values.slice(0, 200)
        for (let c = 0; c < cols; c++) {
          let maxLen = 0
          for (const row of sample) {
            const cell: any = row[c]
            const len = String(typeof cell === 'object' && cell !== null ? cell.v : cell ?? '').length
            if (len > maxLen) maxLen = len
          }
          const w = Math.min(320, Math.max(API_DATE_FALLBACK_COL_W, maxLen * 7 + 20))
          sheet.setColumnWidth?.(anchorCol + c, w)
        }
        if (isNewSheet) sheet.setFrozenRows?.(1)
      } catch (e) {
        console.warn('Не удалось оформить таблицу', e)
      }
    }

    const saved: ApiSource = {
      ...source,
      needsHeaders: source.saveHeaders ? false : source.headers.some(h => h.value) || source.needsHeaders,
      sheetId: sheet.getSheetId(),
      sheetName: sheet.getSheetName(),
      anchorRow,
      anchorCol,
      lastRows: values.length,
      lastCols: cols,
      lastSyncAt: new Date().toISOString(),
    }
    const idx = apiSources.value.findIndex(s => s.id === saved.id)
    if (idx >= 0) apiSources.value.splice(idx, 1, saved)
    else apiSources.value.push(saved)

    wb.setActiveSheet?.(sheet)
    flushEmit()
  } catch (e) {
    console.error('Ошибка вставки данных из API', e)
    alert('Не удалось вставить данные в таблицу. Подробности — в консоли браузера.')
  }
}

function removeApiSource(id: string) {
  apiSources.value = apiSources.value.filter(s => s.id !== id)
  flushEmit() // данные в листе остаются, удаляется только привязка к API
}

/* ───────────────────────── Перехват {@...} через события редактора Univer ─────────────────────────
   Текст читаем из самого редактора Univer (SheetEditChanging), а не из DOM: ячейка рисуется на canvas,
   а скрытый contenteditable не хранит весь набранный текст. */

function placeSuggest() {
  const root = containerEl.value
  const active = document.activeElement as HTMLElement | null
  const candidates: (Element | null | undefined)[] = [
    active && root?.contains(active) ? active : null,
    root?.querySelector('.univer-editor-container'),
    root?.querySelector('.univer-formula-editor'),
    document.querySelector('.univer-cell-editor'),
  ]
  for (const el of candidates) {
    const rect = el?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      suggestCoords.x = Math.max(16, rect.left)
      suggestCoords.y = rect.bottom
      return
    }
  }
  const cRect = root?.getBoundingClientRect()
  if (cRect) {
    suggestCoords.x = cRect.left + 80
    suggestCoords.y = cRect.top + 70
  }
}

function onEditText(row: number, col: number, rawText: string) {
  if (!containerEl.value || containerEl.value.offsetWidth === 0) {
    suggestVisible.value = false
    return
  }
  const text = (rawText || '').replace(/[\u200B-\u200D\uFEFF]/g, '')
  editCtx = { row, col, text }

  // 1. Закрытое выражение {@...} -> отдаём Workspace (он покажет DirectoryResolutionModal)
  const exactMatch = text.match(/\{@[^}]+}/)
  if (exactMatch) {
    suggestVisible.value = false
    const key = `${row}:${col}:${text}`
    if (key === lastResolveKey) return // то же самое выражение уже в обработке
    lastResolveKey = key

    emit('resolve-variable', {
      rawExpression: exactMatch[0],
      apply: (replacement: string) => {
        lastResolveKey = ''
        void commitToCell(row, col, text.replace(exactMatch[0], replacement))
      },
    })
    return
  }
  lastResolveKey = ''

  // 2. Незакрытое {@ -> живой список подсказок
  const match = text.match(/\{@([^}]*)$/)
  if (match) {
    suggestQuery.value = match[1] || ''
    placeSuggest()
    suggestVisible.value = true
  } else {
    suggestVisible.value = false
  }
}

function bindEditorEvents(api: any) {
  const ev = api.Event
  const add = (name: string, cb: (p: any) => void) => {
    if (!name) return
    const d = api.addEvent(name, cb)
    if (d) editDisposables.push(d)
  }
  add(ev?.SheetEditStarted, (p) => { editCtx = { row: p.row, col: p.column, text: '' } })
  add(ev?.SheetEditChanging, (p) => onEditText(p.row, p.column, p.value?.toPlainText?.() ?? ''))
  add(ev?.SheetEditEnded, () => {
    suggestVisible.value = false
    editCtx = null
  })
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (!containerEl.value || containerEl.value.offsetWidth === 0) return
  if (!suggestVisible.value) return

  if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
    suggestDropdownRef.value?.handleKeyDown(e)
  }
}

function writeToUniverCell(row: number, col: number, text: string) {
  if (!univerAPIInstance) return
  const sheet = univerAPIInstance.getActiveWorkbook()?.getActiveSheet()
  const range = sheet?.getRange(row, col)
  if (range) {
    range.setValue(text)
    scheduleEmit()
  }
}

// Сначала закрываем редактор ячейки без сохранения (иначе он перезапишет результат текстом «{@...}»), затем пишем значение
async function commitToCell(row: number, col: number, text: string) {
  try {
    await (univerAPIInstance?.getActiveWorkbook() as any)?.endEditingAsync?.(false)
  } catch (e) {
    console.warn('Univer endEditing:', e)
  }
  setTimeout(() => writeToUniverCell(row, col, text), 50)
}

function handleSuggestSelect(item: DirectoryLookupItem, fieldValue?: string) {
  const ctx = editCtx
  suggestVisible.value = false
  if (!ctx) return

  const textToInsert = fieldValue || item.title
  void commitToCell(ctx.row, ctx.col, ctx.text.replace(/\{@[^}]*$/, textToInsert))
}

function resizeUniver() {
  if (!univerAPIInstance || !containerEl.value) return
  try {
    const w = containerEl.value.clientWidth
    const h = containerEl.value.clientHeight
    if (w <= 0 || h <= 0) return

    const api: any = univerAPIInstance
    api.resize?.()
    const wb: any = api.getActiveWorkbook?.()
    wb?.resize?.()
    window.dispatchEvent(new Event('resize'))
  } catch (e) {
    console.warn('Univer resize:', e)
  }
}

onMounted(async () => {
  allDirectoryItems.value = await fetchAllDirectories()
  if (!containerEl.value) return
  await nextTick()

  const { univer, univerAPI } = createUniver({
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
  if (hasData) apiSources.value = readSources(props.modelValue)
  const workbook = univerAPI.createWorkbook(hasData ? stripSources(props.modelValue!) : { name: 'Новая таблица' })
  lastEmitted = hasData ? toRaw(props.modelValue) : null

  bindEditorEvents(univerAPI)
  window.addEventListener('keydown', handleGlobalKeyDown, true)

  const sub: any = univerAPI.onCommandExecuted((command: any) => {
    if (command?.type === 2) scheduleEmit()
  })
  commandUnsub = () => (typeof sub === 'function' ? sub() : sub?.dispose?.())
  void workbook

  resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => resizeUniver())
  })
  resizeObserver.observe(containerEl.value)

  requestAnimationFrame(() => {
    resizeUniver()
    setTimeout(resizeUniver, 50)
    setTimeout(resizeUniver, 150)
  })
})

watch(() => props.modelValue, (val) => {
  if (!univerAPIInstance || !val || Object.keys(val).length === 0) return
  if (toRaw(val) === lastEmitted) return
  lastEmitted = toRaw(val)
  replaceWorkbook(val)
})

onBeforeUnmount(() => {
  if (saveTimeout) flushEmit()
  editDisposables.forEach(d => { try { typeof d === 'function' ? d() : d.dispose() } catch {} })
  editDisposables = []
  window.removeEventListener('keydown', handleGlobalKeyDown, true)
  resizeObserver?.disconnect()
  resizeObserver = null
  commandUnsub?.()
  commandUnsub = null
  try { univerAPIInstance?.dispose() } catch {}
  try { univerInstance?.dispose() } catch {}
  univerAPIInstance = null
  univerInstance = null
})
</script>

<template>
  <div class="molo-sheet-wrapper">
    <!-- Выпадающий список прямо у ячейки -->
    <DirectorySuggestDropdown
        ref="suggestDropdownRef"
        :visible="suggestVisible"
        :x="suggestCoords.x"
        :y="suggestCoords.y"
        :query="suggestQuery"
        :items="allDirectoryItems"
        @select="handleSuggestSelect"
        @close="suggestVisible = false"
    />

    <!-- components/apps/molo/MoloTable.vue -->
    <div class="sheet-toolbar">
      <div class="btn-group">
        <UIMoloButton class="small" title="Экспорт в Excel (.xlsx)" @click="exportToXlsx">
          <img :src="excelIcon" alt="" style="width: 12px;">
        </UIMoloButton>
        <UIMoloButton class="small" title="Импорт из Excel" @click="triggerExcelImport">
          <UIMoloSticker name="folder"/>
        </UIMoloButton>
        <UIMoloButton class="small" title="Подключить API и показать данные таблицей" @click="apiModalOpen = true">
          <UIMoloSticker name="dev-json"/>
        </UIMoloButton>
      </div>
      <div class="toolbar-sep"/>
      <div class="toolbar-group">
        <span class="toolbar-hint">Поддерживаются форматы: <b>.xlsx, .xls, .csv</b> · Данные из внешнего сервиса — кнопка <b>API</b> · Для автоподстановки введите <b>{@</b> в ячейку</span>
      </div>
    </div>
    <div ref="containerEl" class="molo-sheet-root"/>

    <AppsMoloAPIImportModal
        v-model="apiModalOpen"
        :sources="apiSources"
        @import="handleApiImport"
        @remove="removeApiSource"
    />
  </div>
</template>

<style scoped>
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
  position: relative;
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

.toolbar-hint {
  font-size: 11px;
  color: #6b7280;
}

.molo-sheet-root {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.molo-sheet-root :deep(> .univer),
.molo-sheet-root :deep(> .univer-app),
.molo-sheet-root :deep(> .univer-container),
.molo-sheet-root :deep(> .univer-workbench),
.molo-sheet-root :deep(> .univer-workbench-layout) {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
}
</style>