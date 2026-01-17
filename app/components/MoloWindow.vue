<script setup lang="ts">
import type { WindowItem } from '~/types/window'
import { useWindowDrag } from '~/composables/useWindowDrag'
import { useWindowResize } from '~/composables/useWindowResize'

const props = defineProps<{
  window: WindowItem
  isVisible: boolean
}>()

const emit = defineEmits<{
  'close': []
  'minimize': []
  'move': [position: { x: number; y: number }]
  'resize': [size: { width: number; height: number }]
}>()

// Рефы для контента и контейнера
const contentRef = ref()
const containerRef = ref<HTMLElement>()

// Используем композаблы для перетаскивания и ресайза
const {
  isDragging,
  dragPosition,
  handleDragStart,
  handleDrag,
  handleDragEnd
} = useWindowDrag({
  initialPosition: props.window.position,
  windowSize: props.window.size,
  onMove: (position) => {
    windowPosition.value = position
    emit('move', position)
  }
})

const {
  isResizing,
  resizeHandle,
  handleResizeStart,
  handleResize,
  handleResizeEnd
} = useWindowResize({
  initialSize: props.window.size,
  position: dragPosition,
  onResize: (size) => emit('resize', size),
  onMove: (position) => {
    windowPosition.value = position
    emit('move', position)
  }
})

// Объединенная позиция окна
const windowPosition = ref(props.window.position)

// Объединенные обработчики событий
const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) handleDrag(e)
  if (isResizing.value) handleResize(e)
}

const handleMouseUp = () => {
  if (isDragging.value) handleDragEnd()
  if (isResizing.value) handleResizeEnd()
}

// Инициализация
onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

// Получаем курсор для края ресайза
const getResizeCursor = (edge: string) => {
  const cursors: Record<string, string> = {
    'n': 'ns-resize', 's': 'ns-resize',
    'w': 'ew-resize', 'e': 'ew-resize',
    'nw': 'nwse-resize', 'se': 'nwse-resize',
    'ne': 'nesw-resize', 'sw': 'nesw-resize'
  }
  return cursors[edge] || 'default'
}
</script>

<template>
  <div
      v-if="isVisible"
      ref="containerRef"
      class="window-container"
      :style="{
      left: windowPosition.x + 'px',
      top: windowPosition.y + 'px',
      width: window.size.width + 'px',
      height: window.size.height + 'px',
      zIndex: window.zIndex,
      minWidth: (window.size.minWidth || 300) + 'px',
      minHeight: (window.size.minHeight || 200) + 'px'
    }"
  >
    <div
        class="window"
        :class="{ dragging: isDragging, resizing: isResizing }"
        :style="{ cursor: isDragging ? 'grabbing' : 'default' }"
    >
      <!-- Заголовок окна -->
      <div class="window-header" @mousedown="handleDragStart">
        <div class="window-title">{{ window.fullTitle }}</div>
        <div class="window-controls">
          <button class="control-btn minimize" @click="$emit('minimize')" title="Свернуть">
            _
          </button>
          <button class="control-btn close" @click="$emit('close')" title="Закрыть">
            ×
          </button>
        </div>
      </div>

      <!-- Контент окна -->
      <div class="window-content">
        <slot :ref="contentRef" />
      </div>

      <!-- Ручки для изменения размера -->
      <div
          v-for="edge in ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']"
          :key="edge"
          class="resize-handle"
          :class="`resize-${edge}`"
          @mousedown="(e) => handleResizeStart(e, edge)"
          :style="{ cursor: getResizeCursor(edge) }"
      />
    </div>
  </div>
</template>

<style scoped>
.window-container {
  position: absolute;
  animation: slideIn 0.3s ease-out;
}

.window {
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: visible;
  width: 100%;
  height: 100%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  position: relative;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  gap: 15px;
  border-bottom: 1px solid var(--half_opacity_border);
  background-color: var(--half_opacity_bg);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.window-title {
  color: white;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.window-controls {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.control-btn {
  background: transparent;
  border: 1px solid var(--half_opacity_border);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.control-btn.close:hover {
  background: rgba(220, 53, 69, 0.2);
  border-color: #ff0a21;
  color: #ff0a21;
}

.control-btn.minimize:hover {
  background: rgba(255, 193, 7, 0.2);
  border-color: #ffc107;
  color: #ffc107;
}

.window-content {
  padding: 24px;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
  overflow: visible !important;
  min-height: 0;
  width: 100%;
  height: calc(100% - 57px);
  box-sizing: border-box;
  display: flex;
}

.window-content > * {
  width: 100%;
  overflow: visible !important;
}

/* Ручки изменения размера */
.resize-handle {
  position: absolute;
  background: transparent;
  z-index: 10;
}

.resize-n { top: 0; left: 10px; right: 10px; height: 6px; }
.resize-s { bottom: 0; left: 10px; right: 10px; height: 6px; }
.resize-w { top: 10px; left: 0; width: 6px; bottom: 10px; }
.resize-e { top: 10px; right: 0; width: 6px; bottom: 10px; }
.resize-nw { top: 0; left: 0; width: 15px; height: 15px; }
.resize-ne { top: 0; right: 0; width: 15px; height: 15px; }
.resize-sw { bottom: 0; left: 0; width: 15px; height: 15px; }
.resize-se { bottom: 0; right: 0; width: 15px; height: 15px; }

.window.dragging,
.window.resizing {
  opacity: 0.95;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
}

@media (max-width: 768px) {
  .window-container {
    width: calc(100vw - 40px) !important;
    max-width: calc(100vw - 40px);
    left: 20px !important;
    right: 20px;
  }

  .resize-n, .resize-w, .resize-nw, .resize-ne, .resize-sw {
    display: none;
  }
}
</style>