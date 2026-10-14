<script setup lang="ts">

import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch,} from 'vue'

/* ───────────────────────── props / emits ───────────────────────── */
const props = withDefaults(defineProps<{
  modelValue?: string | Blob | File
  fileName?: string
  fontUrl?: string
  stampOrg?: string
}>(), {
  fontUrl: '/fonts/Roboto-Regular.ttf',
  stampOrg: 'ООО «МОЛОФЛОУ»',
})

const emit = defineEmits<{
  'update:modelValue': [val: any]
  save: [blob: Blob, name: string]
}>()

/* ───────────────────────── типы ───────────────────────── */
type Tool = 'select' | 'text' | 'highlight' | 'pen' | 'rect' | 'ellipse' | 'arrow'
type AType = Tool | 'image' | 'stamp'

interface Pt {
  x: number;
  y: number
}

interface Annot {
  id: string;
  type: Exclude<AType, 'select'>;
  page: string
  x: number;
  y: number;
  w: number;
  h: number
  color: string;
  fill: string;
  width: number;
  opacity: number
  fontSize: number;
  text: string;
  points: Pt[];
  src: string
}

interface PageItem {
  id: string;
  src: number;
  rotate: number;
  w: number;
  h: number
}

interface Drag {
  kind: 'create' | 'move' | 'resize' | 'handle'
  el: HTMLElement;
  id: string;
  start: Pt;
  before: string
  handle?: string;
  orig?: { x: number; y: number; w: number; h: number; points: Pt[] }
  moved: boolean
}

/* ───────────────────────── константы ───────────────────────── */
const BASE = 1.25 // CSS-пикселей на 1 pt при zoom 100%
const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200, 300]
const PALETTE = ['#111827', '#e11d48', '#f97316', '#facc15', '#16a34a', '#2563eb', '#7c3aed', '#ffffff']
const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  {id: 'select', icon: 'cursor', label: 'Выбор', key: 'V'},
  {id: 'text', icon: 'type', label: 'Текст', key: 'T'},
  {id: 'highlight', icon: 'highlighter', label: 'Выделение', key: 'H'},
  {id: 'pen', icon: 'pen', label: 'Рисование', key: 'P'},
  {id: 'rect', icon: 'square', label: 'Прямоугольник', key: 'R'},
  {id: 'ellipse', icon: 'circle', label: 'Эллипс', key: 'O'},
  {id: 'arrow', icon: 'arrow', label: 'Стрелка', key: 'A'},
]
const STAMPS = [
  {label: 'ОПЛАЧЕНО', color: '#16a34a'},
  {label: 'СОГЛАСОВАНО', color: '#2563eb'},
  {label: 'УТВЕРЖДЕНО', color: '#0f766e'},
  {label: 'ЧЕРНОВИК', color: '#ea580c'},
  {label: 'КОПИЯ', color: '#7c3aed'},
  {label: 'ОТКЛОНЕНО', color: '#dc2626'},
]
const TOOL_DEFAULTS: Record<string, Partial<{ color: string; width: number; opacity: number; fontSize: number }>> = {
  text: {color: '#111827', opacity: 1, fontSize: 16},
  highlight: {color: '#facc15', opacity: 0.4},
  pen: {color: '#2563eb', width: 3, opacity: 1},
  rect: {color: '#e11d48', width: 2, opacity: 1},
  ellipse: {color: '#e11d48', width: 2, opacity: 1},
  arrow: {color: '#e11d48', width: 3, opacity: 1},
}
const SIG_KEY = 'molo_pdf_signature'

/* ───────────────────────── состояние ───────────────────────── */
const rootEl = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const sigCanvas = ref<HTMLCanvasElement | null>(null)

const pages = ref<PageItem[]>([])
const annots = ref<Annot[]>([])
const assets = new Map<string, string>() // id → dataURL (картинки, подписи, штампы)

const zoom = ref(100)
const tool = ref<Tool>('select')
const selectedId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const showThumbs = ref(true)
const loading = ref(false)
const busy = ref(false)
const currentPageIdx = ref(0)
const toastMsg = ref('')
const stampMenu = ref(false)
const sigOpen = ref(false)
const sigColor = ref('#111827')
const sigSaved = ref('')
const localName = ref('')

const style = reactive({color: '#e11d48', fill: '', width: 3, opacity: 1, fontSize: 16})

const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])

const scale = computed(() => BASE * zoom.value / 100)
const hasDoc = computed(() => pages.value.length > 0)
const selected = computed(() => annots.value.find(a => a.id === selectedId.value) ?? null)
const displayName = computed(() => localName.value || props.fileName || 'Документ PDF')
const byPage = computed(() => {
  const m: Record<string, Annot[]> = {}
  for (const a of annots.value) (m[a.page] ||= []).push(a)
  return m
})
const activeType = computed(() => selected.value?.type ?? tool.value)
const showProps = computed(() => !!selected.value || tool.value !== 'select')
const propView = computed(() => selected.value ?? style)
const fontFamily = ref('Arial, Helvetica, sans-serif')

const uid = () => Math.random().toString(36).slice(2, 10)
const dispW = (p: PageItem) => (p.rotate % 180 ? p.h : p.w)
const dispH = (p: PageItem) => (p.rotate % 180 ? p.w : p.h)

let toastTimer: any = 0

function notify(msg: string) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 3500)
}

/* ───────────────────────── история (undo/redo) ───────────────────────── */
const serialize = () => JSON.stringify({pages: pages.value, annots: annots.value})

function pushUndo(s: string) {
  undoStack.value.push(s)
  if (undoStack.value.length > 100) undoStack.value.shift()
  redoStack.value = []
}

const snapshot = () => pushUndo(serialize())

function restore(s: string) {
  const d = JSON.parse(s)
  pages.value = d.pages
  annots.value = d.annots
  selectedId.value = null
  editingId.value = null
  nextTick(renderVisible)
}

function undo() {
  if (!undoStack.value.length) return
  redoStack.value.push(serialize())
  restore(undoStack.value.pop()!)
}

function redo() {
  if (!redoStack.value.length) return
  undoStack.value.push(serialize())
  restore(redoStack.value.pop()!)
}

/* ───────────────────────── загрузка PDF ───────────────────────── */
let pdfjs: any = null
let pdfDoc: any = null
let originalBytes: Uint8Array | null = null
let ignoreNext: any = null

async function ensurePdfjs() {
  if (pdfjs) return
  pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
}

async function toBytes(src: string | Blob | File): Promise<Uint8Array> {
  if (typeof src === 'string') {
    if (/^(https?:|blob:)/.test(src)) {
      const r = await fetch(src)
      return new Uint8Array(await r.arrayBuffer())
    }
    const bin = atob(src.includes(',') ? src.split(',')[1] : src)
    const u = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
    return u
  }
  return new Uint8Array(await src.arrayBuffer())
}

async function loadDocument(bytes: Uint8Array) {
  loading.value = true
  try {
    await ensurePdfjs()
    const doc = await pdfjs.getDocument({data: bytes.slice()}).promise
    resetPageStates()
    pdfDoc?.destroy?.()
    pdfDoc = doc
    originalBytes = bytes
    const list: PageItem[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const vp = (await doc.getPage(i)).getViewport({scale: 1})
      list.push({id: uid(), src: i, rotate: 0, w: vp.width, h: vp.height})
    }
    annots.value = []
    assets.clear()
    undoStack.value = []
    redoStack.value = []
    selectedId.value = null
    editingId.value = null
    currentPageIdx.value = 0
    pages.value = list
    await nextTick()
    fitWidth(125)
  } catch (e) {
    console.error(e)
    notify('Не удалось открыть PDF-файл')
  } finally {
    loading.value = false
  }
}

async function loadSource(src: string | Blob | File) {
  try {
    await loadDocument(await toBytes(src))
  } catch (e) {
    console.error(e);
    notify('Не удалось прочитать файл')
  }
}

watch(() => props.modelValue, (v) => {
  if (!v || v === ignoreNext) return
  loadSource(v)
}, {immediate: false})

function openFileDialog() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/pdf'
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) openPdfFile(f)
  }
  input.click()
}

function openPdfFile(file: File) {
  localName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    const data = reader.result as string
    ignoreNext = data
    emit('update:modelValue', data)
    loadSource(data)
  }
  reader.readAsDataURL(file)
}

function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (!f) return
  if (f.type === 'application/pdf') openPdfFile(f)
  else if (f.type.startsWith('image/') && hasDoc.value) addImageFile(f)
}

/* ───────────────────────── шрифт ───────────────────────── */
let fontBytes: ArrayBuffer | null = null

async function ensureFont() {
  if (fontBytes || !props.fontUrl) return
  try {
    const r = await fetch(props.fontUrl)
    if (!r.ok) return
    const buf = await r.arrayBuffer()
    const face = new FontFace('MoloPDFFont', buf.slice(0))
    await face.load()
    document.fonts.add(face)
    fontBytes = buf
    fontFamily.value = "'MoloPDFFont', Arial, sans-serif"
  } catch { /* нет шрифта — будет растровый текст */
  }
}

/* ───────────────────────── рендер страниц ───────────────────────── */
interface PState {
  canvas?: HTMLCanvasElement;
  sheet?: HTMLElement;
  task?: any;
  key?: string;
  visible: boolean
}

const pageStates = new Map<string, PState>()
let observer: IntersectionObserver | null = null
const stateOf = (id: string): PState => {
  let s = pageStates.get(id)
  if (!s) {
    s = {visible: false};
    pageStates.set(id, s)
  }
  return s
}

function resetPageStates() {
  for (const s of pageStates.values()) {
    s.task?.cancel?.()
    if (s.sheet) observer?.unobserve(s.sheet)
  }
  pageStates.clear()
}

function setSheet(el: any, id: string) {
  if (!el) return
  const s = stateOf(id)
  if (s.sheet === el) return
  if (s.sheet) observer?.unobserve(s.sheet)
  s.sheet = el
  observer?.observe(el)
}

function setCanvas(el: any, id: string) {
  if (!el) return
  const s = stateOf(id)
  if (s.canvas === el) return
  s.canvas = el
  s.key = ''
  if (s.visible) renderPage(id)
}

async function renderPage(id: string) {
  const st = pageStates.get(id)
  const p = pages.value.find(x => x.id === id)
  if (!st || !st.canvas || !p || p.src === 0 || !pdfDoc) return
  const key = `${scale.value}|${p.rotate}|${p.src}`
  if (st.key === key) return
  st.key = key
  const prev = st.task
  if (prev) {
    prev.cancel?.();
    try {
      await prev.promise
    } catch { /* cancelled */
    }
  }
  if (st.key !== key) return
  try {
    const page = await pdfDoc.getPage(p.src)
    if (st.key !== key) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let vp = page.getViewport({scale: scale.value * dpr, rotation: p.rotate})
    const maxPx = 16e6
    if (vp.width * vp.height > maxPx) {
      const f = Math.sqrt(maxPx / (vp.width * vp.height))
      vp = page.getViewport({scale: scale.value * dpr * f, rotation: p.rotate})
    }
    const cv = st.canvas!
    cv.width = Math.floor(vp.width)
    cv.height = Math.floor(vp.height)
    st.task = page.render({canvasContext: cv.getContext('2d')!, canvas: cv, viewport: vp})
    await st.task.promise
  } catch (e: any) {
    if (e?.name !== 'RenderingCancelledException') {
      console.error(e);
      st.key = ''
    }
  }
}

function renderVisible() {
  for (const [id, s] of pageStates) if (s.visible) renderPage(id)
}

let zoomTimer: any = 0
watch(scale, () => {
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(renderVisible, 150)
})
watch(pages, (list) => {
  const ids = new Set(list.map(p => p.id))
  for (const [id, s] of pageStates) {
    if (!ids.has(id)) {
      s.task?.cancel?.();
      if (s.sheet) observer?.unobserve(s.sheet);
      pageStates.delete(id)
    }
  }
}, {deep: false})

/* миниатюры */
const thumbDone = new WeakSet<HTMLCanvasElement>()

async function thumbRef(el: any, p: PageItem) {
  if (!el || thumbDone.has(el)) return
  thumbDone.add(el)
  const cv = el as HTMLCanvasElement
  if (p.src === 0 || !pdfDoc) {
    cv.width = 120;
    cv.height = Math.round(120 * dispH(p) / dispW(p))
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, cv.width, cv.height)
    return
  }
  try {
    const page = await pdfDoc.getPage(p.src)
    const base = page.getViewport({scale: 1, rotation: p.rotate})
    const vp = page.getViewport({scale: 240 / base.width, rotation: p.rotate})
    cv.width = Math.floor(vp.width);
    cv.height = Math.floor(vp.height)
    page.render({canvasContext: cv.getContext('2d')!, canvas: cv, viewport: vp})
  } catch (e) {
    console.error(e)
  }
}

/* ───────────────────────── зум / навигация ───────────────────────── */
function zoomIn() {
  zoom.value = ZOOM_STEPS.find(z => z > zoom.value) ?? 300
}

function zoomOut() {
  zoom.value = [...ZOOM_STEPS].reverse().find(z => z < zoom.value) ?? 25
}

function fitWidth(cap = 300) {
  const sc = scroller.value
  const p = pages.value[currentPageIdx.value]
  if (!sc || !p) return
  const avail = sc.clientWidth - 64
  zoom.value = Math.round(Math.min(cap, Math.max(25, (avail / dispW(p)) / BASE * 100)))
}

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  zoom.value = Math.min(300, Math.max(25, zoom.value + (e.deltaY < 0 ? 10 : -10)))
}

function scrollToPage(i: number) {
  const p = pages.value[i]
  if (!p) return
  currentPageIdx.value = i
  stateOf(p.id).sheet?.scrollIntoView({behavior: 'smooth', block: 'start'})
}

function gotoPage(e: Event) {
  const n = Number((e.target as HTMLInputElement).value) - 1
  if (n >= 0 && n < pages.value.length) scrollToPage(n)
}

let scrollRaf = 0

function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const sc = scroller.value
    if (!sc) return
    const mid = sc.getBoundingClientRect().top + sc.clientHeight / 3
    let best = 0
    pages.value.forEach((p, i) => {
      const el = pageStates.get(p.id)?.sheet
      if (el && el.getBoundingClientRect().top <= mid) best = i
    })
    currentPageIdx.value = best
  })
}

/* ───────────────────────── геометрия аннотаций ───────────────────────── */
function bbox(a: Annot) {
  if ((a.type === 'pen' || a.type === 'arrow') && a.points.length) {
    const xs = a.points.map(p => p.x), ys = a.points.map(p => p.y)
    const pad = a.width / 2 + (a.type === 'arrow' ? Math.max(10, a.width * 4) : 0) + 1
    const minX = Math.min(...xs), minY = Math.min(...ys)
    return {x: minX - pad, y: minY - pad, w: Math.max(...xs) - minX + pad * 2, h: Math.max(...ys) - minY + pad * 2}
  }
  return {x: a.x, y: a.y, w: a.w, h: a.h}
}

function boxStyle(a: Annot) {
  const b = bbox(a)
  const s = scale.value
  const st: Record<string, string> = {left: b.x * s + 'px', top: b.y * s + 'px', width: b.w * s + 'px'}
  if (a.type !== 'text') st.height = b.h * s + 'px'
  return st
}

const vb = (a: Annot) => {
  const b = bbox(a);
  return `${b.x} ${b.y} ${b.w} ${b.h}`
}
const ptsAttr = (a: Annot) => a.points.map(p => `${p.x},${p.y}`).join(' ')

function arrowHead(a: Annot) {
  const [p0, p1] = a.points
  if (!p0 || !p1) return ''
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x)
  const len = Math.max(10, a.width * 4)
  const sp = Math.PI / 7
  const l = {x: p1.x - len * Math.cos(ang - sp), y: p1.y - len * Math.sin(ang - sp)}
  const r = {x: p1.x - len * Math.cos(ang + sp), y: p1.y - len * Math.sin(ang + sp)}
  return `${l.x},${l.y} ${p1.x},${p1.y} ${r.x},${r.y}`
}

function textStyle(a: Annot) {
  return {
    fontSize: a.fontSize * scale.value + 'px',
    lineHeight: '1.2',
    color: a.color,
    opacity: String(a.opacity),
    fontFamily: fontFamily.value,
  }
}

function shapeStyle(a: Annot) {
  const st: Record<string, string> = {opacity: String(a.opacity)}
  if (a.type === 'highlight') {
    st.background = a.color;
    st.mixBlendMode = 'multiply'
  }
  if (a.type === 'rect' || a.type === 'ellipse') {
    st.border = `${a.width * scale.value}px solid ${a.color}`
    st.background = a.fill || 'transparent'
  }
  return st
}

function moveBy(a: Annot, dx: number, dy: number) {
  if (a.points.length) a.points = a.points.map(p => ({x: p.x + dx, y: p.y + dy}))
  else {
    a.x += dx;
    a.y += dy
  }
}

/* ───────────────────────── создание / взаимодействие ───────────────────────── */
function baseAnnot(type: Annot['type'], page: string): Annot {
  return {
    id: uid(), type, page, x: 0, y: 0, w: 0, h: 0,
    color: style.color, fill: type === 'rect' || type === 'ellipse' ? style.fill : '',
    width: style.width, opacity: style.opacity, fontSize: style.fontSize,
    text: '', points: [], src: '',
  }
}

function addAnnot(a: Annot): Annot {
  annots.value.push(a)
  return annots.value[annots.value.length - 1]
}

function ptFrom(e: PointerEvent, el: HTMLElement): Pt {
  const r = el.getBoundingClientRect()
  return {x: (e.clientX - r.left) / scale.value, y: (e.clientY - r.top) / scale.value}
}

let drag: Drag | null = null
let newTextId: string | null = null

function setTool(t: Tool) {
  endEditing()
  tool.value = t
  if (t !== 'select') selectedId.value = null
  const d = TOOL_DEFAULTS[t]
  if (d) Object.assign(style, d)
}

function onOverlayDown(e: PointerEvent, p: PageItem, idx: number) {
  if (e.button !== 0) return
  currentPageIdx.value = idx
  endEditing()
  const el = e.currentTarget as HTMLElement
  const pt = ptFrom(e, el)
  if (tool.value === 'select') {
    selectedId.value = null;
    return
  }
  selectedId.value = null

  if (tool.value === 'text') {
    createText(p, pt);
    return
  }

  const before = serialize()
  const a = baseAnnot(tool.value as Annot['type'], p.id)
  if (tool.value === 'pen') a.points = [pt]
  else if (tool.value === 'arrow') a.points = [pt, {...pt}]
  else {
    a.x = pt.x;
    a.y = pt.y
  }
  const ra = addAnnot(a)
  drag = {kind: 'create', el, id: ra.id, start: pt, before, moved: false}
  bindDrag()
}

function createText(p: PageItem, pt: Pt) {
  pushUndo(serialize())
  const a = baseAnnot('text', p.id)
  a.x = pt.x;
  a.y = pt.y;
  a.w = 220;
  a.h = a.fontSize * 1.2
  const ra = addAnnot(a)
  newTextId = ra.id
  selectedId.value = ra.id
  editingId.value = ra.id
  tool.value = 'select'
}

function onAnnotDown(e: PointerEvent, a: Annot) {
  if (e.button !== 0 || editingId.value === a.id) return
  endEditing()
  selectedId.value = a.id
  const el = (e.currentTarget as HTMLElement).closest('.page-overlay') as HTMLElement
  drag = {
    kind: 'move', el, id: a.id, start: ptFrom(e, el), before: serialize(), moved: false,
    orig: {x: a.x, y: a.y, w: a.w, h: a.h, points: a.points.map(p => ({...p}))},
  }
  bindDrag()
}

function startHandle(e: PointerEvent, a: Annot, hn: string) {
  if (e.button !== 0) return
  const el = (e.currentTarget as HTMLElement).closest('.page-overlay') as HTMLElement
  const textBox = a.type === 'text' ? textHeight(a) : a.h
  drag = {
    kind: hn.startsWith('p') ? 'handle' : 'resize', el, id: a.id, handle: hn,
    start: ptFrom(e, el), before: serialize(), moved: false,
    orig: {x: a.x, y: a.y, w: a.w, h: textBox, points: a.points.map(p => ({...p}))},
  }
  bindDrag()
}

function textHeight(a: Annot) {
  const el = document.querySelector(`[data-aid="${a.id}"]`) as HTMLElement | null
  return el ? el.offsetHeight / scale.value : a.h
}

function bindDrag() {
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function unbindDrag() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  if (!drag) return
  const a = annots.value.find(x => x.id === drag!.id)
  if (!a) return
  const pt = ptFrom(e, drag.el)
  const dx = pt.x - drag.start.x, dy = pt.y - drag.start.y
  if (Math.abs(dx) + Math.abs(dy) > 0.5) drag.moved = true

  if (drag.kind === 'create') {
    if (a.type === 'pen') {
      const last = a.points[a.points.length - 1]
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.6) a.points.push(pt)
    } else if (a.type === 'arrow') {
      a.points[1] = pt
    } else {
      a.x = Math.min(drag.start.x, pt.x);
      a.y = Math.min(drag.start.y, pt.y)
      a.w = Math.abs(dx);
      a.h = Math.abs(dy)
    }
    return
  }
  const o = drag.orig!
  if (drag.kind === 'move') {
    if (a.points.length) a.points = o.points.map(p => ({x: p.x + dx, y: p.y + dy}))
    else {
      a.x = o.x + dx;
      a.y = o.y + dy
    }
  } else if (drag.kind === 'handle') {
    a.points[Number(drag.handle!.slice(1))] = pt
  } else {
    const hn = drag.handle!
    if (a.type === 'text') {
      a.w = Math.max(40, o.w + dx);
      return
    }
    let {x, y, w, h} = o
    if (hn.includes('e')) w = o.w + dx
    if (hn.includes('s')) h = o.h + dy
    if (hn.includes('w')) {
      w = o.w - dx;
      x = o.x + dx
    }
    if (hn.includes('n')) {
      h = o.h - dy;
      y = o.y + dy
    }
    if (a.type === 'image' || a.type === 'stamp') {
      const ratio = o.w / o.h
      const nw = Math.max(12, w), nh = nw / ratio
      if (hn.includes('w')) x = o.x + o.w - nw
      if (hn.includes('n')) y = o.y + o.h - nh
      w = nw;
      h = nh
    } else {
      if (w < 4) {
        if (hn.includes('w')) x = o.x + o.w - 4;
        w = 4
      }
      if (h < 4) {
        if (hn.includes('n')) y = o.y + o.h - 4;
        h = 4
      }
    }
    a.x = x;
    a.y = y;
    a.w = w;
    a.h = h
  }
}

function onDragEnd() {
  unbindDrag()
  const d = drag
  drag = null
  if (!d) return
  const a = annots.value.find(x => x.id === d.id)
  if (!a) return

  if (d.kind === 'create') {
    if (a.type === 'pen') {
      if (a.points.length < 2) a.points.push({x: a.points[0].x + 0.01, y: a.points[0].y})
    } else if (a.type !== 'arrow' && a.w < 3 && a.h < 3) {
      annots.value = annots.value.filter(x => x.id !== a.id)
      return
    } else if (a.type === 'arrow' && Math.hypot(a.points[1].x - a.points[0].x, a.points[1].y - a.points[0].y) < 4) {
      annots.value = annots.value.filter(x => x.id !== a.id)
      return
    }
    pushUndo(d.before)
    if (a.type === 'pen' || a.type === 'highlight') selectedId.value = null
    else {
      selectedId.value = a.id;
      tool.value = 'select'
    }
    return
  }
  if (d.moved) pushUndo(d.before)
}

function onAnnotDbl(a: Annot) {
  if (a.type !== 'text') return
  snapshot()
  selectedId.value = a.id
  editingId.value = a.id
}

function endEditing() {
  const id = editingId.value
  if (!id) return
  const a = annots.value.find(x => x.id === id)
  editingId.value = null
  if (a && !a.text.trim()) {
    annots.value = annots.value.filter(x => x.id !== id)
    selectedId.value = null
    if (newTextId === id) undoStack.value.pop()
  }
  newTextId = null
}

const focusEl = (el: any) => {
  if (!el) return
  nextTick(() => {
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    autoGrow(el)
  })
}

function autoGrow(el: any) {
  const t = (el?.target ?? el) as HTMLTextAreaElement
  t.style.height = 'auto'
  t.style.height = t.scrollHeight + 'px'
}

function removeSelected() {
  if (!selectedId.value) return
  snapshot()
  annots.value = annots.value.filter(a => a.id !== selectedId.value)
  selectedId.value = null
}

function duplicateSelected() {
  const a = selected.value
  if (!a) return
  snapshot()
  const c: Annot = JSON.parse(JSON.stringify(a))
  c.id = uid()
  moveBy(c, 14, 14)
  const ra = addAnnot(c)
  selectedId.value = ra.id
}

/* свойства */
let propEditing = false

function beginProp() {
  if (propEditing) return;
  propEditing = true;
  if (selected.value) snapshot()
}

function endProp() {
  propEditing = false
}

function setProp(k: 'color' | 'fill' | 'width' | 'opacity' | 'fontSize', v: any) {
  const a = selected.value
  if (a) (a as any)[k] = v
  else (style as any)[k] = v
}

const onColor = (e: Event) => setProp('color', (e.target as HTMLInputElement).value)
const onFillColor = (e: Event) => setProp('fill', (e.target as HTMLInputElement).value)
const onNum = (k: 'width' | 'opacity' | 'fontSize', e: Event) => setProp(k, Number((e.target as HTMLInputElement).value))

function pickColor(c: string) {
  beginProp();
  setProp('color', c);
  endProp()
}

function toggleFill() {
  beginProp()
  setProp('fill', propView.value.fill ? '' : '#fde68a')
  endProp()
}

/* ───────────────────────── страницы ───────────────────────── */
function pageHasAnnots(p: PageItem) {
  return annots.value.some(a => a.page === p.id)
}

function rotatePage(i: number, dir: number) {
  const p = pages.value[i]
  if (pageHasAnnots(p)) {
    notify('На странице есть пометки. Поверните страницу до их добавления.');
    return
  }
  snapshot()
  p.rotate = (p.rotate + dir + 360) % 360
  nextTick(renderVisible)
}

function deletePage(i: number) {
  if (pages.value.length <= 1) {
    notify('Нельзя удалить единственную страницу');
    return
  }
  snapshot()
  const [p] = pages.value.splice(i, 1)
  annots.value = annots.value.filter(a => a.page !== p.id)
  selectedId.value = null
}

function movePage(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= pages.value.length) return
  snapshot()
  const arr = pages.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

function addBlankPage(i: number) {
  const ref0 = pages.value[i]
  snapshot()
  pages.value.splice(i + 1, 0, {id: uid(), src: 0, rotate: 0, w: dispW(ref0), h: dispH(ref0)})
}

/* ───────────────────────── картинки / штампы / подпись ───────────────────────── */
function currentPage(): PageItem | undefined {
  return pages.value[currentPageIdx.value] ?? pages.value[0]
}

function placeImage(url: string, natW: number, natH: number, type: 'image' | 'stamp', targetW?: number) {
  const p = currentPage()
  if (!p) return
  snapshot()
  const w = Math.min(targetW ?? natW, dispW(p) * 0.6)
  const h = w * natH / natW
  const id = uid()
  assets.set(id, url)
  const a = baseAnnot(type, p.id)
  a.src = id;
  a.w = w;
  a.h = h
  a.x = (dispW(p) - w) / 2
  a.y = Math.max(10, (dispH(p) - h) / 2)
  const ra = addAnnot(a)
  tool.value = 'select'
  selectedId.value = ra.id
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

async function addImageFile(file: File) {
  try {
    const objUrl = URL.createObjectURL(file)
    const img = await loadImg(objUrl)
    const maxDim = 2400
    const isJpeg = file.type === 'image/jpeg'
    let data: string
    if ((isJpeg || file.type === 'image/png') && Math.max(img.width, img.height) <= maxDim) {
      data = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(file)
      })
    } else {
      const k = Math.min(1, maxDim / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      data = c.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', 0.9)
    }
    URL.revokeObjectURL(objUrl)
    placeImage(data, img.width, img.height, 'image', 240)
  } catch {
    notify('Не удалось загрузить изображение')
  }
}

function pickImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) addImageFile(f)
  }
  input.click()
}

function makeStamp(label: string, color: string) {
  const S = 2
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const date = new Date().toLocaleDateString('ru-RU')
  ctx.font = `bold ${64 * S}px Arial, sans-serif`
  const tw = ctx.measureText(label).width
  const pad = 36 * S
  const W = Math.ceil(tw + pad * 2), H = 180 * S
  c.width = W;
  c.height = H
  ctx.strokeStyle = color;
  ctx.fillStyle = color
  ctx.lineWidth = 5 * S
  ctx.beginPath();
  ctx.roundRect(6 * S, 6 * S, W - 12 * S, H - 12 * S, 18 * S);
  ctx.stroke()
  ctx.lineWidth = 2 * S
  ctx.beginPath();
  ctx.roundRect(16 * S, 16 * S, W - 32 * S, H - 32 * S, 12 * S);
  ctx.stroke()
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${24 * S}px 'Courier New', monospace`
  ctx.fillText(props.stampOrg, W / 2, 55 * S)
  ctx.font = `bold ${64 * S}px Arial, sans-serif`
  ctx.fillText(label, W / 2, 118 * S)
  ctx.font = `${24 * S}px 'Courier New', monospace`
  ctx.fillText(date, W / 2, 152 * S)
  return {url: c.toDataURL('image/png'), w: W, h: H}
}

function addStamp(s: { label: string; color: string }) {
  stampMenu.value = false
  const st = makeStamp(s.label, s.color)
  placeImage(st.url, st.w, st.h, 'stamp', 170)
}

/* подпись */
let sigDrawing = false
let sigBounds = {minX: 1e9, minY: 1e9, maxX: -1, maxY: -1}

function openSignature() {
  try {
    sigSaved.value = localStorage.getItem(SIG_KEY) || ''
  } catch {
    sigSaved.value = ''
  }
  sigOpen.value = true
  nextTick(clearSig)
}

function clearSig() {
  const c = sigCanvas.value
  if (!c) return
  c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
  sigBounds = {minX: 1e9, minY: 1e9, maxX: -1, maxY: -1}
}

function sigPos(e: PointerEvent) {
  const c = sigCanvas.value!
  const r = c.getBoundingClientRect()
  return {x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height}
}

function sigDown(e: PointerEvent) {
  const c = sigCanvas.value!
  c.setPointerCapture(e.pointerId)
  sigDrawing = true
  const p = sigPos(e)
  const ctx = c.getContext('2d')!
  ctx.strokeStyle = sigColor.value;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round'
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + 0.1, p.y);
  ctx.stroke()
  trackSig(p)
}

function sigMove(e: PointerEvent) {
  if (!sigDrawing) return
  const ctx = sigCanvas.value!.getContext('2d')!
  const p = sigPos(e)
  ctx.lineTo(p.x, p.y);
  ctx.stroke()
  trackSig(p)
}

const sigUp = () => {
  sigDrawing = false
}

function trackSig(p: Pt) {
  sigBounds.minX = Math.min(sigBounds.minX, p.x);
  sigBounds.minY = Math.min(sigBounds.minY, p.y)
  sigBounds.maxX = Math.max(sigBounds.maxX, p.x);
  sigBounds.maxY = Math.max(sigBounds.maxY, p.y)
}

function applySignature() {
  const c = sigCanvas.value
  if (!c || sigBounds.maxX < 0) {
    notify('Сначала нарисуйте подпись');
    return
  }
  const pad = 8
  const x = Math.max(0, sigBounds.minX - pad), y = Math.max(0, sigBounds.minY - pad)
  const w = Math.min(c.width - x, sigBounds.maxX - sigBounds.minX + pad * 2)
  const hh = Math.min(c.height - y, sigBounds.maxY - sigBounds.minY + pad * 2)
  const out = document.createElement('canvas')
  out.width = w;
  out.height = hh
  out.getContext('2d')!.drawImage(c, x, y, w, hh, 0, 0, w, hh)
  const url = out.toDataURL('image/png')
  try {
    localStorage.setItem(SIG_KEY, url)
  } catch { /* ignore */
  }
  sigOpen.value = false
  placeImage(url, w, hh, 'image', 150)
}

async function useSavedSignature() {
  if (!sigSaved.value) return
  const img = await loadImg(sigSaved.value)
  sigOpen.value = false
  placeImage(sigSaved.value, img.width, img.height, 'image', 150)
}

/* ───────────────────────── экспорт (pdf-lib) ───────────────────────── */
function dataUrlToBytes(d: string): Uint8Array {
  const bin = atob(d.split(',')[1])
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}

function wrapText(text: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('');
      continue
    }
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue
      if (measure(line + word) <= maxW || line === '') {
        if (line === '' && measure(word) > maxW) {
          let chunk = ''
          for (const ch of word) {
            if (measure(chunk + ch) > maxW && chunk) {
              out.push(chunk);
              chunk = ch
            } else chunk += ch
          }
          line = chunk
        } else line += word
      } else {
        out.push(line.trimEnd())
        line = word.trimStart()
      }
    }
    out.push(line)
  }
  return out
}

async function buildPdf(): Promise<Uint8Array> {
  if (!originalBytes) throw new Error('no document')
  const lib = await import('pdf-lib')
  const {
    PDFDocument,
    rgb,
    degrees,
    pushGraphicsState,
    popGraphicsState,
    concatTransformationMatrix,
    BlendMode,
    LineCapStyle
  } = lib
  const fontkit = (await import('@pdf-lib/fontkit')).default

  const src = await PDFDocument.load(originalBytes, {ignoreEncryption: true})
  const out = await PDFDocument.create()
  out.registerFontkit(fontkit)

  let font: any = null
  if (fontBytes && annots.value.some(a => a.type === 'text')) {
    try {
      font = await out.embedFont(fontBytes, {subset: true})
    } catch {
      font = null
    }
  }
  const hex = (c: string) => {
    const n = parseInt(c.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  }
  const imgCache = new Map<string, any>()

  for (const p of pages.value) {
    let page: any
    if (p.src === 0) page = out.addPage([p.w, p.h])
    else {
      const [cp] = await out.copyPages(src, [p.src - 1])
      page = out.addPage(cp)
    }
    const orig = p.src === 0 ? 0 : page.getRotation().angle
    const total = (((orig + p.rotate) % 360) + 360) % 360
    if (p.rotate) page.setRotation(degrees(total))

    const list = annots.value.filter(a => a.page === p.id)
    if (!list.length) continue

    const box = page.getCropBox()
    const w0 = box.width, h0 = box.height
    const Hd = total % 180 ? w0 : h0
    const M: number[] =
        total === 0 ? [1, 0, 0, 1, 0, 0]
            : total === 90 ? [0, 1, -1, 0, w0, 0]
                : total === 180 ? [-1, 0, 0, -1, w0, h0]
                    : [0, -1, 1, 0, 0, h0]
    M[4] += box.x;
    M[5] += box.y

    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(M[0], M[1], M[2], M[3], M[4], M[5]))

    for (const a of list) {
      const col = hex(a.color)
      if (a.type === 'highlight') {
        page.drawRectangle({
          x: a.x,
          y: Hd - a.y - a.h,
          width: a.w,
          height: a.h,
          color: col,
          opacity: a.opacity,
          blendMode: BlendMode.Multiply
        })
      } else if (a.type === 'rect') {
        const o: any = {
          x: a.x + a.width / 2, y: Hd - a.y - a.h + a.width / 2,
          width: Math.max(1, a.w - a.width), height: Math.max(1, a.h - a.width),
          borderColor: col, borderWidth: a.width, borderOpacity: a.opacity,
        }
        if (a.fill) {
          o.color = hex(a.fill);
          o.opacity = a.opacity
        }
        page.drawRectangle(o)
      } else if (a.type === 'ellipse') {
        const o: any = {
          x: a.x + a.w / 2, y: Hd - a.y - a.h / 2,
          xScale: Math.max(1, (a.w - a.width) / 2), yScale: Math.max(1, (a.h - a.width) / 2),
          borderColor: col, borderWidth: a.width, borderOpacity: a.opacity,
        }
        if (a.fill) {
          o.color = hex(a.fill);
          o.opacity = a.opacity
        }
        page.drawEllipse(o)
      } else if (a.type === 'pen') {
        const d = a.points.map((pt, i) => `${i ? 'L' : 'M'} ${pt.x} ${pt.y}`).join(' ')
        page.drawSvgPath(d, {
          x: 0,
          y: Hd,
          borderColor: col,
          borderWidth: a.width,
          borderOpacity: a.opacity,
          borderLineCap: LineCapStyle.Round
        })
      } else if (a.type === 'arrow') {
        const [p0, p1] = a.points
        const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x)
        const len = Math.max(10, a.width * 4), sp = Math.PI / 7
        const seg = (x1: number, y1: number, x2: number, y2: number) =>
            page.drawLine({
              start: {x: x1, y: Hd - y1},
              end: {x: x2, y: Hd - y2},
              thickness: a.width,
              color: col,
              opacity: a.opacity,
              lineCap: LineCapStyle.Round
            })
        seg(p0.x, p0.y, p1.x, p1.y)
        seg(p1.x, p1.y, p1.x - len * Math.cos(ang - sp), p1.y - len * Math.sin(ang - sp))
        seg(p1.x, p1.y, p1.x - len * Math.cos(ang + sp), p1.y - len * Math.sin(ang + sp))
      } else if (a.type === 'image' || a.type === 'stamp') {
        const data = assets.get(a.src)
        if (!data) continue
        let img = imgCache.get(a.src)
        if (!img) {
          const bytes = dataUrlToBytes(data)
          img = data.startsWith('data:image/png') ? await out.embedPng(bytes) : await out.embedJpg(bytes)
          imgCache.set(a.src, img)
        }
        page.drawImage(img, {x: a.x, y: Hd - a.y - a.h, width: a.w, height: a.h, opacity: a.opacity})
      } else if (a.type === 'text' && a.text.trim()) {
        let done = false
        if (font) {
          try {
            const size = a.fontSize
            const lines = wrapText(a.text, a.w, s => font.widthOfTextAtSize(s, size))
            lines.forEach(l => {
              if (l) font.widthOfTextAtSize(l, size)
            }) // проверка глифов до рисования
            lines.forEach((l, i) => {
              if (l) page.drawText(l, {
                x: a.x,
                y: Hd - a.y - size * 0.95 - i * size * 1.2,
                size,
                font,
                color: col,
                opacity: a.opacity
              })
            })
            done = true
          } catch {
            done = false
          }
        }
        if (!done) {
          const S = 3
          const c = document.createElement('canvas')
          const ctx = c.getContext('2d')!
          const fs = a.fontSize * S
          const fnt = `${fs}px ${fontFamily.value}`
          ctx.font = fnt
          const lines = wrapText(a.text, a.w * S, s => ctx.measureText(s).width)
          const lh = fs * 1.2
          c.width = Math.ceil(a.w * S)
          c.height = Math.max(2, Math.ceil(lines.length * lh))
          const c2 = c.getContext('2d')!
          c2.font = fnt;
          c2.fillStyle = a.color;
          c2.textBaseline = 'alphabetic'
          lines.forEach((l, i) => c2.fillText(l, 0, i * lh + fs * 0.95))
          const png = await out.embedPng(dataUrlToBytes(c.toDataURL('image/png')))
          page.drawImage(png, {
            x: a.x,
            y: Hd - a.y - c.height / S,
            width: a.w,
            height: c.height / S,
            opacity: a.opacity
          })
        }
      }
    }
    page.pushOperators(popGraphicsState())
  }
  return await out.save()
}

const outName = () => {
  const base = (displayName.value || 'document').replace(/\.pdf$/i, '')
  return `${base}-edited.pdf`
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url;
  a.download = name
  document.body.appendChild(a);
  a.click();
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (busy.value) return
  busy.value = true
  endEditing()
  try {
    return await fn()
  } catch (e) {
    console.error(e);
    notify('Не удалось собрать PDF')
  } finally {
    busy.value = false
  }
}

const downloadPdf = () => withBusy(async () => {
  const bytes = await buildPdf()
  downloadBlob(new Blob([bytes as BlobPart], {type: 'application/pdf'}), outName())
})

const saveDoc = () => withBusy(async () => {
  const bytes = await buildPdf()
  const blob = new Blob([bytes as BlobPart], {type: 'application/pdf'})
  emit('save', blob, outName())
  ignoreNext = null
  emit('update:modelValue', blob)
  notify('Изменения применены')
})

const printPdf = () => withBusy(async () => {
  const bytes = await buildPdf()
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], {type: 'application/pdf'}))
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  f.src = url
  f.onload = () => {
    f.contentWindow?.focus()
    f.contentWindow?.print()
    setTimeout(() => {
      URL.revokeObjectURL(url);
      f.remove()
    }, 60000)
  }
  document.body.appendChild(f)
})

/* ───────────────────────── клавиатура ───────────────────────── */
let editorActive = false

function onWinPointerDown(e: PointerEvent) {
  const t = e.target as HTMLElement
  editorActive = !!rootEl.value?.contains(t)
  if (!t.closest?.('.stamp-wrap')) stampMenu.value = false
}

function onKey(e: KeyboardEvent) {
  if (!editorActive || !hasDoc.value || sigOpen.value) return
  const t = e.target as HTMLElement
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  if (mod && k === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return
  }
  if (mod && k === 'y') {
    e.preventDefault();
    redo();
    return
  }
  if (mod && k === 's') {
    e.preventDefault();
    saveDoc();
    return
  }
  if (mod && k === 'd' && selected.value) {
    e.preventDefault();
    duplicateSelected();
    return
  }
  if (mod) return
  if ((k === 'delete' || k === 'backspace') && selected.value) {
    e.preventDefault();
    removeSelected();
    return
  }
  if (k === 'escape') {
    selectedId.value = null;
    setTool('select');
    return
  }
  if (selected.value && k.startsWith('arrow')) {
    e.preventDefault()
    const st = e.shiftKey ? 10 : 1
    snapshot()
    moveBy(selected.value, k === 'arrowleft' ? -st : k === 'arrowright' ? st : 0, k === 'arrowup' ? -st : k === 'arrowdown' ? st : 0)
    return
  }
  const map: Record<string, Tool> = {
    v: 'select',
    t: 'text',
    h: 'highlight',
    p: 'pen',
    r: 'rect',
    o: 'ellipse',
    a: 'arrow'
  }
  if (map[k]) setTool(map[k])
}

/* ───────────────────────── жизненный цикл ───────────────────────── */
onMounted(async () => {
  observer = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const id = (en.target as HTMLElement).dataset.pid
      if (!id) continue
      const s = stateOf(id)
      s.visible = en.isIntersecting
      if (en.isIntersecting) renderPage(id)
    }
  }, {root: scroller.value, rootMargin: '900px 0px'})
  window.addEventListener('pointerdown', onWinPointerDown, true)
  window.addEventListener('keydown', onKey)
  await ensureFont()
  if (props.modelValue) loadSource(props.modelValue)
})

onBeforeUnmount(() => {
  unbindDrag()
  observer?.disconnect()
  resetPageStates()
  pdfDoc?.destroy?.()
  window.removeEventListener('pointerdown', onWinPointerDown, true)
  window.removeEventListener('keydown', onKey)
  clearTimeout(zoomTimer);
  clearTimeout(toastTimer)
})

defineExpose({save: saveDoc, getPdf: buildPdf, download: downloadPdf})
</script>

<template>
  <div ref="rootEl" class="molo-pdf-editor" @dragover.prevent @drop.prevent="onDrop">
    <!-- ───── верхняя панель ───── -->
    <header class="topbar">
      <div class="tb-left">
        <button class="icon-btn" :class="{ active: showThumbs }" title="Миниатюры страниц" :disabled="!hasDoc"
                @click="showThumbs = !showThumbs">
          <UIMoloSticker name="sidebar"/>
        </button>
        <span class="badge">PDF РЕДАКТОР</span>
        <span class="file-name" :title="displayName">{{ displayName }}</span>
      </div>

      <div v-if="hasDoc" class="tb-center">
        <div class="pill">
          <button class="icon-btn" title="Отдалить" @click="zoomOut">
            <UIMoloSticker name="zoom-out"/>
          </button>
          <span class="zoom-val" title="Сбросить до 100%" @click="zoom = 100">{{ zoom }}%</span>
          <button class="icon-btn" title="Приблизить" @click="zoomIn">
            <UIMoloSticker name="zoom-in"/>
          </button>
          <button class="icon-btn" title="По ширине" @click="fitWidth()">
            <UIMoloSticker name="fit"/>
          </button>
        </div>
        <div class="pill">
          <input class="page-input" type="number" min="1" :max="pages.length" :value="currentPageIdx + 1"
                 @change="gotoPage"/>
          <span class="dim">из {{ pages.length }}</span>
        </div>
      </div>

      <div class="tb-right">
        <template v-if="hasDoc">
          <div class="btn-group">
            <UIMoloButton class="icon-btn small" title="Отменить (Ctrl+Z)" :disabled="!undoStack.length" @click="undo">
              <UIMoloSticker name="undo"/>
            </UIMoloButton>
            <UIMoloButton class="icon-btn small" title="Повторить (Ctrl+Y)" :disabled="!redoStack.length" @click="redo">
              <UIMoloSticker name="redo"/>
            </UIMoloButton>
          </div>
            <span class="sep"/>
          <div class="btn-group">
            <UIMoloButton class="icon-btn small" title="Печать" :disabled="busy" @click="printPdf">
              <UIMoloSticker name="print"/>
            </UIMoloButton>
            <UIMoloButton class="icon-btn small" title="Скачать PDF" :disabled="busy" @click="downloadPdf">
              <UIMoloSticker name="download"/>
            </UIMoloButton>
          </div>
        </template>
        <UIMoloButton class="icon-btn small" title="Открыть другой PDF" @click="openFileDialog">
          <UIMoloSticker name="folder"/>
        </UIMoloButton>
        <UIMoloButton v-if="hasDoc" class="confirm small" :disabled="busy" title="Применить изменения (Ctrl+S)"
                @click="saveDoc">
          <UIMoloSticker name="save"/>
          {{ busy ? 'Сборка…' : 'Сохранить' }}
        </UIMoloButton>
      </div>
    </header>

    <!-- ───── инструменты ───── -->
    <div v-if="hasDoc" class="toolbar">
      <UIMoloButton
          v-for="t in TOOLS" :key="t.id" class="tool small" :class="{ confirm: tool === t.id }"
          :title="`${t.label} (${t.key})`" @click="setTool(t.id)"
      >
        <UIMoloSticker :name="t.icon" :size="18"/>
        <span>{{ t.label }}</span>
      </UIMoloButton>
      <span class="sep"/>
      <UIMoloButton class="tool small" title="Вставить изображение" @click="pickImage">
        <UIMoloSticker name="image" :size="18"/>
        <span>Картинка</span></UIMoloButton>
      <UIMoloButton class="tool small" title="Нарисовать подпись" @click="openSignature">
        <UIMoloSticker name="signature" :size="18"/>
        <span>Подпись</span></UIMoloButton>
      <div class="stamp-wrap">
        <UIMoloButton class="tool small" :class="{ confirm: stampMenu }" title="Штампы" @click="stampMenu = !stampMenu">
          <UIMoloSticker name="stamp" :size="18"/>
          <span>Штамп</span>
        </UIMoloButton>
        <div v-if="stampMenu" class="menu">
          <button v-for="s in STAMPS" :key="s.label" class="menu-item" @click="addStamp(s)">
            <i class="dot" :style="{ background: s.color }"/>{{ s.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- ───── свойства ───── -->
    <div v-if="hasDoc && showProps" class="propbar">
      <template v-if="activeType !== 'image' && activeType !== 'stamp'">
        <div class="field">
          <span class="lbl">Цвет</span>
          <div class="swatches">
            <button
                v-for="c in PALETTE" :key="c" class="swatch" :class="{ on: propView.color.toLowerCase() === c }"
                :style="{ background: c }" @click="pickColor(c)"
            />
            <input type="color" class="color-input" :value="propView.color" @pointerdown="beginProp" @input="onColor"
                   @change="endProp"/>
          </div>
        </div>
      </template>

      <div v-if="activeType === 'rect' || activeType === 'ellipse'" class="field">
        <span class="lbl">Заливка</span>
        <label class="check"><input type="checkbox" :checked="!!propView.fill" @change="toggleFill"/></label>
        <input v-if="propView.fill" type="color" class="color-input" :value="propView.fill" @pointerdown="beginProp"
               @input="onFillColor" @change="endProp"/>
      </div>

      <div v-if="['pen', 'rect', 'ellipse', 'arrow'].includes(activeType)" class="field">
        <span class="lbl">Толщина</span>
        <input type="range" min="1" max="20" step="1" :value="propView.width" @pointerdown="beginProp"
               @input="onNum('width', $event)" @change="endProp"/>
        <span class="val">{{ propView.width }}</span>
      </div>

      <div v-if="activeType === 'text'" class="field">
        <span class="lbl">Размер</span>
        <input type="range" min="8" max="72" step="1" :value="propView.fontSize" @pointerdown="beginProp"
               @input="onNum('fontSize', $event)" @change="endProp"/>
        <span class="val">{{ propView.fontSize }}</span>
      </div>

      <div class="field">
        <span class="lbl">Прозрачность</span>
        <input type="range" min="0.1" max="1" step="0.05" :value="propView.opacity" @pointerdown="beginProp"
               @input="onNum('opacity', $event)" @change="endProp"/>
        <span class="val">{{ Math.round(propView.opacity * 100) }}%</span>
      </div>

      <div v-if="selected" class="field push">
        <button class="icon-btn" title="Дублировать (Ctrl+D)" @click="duplicateSelected">
          <UIMoloSticker name="copy"/>
        </button>
        <button class="icon-btn danger" title="Удалить (Del)" @click="removeSelected">
          <UIMoloSticker name="trash"/>
        </button>
      </div>
    </div>

    <!-- ───── рабочая область ───── -->
    <div class="body">
      <aside v-if="hasDoc && showThumbs" class="thumbs">
        <div
            v-for="(p, i) in pages" :key="p.id" class="thumb" :class="{ active: i === currentPageIdx }"
            @click="scrollToPage(i)"
        >
          <div class="thumb-img" :style="{ aspectRatio: dispW(p) + ' / ' + dispH(p) }">
            <canvas :key="p.id + '-' + p.rotate" :ref="(el) => thumbRef(el, p)"/>
            <span v-if="pageHasAnnots(p)" class="thumb-mark" title="Есть пометки"/>
          </div>
          <div class="thumb-foot" @click.stop>
            <span class="thumb-num">{{ i + 1 }}</span>
            <div class="thumb-actions">
              <button class="mini" title="Повернуть влево" @click="rotatePage(i, -90)">
                <UIMoloSticker name="rotate-ccw" :size="13"/>
              </button>
              <button class="mini" title="Повернуть вправо" @click="rotatePage(i, 90)">
                <UIMoloSticker name="rotate-cw" :size="13"/>
              </button>
              <button class="mini" title="Выше" :disabled="i === 0" @click="movePage(i, -1)">
                <UIMoloSticker name="up" :size="13"/>
              </button>
              <button class="mini" title="Ниже" :disabled="i === pages.length - 1" @click="movePage(i, 1)">
                <UIMoloSticker name="down" :size="13"/>
              </button>
              <button class="mini" title="Пустая страница после этой" @click="addBlankPage(i)">
                <UIMoloSticker name="file-plus" :size="13"/>
              </button>
              <button class="mini danger" title="Удалить страницу" @click="deletePage(i)">
                <UIMoloSticker name="trash" :size="13"/>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div ref="scroller" class="scroller" @scroll="onScroll" @wheel="onWheel">
        <div v-if="hasDoc" class="pages">
          <div v-for="(p, i) in pages" :key="p.id" class="page-slot">
            <div
                class="page-sheet" :data-pid="p.id" :ref="(el) => setSheet(el, p.id)"
                :style="{ width: dispW(p) * scale + 'px', height: dispH(p) * scale + 'px' }"
            >
              <canvas v-if="p.src > 0" class="page-canvas" :ref="(el) => setCanvas(el, p.id)"/>

              <div class="page-overlay" :class="'tool-' + tool" @pointerdown="onOverlayDown($event, p, i)">
                <div
                    v-for="a in byPage[p.id] ?? []" :key="a.id"
                    class="annot" :class="['a-' + a.type, { sel: a.id === selectedId }]"
                    :data-aid="a.id" :style="boxStyle(a)"
                    @pointerdown.stop="onAnnotDown($event, a)" @dblclick.stop="onAnnotDbl(a)"
                >
                  <!-- текст -->
                  <template v-if="a.type === 'text'">
                    <textarea
                        v-if="editingId === a.id" v-model="a.text" class="text-edit"
                        :style="textStyle(a)" :ref="focusEl" placeholder="Введите текст"
                        @input="autoGrow" @keydown.esc.stop="endEditing" @blur="endEditing"
                    />
                    <div v-else class="text-view" :style="textStyle(a)">{{ a.text }}</div>
                  </template>

                  <!-- фигуры -->
                  <div v-else-if="a.type === 'highlight' || a.type === 'rect' || a.type === 'ellipse'"
                       class="shape" :class="{ round: a.type === 'ellipse' }" :style="shapeStyle(a)"/>

                  <!-- картинки -->
                  <img v-else-if="a.type === 'image' || a.type === 'stamp'" class="img" :src="assets.get(a.src)"
                       :style="{ opacity: a.opacity }" draggable="false"/>

                  <!-- линии -->
                  <svg v-else class="vec" :viewBox="vb(a)" preserveAspectRatio="none">
                    <polyline :points="ptsAttr(a)" fill="none" stroke="transparent"
                              :stroke-width="Math.max(a.width, 10)"
                              stroke-linecap="round" stroke-linejoin="round" class="hit"/>
                    <polyline :points="ptsAttr(a)" fill="none" :stroke="a.color" :stroke-width="a.width"
                              stroke-linecap="round" stroke-linejoin="round" :opacity="a.opacity"/>
                    <polyline v-if="a.type === 'arrow'" :points="arrowHead(a)" fill="none" :stroke="a.color"
                              :stroke-width="a.width" stroke-linecap="round" stroke-linejoin="round"
                              :opacity="a.opacity"/>
                  </svg>

                  <!-- ручки -->
                  <template v-if="a.id === selectedId && editingId !== a.id">
                    <template v-if="a.type === 'arrow'">
                      <i v-for="(pt, k) in a.points" :key="k" class="handle round-h"
                         :style="{ left: (pt.x - bbox(a).x) * scale + 'px', top: (pt.y - bbox(a).y) * scale + 'px' }"
                         @pointerdown.stop.prevent="startHandle($event, a, 'p' + k)"/>
                    </template>
                    <template v-else-if="a.type === 'text'">
                      <i class="handle h-e" @pointerdown.stop.prevent="startHandle($event, a, 'e')"/>
                    </template>
                    <template v-else-if="a.type !== 'pen'">
                      <i v-for="hn in ['nw', 'ne', 'sw', 'se']" :key="hn" class="handle" :class="'h-' + hn"
                         @pointerdown.stop.prevent="startHandle($event, a, hn)"/>
                    </template>
                  </template>
                </div>
              </div>
            </div>
            <div class="page-label">{{ i + 1 }}</div>
          </div>
        </div>

        <div v-else class="empty">
          <div v-if="loading" class="spinner"/>
          <template v-else>
            <UIMoloSticker name="folder" :size="44"/>
            <h3>PDF-файл не загружен</h3>
            <p>Перетащите файл в это окно или выберите его на компьютере</p>
            <button class="btn primary" @click="openFileDialog">Выбрать PDF-файл</button>
          </template>
        </div>
      </div>
    </div>

    <!-- ───── подпись ───── -->
    <div v-if="sigOpen" class="modal-back" @pointerdown.self="sigOpen = false">
      <div class="modal">
        <div class="modal-head">
          <b>Нарисуйте подпись</b>
          <button class="icon-btn" @click="sigOpen = false">
            <UIMoloSticker name="x"/>
          </button>
        </div>
        <canvas
            ref="sigCanvas" class="sig-pad" width="900" height="320"
            @pointerdown="sigDown" @pointermove="sigMove" @pointerup="sigUp" @pointercancel="sigUp"
        />
        <div class="modal-foot">
          <div class="swatches">
            <button v-for="c in ['#111827', '#1d4ed8', '#7c3aed']" :key="c" class="swatch"
                    :class="{ on: sigColor === c }"
                    :style="{ background: c }" @click="sigColor = c"/>
          </div>
          <span class="grow"/>
          <button v-if="sigSaved" class="btn" @click="useSavedSignature">Сохранённая</button>
          <button class="btn" @click="clearSig">Очистить</button>
          <button class="btn primary" @click="applySignature">Вставить</button>
        </div>
      </div>
    </div>

    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.molo-pdf-editor {
  --bg: #0d0d12;
  --panel: var(--half_opacity_bg, #171720);
  --border: var(--half_opacity_border, #2a2a38);
  --text: #e6e6f0;
  --dim: #8a8aa0;
  --accent: #2f80ed;
  --danger: #ef4444;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #141419;
  color: var(--text);
  overflow: hidden;
  position: relative;
  font-size: 13px;
  user-select: none;
}

/* верхняя панель */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 20;
}

.tb-left, .tb-center, .tb-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tb-left {
  flex: 1;
}

.tb-right {
  flex: 1;
  justify-content: flex-end;
}

.badge {
  background: #dc2626;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.file-name {
  font-size: 13px;
  color: #d1d1e0;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, .05);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.zoom-val {
  min-width: 44px;
  text-align: center;
  cursor: pointer;
  font-size: 12px;
}

.page-input {
  width: 44px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  text-align: center;
  padding: 2px;
  font-size: 12px;
}

.dim {
  color: var(--dim);
  font-size: 12px;
  padding-right: 4px;
}

.sep {
  width: 1px;
  height: 22px;
  background: var(--border);
  margin: 0 4px;
  flex-shrink: 0;
}

/* кнопки */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, .08);
}

.icon-btn.active {
  background: rgba(47, 128, 237, .2);
  color: #8ab8ff;
}

.icon-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, .18);
  color: #ff8a8a;
}

.icon-btn:disabled, .mini:disabled {
  opacity: .35;
  cursor: default;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, .05);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}

.btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, .1);
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.btn.primary:hover:not(:disabled) {
  background: #4390f5;
}

.btn:disabled {
  opacity: .6;
  cursor: default;
}

/* инструменты */
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  flex-wrap: wrap;
  background: #1b1b25;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 15;
}

.tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
}

.tool:hover {
  background: rgba(255, 255, 255, .07);
}

.tool.active {
  background: rgba(47, 128, 237, .22);
  border-color: rgba(47, 128, 237, .6);
  color: #b5d3ff;
}

.stamp-wrap {
  position: relative;
}

.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 190px;
  padding: 4px;
  z-index: 40;
  background: #1f1f2b;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .5);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: none;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  border-radius: 5px;
  font-size: 12px;
}

.menu-item:hover {
  background: rgba(255, 255, 255, .08);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

/* свойства */
.propbar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 6px 14px;
  flex-wrap: wrap;
  background: #16161e;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 14;
}

.field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field.push {
  margin-left: auto;
}

.lbl {
  color: var(--dim);
  font-size: 12px;
}

.val {
  min-width: 32px;
  font-size: 12px;
  color: var(--dim);
}

.swatches {
  display: flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .3);
  cursor: pointer;
  padding: 0;
}

.swatch.on {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.color-input {
  width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

input[type='range'] {
  width: 110px;
  accent-color: var(--accent);
}

.check input {
  accent-color: var(--accent);
}

/* рабочая область */
.body {
  flex: 1;
  display: flex;
  min-height: 0;
  background: var(--bg);
}

.thumbs {
  width: 168px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 12px 10px;
  background: #12121a;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.thumb {
  cursor: pointer;
  border-radius: 6px;
  padding: 6px;
  border: 1px solid transparent;
}

.thumb:hover {
  background: rgba(255, 255, 255, .04);
}

.thumb.active {
  border-color: var(--accent);
  background: rgba(47, 128, 237, .1);
}

.thumb-img {
  position: relative;
  background: #fff;
  width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .5);
}

.thumb-img canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.thumb-mark {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.thumb-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.thumb-num {
  font-size: 11px;
  color: var(--dim);
}

.thumb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: flex-end;
}

.mini {
  display: inline-flex;
  padding: 3px;
  background: transparent;
  border: none;
  color: var(--dim);
  cursor: pointer;
  border-radius: 4px;
}

.mini:hover:not(:disabled) {
  background: rgba(255, 255, 255, .1);
  color: #fff;
}

.mini.danger:hover:not(:disabled) {
  color: #ff8a8a;
}

.scroller {
  flex: 1;
  overflow: auto;
  padding: 24px 32px 80px;
  position: relative;
}

.pages {
  margin: 0 auto;
  width: max-content;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.page-label {
  font-size: 11px;
  color: var(--dim);
}

.page-sheet {
  position: relative;
  background: #fff;
  box-shadow: 0 4px 24px rgba(0, 0, 0, .6);
}

.page-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.page-overlay {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: pan-y;
}

.page-overlay.tool-text {
  cursor: text;
  touch-action: none;
}

.page-overlay:is(.tool-highlight, .tool-pen, .tool-rect, .tool-ellipse, .tool-arrow) {
  cursor: crosshair;
  touch-action: none;
}

.page-overlay:not(.tool-select) .annot, .page-overlay:not(.tool-select) .annot * {
  pointer-events: none !important;
}

/* аннотации */
.annot {
  position: absolute;
  touch-action: none;
}

.tool-select .annot {
  cursor: move;
}

.tool-select .annot:hover:not(.sel) {
  outline: 1px solid rgba(47, 128, 237, .55);
  outline-offset: 2px;
}

.annot.sel {
  outline: 1.5px dashed var(--accent);
  outline-offset: 2px;
}

.a-pen, .a-arrow {
  pointer-events: none;
}

.a-pen .hit, .a-arrow .hit {
  pointer-events: stroke;
}

.annot .shape {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.annot .shape.round {
  border-radius: 50%;
}

.annot .img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
  -webkit-user-drag: none;
}

.annot .vec {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.text-view, .text-edit {
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
  box-sizing: border-box;
  display: block;
  min-height: 1.2em;
  user-select: text;
}

.text-edit {
  resize: none;
  overflow: hidden;
  outline: none;
  cursor: text;
}

.text-edit::placeholder {
  color: rgba(100, 100, 120, .8);
}

.handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1.5px solid var(--accent);
  border-radius: 2px;
  transform: translate(-50%, -50%);
  z-index: 5;
  touch-action: none;
}

.handle.round-h {
  border-radius: 50%;
  width: 12px;
  height: 12px;
  cursor: crosshair;
}

.h-nw {
  left: 0;
  top: 0;
  cursor: nwse-resize;
}

.h-ne {
  left: 100%;
  top: 0;
  cursor: nesw-resize;
}

.h-sw {
  left: 0;
  top: 100%;
  cursor: nesw-resize;
}

.h-se {
  left: 100%;
  top: 100%;
  cursor: nwse-resize;
}

.h-e {
  left: 100%;
  top: 50%;
  cursor: ew-resize;
}

/* пусто */
.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6a6a7a;
  text-align: center;
}

.empty h3 {
  color: var(--text);
  margin: 0;
  font-size: 16px;
}

.empty p {
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
}

.spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, .12);
  border-top-color: var(--accent);
  animation: spin .8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* модалка подписи */
.modal-back {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 16px;
}

.modal {
  width: min(640px, 100%);
  background: #1b1b25;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .6);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.sig-pad {
  width: 100%;
  aspect-ratio: 900 / 320;
  background: #fff;
  border-radius: 6px;
  touch-action: none;
  cursor: crosshair;
  display: block;
  background-image: linear-gradient(transparent calc(100% - 56px), #cbd5e1 calc(100% - 56px), #cbd5e1 calc(100% - 55px), transparent calc(100% - 55px));
}

.modal-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.grow {
  flex: 1;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 80;
  background: #26263a;
  border: 1px solid var(--border);
  color: #fff;
  padding: 9px 16px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .5);
  font-size: 13px;
  max-width: 80%;
}

@media (max-width: 720px) {
  .tool span {
    display: none;
  }

  .thumbs {
    width: 120px;
  }

  .file-name {
    max-width: 110px;
  }

  .scroller {
    padding: 12px 8px 60px;
  }
}
</style>