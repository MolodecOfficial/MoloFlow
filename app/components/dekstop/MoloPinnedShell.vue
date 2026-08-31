<script setup lang="ts">
import {onMounted, onUnmounted, ref, computed} from 'vue'
import {useWindowDrag} from '~/composables/window/useWindowDrag'
import {type PinnedItem, usePinnedItems} from '~/composables/window/usePinnedItems'

const props = defineProps<{ item: PinnedItem }>()
const {unpin, move} = usePinnedItems()

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

// Определяем, активен ли текущий виджет
const isActive = ref(false)

// Обработчик для закрытия по клавише
const handleKeyDown = (e: KeyboardEvent) => {
  // Проверяем, что это Ctrl/Cmd + P
  const isToggleCombo = (e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyP'

  if (!isToggleCombo) return

  // Проверяем, что фокус внутри нашего виджета или это глобальное закрытие
  const target = e.target as HTMLElement
  const isInsideWidget = target?.closest?.('.pinned-shell') === document.querySelector(`[data-widget-id="${props.item.id}"]`)

  // Закрываем только если:
  // 1. Фокус внутри нашего виджета
  // 2. Или виджет активен (например, был кликнут)
  // 3. Или это явное глобальное действие (можно добавить отдельный хоткей)
  if (!isInsideWidget && !isActive.value) return

  if (e.repeat) return
  e.preventDefault()
  e.stopPropagation()

  unpin(props.item.id)
}

// Обработчик для закрытия по Escape (как альтернатива)
const handleEscape = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return

  const target = e.target as HTMLElement
  const isInsideWidget = target?.closest?.('.pinned-shell') === document.querySelector(`[data-widget-id="${props.item.id}"]`)

  if (!isInsideWidget && !isActive.value) return

  // Не закрываем, если внутри есть инпут или textarea (чтобы не мешать вводу)
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.contentEditable === 'true') {
    return
  }

  e.preventDefault()
  e.stopPropagation()
  unpin(props.item.id)
}

// Обработчик клика по виджету для активации
const activateWidget = () => {
  isActive.value = true
}

// Обработчик клика вне виджета для деактивации
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
  // Основной хоткей
  window.addEventListener('keydown', handleKeyDown, { capture: true })
  // Альтернативный хоткей через Escape
  window.addEventListener('keydown', handleEscape, { capture: true })

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  // Клик вне виджета для деактивации
  document.addEventListener('mousedown', deactivateWidget)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', handleKeyDown, { capture: true })
  window.removeEventListener('keydown', handleEscape, { capture: true })
  document.removeEventListener('mousedown', deactivateWidget)
})
</script>

<template>
  <div
      class="pinned-shell"
      :class="{ dragging: isDragging, active: isActive }"
      :style="{ left: positionRef.x + 'px', top: positionRef.y + 'px', width: sizeRef.width + 'px', height: sizeRef.height + 'px' }"
      :data-widget-id="item.id"
      @mousedown="activateWidget"
      @click="activateWidget"
  >
    <div class="pinned-shell-body">
      <slot/>
    </div>
    <div class="pinned-shell-header" @mousedown="handleDragStart">
      <span class="drag-dot"/>
      <!-- Добавляем визуальный индикатор активности -->
      <span v-if="isActive" class="active-indicator">⚡</span>
      <span class="shortcut-hint">⌘P</span>
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

.pinned-shell-body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
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
  z-index: 1;
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

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>