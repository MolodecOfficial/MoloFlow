<!-- MoloWindow.vue -->
<script setup lang="ts">
import type {WindowItem} from '~/types/window'
import {useWindowDrag} from '~/composables/useWindowDrag'
import {useWindowResize} from '~/composables/useWindowResize'
import {ref, computed, onMounted, onUnmounted} from 'vue'
import RestoreIcon from '~~/public/min.svg'
import {useUserStore} from "~~/stores/userStore"
import {getAllThemes, getAllButtonStyles, THEME_STORAGE_KEY, BUTTON_STYLE_STORAGE_KEY} from '~~/types/window-themes'

const userStore = useUserStore()
const role = ref('')

const loadUserRole = () => {
  let userRole = ''
  if (userStore.userRole) {
    userRole = userStore.userRole
  } else {
    const storageUser = localStorage.getItem('user')
    if (storageUser) {
      const user = JSON.parse(storageUser)
      userRole = user.role || 'Пользователь'
    }
  }
  role.value = userRole
}

const props = defineProps<{
  window?: WindowItem
  isVisible?: boolean
  windowId?: string,
  groupId?: string,
  subGroupId?: string,
  isModal?: boolean,
  windowData?: any
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

const containerRef = ref<HTMLElement>()
const windowRef = ref<HTMLElement>()

const isMinimizing = ref(false)
const isClosing = ref(false)

const currentTheme = ref()
const currentButtonStyle = ref()

const isMaximized = computed(() => props.window.size.isMaximized === true)

const refreshKey = ref(0)

function refreshContent() {
  refreshKey.value++
}

const minimizeWithAnimation = () => {
  isMinimizing.value = true
  setTimeout(() => {
    emit('minimize')
    isMinimizing.value = false
  }, 300)
}

const closeWithAnimation = () => {
  isClosing.value = true
  setTimeout(() => {
    emit('close')
  }, 300)
}

const toggleMaximize = () => {
  emit('maximize')
}

provide('currentWindowId', props.window?.id)

const windowPosition = ref({
  x: props.window.position.x,
  y: props.window.position.y
})

const windowSize = ref({
  width: props.window.size.width,
  height: props.window.size.height,
  minWidth: props.window.size.minWidth || 300,
  minHeight: props.window.size.minHeight || 200
})

const {
  isDragging,
  currentPosition: dragPosition,
  handleDragStart,
  handleDrag,
  handleDragEnd
} = useWindowDrag({
  initialPosition: windowPosition,
  windowSize: windowSize,
  onMove: (position) => {
    windowPosition.value = position
    emit('move', position)
  }
})

const {
  isResizing,
  resizeEdge,
  handleResizeStart,
  handleResize,
  handleResizeEnd
} = useWindowResize({
  initialSize: windowSize.value,
  position: windowPosition,
  onResize: (size) => {
    windowSize.value = size
    emit('resize', size)
  },
  onMove: (position) => {
    windowPosition.value = position
    emit('move', position)
  }
})

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) handleDrag(e)
  if (isResizing.value) handleResize(e)
}

const handleMouseUp = () => {
  if (isDragging.value) handleDragEnd()
  if (isResizing.value) handleResizeEnd()
}

const containerStyle = computed(() => {
  const disableTransition = isDragging.value || isResizing.value
  const currentZIndex = props.window?.zIndex || 100

  if (isMaximized.value) {
    return {
      zIndex: currentZIndex,
      left: '20px',
      top: '20px',
      width: 'calc(100vw - 40px)',
      height: 'calc(100vh - 40px)',
      transition: disableTransition ? 'none' : undefined
    }
  }

  return {
    zIndex: currentZIndex,
    left: windowPosition.value.x + 'px',
    top: windowPosition.value.y + 'px',
    width: windowSize.value.width + 'px',
    height: windowSize.value.height + 'px',
    minWidth: windowSize.value.minWidth + 'px',
    minHeight: windowSize.value.minHeight + 'px',
    transition: disableTransition ? 'none' : undefined
  }
})

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

const loadTheme = () => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (saved) {
    const allThemes = getAllThemes()
    const theme = allThemes.find(t => t.id === saved)
    if (theme) {
      currentTheme.value = theme
      applyTheme(theme)
    }
  }
  if (!currentTheme.value) {
    const allThemes = getAllThemes()
    currentTheme.value = allThemes[0]
    applyTheme(allThemes[0])
  }
}

const loadButtonStyle = () => {
  const saved = localStorage.getItem(BUTTON_STYLE_STORAGE_KEY)
  if (saved) {
    const allStyles = getAllButtonStyles()
    const style = allStyles.find(s => s.id === saved)
    if (style) {
      currentButtonStyle.value = style
      applyButtonStyle(style)
    }
  }
  if (!currentButtonStyle.value) {
    const allStyles = getAllButtonStyles()
    currentButtonStyle.value = allStyles[0]
    applyButtonStyle(allStyles[0])
  }
}

const applyTheme = (theme: any) => {
  if (!theme) return
  Object.entries(theme.styles).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--window-${key}`, value as string)
  })
}

const applyButtonStyle = (style: any) => {
  if (!style) return
  Object.entries(style.styles).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--button-${key}`, value as string)
  })
}

const handleThemeChange = (e: CustomEvent) => {
  currentTheme.value = e.detail
  applyTheme(e.detail)
}
const handleButtonStyleChange = (e: CustomEvent) => {
  currentButtonStyle.value = e.detail
  applyButtonStyle(e.detail)
}

const windowStyles = computed(() => {
  const theme = currentTheme.value
  const buttonStyle = currentButtonStyle.value

  if (!theme || !buttonStyle) return {}

  return {
    '--window-header-bg': theme.styles.headerBg,
    '--window-header-border': theme.styles.headerBorder,
    '--window-header-text': theme.styles.headerText,
    '--window-content-bg': theme.styles.contentBg,
    '--window-content-text': theme.styles.contentText,
    '--window-border-color': theme.styles.borderColor,
    '--window-border-radius': theme.styles.borderRadius,
    '--window-backdrop-blur': theme.styles.backdropBlur,
    '--window-controls-bg': theme.styles.controlsBg,
    '--window-controls-hover': theme.styles.controlsHover,
    '--window-accent': theme.styles.accentColor,
    '--button-controls-border': buttonStyle.styles.controlsBorder || 'none',
    '--button-button-border': buttonStyle.styles.buttonBorder || 'none',
    '--button-button-bg': buttonStyle.styles.buttonBg || 'transparent',
    '--button-button-hover-bg': buttonStyle.styles.buttonHoverBg || 'rgba(255, 255, 255, 0.1)',
    '--button-button-text-color': buttonStyle.styles.buttonTextColor || 'white',
    '--button-button-hover-text-color': buttonStyle.styles.buttonHoverTextColor || buttonStyle.styles.buttonTextColor || 'white',
    '--button-controls-gap': buttonStyle.styles.controlsGap || '6px',
    '--button-controls-padding': buttonStyle.styles.controlsPadding || '2px',
  }
})

onMounted(() => {
  window.addEventListener('theme-changed', handleThemeChange as EventListener)
  window.addEventListener('button-style-changed', handleButtonStyleChange as EventListener)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  loadUserRole()
  loadTheme()
  loadButtonStyle()
})

onUnmounted(() => {
  window.removeEventListener('theme-changed', handleThemeChange as EventListener)
  window.removeEventListener('button-style-changed', handleButtonStyleChange as EventListener)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

watch(() => props.window?.zIndex, (newZIndex) => {
  if (newZIndex && containerRef.value) {
    containerRef.value.style.zIndex = String(newZIndex)
  }
}, { immediate: true })
</script>

<template>
  <div
      v-if="isVisible"
      ref="containerRef"
      class="window-container"
      :class="{
            'maximized': isMaximized,
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
        :style="windowStyles"
    >
      <div class="window-header" @mousedown="handleDragStart">
        <div class="window-title">{{ props.window?.fullTitle || props.window?.itemTitle || windowId || 'Окно' }}</div>
        <div class="header-logger" v-if="role === 'Управляющий'">
          <span>{{ groupId }}</span><span>{{ subGroupId }}</span><span>{{ windowId }}</span>
        </div>
        <div class="window-controls">
          <button class="control-btn refresh" @click="refreshContent" @mousedown.stop>
            ↻
          </button>
          <button
              class="control-btn minimize"
              @click="minimizeWithAnimation"
              @mousedown.stop
              title="Свернуть"
              v-if="!isModal"
          >
            <span class="control-icon">_</span>
          </button>
          <button
              class="control-btn maximize"
              @click="toggleMaximize"
              @mousedown.stop
              :title="isMaximized ? 'Восстановить' : 'На весь экран'"
              v-if="!isModal"
          >

            <span class="control-icon">⛶</span>
          </button>
          <button
              class="control-btn close"
              @click="closeWithAnimation"
              @mousedown.stop
              title="Закрыть"
          >
            <span class="control-icon">×</span>
          </button>
        </div>
      </div>

      <div class="window-content">
        <div class="content">
          <slot
              :key="refreshKey"
              :refreshKey="refreshKey"
              :windowData="windowData"
          />
        </div>
      </div>

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
  transition: left 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1),
  top 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1),
  width 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1),
  height 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.window-container:not(.minimizing):not(.closing) {
  animation: slideIn 0.3s ease-out;
}

.window-container.maximized {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  left: 10px;
  top: 10px;
  width: calc(100vw - 10px);
  height: calc(100vh - 10px);
  z-index: 1;
}

.window-container.maximized .window-header {
  cursor: auto;
}

.window-container.minimizing {
  animation: slideOut 0.2s ease-in-out forwards;
  pointer-events: none;
}

.window-container.closing {
  animation: fadeOut 0.2s ease-in forwards;
  pointer-events: none;
}

.window {
  background: var(--window-content-bg, var(--half_opacity_bg));
  border: 1px solid var(--window-border-color, var(--half_opacity_border));
  border-radius: var(--window-border-radius, 10px);
  display: flex;
  flex-direction: column;
  overflow: visible;
  position: relative;
  width: 100%;
  height: 100%;
  transition: border-radius 0.2s ease;
  backdrop-filter:
      blur(20px)
      saturate(100%)
      brightness(100%);
  -webkit-backdrop-filter:
      blur(30px)
      saturate(180%)
      brightness(110%);
  box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.29),
      inset 0 -1px 0 rgba(255, 255, 255, 0.03),
      0 15px 40px rgba(0, 0, 0, 0);
  transition:
      border-radius .25s ease,
      transform .25s ease,
      box-shadow .25s ease;
}

.window.maximized {
  border-radius: 10px;
  box-shadow: none;
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
  padding: 5px 5px;
  gap: 15px;
  background: var(--window-header-bg, var(--half_opacity_bg));
  border-bottom: 1px solid var(--window-header-border, var(--half_opacity_border));
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.window-title {
  color: var(--window-header-text, white);
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  padding: 0 5px;
}

.window-content {
  flex: 1;
  overflow: hidden; /* ← Добавить или изменить на: */
  overflow-y: auto;
  position: relative;
  min-height: 0;
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

.window-controls {
  display: flex;
  gap: var(--button-controls-gap, 6px);
  padding: var(--button-controls-padding, 2px);
  border: var(--button-controls-border, none);
  border-radius: 6px;
  flex-shrink: 0;
}

.control-btn {
  border: var(--button-button-border, 1px solid var(--half_opacity_border));
  background: var(--button-button-bg, transparent);
  color: var(--button-button-text-color, white);
  width: 28px;
  height: 28px;
  border-radius: 4px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.control-btn .control-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* Базовое наведение для всех кнопок */
.control-btn:hover {
  background: var(--button-button-hover-bg, rgba(255, 255, 255, 0.1));
  color: var(--button-button-hover-text-color, var(--button-button-text-color));
}

.control-btn.maximize:hover .restore-icon {
  filter: brightness(0) invert(0.5) sepia(1) saturate(30) hue-rotate(200deg);
}

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
  border: 1px solid #888888;
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