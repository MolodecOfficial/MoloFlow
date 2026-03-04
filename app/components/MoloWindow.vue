<script setup lang="ts">
import type {WindowItem} from '~/types/window'
import {useWindowDrag} from '~/composables/useWindowDrag'
import {useWindowResize} from '~/composables/useWindowResize'
import {ref, computed, onMounted, onUnmounted} from 'vue'
import RestoreIcon from '~~/app/assets/icons/min.svg'

const props = defineProps<{
  window: WindowItem
  isVisible: boolean
  windowId: string,
  groupId: string,
  subGroupId: string,
}>()

const emit = defineEmits<{
  'close': []
  'minimize': []
  'move': [position: { x: number; y: number }]
  'resize': [size: { width: number; height: number }]
  'maximize': []
  'open-window': [groupId: string, itemId: string, groupTitle: string, itemTitle: string]
}>()

provide('openWindow', (groupId: string, itemId: string, groupTitle: string, itemTitle: string) => {
  emit('open-window', groupId, itemId, groupTitle, itemTitle)
})

// Рефы для контейнера
const containerRef = ref<HTMLElement>()
const windowRef = ref<HTMLElement>()

// Состояние для анимации
const isMinimizing = ref(false)
const isClosing = ref(false)
const isMaximizing = ref(false)

// Определяем, включен ли полный размер
const isMaximized = computed(() => props.window.size.isMaximized === true)

const refreshKey = ref(0)

function refreshContent() {
  refreshKey.value++ // увеличение ключа пересоздаст содержимое
}

// Функция для минимизации с анимацией
const minimizeWithAnimation = () => {
  isMinimizing.value = true
  // Ждем завершения анимации и эмитим событие
  setTimeout(() => {
    emit('minimize')
    isMinimizing.value = false
  }, 300) // Длительность анимации
}

// Функция для закрытия с анимацией
const closeWithAnimation = () => {
  isClosing.value = true
  // Ждем завершения анимации и эмитим событие
  setTimeout(() => {
    emit('close')
  }, 300) // Длительность анимации
}

// Функция для минимизации с анимацией
const maximizeWithAnimation = () => {
  isMaximizing.value = true
  // Ждем завершения анимации и эмитим событие
  setTimeout(() => {
    emit('maximize')
    isMaximizing.value = false
  }, 300) // Длительность анимации
}

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
  onResize: (size) => {
    emit('resize', size)
  },
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

// Стили для контейнера
const containerStyle = computed(() => {
  if (isMaximized.value) {
    return {
      left: '20px',
      top: '20px',
      width: 'calc(100vw - 40px)',
      height: 'calc(100vh - 40px)',
      zIndex: props.window.zIndex
    }
  }

  return {
    left: windowPosition.value.x + 'px',
    top: windowPosition.value.y + 'px',
    width: props.window.size.width + 'px',
    height: props.window.size.height + 'px',
    zIndex: props.window.zIndex,
    minWidth: (props.window.size.minWidth || 300) + 'px',
    minHeight: (props.window.size.minHeight || 200) + 'px'
  }
})

// Получаем курсор для края ресайза
const getResizeCursor = (edge: string) => {
  if (isMaximized.value) return 'default'

  const cursors: Record<string, string> = {
    'n': 'ns-resize', 's': 'ns-resize',
    'w': 'ew-resize', 'e': 'ew-resize',
    'nw': 'nwse-resize', 'se': 'nwse-resize',
    'ne': 'nesw-resize', 'sw': 'nesw-resize'
  }
  return cursors[edge] || 'default'
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
</script>

<template>
  <div
      v-if="isVisible"
      ref="containerRef"
      class="window-container"
      :class="{
          'maximized': isMaximized,
          'maximizing': isMaximizing,
          'minimizing': isMinimizing,
          'closing': isClosing
        }"
      :style="containerStyle"
  >
    <div
        ref="windowRef"
        class="window"
        :class="{
          dragging: isDragging,
          resizing: isResizing,
          'maximized': isMaximized
        }"
        :style="{
          cursor: isDragging ? 'grabbing' : 'default',
        }"
    >
      <!-- Заголовок окна -->
      <div class="window-header" @mousedown="handleDragStart">
        <div class="window-title">{{ window.fullTitle }}</div>
        <div class="header-logger">
          <span>{{ groupId }}</span><span>{{ subGroupId }}</span><span>{{ windowId }}</span>
        </div>
        <div class="window-controls">
          <button class="control-btn refresh" @click="refreshContent">
            ↻
          </button>
          <button
              class="control-btn minimize"
              @click="minimizeWithAnimation"
              title="Свернуть"
          >
            _
          </button>
          <button
              class="control-btn maximize"
              @click="maximizeWithAnimation"
              :title="isMaximized ? 'Восстановить' : 'На весь экран'"
          >
            <img
                v-if="isMaximized"
                class="control-icon restore-icon"
                :src="RestoreIcon"
            />
            <span v-else class="control-icon">⛶</span>
          </button>
          <button
              class="control-btn close"
              @click="closeWithAnimation"
              title="Закрыть"
          >
            ×
          </button>
        </div>
      </div>


      <div class="window-content">
        <slot :refreshKey="refreshKey" />
      </div>

      <!-- Ручки для изменения размера (скрываем при максимизации) -->
      <div
          v-if="!isMaximized"
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

.window-container.maximized {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  left: 20px;
  top: 20px;
  width: calc(100vw - 40px);
  height: calc(100vh - 40px);
  z-index: 1;
  & .window-header {
    cursor: auto;
  }
}

/* Анимация минимизации - обратная slideIn */
.window-container.minimizing {
  animation: slideOut 0.2s ease-in-out forwards;
  pointer-events: none;
}

.window-container.maximizing {
  animation: slideOn 0.2s ease-in-out forwards;
  pointer-events: none;
}

/* Анимация закрытия - исчезновение */
.window-container.closing {
  animation: fadeOut 0.2s ease-in forwards;
  pointer-events: none;
}

.window {
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(20px);
  position: relative;
  width: 100%;
  height: 100%;
}

.window.maximized {
  border-radius: 10px;
  box-shadow: none;
  display: flex;
  width: 100%;
  height: 100%;
  z-index: 1;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(250px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slideOn {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(250px) scale(0.95);
  }
}

@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(250px) scale(0.95);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
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

.header-logger {
  display: flex;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 10px;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.5px;
  white-space: nowrap;
  margin: 0 8px;
  backdrop-filter: blur(2px);
  border: 1px solid var(--half_opacity_border);
}

.header-logger span {
  text-transform: capitalize;
}

.header-logger span::first-letter {
  text-transform: uppercase;
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

.control-btn.maximize:hover {
  background: rgba(33, 150, 243, 0.2);
  border-color: #0c92ff;
  color: #0c92ff;
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

.control-btn.refresh:hover {
  background: rgba(161, 161, 161, 0.2);
  border-color: #d3d3d3;
  color: #d3d3d3;
}

.window-content {
  padding: 24px;
  color: rgba(255, 255, 255, 0.9);
  overflow: auto;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
}

.restore-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: brightness(0) invert(1); /* Делает SVG белым */
  transition: filter 0.2s ease;
}

/* При наведении на кнопку максимизации меняем цвет SVG */
.control-btn.maximize:hover .restore-icon {
  /* Для синего цвета (#0c92ff) */
  filter: brightness(0) invert(0.5) sepia(1) saturate(30) hue-rotate(200deg);
}

/* Ручки изменения размера */
.resize-handle {
  position: absolute;
  background: transparent;
  z-index: 10;
}

.resize-n {
  top: 0;
  left: 10px;
  right: 10px;
  height: 6px;
}

.resize-s {
  bottom: 0;
  left: 10px;
  right: 10px;
  height: 6px;
}

.resize-w {
  top: 10px;
  left: 0;
  width: 6px;
  bottom: 10px;
}

.resize-e {
  top: 10px;
  right: 0;
  width: 6px;
  bottom: 10px;
}

.resize-nw {
  top: 0;
  left: 0;
  width: 15px;
  height: 15px;
}

.resize-ne {
  top: 0;
  right: 0;
  width: 15px;
  height: 15px;
}

.resize-sw {
  bottom: 0;
  left: 0;
  width: 15px;
  height: 15px;
}

.resize-se {
  bottom: 0;
  right: 0;
  width: 15px;
  height: 15px;
}

.window.dragging,
.window.resizing {
  opacity: 0.95;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
}

.logger {
  position: absolute;
  right: 10px;

}

.logger span {
  display: inline-block;
  text-transform: capitalize;
  font-size: 10px;
}


.logger span::first-letter {
  text-transform: uppercase;
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