import type { Directive } from 'vue'
import {
    startDrag,
    discardDragCallback
} from '~~/app/composables/window/useDragPayload'
import {
    registerSourceElement,
    unregisterSourceElement
} from '~~/app/composables/window/useLiveSourceRegistry'
import { usePinnedItems } from '~~/app/composables/window/usePinnedItems'

export interface PinnableOptions {
    type?: string
    onPinned?: () => void
    width?: number
    height?: number
}

type PinnableEl = HTMLElement & {
    __pinnableOptions?: PinnableOptions
    __lastDragId?: string
    __liveDragIds?: Set<string> // все dragId, выданные с этого элемента — нужны, чтобы отписаться от реестра при unmount
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
// не меняется сам по себе — НО пин теперь умеет попросить свежий снапшот
// у живого source-элемента заново (см. useLiveSourceRegistry.ts +
// MoloPinnedShell.vue), пока окно, из которого его вытянули, открыто.
//
// Экспортируем функцию наружу — она переиспользуется в MoloPinnedShell.vue
// для повторного снятия снапшота при live-синхронизации.
export function inlineVisualStyles(source: Element, target: HTMLElement) {
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

export interface SnapshotOptions {
    // true  — "живой" снапшот: пин связан с открытым окном и умеет
    //         форвардить клики/ввод на настоящий исходный элемент
    //         (см. MoloPinnedShell.vue). В этом режиме кнопки и поля
    //         ввода НЕ вырезаются/дизейблятся — они должны оставаться
    //         полноценными DOM-узлами, по которым можно кликать/печатать.
    // false — "мёртвый" снапшот: живого источника не будет никогда
    //         (пин не привязан к окну), поэтому кнопки вырезаются,
    //         а поля дизейблятся, чтобы не вводить в заблуждение
    //         видимостью несуществующей интерактивности.
    interactive?: boolean
}

export function snapshotElement(el: HTMLElement, options: SnapshotOptions = {}): string {
    const { interactive = false } = options
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

    // Убираем интерактивные элементы — но ТОЛЬКО если это заведомо "мёртвый"
    // снапшот (нет живого источника, с которым можно синхронизироваться).
    // Для живых пинов (interactive === true) кнопки остаются настоящими
    // DOM-узлами — по ним можно кликать, и клик форвардится на живой
    // исходный элемент (см. handleContentClick в MoloPinnedShell.vue).
    if (!interactive) {
        clone.querySelectorAll('button').forEach((btn) => btn.remove())
    }

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
    //
    // Для живых (interactive) снапшотов мы НЕ удаляем эти узлы из DOM,
    // а только скрываем их через display:none — удаление меняло бы
    // порядковые индексы детей внутри клона, а именно по этим индексам
    // MoloPinnedShell.vue сопоставляет узел клона с узлом живого
    // исходного элемента (getElementPath/resolveElementByPath ниже).
    // Раз индексы должны 1:1 совпадать с живым DOM — узел лучше спрятать,
    // чем вырезать.
    if (interactive) {
        clone.querySelectorAll('[data-pinnable-chrome]').forEach((chromeEl) => {
            (chromeEl as HTMLElement).style.display = 'none'
        })
    } else {
        clone.querySelectorAll('[data-pinnable-chrome]').forEach((chromeEl) => chromeEl.remove())
    }

    if (interactive) {
        // Живой снапшот: поля должны оставаться полноценно вводимыми —
        // печать в них форвардится на живой исходный элемент (см.
        // handleContentInput/handleContentChange в MoloPinnedShell.vue).
        clone.querySelectorAll('textarea, input, select').forEach((field) => {
            field.removeAttribute('disabled')
        })
    } else {
        // Мёртвый снапшот — не редактируемая форма, а застывшая копия.
        clone.querySelectorAll('textarea, input, select').forEach((field) => {
            field.setAttribute('disabled', '')
        })
    }

    // Маркер корня снапшота. По нему MoloPinnedShell.vue надёжно находит
    // "тот самый" корневой узел клона в живом DOM пина независимо от того,
    // во сколько обёрток (v-html и т.п.) его завернул компонент-контейнер
    // (DekstopMoloPinnedLayer и т.д.) — и именно от него отсчитывает путь
    // до кликнутого/изменённого элемента.
    clone.setAttribute('data-pinnable-root', '')

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

// --- Сопоставление узлов клона с узлами живого исходника -------------------
//
// Клон (снапшот) и живой исходный элемент структурно идентичны 1:1 (см.
// комментарии выше про то, почему мы скрываем, а не вырезаем chrome-узлы
// в interactive-режиме). Поэтому путь до узла можно закодировать как
// последовательность индексов среди element-детей (children, а не
// childNodes — так путь не ломается от пробельных текстовых узлов).
//
// getElementPath считается от корня клона (узел с data-pinnable-root) до
// кликнутого/изменённого элемента внутри пина; resolveElementByPath потом
// проходит тот же путь, но уже от живого исходного элемента — и находит
// соответствующий "настоящий" узел, на который форвардится взаимодействие.

export function getElementPath(root: Element, target: Element): number[] | null {
    const path: number[] = []
    let node: Element | null = target

    while (node && node !== root) {
        const parent: Element | null = node.parentElement
        if (!parent) return null
        const index = Array.prototype.indexOf.call(parent.children, node)
        if (index === -1) return null
        path.unshift(index)
        node = parent
    }

    if (node !== root) return null
    return path
}

export function resolveElementByPath(root: Element, path: number[]): Element | null {
    let node: Element = root
    for (const index of path) {
        const next: Element | undefined = node.children[index]
        if (!next) return null
        node = next
    }
    return node
}
// ---------------------------------------------------------------------------

function onDragStart(e: DragEvent) {
    const el = e.currentTarget as PinnableEl
    const windowRoot = el.closest('[data-window-key]')
    const windowKey = windowRoot?.getAttribute('data-window-key') || undefined
    console.log('[pinnable] onDragStart windowKey=', windowKey, 'el=', el.className)
    const rect = el.getBoundingClientRect()
    const opts = el.__pinnableOptions || {}

    // Путь от корня окна (узел с data-window-key) до самого этого элемента.
    // Сохраняется в data пина и используется позже tryAutoReconnect'ом —
    // когда окно закрывают и открывают заново, внутри рождается НОВЫЙ DOM-
    // узел, который никогда не перетаскивался и поэтому никогда не получил
    // бы свой dragId сам по себе. По этому пути мы находим "тот самый"
    // элемент в новом окне и регистрируем его под СТАРЫМ dragId пина —
    // без этого повторное открытие окна навсегда обрывало бы синхронизацию.
    const sourcePath = windowRoot ? getElementPath(windowRoot, el) : null

    const dragId = startDrag(
        e,
        {
            type: opts.type ?? 'widget',
            // Пин, привязанный к windowKey, потенциально сможет
            // синхронизироваться с живым источником (пока окно открыто) —
            // поэтому сразу снимаем interactive-снапшот, с рабочими
            // кнопками и полями. Пины без windowKey живыми не бывают
            // никогда, поэтому остаются "мёртвыми" как раньше.
            html: snapshotElement(el, { interactive: !!windowKey }),
            width: opts.width ?? Math.round(rect.width),
            height: opts.height ?? Math.round(rect.height),
            windowKey,
            sourcePath: sourcePath ?? undefined,
        },
        opts.onPinned
    )

    if (dragId) {
        el.__lastDragId = dragId
        el.classList.add('is-pinning')

        // Регистрируем сам элемент как "живой источник" под этим dragId.
        // Пока этот элемент остаётся в DOM (т.е. его окно открыто), пин
        // сможет по этому dragId (он приезжает в data.dragId вместе с
        // остальным payload'ом) в любой момент снять свежий снапшот и
        // обновить своё отображение — это и даёт "динамичность" пину.
        registerSourceElement(dragId, el)
        el.__liveDragIds = el.__liveDragIds || new Set<string>()
        el.__liveDragIds.add(dragId)
    }
}

function onDragEnd(e: DragEvent) {
    const el = e.currentTarget as PinnableEl

    el.classList.remove('is-pinning')

    discardDragCallback(el.__lastDragId)

    el.__lastDragId = undefined
}

function pathsEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((value, i) => value === b[i])
}

// Автопереподключение: когда какой-то ДРУГОЙ экземпляр этого же элемента
// (например, после закрытия и повторного открытия окна) монтируется заново,
// он сам по себе не знает, что раньше уже был источником для одного или
// нескольких пинов — ведь регистрация в реестре раньше происходила только
// в момент dragstart, а этот новый узел никто не перетаскивал.
//
// Решение: у каждого пина, привязанного к windowKey, в data сохранён путь
// (sourcePath) от корня окна до исходного элемента (см. onDragStart выше).
// Как только внутри окна с тем же windowKey монтируется pinnable-элемент
// с ТЕМ ЖЕ путём — считаем, что это "тот самый" источник, и регистрируем
// его под уже существующим dragId пина. Дальше всё работает как обычно:
// MoloPinnedShell.vue подписан на onSourceRegistered и сразу подхватит
// свежий источник, даже если его собственный watch(isWindowOpen) успел
// сработать раньше, чем этот элемент вообще смонтировался.
function tryAutoReconnect(el: PinnableEl) {
    const windowRoot = el.closest('[data-window-key]')
    const windowKey = windowRoot?.getAttribute('data-window-key')
    if (!windowRoot || !windowKey) return

    const path = getElementPath(windowRoot, el)
    if (!path) return

    const { pinnedItems } = usePinnedItems()

    pinnedItems.value.forEach((item) => {
        const dragId = item.data?.dragId
        const sourcePath = item.data?.sourcePath

        if (
            item.windowKey !== windowKey ||
            !dragId ||
            !Array.isArray(sourcePath) ||
            !pathsEqual(sourcePath, path)
        ) {
            return
        }

        console.log('[pinnable] auto-reconnect dragId=', dragId, 'windowKey=', windowKey)
        registerSourceElement(dragId, el)
        el.__liveDragIds = el.__liveDragIds || new Set<string>()
        el.__liveDragIds.add(dragId)
    })
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

        tryAutoReconnect(el)
    },

    updated(el, binding) {
        el.__pinnableOptions = binding.value
    },

    unmounted(el) {
        el.removeEventListener('dragstart', onDragStart)
        el.removeEventListener('dragend', onDragEnd)

        // Элемент уходит из DOM (например, закрыли окно) — вычищаем все
        // его записи из реестра живых источников, чтобы связанные пины
        // корректно перешли в offline-состояние.
        el.__liveDragIds?.forEach((id) => unregisterSourceElement(id))
        el.__liveDragIds = undefined
    },
}