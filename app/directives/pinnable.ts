import type { Directive } from 'vue'
import {
    startDrag,
    discardDragCallback
} from '~~/app/composables/window/useDragPayload'

export interface PinnableOptions {
    type?: string
    onPinned?: () => void
    width?: number
    height?: number
}

type PinnableEl = HTMLElement & {
    __pinnableOptions?: PinnableOptions
    __lastDragId?: string
}

// Свойства, которые реально формируют "внешний вид" (цвет, шрифты,
// отступы, границы, флекс/грид-раскладка и т.д.). Осознанно НЕ включаем
// сюда position/top/left/transform/width/height — эти геометрические
// свойства управляются отдельно (см. ниже) и их слепое копирование
// может сломать позиционирование внутри нового родителя.
const VISUAL_PROPS = [
    'color', 'background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat', 'background-clip', 'background-origin',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
    'box-shadow', 'opacity', 'backdrop-filter', 'filter',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'text-align', 'text-decoration',
    'text-transform', 'white-space', 'text-overflow', 'word-break',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
    'align-self', 'flex-grow', 'flex-shrink', 'flex-basis', 'gap', 'row-gap', 'column-gap',
    'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
    'overflow-x', 'overflow-y', 'cursor', 'outline', 'vertical-align',
]

// Копируем ВЫЧИСЛЕННЫЕ (итоговые, уже разрешённые браузером) стили прямо
// в inline style каждого элемента снапшота. Благодаря этому снапшот
// становится полностью самодостаточным — он ПЕРЕСТАЁТ зависеть от:
//  - scoped data-v-<хэш> атрибутов Vue (они привязаны к конкретной сборке
//    компонента и "уезжают" между пересборками/рестартами dev-сервера —
//    старый снапшот в localStorage их больше не матчит);
//  - того, загружен ли вообще на странице стилевой чанк компонента-
//    источника в момент восстановления пина (например, если вкладка/окно,
//    из которого что-то закрепили, сейчас не открыта).
// Внешний вид "запекается" один раз, в момент закрепления, и дальше уже
// не меняется — ровно то, что нужно для статичного снапшота.
function inlineVisualStyles(source: Element, target: HTMLElement) {
    const computed = getComputedStyle(source)
    let cssText = ''
    for (const prop of VISUAL_PROPS) {
        const value = computed.getPropertyValue(prop)
        if (value) cssText += `${prop}:${value};`
    }
    target.style.cssText += cssText

    const sourceChildren = source.children
    const targetChildren = target.children
    for (let i = 0; i < sourceChildren.length; i++) {
        const s = sourceChildren[i]
        const t = targetChildren[i]
        if (s && t) inlineVisualStyles(s, t as HTMLElement)
    }
}

function snapshotElement(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement

    // Запекаем визуальные стили ДО любых структурных правок клона —
    // так узлы source/clone гарантированно идут в одном порядке 1:1.
    inlineVisualStyles(el, clone)

    const sourceFields = [
        ...Array.from(
            el.querySelectorAll('input, textarea, select')
        )
    ]

    const cloneFields = [
        ...Array.from(
            clone.querySelectorAll('input, textarea, select')
        )
    ]

    sourceFields.forEach((source, i) => {
        const target = cloneFields[i]

        if (!target) return

        if (
            source instanceof HTMLTextAreaElement &&
            target instanceof HTMLTextAreaElement
        ) {
            target.textContent = source.value
        }

        if (
            source instanceof HTMLInputElement &&
            target instanceof HTMLInputElement
        ) {
            if (
                source.type === 'checkbox' ||
                source.type === 'radio'
            ) {
                if (source.checked) {
                    target.setAttribute('checked', '')
                } else {
                    target.removeAttribute('checked')
                }
            } else {
                target.setAttribute('value', source.value)
            }
        }

        if (
            source instanceof HTMLSelectElement &&
            target instanceof HTMLSelectElement
        ) {
            Array.from(target.options).forEach((option, oi) => {
                const sourceOption = source.options[oi]

                if (sourceOption?.selected) {
                    option.setAttribute('selected', '')
                } else {
                    option.removeAttribute('selected')
                }
            })
        }
    })

    // Убираем интерактивные элементы — в застывшем HTML без Vue-инстанса
    // они всё равно "мёртвые" (клики ничего не делают), но выглядят как
    // рабочие и вводят в заблуждение.
    clone.querySelectorAll('button').forEach((btn) => btn.remove())

    // ВАЖНО: раньше тут стоял [class*="header"] — слишком широкий селектор.
    // Он ломал ЛЮБОЙ контент, чьё имя класса просто СОДЕРЖИТ подстроку
    // "header" (например .form-header в MoloSection.vue — это не
    // дублирующий drag-хендл, а настоящий заголовок секции с реальным
    // контентом). Из-за этого при пине секции "улетала" верхняя часть,
    // а оставалась только нижняя ("form-main"). Теперь удаляем только
    // элементы, ЯВНО помеченные как служебный drag-хендл директивы —
    // атрибутом data-pinnable-chrome. Если где-то в приложении есть
    // собственная "шапка"/drag-зона внутри пинуемого блока, которая
    // дублирует шапку MoloPinnedShell — просто повесь на неё этот
    // атрибут (data-pinnable-chrome), и она будет вырезана из снапшота.
    clone.querySelectorAll('[data-pinnable-chrome]').forEach((el) => el.remove())

    // Поля вывода — не редактируемая форма, а застывшая копия.
    clone.querySelectorAll('textarea, input, select').forEach((field) => {
        field.setAttribute('disabled', '')
    })

    clone.removeAttribute('draggable')

    clone.style.width = '100%'
    clone.style.height = '100%'

    // Источник может иметь свой собственный min-height/min-width в CSS.
    // Убираем флор явно, чтобы клон всегда точно занимал 100% контейнера.
    clone.style.minWidth = '0'
    clone.style.minHeight = '0'
    clone.style.maxWidth = '100%'
    clone.style.maxHeight = '100%'
    clone.style.boxSizing = 'border-box'

    return clone.outerHTML
}

function onDragStart(e: DragEvent) {
    const el = e.currentTarget as PinnableEl

    const rect = el.getBoundingClientRect()
    const opts = el.__pinnableOptions || {}
    const dragId = startDrag(
        e,
        {
            type: opts.type ?? 'widget',
            html: snapshotElement(el),
            width: opts.width ?? Math.round(rect.width),
            height: opts.height ?? Math.round(rect.height),
        },
        opts.onPinned
    )

    if (dragId) {
        el.__lastDragId = dragId
        el.classList.add('is-pinning')
    }
}

function onDragEnd(e: DragEvent) {
    const el = e.currentTarget as PinnableEl

    el.classList.remove('is-pinning')

    discardDragCallback(el.__lastDragId)

    el.__lastDragId = undefined
}

export const vPinnable: Directive<
    PinnableEl,
    PinnableOptions | undefined
> = {
    mounted(el, binding) {
        el.setAttribute('draggable', 'true')

        el.__pinnableOptions = binding.value

        el.addEventListener('dragstart', onDragStart)
        el.addEventListener('dragend', onDragEnd)
    },

    updated(el, binding) {
        el.__pinnableOptions = binding.value
    },

    unmounted(el) {
        el.removeEventListener('dragstart', onDragStart)
        el.removeEventListener('dragend', onDragEnd)
    },
}