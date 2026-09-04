<script setup lang="ts">
import {onMounted, onUnmounted, ref, computed, watch} from 'vue'
import {useWindowDrag} from '~/composables/window/useWindowDrag'
import {type PinnedItem, usePinnedItems} from '~/composables/window/usePinnedItems'
import { useWindowManager } from '~/composables/window/useWindowManager'
import { getSourceElement, onSourceRegistered } from '~/composables/window/useLiveSourceRegistry'
import { snapshotElement, getElementPath, resolveElementByPath } from '~/directives/pinnable'

const props = defineProps<{ item: PinnedItem }>()
const {unpin, move, updateData, setCloseWithWindow} = usePinnedItems()
const { openWindow, windows } = useWindowManager()

// Поля, которые нужны только служебно для самого пина и не должны утекать
// в data окна, когда мы его открываем/фокусируем по двойному клику.
const PIN_ONLY_FIELDS = ['html', 'dragId', 'type', 'sourcePath']
function sanitizePinData(data?: Record<string, any>) {
  if (!data) return {}
  const clone = { ...data }
  PIN_ONLY_FIELDS.forEach(f => delete clone[f])
  return clone
}

const handleOpenLinkedWindow = () => {
  if (!props.item.windowKey) return
  console.log('[MoloPinnedShell] open linked window key=', props.item.windowKey, 'dataKeys=', Object.keys(props.item.data || {}))
  openWindow(props.item.windowKey, sanitizePinData(props.item.data))
}
const positionRef = ref({...props.item.position})
const sizeRef = ref({
  width: props.item.size?.width,
  height: props.item.size?.height,
})

const {isDragging, handleDragStart, handleDrag, handleDragEnd} = useWindowDrag({
  initialPosition: positionRef,
  windowSize: sizeRef,
  onMove: (pos) => {
    positionRef.value = pos;
    move(props.item.id, pos)
  }
})

const isActive = ref(false)

// Ссылка на .pinned-shell-body — внутри неё (через <slot/>) лежит
// отрендеренный v-html снапшот. Корневой узел самого снапшота помечен
// атрибутом data-pinnable-root (см. snapshotElement в pinnable.ts) —
// именно от него мы считаем путь до кликнутого/изменённого элемента.
const bodyEl = ref<HTMLElement | null>(null)

// --- Живая синхронизация с окном-источником -------------------------------
//
// Пока связанное окно (props.item.windowKey) открыто, элемент, из которого
// был сделан пин, доступен в реестре useLiveSourceRegistry по data.dragId.
// Мы наблюдаем за ним через MutationObserver и на любое изменение (в т.ч.
// изменения value у input/select через события input/change, которые
// MutationObserver сам не ловит) перегенерируем HTML-снапшот и обновляем
// data.html пина — визуально пин "оживает" вместе с окном.
//
// Если окно закрыто — isWindowOpen === false, показываем offline-оверлей.
// Если у пина включён closeWithWindow — пин при закрытии окна удаляется
// автоматически (см. также useWindowManager.closeWindow для случая, когда
// окно закрывают явно через крестик).

const isWindowOpen = computed(() =>
    !!props.item.windowKey && windows.value.some(w => w.key === props.item.windowKey)
)

let observer: MutationObserver | null = null
let resnapshotTimer: ReturnType<typeof setTimeout> | null = null

// Пока пользователь печатает прямо в поле пина (см. handleContentFocusIn/
// handleContentFocusOut ниже), реснапшот от MutationObserver'а откладывается —
// иначе v-html целиком пересоздаёт DOM снапшота и "выдёргивает" фокус
// и введённый текст прямо посреди печати. Как только фокус уходит с поля —
// doResnapshot() вызывается явно и подтягивает самое свежее состояние.
const pinIsEditing = ref(false)

function scheduleResnapshot() {
  if (resnapshotTimer) clearTimeout(resnapshotTimer)
  resnapshotTimer = setTimeout(doResnapshot, 150)
}

function doResnapshot() {
  if (pinIsEditing.value) return
  const dragId = props.item.data?.dragId
  const el = getSourceElement(dragId)
  if (!el) return
  try {
    const html = snapshotElement(el, { interactive: true })
    updateData(props.item.id, { html })
  } catch (e) {
    console.warn('[MoloPinnedShell] Не удалось обновить live-снапшот', e)
  }
}

// --- Форвардинг взаимодействий: клон → живой исходный элемент --------------
//
// Клон в пине — застывшая копия без своего Vue-инстанса, поэтому клики
// внутри него сами по себе ничего не делают, а печать в полях никуда не
// сохраняется. Чтобы пин был по-настоящему интерактивным, мы находим
// соответствующий узел в ЖИВОМ исходном элементе (по пути от
// data-pinnable-root, см. getElementPath/resolveElementByPath в
// pinnable.ts) и форвардим туда: клики — через .click(), ввод — через
// синхронизацию value/checked с последующим диспатчем нативных событий
// input/change (чтобы сработали настоящие Vue-обработчики/v-model окна).
//
// Дальше уже работает существующий MutationObserver: живой элемент
// меняется → срабатывает scheduleResnapshot → пин обновляет свою
// картинку. Круг замыкается — двусторонняя синхронизация.

function isLiveInteractive(): boolean {
  return !!props.item.windowKey && isWindowOpen.value
}

function getContentRoot(): HTMLElement | null {
  return bodyEl.value?.querySelector('[data-pinnable-root]') ?? null
}

function findLiveTarget(cloneTarget: Element): HTMLElement | null {
  const root = getContentRoot()
  if (!root) return null

  const path = getElementPath(root, cloneTarget)
  if (!path) return null

  const sourceRoot = getSourceElement(props.item.data?.dragId)
  if (!sourceRoot) return null

  return resolveElementByPath(sourceRoot, path) as HTMLElement | null
}

const CLICKABLE_SELECTOR = 'button, a[href], [role="button"], summary, label'
type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
const isFormField = (el: Element | null): el is FormField =>
    !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)

function handleContentClick(e: MouseEvent) {
  if (!isLiveInteractive()) return

  const target = e.target as HTMLElement
  const root = getContentRoot()
  if (!root) return

  const clickable = target.closest(CLICKABLE_SELECTOR)
  if (!clickable || !root.contains(clickable)) return

  const liveEl = findLiveTarget(clickable)
  if (!liveEl) return

  // Гасим собственное (нерабочее) поведение клона — например, переход
  // по ссылке или сабмит формы внутри застывшей копии — и вместо этого
  // кликаем по НАСТОЯЩЕМУ элементу в открытом окне.
  e.preventDefault()
  e.stopPropagation()
  liveEl.click()
}

function handleContentInput(e: Event) {
  if (!isLiveInteractive()) return

  const target = e.target as Element
  if (!isFormField(target)) return

  const liveEl = findLiveTarget(target)
  if (!isFormField(liveEl)) return

  if (target instanceof HTMLInputElement && liveEl instanceof HTMLInputElement &&
      (target.type === 'checkbox' || target.type === 'radio')) {
    liveEl.checked = target.checked
  } else {
    liveEl.value = target.value
  }

  liveEl.dispatchEvent(new Event('input', { bubbles: true }))
}

function handleContentChange(e: Event) {
  if (!isLiveInteractive()) return

  const target = e.target as Element
  if (!isFormField(target)) return

  const liveEl = findLiveTarget(target)
  if (!isFormField(liveEl)) return

  if (target instanceof HTMLInputElement && liveEl instanceof HTMLInputElement &&
      (target.type === 'checkbox' || target.type === 'radio')) {
    liveEl.checked = target.checked
  } else {
    liveEl.value = target.value
  }

  liveEl.dispatchEvent(new Event('change', { bubbles: true }))
}

function handleContentFocusIn(e: FocusEvent) {
  if (isFormField(e.target as Element)) {
    pinIsEditing.value = true
  }
}

function handleContentFocusOut(e: FocusEvent) {
  if (isFormField(e.target as Element)) {
    pinIsEditing.value = false
    // Поле отпустили — можно спокойно подтянуть самый свежий снапшот
    // (пока печатали, реснапшот сознательно придерживался, см. выше).
    doResnapshot()
  }
}
// ---------------------------------------------------------------------------

function attachObserver() {
  detachObserver()
  if (!props.item.windowKey) return
  const el = getSourceElement(props.item.data?.dragId)
  if (!el) return

  observer = new MutationObserver(scheduleResnapshot)
  observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true })
  el.addEventListener('input', scheduleResnapshot, true)
  el.addEventListener('change', scheduleResnapshot, true)
  ;(el as any).__moloLiveListenerAttached = true
}

function detachObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (resnapshotTimer) {
    clearTimeout(resnapshotTimer)
    resnapshotTimer = null
  }
}

watch(isWindowOpen, (open) => {
  if (open) {
    attachObserver()
    doResnapshot() // сразу подтягиваем самое свежее состояние при (пере)подключении
  } else {
    detachObserver()
    if (props.item.closeWithWindow) {
      unpin(props.item.id)
    }
  }
}, { immediate: true })

// Окно могли закрыть и открыть заново — новый DOM-узел источника монтируется
// (и автопереподключается, см. tryAutoReconnect в pinnable.ts) уже ПОСЛЕ
// того, как этот watch выше успевает отработать на смену isWindowOpen
// (реактивность Vue не гарантирует, что дочерний компонент нового окна
// уже смонтирован к моменту срабатывания watcher'а в этом компоненте).
// Поэтому дополнительно слушаем сам факт регистрации источника напрямую —
// и, если он относится к нашему пину, досинхронизируемся сразу же.
let unsubscribeSourceRegistered: (() => void) | null = null

onMounted(() => {
  unsubscribeSourceRegistered = onSourceRegistered((dragId) => {
    if (dragId && dragId === props.item.data?.dragId) {
      attachObserver()
      doResnapshot()
    }
  })
})

function toggleCloseWithWindow() {
  setCloseWithWindow(props.item.id, !props.item.closeWithWindow)
}
// ---------------------------------------------------------------------------

const handleKeyDown = (e: KeyboardEvent) => {
  const isToggleCombo = (e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyP'
  if (!isToggleCombo) return
  const target = e.target as HTMLElement
  const isInsideWidget = target?.closest?.('.pinned-shell') === document.querySelector(`[data-widget-id="${props.item.id}"]`)
  if (!isInsideWidget && !isActive.value) return
  if (e.repeat) return
  e.preventDefault()
  e.stopPropagation()
  unpin(props.item.id)
}

const handleEscape = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  const target = e.target as HTMLElement
  const isInsideWidget = target?.closest?.('.pinned-shell') === document.querySelector(`[data-widget-id="${props.item.id}"]`)
  if (!isInsideWidget && !isActive.value) return
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.contentEditable === 'true') {
    return
  }
  e.preventDefault()
  e.stopPropagation()
  unpin(props.item.id)
}

const activateWidget = () => {
  isActive.value = true
}

const deactivateWidget = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const widgetElement = document.querySelector(`[data-widget-id="${props.item.id}"]`)
  if (widgetElement && !widgetElement.contains(target)) {
    isActive.value = false
  }
}

const onMouseMove = (e: MouseEvent) => {
  if (isDragging.value) handleDrag(e)
}
const onMouseUp = () => {
  if (isDragging.value) handleDragEnd()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, { capture: true })
  window.addEventListener('keydown', handleEscape, { capture: true })
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousedown', deactivateWidget)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', handleKeyDown, { capture: true })
  window.removeEventListener('keydown', handleEscape, { capture: true })
  document.removeEventListener('mousedown', deactivateWidget)
  detachObserver()
  unsubscribeSourceRegistered?.()
})
</script>

<template>
  <div
      class="pinned-shell"
      :class="{ dragging: isDragging, active: isActive, offline: item.windowKey && !isWindowOpen }"
      :style="{ left: positionRef.x + 'px', top: positionRef.y + 'px', width: sizeRef.width + 'px', height: sizeRef.height + 'px' }"
      :data-widget-id="item.id"
      @mousedown="activateWidget"
      @click="activateWidget"
  >
    <div
        ref="bodyEl"
        class="pinned-shell-body"
        @dblclick="handleOpenLinkedWindow"
        @click="handleContentClick"
        @input="handleContentInput"
        @change="handleContentChange"
        @focusin="handleContentFocusIn"
        @focusout="handleContentFocusOut"
    >
      <slot/>
      <div v-if="item.windowKey && !isWindowOpen" class="pinned-shell-offline">
        <span class="offline-text">Окно закрыто — нет данных</span>
        <UIMoloButton class="small" @click.stop="handleOpenLinkedWindow">Открыть окно</UIMoloButton>
      </div>
    </div>
    <div class="pinned-shell-header" @mousedown="handleDragStart">
      <span class="drag-dot"/>
      <span v-if="isActive" class="active-indicator">⚡</span>
      <template v-if="item.windowKey">
        <span
            class="sync-indicator"
            :class="{ live: isWindowOpen, offline: !isWindowOpen }"
            :title="isWindowOpen ? 'Синхронизировано с окном' : 'Окно закрыто, данные не обновляются'"
        />
        <span
            class="close-with-window-toggle"
            :class="{ active: item.closeWithWindow }"
            @click.stop="toggleCloseWithWindow"
            :title="item.closeWithWindow ? 'Закрывается вместе с окном (нажмите, чтобы выключить)' : 'Закрыть вместе с окном (сейчас выключено)'"
        >⛓</span>
        <span class="link-indicator" @click.stop="handleOpenLinkedWindow" title="Открыть связанное окно">↗</span>
      </template>
    </div>
    <UIMoloButton class="pinned small close" @click.stop="unpin(item.id)">✕</UIMoloButton>
  </div>
</template>

<style scoped>
.pinned-shell {
  position: absolute;
  z-index: 22;
  transition: box-shadow 0.2s;
  overflow: visible;
  box-sizing: border-box;
}

.pinned-shell.active {
  box-shadow: 0 0 0 2px rgba(222, 222, 222, 0.5);
  z-index: 230;
}

.pinned-shell.offline {
  filter: saturate(0.4);
}

.pinned-shell-body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  position: relative;
}

.pinned-shell-offline {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  z-index: 2;
  padding: 8px;
  text-align: center;
}

.offline-text {
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  line-height: 1.3;
}

.pinned-shell-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 22px;
  display: flex;
  align-items: center;
  padding: 0 2px;
  cursor: move;
  z-index: 3;
  gap: 4px;
}

.drag-dot {
  flex: 1;
}

.shortcut-hint {
  font-size: 8px;
  opacity: 0.3;
  pointer-events: none;
  user-select: none;
  font-family: monospace;
}

.active-indicator {
  font-size: 10px;
  opacity: 0.5;
  animation: pulse 2s infinite;
}

.sync-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sync-indicator.live {
  background: #43d17a;
  box-shadow: 0 0 4px #43d17a;
  animation: pulse 2s infinite;
}

.sync-indicator.offline {
  background: #888;
}

.close-with-window-toggle {
  font-size: 11px;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.2s, color 0.2s;
}

.close-with-window-toggle:hover {
  opacity: 0.8;
}

.close-with-window-toggle.active {
  opacity: 1;
  color: #3872ef;
}

.link-indicator {
  font-size: 12px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  margin-left: 2px;
}
.link-indicator:hover {
  opacity: 1;
  color: #3872ef;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>