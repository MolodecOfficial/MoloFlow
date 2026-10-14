<!-- components/apps/molo/MoloDocument.vue -->
<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { FontFamily, TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign
} from 'docx'
import { saveAs } from 'file-saver'
import mammoth from 'mammoth'
import wordIcon from '~~/app/assets/icons/word.svg'
import { useDirectoryInterpolator, type DirectoryLookupItem } from '~/composables/useDirectoryInterpolator'
import DirectorySuggestDropdown from '~/components/directory/DirectorySuggestDropdown.vue'

const props = defineProps<{
  modelValue?: string
  fileName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', html: string): void
  (e: 'resolve-variable', payload: { rawExpression: string; apply: (replacement: string) => void }): void
}>()

const interpolator = useDirectoryInterpolator()

// Геометрия листа А4 (210x297мм при 96dpi = 794x1123px)
const PAGE_W = 794
const PAGE_H = 1123
const MARGIN_V = 72
const PAGE_GAP = 24
const CONTENT_H = PAGE_H - MARGIN_V * 2

const pageCount = ref(1)
const wordCount = ref(0)
const charCount = ref(0)

/* ── Состояние плавающего окна саджеста ── */
const suggestDropdownRef = ref<InstanceType<typeof DirectorySuggestDropdown> | null>(null)
const suggestVisible = ref(false)
const suggestCoords = reactive({ x: 0, y: 0 })
const suggestQuery = ref('')
const allDirectoryItems = ref<DirectoryLookupItem[]>([])
let mentionActiveRange: { from: number; to: number } | null = null

onMounted(async () => {
  await interpolator.fetchDefinitions()
  allDirectoryItems.value = await interpolator.fetchAllDirectories()
})

/* ───────────────────────── Плагин перехвата {@...} в тексте ───────────────────────── */
const directoryMentionKey = new PluginKey('directoryMention')

const DirectoryMention = Extension.create({
  name: 'directoryMention',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: directoryMentionKey,
        props: {
          handleKeyDown(view, event) {
            if (!suggestVisible.value) return false
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
              suggestDropdownRef.value?.handleKeyDown(event)
              return true
            }
            return false
          },
          handleTextInput(view, from, to, text) {
            if (text === '}') {
              suggestVisible.value = false
              const { state } = view
              const $from = state.doc.resolve(from)
              const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc') + text

              const match = textBefore.match(/\{@[^}]+}$/)
              if (match) {
                const rawExpr = match[0]
                const matchStart = from - (rawExpr.length - 1)
                const matchEnd = to

                emit('resolve-variable', {
                  rawExpression: rawExpr,
                  apply: (replacement: string) => {
                    const tr = view.state.tr.replaceWith(
                        matchStart,
                        matchEnd + 1,
                        view.state.schema.text(replacement)
                    )
                    view.dispatch(tr)
                  }
                })
              }
            }
            return false
          }
        },
        view() {
          return {
            update(view) {
              const { state } = view
              const { selection } = state
              if (!selection.empty) {
                suggestVisible.value = false
                return
              }

              const $pos = selection.$from
              const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, undefined, '\ufffc')

              const match = textBefore.match(/\{@([^}]*)$/)
              if (match) {
                mentionActiveRange = {
                  from: $pos.start() + match.index!,
                  to: $pos.pos
                }
                suggestQuery.value = match[1] || ''

                const coords = view.coordsAtPos($pos.pos)
                suggestCoords.x = coords.left
                suggestCoords.y = coords.bottom
                suggestVisible.value = true
              } else {
                suggestVisible.value = false
                mentionActiveRange = null
              }
            }
          }
        }
      })
    ]
  }
})

function handleSuggestSelect(item: DirectoryLookupItem, fieldValue?: string) {
  if (!editor.value || !mentionActiveRange) return

  const { from, to } = mentionActiveRange
  const view = editor.value.view

  const textToInsert = fieldValue || item.title

  const tr = view.state.tr.replaceWith(
      from,
      to,
      view.state.schema.text(textToInsert)
  )
  view.dispatch(tr)

  suggestVisible.value = false
  mentionActiveRange = null
  view.focus()
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, any>) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any
  },
})

const Indent = Extension.create({
  name: 'indent',
  addOptions() { return { types: ['paragraph', 'heading'], min: 0, max: 8, stepPx: 24 } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el: HTMLElement) => {
            const px = parseInt(el.style.marginLeft || '0', 10)
            return px ? Math.round(px / this.options.stepPx) : 0
          },
          renderHTML: (attrs: Record<string, any>) => attrs.indent ? { style: `margin-left: ${attrs.indent * this.options.stepPx}px` } : {},
        },
      },
    }]
  },
  addCommands() {
    const applyDelta = (delta: number) => ({ tr, state, dispatch }: any) => {
      const { selection } = state
      let changed = false
      state.doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
        if (this.options.types.includes(node.type.name)) {
          const current = node.attrs.indent || 0
          const next = Math.min(this.options.max, Math.max(this.options.min, current + delta))
          if (next !== current) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
            changed = true
          }
        }
      })
      if (changed && dispatch) dispatch(tr)
      return changed
    }
    return {
      indent: () => applyDelta(1),
      outdent: () => applyDelta(-1),
    } as any
  },
})

/* ───────────────────────── Прецизионный плагин пагинации ───────────────────────── */
const pagerKey = new PluginKey<{ deco: DecorationSet; sig: string }>('moloPager')

const Pagination = Extension.create<{ onPages: (n: number) => void }>({
  name: 'pagination',
  addOptions() {
    return { onPages: () => {} }
  },
  addProseMirrorPlugins() {
    const onPages = this.options.onPages

    const breakEl = (height: number, bandTop: number) => () => {
      const el = document.createElement('div')
      el.className = 'molo-pb'
      el.setAttribute('contenteditable', 'false')
      el.style.height = `${height}px`
      el.style.pointerEvents = 'none'

      const band = document.createElement('div')
      band.className = 'molo-pb-band'
      band.style.top = `${bandTop}px`
      band.style.height = `${PAGE_GAP}px`
      el.appendChild(band)
      return el
    }

    const fillerEl = (height: number) => () => {
      const el = document.createElement('div')
      el.className = 'molo-pb-end'
      el.setAttribute('contenteditable', 'false')
      el.style.height = `${height}px`
      el.style.pointerEvents = 'none'
      return el
    }

    return [
      new Plugin({
        key: pagerKey,
        state: {
          init: () => ({ deco: DecorationSet.empty, sig: '' }),
          apply(tr, prev) {
            const meta = tr.getMeta(pagerKey)
            if (meta) return meta
            return tr.docChanged ? { deco: prev.deco.map(tr.mapping, tr.doc), sig: prev.sig } : prev
          },
        },
        props: {
          decorations: (state) => pagerKey.getState(state)?.deco,
        },
        view(view) {
          let raf = 0

          const run = () => {
            raf = 0
            const dom = view.dom as HTMLElement
            if (view.isDestroyed || !dom.isConnected || dom.offsetParent === null) return

            const { doc } = view.state

            interface UnitInfo {
              offset: number
              el: HTMLElement
              isHeading: boolean
            }

            const units: UnitInfo[] = []
            doc.forEach((node, offset) => {
              const el = view.nodeDOM(offset) as HTMLElement | null
              if (el && el.nodeType === 1) {
                units.push({
                  offset,
                  el,
                  isHeading: node.type.name === 'heading'
                })
              }
            })

            if (!units.length) {
              onPages(1)
              return
            }

            let currentBudget = CONTENT_H
            let pages = 1
            const breaks: { offset: number; height: number; bandTop: number }[] = []
            let prevMarginBottom = 0

            for (let i = 0; i < units.length; i++) {
              const unit = units[i]
              const cs = window.getComputedStyle(unit.el)
              const mt = parseFloat(cs.marginTop) || 0
              const mb = parseFloat(cs.marginBottom) || 0

              const effectiveMarginTop = i === 0 ? mt : Math.max(mt, prevMarginBottom)
              const selfHeight = unit.el.getBoundingClientRect().height
              const blockTotalHeight = Math.round(selfHeight + effectiveMarginTop)
              prevMarginBottom = mb

              let requiredSpace = blockTotalHeight
              if (unit.isHeading && i < units.length - 1) {
                requiredSpace += 40
              }

              if (i > 0 && requiredSpace > currentBudget) {
                const remainingSpace = Math.max(0, Math.round(currentBudget))
                const breakHeight = remainingSpace + MARGIN_V + PAGE_GAP + MARGIN_V

                breaks.push({
                  offset: unit.offset,
                  height: breakHeight,
                  bandTop: MARGIN_V + remainingSpace
                })

                pages++
                currentBudget = CONTENT_H - Math.round(selfHeight)
                prevMarginBottom = mb
              } else {
                currentBudget -= blockTotalHeight
              }
            }

            const filler = Math.max(0, Math.round(currentBudget))
            const sig = `${breaks.map(b => `${b.offset}:${b.height}`).join('|')}#${filler}#${pages}`

            if (pagerKey.getState(view.state)?.sig === sig) return

            const decos = breaks.map((b, idx) =>
                Decoration.widget(b.offset, breakEl(b.height, b.bandTop), {
                  side: -1,
                  key: `pb_${idx}_${b.height}`,
                  ignoreSelection: true,
                })
            )

            if (filler > 0) {
              decos.push(
                  Decoration.widget(doc.content.size, fillerEl(filler), {
                    side: 1,
                    key: `pf_${filler}`,
                    ignoreSelection: true,
                  })
              )
            }

            view.dispatch(
                view.state.tr
                    .setMeta(pagerKey, { deco: DecorationSet.create(doc, decos), sig })
                    .setMeta('addToHistory', false)
            )

            onPages(pages)
          }

          const schedule = () => {
            if (!raf) raf = requestAnimationFrame(run)
          }

          const ro = new ResizeObserver(schedule)
          ro.observe(view.dom)
          schedule()

          return {
            update: schedule,
            destroy() {
              cancelAnimationFrame(raf)
              ro.disconnect()
            },
          }
        },
      }),
    ]
  },
})

const PX_PER_CM = PAGE_W / 21
const CM_COUNT = 21

const margins = reactive({ left: 70, right: 70 })
const rulerTicks = Array.from({ length: CM_COUNT + 1 }, (_, i) => i)

let dragging: 'left' | 'right' | null = null
let rulerEl: HTMLElement | null = null

function setRulerEl(el: Element | null) { rulerEl = el as HTMLElement | null }
function startDrag(side: 'left' | 'right', ev: MouseEvent) {
  dragging = side
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
  ev.preventDefault()
}
function onDrag(ev: MouseEvent) {
  if (!dragging || !rulerEl) return
  const rect = rulerEl.getBoundingClientRect()
  const x = ev.clientX - rect.left
  if (dragging === 'left') margins.left = Math.round(Math.min(250, Math.max(24, x)))
  else margins.right = Math.round(Math.min(250, Math.max(24, PAGE_W - x)))
}
function stopDrag() {
  dragging = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

const pageStyle = computed(() => ({
  paddingLeft: `${margins.left}px`,
  paddingRight: `${margins.right}px`,
  paddingTop: `${MARGIN_V}px`,
  paddingBottom: `${MARGIN_V}px`,
  '--ml': `${margins.left}px`,
  '--mr': `${margins.right}px`,
}))

/* ───────────────────────── Экспорт в DOCX ───────────────────────── */
interface InlineStyleState {
  bold?: boolean
  italics?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
}

function parseInlineRuns(element: Node, defaultOverrides?: { size?: number; color?: string; bold?: boolean }): TextRun[] {
  const runs: TextRun[] = []

  function walk(node: Node, state: InlineStyleState) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text) {
        runs.push(new TextRun({
          text,
          bold: defaultOverrides?.bold ?? state.bold,
          italics: state.italics,
          underline: state.underline ? {} : undefined,
          strike: state.strike,
          font: 'Arial',
          size: defaultOverrides?.size ?? 21,
          color: defaultOverrides?.color ?? state.color ?? '111111'
        }))
      }
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()

      const nextState: InlineStyleState = { ...state }
      if (tag === 'b' || tag === 'strong' || el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight, 10) >= 600) {
        nextState.bold = true
      }
      if (tag === 'i' || tag === 'em' || el.style.fontStyle === 'italic') {
        nextState.italics = true
      }
      if (tag === 'u' || el.style.textDecoration?.includes('underline')) {
        nextState.underline = true
      }
      if (tag === 's' || tag === 'strike' || el.style.textDecoration?.includes('line-through')) {
        nextState.strike = true
      }
      if (el.style.color) {
        const hex = el.style.color.replace('#', '')
        if (hex.length === 6) nextState.color = hex
      }

      el.childNodes.forEach(child => walk(child, nextState))
    }
  }

  walk(element, {})
  return runs.length ? runs : [new TextRun({ text: '', size: defaultOverrides?.size ?? 21 })]
}

function htmlToDocxElements(bodyEl: HTMLElement): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = []

  Array.from(bodyEl.children).forEach(child => {
    const el = child as HTMLElement
    const tag = el.tagName.toLowerCase()

    let alignment = AlignmentType.LEFT
    const align = el.style.textAlign
    if (align === 'center') alignment = AlignmentType.CENTER
    if (align === 'right') alignment = AlignmentType.RIGHT
    if (align === 'justify') alignment = AlignmentType.JUSTIFIED

    if (tag === 'h1') {
      elements.push(new Paragraph({
        children: parseInlineRuns(el, { size: 44, bold: true, color: '000000' }),
        alignment,
        spacing: { before: 240, after: 100 }
      }))
    } else if (tag === 'h2') {
      elements.push(new Paragraph({
        children: parseInlineRuns(el, { size: 32, bold: true, color: '000000' }),
        alignment,
        spacing: { before: 200, after: 60 }
      }))
    } else if (tag === 'h3') {
      elements.push(new Paragraph({
        children: parseInlineRuns(el, { size: 26, bold: true, color: '000000' }),
        alignment,
        spacing: { before: 160, after: 50 }
      }))
    } else if (tag === 'blockquote') {
      elements.push(new Paragraph({
        children: parseInlineRuns(el, { size: 21, color: '555555' }),
        alignment,
        indent: { left: 400 },
        borders: {
          left: { style: BorderStyle.SINGLE, size: 24, color: '2B7DE9', space: 12 }
        },
        spacing: { before: 120, after: 120 }
      }))
    } else if (tag === 'p') {
      elements.push(new Paragraph({
        children: parseInlineRuns(el),
        alignment,
        spacing: { after: 70 }
      }))
    } else if (tag === 'ul') {
      Array.from(el.children).forEach(li => {
        elements.push(new Paragraph({
          children: parseInlineRuns(li),
          bullet: { level: 0 },
          spacing: { after: 35 }
        }))
      })
    } else if (tag === 'ol') {
      Array.from(el.children).forEach((li, idx) => {
        elements.push(new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. `, bold: true, font: 'Arial', size: 21, color: '111111' }),
            ...parseInlineRuns(li)
          ],
          indent: { left: 360 },
          spacing: { after: 35 }
        }))
      })
    } else if (tag === 'table') {
      const rows: TableRow[] = []
      const trList = el.querySelectorAll('tr')

      trList.forEach(tr => {
        const cells: TableCell[] = []
        Array.from(tr.children).forEach((cellEl, cellIdx) => {
          const cell = cellEl as HTMLTableCellElement
          const colSpan = parseInt(cell.getAttribute('colspan') || '1', 10)
          const rowSpan = parseInt(cell.getAttribute('rowspan') || '1', 10)

          let widthPct = 25
          if (colSpan >= 3) widthPct = 100
          else if (cellIdx === 1) widthPct = 50

          cells.push(new TableCell({
            children: [
              new Paragraph({
                children: parseInlineRuns(cell),
                spacing: { after: 30, before: 30 }
              })
            ],
            columnSpan: colSpan > 1 ? colSpan : undefined,
            rowSpan: rowSpan > 1 ? rowSpan : undefined,
            width: { size: widthPct, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '777777' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '777777' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '777777' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '777777' },
            },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
          }))
        })

        if (cells.length) {
          rows.push(new TableRow({ children: cells, cantSplit: true }))
        }
      })

      if (rows.length) {
        elements.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows,
        }))
        elements.push(new Paragraph({ spacing: { after: 80 } }))
      }
    }
  })

  return elements
}

async function exportToDocx() {
  if (!editor.value) return

  const rawHtml = editor.value.getHTML()
  const parsed = new DOMParser().parseFromString(`<body>${rawHtml}</body>`, 'text/html')
  parsed.querySelectorAll('.molo-pb, .molo-pb-band, .molo-pb-end').forEach(el => el.remove())

  try {
    const docChildren = htmlToDocxElements(parsed.body)
    const doc = new DocxDocument({
      sections: [{
        properties: {
          page: {
            margin: { top: 1020, bottom: 1020, left: 1020, right: 1020 },
          },
        },
        children: docChildren,
      }],
    })

    const blob = await Packer.toBlob(doc)
    const fileName = (props.fileName || 'document').replace(/\.[^.]+$/, '')
    saveAs(blob, `${fileName}.docx`)
  } catch (err) {
    console.error('Ошибка экспорта в Word:', err)
  }
}

function triggerWordImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.docx'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const options = {
        styleMap: ['u => u'],
        convertImage: mammoth.images.imgElement((image: any) => {
          return image.read('base64').then((imageBuffer: string) => ({
            src: `data:${image.contentType};base64,${imageBuffer}`,
          }))
        }),
      }

      const result = await mammoth.convertToHtml({ arrayBuffer }, options as any)
      if (editor.value) {
        editor.value.commands.setContent(result.value || '<p></p>', false)
        emitNow()
      }
    } catch (error) {
      console.error('Ошибка импорта Word документа:', error)
      alert('Не удалось прочитать документ. Убедитесь, что это валидный файл .docx')
    }
  }
  input.click()
}

const toHtml = (v: unknown) => (typeof v === 'string' && v.trim() ? v : '<p></p>')

let saveTimeout: ReturnType<typeof setTimeout> | null = null
let lastEmitted = props.modelValue ?? ''

function emitNow() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  const html = editor.value?.getHTML()
  if (html === undefined) return
  lastEmitted = html
  emit('update:modelValue', html)
}

function updateStats() {
  if (!editor.value) return
  const text = editor.value.getText()
  charCount.value = text.length
  wordCount.value = text.trim() ? text.trim().split(/\s+/).length : 0
}

const editor = useEditor({
  content: toHtml(props.modelValue),
  extensions: [
    StarterKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image,
    TableKit.configure({ table: { resizable: true } }),
    TextStyle,
    FontFamily,
    Color,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    FontSize,
    Indent,
    Pagination.configure({ onPages: (n: number) => { pageCount.value = n } }),
    DirectoryMention,
  ],
  onUpdate: () => {
    updateStats()
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(emitNow, 400)
  },
  onCreate: () => {
    updateStats()
  }
})

watch(() => props.modelValue, (val) => {
  if (!editor.value || val === lastEmitted) return
  const html = toHtml(val)
  if (html !== editor.value.getHTML()) {
    editor.value.commands.setContent(html, false)
    updateStats()
  }
  lastEmitted = val ?? ''
})

function chain() { return (editor.value as any)?.chain().focus() }
function exec(cmd: string, arg?: any) {
  const c = chain()
  if (!c) return
  if (arg !== undefined) c[cmd]?.(arg).run()
  else c[cmd]?.().run()
}
function isActive(name: string, attrs?: Record<string, any>) {
  return editor.value?.isActive(name, attrs) ?? false
}

const currentFontFamily = computed({
  get: () => editor.value?.getAttributes('textStyle').fontFamily || '',
  set: (val: string) => { if (!val) exec('unsetFontFamily'); else exec('setFontFamily', val) },
})
const currentFontSize = computed({
  get: () => editor.value?.getAttributes('textStyle').fontSize || '',
  set: (val: string) => { if (!val) exec('unsetFontSize'); else exec('setFontSize', val) },
})
const currentBlockType = computed({
  get: () => {
    if (isActive('heading', { level: 1 })) return 'h1'
    if (isActive('heading', { level: 2 })) return 'h2'
    if (isActive('heading', { level: 3 })) return 'h3'
    if (isActive('blockquote')) return 'quote'
    return 'p'
  },
  set: (val: string) => {
    if (val === 'p') exec('setParagraph')
    else if (val === 'quote') exec('toggleBlockquote')
    else exec('toggleHeading', { level: Number(val.slice(1)) })
  },
})

function setTextColor(e: Event) { exec('setColor', (e.target as HTMLInputElement).value) }
function setHighlight(e: Event) { exec('toggleHighlight', { color: (e.target as HTMLInputElement).value }) }
function setAlign(align: string) { chain()?.setTextAlign(align).run() }
function insertTable() { chain()?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }
function clearFormatting() { chain()?.clearNodes().unsetAllMarks().run() }

onBeforeUnmount(() => {
  if (saveTimeout) emitNow()
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  editor.value?.destroy()
})
</script>

<template>
  <div class="molo-editor-root">
    <DirectorySuggestDropdown
        ref="suggestDropdownRef"
        :visible="suggestVisible"
        :x="suggestCoords.x"
        :y="suggestCoords.y"
        :query="suggestQuery"
        :items="allDirectoryItems"
        :definitions="interpolator.customDefs.value"
        @select="handleSuggestSelect"
        @close="suggestVisible = false"
    />

    <div class="sheet-toolbar">
      <div class="btn-group">
        <UIMoloButton class="small" title="Экспорт в Word (.docx)" @click="exportToDocx">
          <img :src="wordIcon" alt="" style="width: 12px">
        </UIMoloButton>
        <UIMoloButton class="small" title="Импорт из Word (.docx)" @click="triggerWordImport">
          <UIMoloSticker name="folder"/>
        </UIMoloButton>
      </div>
      <div class="toolbar-sep"/>
      <div class="toolbar-group">
        <span class="toolbar-hint">
          Страниц: <b>{{ pageCount }}</b> · Слов: <b>{{ wordCount }}</b> · Символов: <b>{{ charCount }}</b>
        </span>
      </div>
    </div>

    <div class="molo-ribbon" v-if="editor">
      <div class="ribbon-group">
        <button title="Отменить" @click="exec('undo')">↶</button>
        <button title="Повторить" @click="exec('redo')">↷</button>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <select class="ribbon-select wide" v-model="currentBlockType">
          <option value="p">Обычный текст</option>
          <option value="h1">Заголовок 1</option>
          <option value="h2">Заголовок 2</option>
          <option value="h3">Заголовок 3</option>
          <option value="quote">Цитата</option>
        </select>
        <select class="ribbon-select wide" v-model="currentFontFamily">
          <option value="">Шрифт по умолчанию</option>
          <option value="Arial">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="Georgia, serif">Georgia</option>
        </select>
        <select class="ribbon-select" v-model="currentFontSize">
          <option value="">—</option>
          <option v-for="s in [10,11,12,14,16,18,20,24,28,32]" :key="s" :value="`${s}pt`">{{ s }}</option>
        </select>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <button :class="{ active: isActive('bold') }" @click="exec('toggleBold')"><b>Ж</b></button>
        <button :class="{ active: isActive('italic') }" @click="exec('toggleItalic')"><i>К</i></button>
        <button :class="{ active: isActive('underline') }" @click="exec('toggleUnderline')"><u>Ч</u></button>
        <label class="color-swatch">A<input type="color" @input="setTextColor"/></label>
        <label class="color-swatch">▧<input type="color" @input="setHighlight"/></label>
        <button @click="clearFormatting">Очистить</button>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <button :class="{ active: isActive('paragraph', { textAlign: 'left' }) }" @click="setAlign('left')">⯇</button>
        <button :class="{ active: isActive('paragraph', { textAlign: 'center' }) }" @click="setAlign('center')">≡</button>
        <button :class="{ active: isActive('paragraph', { textAlign: 'right' }) }" @click="setAlign('right')">⯈</button>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <button :class="{ active: isActive('bulletList') }" @click="exec('toggleBulletList')">• Список</button>
        <button :class="{ active: isActive('orderedList') }" @click="exec('toggleOrderedList')">1. Список</button>
        <button @click="insertTable">Таблица</button>
      </div>
    </div>

    <div class="molo-editor-canvas">
      <div class="molo-page-wrap" :style="{ width: PAGE_W + 'px' }">
        <div class="molo-ruler" :ref="setRulerEl">
          <div v-for="cm in rulerTicks" :key="cm" class="ruler-tick" :style="{ left: (cm * PX_PER_CM) + 'px' }">
            <span v-if="cm % 1 === 0" class="ruler-label">{{ cm }}</span>
          </div>
          <div class="ruler-margin-shade left" :style="{ width: margins.left + 'px' }"/>
          <div class="ruler-margin-shade right" :style="{ width: margins.right + 'px' }"/>
          <div class="ruler-handle" :style="{ left: margins.left + 'px' }" @mousedown="startDrag('left', $event)"/>
          <div class="ruler-handle" :style="{ left: (PAGE_W - margins.right) + 'px' }" @mousedown="startDrag('right', $event)"/>
        </div>

        <div class="molo-page" :style="pageStyle">
          <EditorContent :editor="editor"/>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.molo-editor-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #eef0f3;
  position: relative;
}

.sheet-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #1a1a22;
  z-index: 10;
  flex-shrink: 0;
}

.toolbar-sep {
  width: 1px;
  align-self: stretch;
  background: #d7dbe0;
  margin: 2px 8px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-hint {
  font-size: 11px;
  color: #6b7280;
}

.molo-ribbon {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #fafbfc;
  border-bottom: 1px solid #d7dbe0;
  flex-wrap: wrap;
  flex-shrink: 0;
  color: #1f2328;
}

.ribbon-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ribbon-sep {
  width: 1px;
  align-self: stretch;
  background: #d7dbe0;
  margin: 2px 8px;
}

.molo-ribbon button {
  background: #f8f9fa;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #1f2328;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.molo-ribbon button:hover {
  background: #eef3ff;
  border-color: #a9c6ff;
}

.molo-ribbon button.active {
  background: #dbe9ff;
  border-color: #2b7de9;
  color: #1054c2;
}

.ribbon-select {
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #f8f9fa;
  color: #1f2328;
  font-size: 13px;
  padding: 0 6px;
  cursor: pointer;
}

.ribbon-select.wide {
  min-width: 140px;
}

.color-swatch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: #f8f9fa;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
}

.color-swatch input[type='color'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.molo-editor-canvas {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px 24px 60px;
  display: flex;
  justify-content: safe center;
  align-items: flex-start;
}

.molo-page-wrap {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex-shrink: 0;
}

.molo-ruler {
  position: relative;
  height: 22px;
  background: #fff;
  border: 1px solid #d7dbe0;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  user-select: none;
}

.ruler-margin-shade {
  position: absolute;
  top: 0;
  bottom: 0;
  background: #e7eaee;
}

.ruler-margin-shade.left { left: 0; }
.ruler-margin-shade.right { right: 0; }

.ruler-tick {
  position: absolute;
  top: 12px;
  width: 1px;
  height: 8px;
  background: #99a1ab;
}

.ruler-label {
  position: absolute;
  top: -13px;
  left: 2px;
  font-size: 9px;
  color: #6b7280;
}

.ruler-handle {
  position: absolute;
  top: 0;
  width: 10px;
  height: 22px;
  margin-left: -5px;
  cursor: ew-resize;
  z-index: 5;
}

.ruler-handle::before {
  content: '';
  position: absolute;
  left: 3px;
  right: 3px;
  top: 4px;
  bottom: 4px;
  background: #2b7de9;
  border-radius: 2px;
}

.molo-page {
  background: #ffffff;
  width: 794px;
  min-height: 1123px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 10px 30px rgba(0, 0, 0, 0.15);
  border-radius: 0 0 4px 4px;
  color: #111;
  box-sizing: border-box;
}

.molo-page :deep(.ProseMirror) {
  outline: none;
  display: flex;
  flex-direction: column;
  font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.15;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.molo-page :deep(.ProseMirror > *) {
  flex: none;
  min-width: 0;
  max-width: 100%;
  margin: 0 0 3px;
}

.molo-page :deep(.ProseMirror > ul),
.molo-page :deep(.ProseMirror > ol) {
  margin-top: 1px;
  margin-bottom: 2px;
  padding-left: 24px;
}

.molo-page :deep(.ProseMirror li) {
  margin-bottom: 1px;
}

.molo-page :deep(.ProseMirror p) {
  margin: 0 0 2px;
}

.molo-page :deep(.ProseMirror blockquote) {
  border-left: 3px solid #2b7de9;
  padding-left: 10px;
  margin: 4px 0;
  color: #555;
  font-style: italic;
}

.molo-page :deep(.ProseMirror > h1) {
  font-size: 19pt;
  font-weight: 700;
  margin: 10px 0 3px;
}

.molo-page :deep(.ProseMirror > h2) {
  font-size: 13.5pt;
  font-weight: 700;
  margin: 8px 0 2px;
}

.molo-page :deep(.ProseMirror > h3) {
  font-size: 11.5pt;
  font-weight: 700;
  margin: 6px 0 2px;
}

.molo-page :deep(.tableWrapper) {
  overflow-x: auto;
}

.molo-page :deep(table) {
  border-collapse: collapse;
  width: 100%;
  max-width: 100%;
  margin: 0;
  table-layout: fixed;
}

.molo-page :deep(td), .molo-page :deep(th) {
  border: 1px solid #ccc;
  padding: 3px 6px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  vertical-align: top;
}

.molo-page :deep(img) {
  max-width: 100%;
  height: auto;
}

.molo-page :deep(.molo-pb) {
  position: relative;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  pointer-events: none;
  user-select: none;
}

.molo-page :deep(.molo-pb-band) {
  position: absolute;
  left: calc(-1 * var(--ml));
  right: calc(-1 * var(--mr));
  background: #eef0f3;
  box-shadow: inset 0 8px 8px -8px rgba(0, 0, 0, 0.25), inset 0 -8px 8px -8px rgba(0, 0, 0, 0.25);
}

.molo-page :deep(.molo-pb-end) {
  margin: 0 !important;
  pointer-events: none;
  user-select: none;
}
</style>