<script lang="ts" setup>
import {computed, onBeforeUnmount, reactive, ref, watch} from 'vue'
import {EditorContent, useEditor} from '@tiptap/vue-3'
import {Extension} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {Decoration, DecorationSet} from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import {TableKit} from '@tiptap/extension-table'
import {FontFamily, TextStyle} from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import HTMLtoDOCX from 'html-to-docx-lite'
import {saveAs} from 'file-saver'
import mammoth from 'mammoth'
import wordIcon from '~~/app/assets/icons/word.png'

const props = defineProps<{
  modelValue?: string // HTML-содержимое документа
  fileName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', html: string): void
}>()

// ===== Геометрия страницы A4 (96 dpi) — ОДНА на редактор и на экспорт =====
const PAGE_W = 794            // 21,0 см
const PAGE_H = 1123           // 29,7 см
const MARGIN_V = 96           // верх/низ 2,54 см
const PAGE_GAP = 24           // просвет между страницами в редакторе
const CONTENT_H = PAGE_H - MARGIN_V * 2
const PX_TO_TWIP = 15         // 1px = 15 twips
const A4_TWIPS = {width: 11906, height: 16838}

const pageCount = ref(1)

// ===== Локальное расширение: размер шрифта =====
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {types: ['textStyle']}
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontSize) return {}
              return {style: `font-size: ${attributes.fontSize}`}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({chain}: any) => {
        return chain().setMark('textStyle', {fontSize: size}).run()
      },
      unsetFontSize: () => ({chain}: any) => {
        return chain().setMark('textStyle', {fontSize: null}).removeEmptyTextStyle().run()
      },
    } as any
  },
})

// ===== Локальное расширение: отступы абзацев =====
const Indent = Extension.create({
  name: 'indent',
  addOptions() {
    return {types: ['paragraph', 'heading'], min: 0, max: 8, stepPx: 24}
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const px = parseInt(element.style.marginLeft || '0', 10)
              return px ? Math.round(px / this.options.stepPx) : 0
            },
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.indent) return {}
              return {style: `margin-left: ${attributes.indent * this.options.stepPx}px`}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    const applyDelta = (delta: number) => ({tr, state, dispatch}: any) => {
      const {selection} = state
      let changed = false
      state.doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
        if (this.options.types.includes(node.type.name)) {
          const current = node.attrs.indent || 0
          const next = Math.min(this.options.max, Math.max(this.options.min, current + delta))
          if (next !== current) {
            tr.setNodeMarkup(pos, undefined, {...node.attrs, indent: next})
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

// ===== Локальное расширение: разбивка на страницы =====
// Никаких зависимостей: измеряем блоки верхнего уровня и перед блоком, который не
// помещается на страницу, вставляем «просвет» (низ страницы + серая полоса + верх следующей).
// Высота блока — в натуральных координатах (за вычетом уже вставленных просветов),
// поэтому расчёт стабилен и не зацикливается.
const pagerKey = new PluginKey<{ deco: DecorationSet; sig: string }>('moloPager')

const Pagination = Extension.create<{ onPages: (n: number) => void }>({
  name: 'pagination',
  addOptions() {
    return {onPages: () => {}}
  },
  addProseMirrorPlugins() {
    const onPages = this.options.onPages

    const breakEl = (height: number, bandTop: number, hide: number) => () => {
      const el = document.createElement('div')
      el.className = 'molo-pb'
      el.setAttribute('contenteditable', 'false')
      el.style.height = `${height}px`
      el.style.marginBottom = `${-hide}px`   // отступ следующего блока «съедаем», чтобы он встал ровно в начало страницы
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
      return el
    }

    return [
      new Plugin({
        key: pagerKey,
        state: {
          init: () => ({deco: DecorationSet.empty, sig: ''}),
          apply(tr, prev) {
            const meta = tr.getMeta(pagerKey)
            if (meta) return meta
            return tr.docChanged ? {deco: prev.deco.map(tr.mapping, tr.doc), sig: prev.sig} : prev
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
            // вкладка скрыта (v-show) — посчитаем, когда покажут (сработает ResizeObserver)
            if (view.isDestroyed || !dom.isConnected || dom.offsetParent === null) return

            const {doc} = view.state
            const domTop = dom.getBoundingClientRect().top

            const blocks: { offset: number; el: HTMLElement; heading: boolean }[] = []
            doc.forEach((node, offset) => {
              const el = view.nodeDOM(offset) as HTMLElement | null
              if (el && el.nodeType === 1) blocks.push({offset, el, heading: node.type.name === 'heading'})
            })

            // Сколько места уже занимают вставленные просветы перед каждым блоком
            const shiftBefore = new Map<Element, number>()
            let shift = 0
            for (const child of Array.from(dom.children) as HTMLElement[]) {
              if (child.classList.contains('molo-pb')) {
                shift += child.getBoundingClientRect().height + (parseFloat(getComputedStyle(child).marginBottom) || 0)
              } else {
                shiftBefore.set(child, shift)
              }
            }

            let pageStart = 0
            let pages = 1
            let first = true
            let endNat = 0
            const breaks: { offset: number; height: number; bandTop: number; hide: number }[] = []

            for (const b of blocks) {
              const rect = b.el.getBoundingClientRect()
              const cs = getComputedStyle(b.el)
              const top = rect.top - domTop - (shiftBefore.get(b.el) ?? 0)
              const bottom = top + rect.height
              const mt = parseFloat(cs.marginTop) || 0

              // Заголовок не оставляем одиноким внизу страницы (в Word у него keepNext)
              const need = bottom + (b.heading ? 48 : 0)
              if (!first && need > pageStart + CONTENT_H + 1) {
                const room = pageStart + CONTENT_H - (top - mt) // может быть слегка <0, если отступ предыдущего блока вылез за край
                breaks.push({
                  offset: b.offset,
                  height: Math.round(room + MARGIN_V + PAGE_GAP + MARGIN_V),
                  bandTop: Math.round(MARGIN_V + room),
                  hide: Math.round(mt),
                })
                pageStart = top
                pages++
              }
              // Блок выше страницы (большая таблица/картинка) — считаем занятые им страницы
              if (bottom > pageStart + CONTENT_H + 1) {
                const extra = Math.floor((bottom - pageStart) / CONTENT_H)
                if (extra > 0) {
                  pageStart += extra * CONTENT_H
                  pages += extra
                }
              }
              first = false
              endNat = bottom + (parseFloat(cs.marginBottom) || 0)
            }

            const filler = blocks.length ? Math.max(0, Math.round(pageStart + CONTENT_H - endNat)) : 0
            const sig = `${breaks.map(b => `${b.offset}:${b.height}:${b.bandTop}:${b.hide}`).join('|')}#${filler}#${pages}`
            if (pagerKey.getState(view.state)?.sig === sig) return

            const decos = breaks.map(b =>
                Decoration.widget(b.offset, breakEl(b.height, b.bandTop, b.hide), {
                  side: -1,
                  key: `pb${b.height}_${b.bandTop}_${b.hide}`,
                  ignoreSelection: true,
                })
            )
            if (filler > 0) {
              decos.push(Decoration.widget(doc.content.size, fillerEl(filler), {
                side: 1,
                key: `pf${filler}`,
                ignoreSelection: true,
              }))
            }
            view.dispatch(
                view.state.tr
                    .setMeta(pagerKey, {deco: DecorationSet.create(doc, decos), sig})
                    .setMeta('addToHistory', false)
            )
            onPages(pages)
          }

          const schedule = () => {
            if (!raf) raf = requestAnimationFrame(run)
          }
          // Пересчёт при любом изменении размеров (поля, картинки, шрифты, показ вкладки)
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

// ===== Линейка и поля страницы =====
const PX_PER_CM = PAGE_W / 21
const CM_COUNT = 21

const margins = reactive({left: 96, right: 96})
const rulerTicks = Array.from({length: CM_COUNT + 1}, (_, i) => i)

let dragging: 'left' | 'right' | null = null
let rulerEl: HTMLElement | null = null

function setRulerEl(el: Element | null) {
  rulerEl = el as HTMLElement | null
}

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
  if (dragging === 'left') {
    margins.left = Math.round(Math.min(300, Math.max(24, x)))
  } else {
    margins.right = Math.round(Math.min(300, Math.max(24, PAGE_W - x)))
  }
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

// ===== Экспорт в DOCX (та же страница A4 и те же поля, что в редакторе) =====
async function exportToDocx() {
  if (!editor.value) return

  const parsed = new DOMParser().parseFromString(`<body>${editor.value.getHTML()}</body>`, 'text/html')
  const contentWidth = PAGE_W - margins.left - margins.right

  // Ширины колонок таблиц (tiptap хранит их в атрибуте colwidth)
  parsed.querySelectorAll<HTMLElement>('td[colwidth], th[colwidth]').forEach((cell) => {
    const w = (cell.getAttribute('colwidth') || '')
        .split(',')
        .reduce((sum, part) => sum + (parseInt(part, 10) || 0), 0)
    if (w) cell.style.width = `${w}px`
  })

  // Картинки: явные размеры, не шире области текста
  await Promise.all(
      Array.from(parsed.querySelectorAll<HTMLImageElement>('img')).map(
          (img) =>
              new Promise<void>((resolve) => {
                const probe = new window.Image()
                probe.onload = () => {
                  const scale = Math.min(1, contentWidth / (probe.naturalWidth || 1))
                  img.style.width = `${Math.round(probe.naturalWidth * scale)}px`
                  img.style.height = `${Math.round(probe.naturalHeight * scale)}px`
                  resolve()
                }
                probe.onerror = () => resolve()
                probe.src = img.getAttribute('src') || ''
              })
      )
  )

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${parsed.body.innerHTML}</body></html>`

  const blob = await HTMLtoDOCX(fullHtml, null, {
    orientation: 'portrait',
    pageSize: A4_TWIPS,                       // по умолчанию библиотека делает US Letter — отсюда «уезжали» страницы
    margins: {
      top: MARGIN_V * PX_TO_TWIP,
      bottom: MARGIN_V * PX_TO_TWIP,
      left: Math.round(margins.left * PX_TO_TWIP),
      right: Math.round(margins.right * PX_TO_TWIP),
      header: 720,                            // без этих значений в файл попадало "undefined"
      footer: 720,
      gutter: 0,
    },
    font: 'Arial',
    fontSize: 22,                             // 11 pt — как в редакторе
  } as any)

  const fileName = (props.fileName || 'document').replace(/\.[^.]+$/, '')
  saveAs(blob as Blob, `${fileName}.docx`)
}

// ===== Импорт из DOCX =====
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
        styleMap: [
          'u => u',
        ],
        convertImage: mammoth.images.imgElement((image: any) => {
          return image.read('base64').then((imageBuffer: string) => ({
            src: `data:${image.contentType};base64,${imageBuffer}`,
          }))
        }),
      }

      const result = await mammoth.convertToHtml({arrayBuffer}, options as any)

      if (editor.value) {
        editor.value.commands.setContent(result.value || '<p></p>', false)
        emitNow() // setContent без emitUpdate — сообщаем родителю сами, иначе импорт не сохранится
      }

      if (result.messages.length > 0) {
        console.warn('Предупреждения при импорте документа:', result.messages)
      }
    } catch (error) {
      console.error('Ошибка импорта Word документа:', error)
      alert('Не удалось прочитать документ. Убедитесь, что это валидный файл .docx')
    }
  }
  input.click()
}

// ===== Редактор =====
const toHtml = (v: unknown) => (typeof v === 'string' && v.trim() ? v : '<p></p>')

let saveTimeout: ReturnType<typeof setTimeout> | null = null
// Последний HTML, который мы сами отдали родителю (эхо из props игнорируем —
// иначе setContent во время набора сбивал курсор и терял символы)
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

const editor = useEditor({
  content: toHtml(props.modelValue),
  extensions: [
    StarterKit,
    TextAlign.configure({types: ['heading', 'paragraph']}),
    Image,
    TableKit.configure({table: {resizable: true}}),
    TextStyle,
    FontFamily,
    Color,
    Highlight.configure({multicolor: true}),
    FontSize,
    Indent,
    Pagination.configure({onPages: (n: number) => { pageCount.value = n }}),
  ],
  onUpdate: () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(emitNow, 400)
  },
})

watch(() => props.modelValue, (val) => {
  if (!editor.value || val === lastEmitted) return
  const html = toHtml(val)
  if (html !== editor.value.getHTML()) {
    editor.value.commands.setContent(html, false)
  }
  lastEmitted = val ?? ''
})

// ===== Помощники управления стейтом ленты форматирования =====
function chain() {
  return (editor.value as any)?.chain().focus()
}

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
  set: (val: string) => {
    if (!val) exec('unsetFontFamily')
    else exec('setFontFamily', val)
  },
})

const currentFontSize = computed({
  get: () => editor.value?.getAttributes('textStyle').fontSize || '',
  set: (val: string) => {
    if (!val) exec('unsetFontSize')
    else exec('setFontSize', val)
  },
})

const currentBlockType = computed({
  get: () => {
    if (isActive('heading', {level: 1})) return 'h1'
    if (isActive('heading', {level: 2})) return 'h2'
    if (isActive('heading', {level: 3})) return 'h3'
    return 'p'
  },
  set: (val: string) => {
    if (val === 'p') exec('setParagraph')
    else exec('toggleHeading', {level: Number(val.slice(1))})
  },
})

function setTextColor(e: Event) {
  const color = (e.target as HTMLInputElement).value
  exec('setColor', color)
}

function setHighlight(e: Event) {
  const color = (e.target as HTMLInputElement).value
  exec('toggleHighlight', {color})
}

function setAlign(align: string) {
  chain()?.setTextAlign(align).run()
}

function insertTable() {
  chain()?.insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
}

function insertLink() {
  const previous = editor.value?.getAttributes('link').href
  const url = window.prompt('Ссылка (URL):', previous || 'https://')
  if (url === null) return
  const c = chain()?.extendMarkRange('link')
  if (url === '') c?.unsetLink().run()
  else c?.setLink({href: url}).run()
}

function insertImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      exec('setImage', {src: reader.result as string})
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function clearFormatting() {
  chain()?.clearNodes().unsetAllMarks().run()
}

onBeforeUnmount(() => {
  if (saveTimeout) emitNow() // не теряем последние правки при закрытии вкладки
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  editor.value?.destroy()
})
</script>

<template>
  <div class="molo-editor-root">
    <div class="sheet-toolbar">
      <div class="toolbar-group">
        <button class="toolbar-btn" title="Экспорт в Word (.docx)" @click="exportToDocx">
          <img :src="wordIcon" alt="" style="width: 15px;">
        </button>
        <button class="toolbar-btn" title="Импорт из Word (.docx)" @click="triggerWordImport">
          <span class="toolbar-icon">📂</span>
        </button>
      </div>
      <div class="toolbar-sep"/>
      <div class="toolbar-group">
        <span class="toolbar-hint">Поддерживаются форматы: <b>.docx</b> · Страница A4 · Страниц: <b>{{ pageCount }}</b></span>
      </div>
    </div>

    <div class="molo-ribbon" v-if="editor">
      <div class="ribbon-group">
        <button title="Отменить (Ctrl+Z)" @click="exec('undo')">↶</button>
        <button title="Повторить (Ctrl+Y)" @click="exec('redo')">↷</button>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <select class="ribbon-select wide" title="Стиль абзаца" v-model="currentBlockType">
          <option value="p">Обычный текст</option>
          <option value="h1">Заголовок 1</option>
          <option value="h2">Заголовок 2</option>
          <option value="h3">Заголовок 3</option>
        </select>
        <select class="ribbon-select wide" title="Шрифт" v-model="currentFontFamily">
          <option value="">Шрифт по умолчанию</option>
          <option value="Arial">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="Georgia, serif">Georgia</option>
        </select>
        <select class="ribbon-select" title="Размер шрифта" v-model="currentFontSize">
          <option value="">—</option>
          <option v-for="s in [8,9,10,11,12,14,16,18,20,24,28,32,36,48]" :key="s" :value="`${s}pt`">
            {{ s }}
          </option>
        </select>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <button title="Жирный" :class="{ active: isActive('bold') }" @click="exec('toggleBold')"><b>Ж</b></button>
        <button title="Курсив" :class="{ active: isActive('italic') }" @click="exec('toggleItalic')"><i>К</i></button>
        <button title="Подчёркнутый" :class="{ active: isActive('underline') }" @click="exec('toggleUnderline')">
          <u>Ч</u></button>
        <button title="Зачёркнутый" :class="{ active: isActive('strike') }" @click="exec('toggleStrike')"><s>ЗЧ</s>
        </button>
        <label class="color-swatch" title="Цвет текста">A<input type="color" @input="setTextColor"/></label>
        <label class="color-swatch" title="Маркер">▧<input type="color" @input="setHighlight"/></label>
        <button title="Очистить стили" @click="clearFormatting">Очистить</button>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <button title="По левому краю" :class="{ active: isActive('paragraph', { textAlign: 'left' }) }"
                @click="setAlign('left')">⯇
        </button>
        <button title="По центру" :class="{ active: isActive('paragraph', { textAlign: 'center' }) }"
                @click="setAlign('center')">≡
        </button>
        <button title="По правому краю" :class="{ active: isActive('paragraph', { textAlign: 'right' }) }"
                @click="setAlign('right')">⯈
        </button>
        <button title="По ширине" :class="{ active: isActive('paragraph', { textAlign: 'justify' }) }"
                @click="setAlign('justify')">☰
        </button>
      </div>
      <div class="ribbon-sep"/>
      <div class="ribbon-group">
        <button title="Список" :class="{ active: isActive('bulletList') }" @click="exec('toggleBulletList')">• Список
        </button>
        <button title="Таблица" @click="insertTable">Таблица</button>
        <button title="Картинка" @click="insertImage">Картинка</button>
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
          <div class="ruler-handle" :style="{ left: (PAGE_W - margins.right) + 'px' }"
               @mousedown="startDrag('right', $event)"/>
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

.ruler-margin-shade.left {
  left: 0;
}

.ruler-margin-shade.right {
  right: 0;
}

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

/* Лист A4: поля сверху/снизу задаются padding'ом (см. pageStyle) и совпадают с экспортом */
.molo-page {
  background: #ffffff;
  width: 794px;
  min-height: 1123px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 10px 30px rgba(0, 0, 0, 0.15);
  border-radius: 0 0 4px 4px;
  color: #111;
  box-sizing: border-box;
}

/* Типографика как в экспортируемом DOCX: Arial 11pt, одинарный интервал, 8px после абзаца */
.molo-page :deep(.ProseMirror) {
  outline: none;
  display: flex;               /* у flex-детей отступы не схлопываются — как в Word */
  flex-direction: column;
  font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.15;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.molo-page :deep(.ProseMirror > *) {
  flex: none;
  min-width: 0;
  max-width: 100%;
  margin: 0 0 8px;
}

.molo-page :deep(.ProseMirror > ul),
.molo-page :deep(.ProseMirror > ol) {
  margin-bottom: 0;
  padding-left: 48px;
}

.molo-page :deep(.ProseMirror p) {
  margin: 0 0 8px;
}

.molo-page :deep(.ProseMirror li > p) {
  margin: 0 0 8px;
}

.molo-page :deep(.ProseMirror > h1) {
  font-size: 24pt;
  font-weight: 700;
  margin: 32px 0 8px;
}

.molo-page :deep(.ProseMirror > h2) {
  font-size: 18pt;
  font-weight: 700;
  margin: 24px 0 5px;
}

.molo-page :deep(.ProseMirror > h3) {
  font-size: 14pt;
  font-weight: 700;
  margin: 19px 0 5px;
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
  padding: 4px 8px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  vertical-align: top;
}

.molo-page :deep(img) {
  max-width: 100%;
  height: auto;
}

/* Разрыв страницы: свободное место + серая полоса между листами */
.molo-page :deep(.molo-pb) {
  position: relative;
  margin-top: 0 !important;
  pointer-events: none;
  user-select: none;
}

.molo-page :deep(.molo-pb-band) {
  position: absolute;
  left: calc(-1 * var(--ml) - 24px);
  right: calc(-1 * var(--mr) - 24px);
  background: #eef0f3;
  box-shadow: inset 0 8px 8px -8px rgba(0, 0, 0, 0.3), inset 0 -8px 8px -8px rgba(0, 0, 0, 0.3);
}

.molo-page :deep(.molo-pb-end) {
  margin: 0 !important;
  pointer-events: none;
  user-select: none;
}
</style>