<script setup lang="ts">
import type {WindowItem} from '~/types/window'
import {useWindowDrag} from '~/composables/useWindowDrag'
import {useWindowResize} from '~/composables/useWindowResize'
import {ref, computed, onMounted, onUnmounted} from 'vue'
import RestoreIcon from '~~/public/min.svg'
import {useUserStore} from "~~/stores/userStore"
import {windowThemes, windowButtonStyles, windowTitleStyles, TITLE_STYLE_STORAGE_KEY, THEME_STORAGE_KEY, BUTTON_STYLE_STORAGE_KEY} from '~~/types/window-themes'

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

const currentTheme = ref(windowThemes[0])
const currentButtonStyle = ref(windowButtonStyles[0])
const currentTitleStyle = ref(windowTitleStyles[0])

const isMaximized = computed(() => props.window.size.isMaximized === true)

const refreshKey = ref(0)

function refreshContent() {
  refreshKey.value++
}

const displayTitle = computed(() => {
  return currentTitleStyle.value.isFullTitle
      ? props.window.fullTitle
      : props.window.itemTitle
})

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
  initialPosition: windowPosition.value,
  windowSize: windowSize.value,
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

  if (isMaximized.value) {
    return {
      zIndex: props.window.zIndex,
      left: '20px',
      top: '20px',
      width: 'calc(100vw - 40px)',
      height: 'calc(100vh - 40px)',
      transition: disableTransition ? 'none' : undefined
    }
  }

  return {
    zIndex: props.window.zIndex,
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
    const theme = windowThemes.find(t => t.id === saved)
    if (theme) currentTheme.value = theme
  }
}

const loadButtonStyle = () => {
  const saved = localStorage.getItem(BUTTON_STYLE_STORAGE_KEY)
  if (saved) {
    const style = windowButtonStyles.find(s => s.id === saved)
    if (style) currentButtonStyle.value = style
  }
}

const loadTitleStyle = () => {
  const saved = localStorage.getItem(TITLE_STYLE_STORAGE_KEY)
  if (saved) {
    const style = windowTitleStyles.find(s => s.id === saved)
    if (style) currentTitleStyle.value = style
  }
}

const handleThemeChange = (e: CustomEvent) => { currentTheme.value = e.detail }
const handleButtonStyleChange = (e: CustomEvent) => { currentButtonStyle.value = e.detail }
const handleTitleStyleChange = (e: CustomEvent) => { currentTitleStyle.value = e.detail }

const windowStyles = computed(() => ({
  '--window-header-bg': currentTheme.value.styles.headerBg,
  '--window-header-border': currentTheme.value.styles.headerBorder,
  '--window-header-text': currentTheme.value.styles.headerText,
  '--window-content-bg': currentTheme.value.styles.contentBg,
  '--window-content-text': currentTheme.value.styles.contentText,
  '--window-border-color': currentTheme.value.styles.borderColor,
  '--window-border-radius': currentTheme.value.styles.borderRadius,
  '--window-backdrop-blur': currentTheme.value.styles.backdropBlur,
  '--window-controls-bg': currentTheme.value.styles.controlsBg,
  '--window-controls-hover': currentTheme.value.styles.controlsHover,
  '--window-accent': currentTheme.value.styles.accentColor,
  '--button-controls-border': currentButtonStyle.value.styles.controlsBorder,
  '--button-button-border': currentButtonStyle.value.styles.buttonBorder,
  '--button-button-bg': currentButtonStyle.value.styles.buttonBg,
  '--button-button-hover-bg': currentButtonStyle.value.styles.buttonHoverBg,
  '--button-button-text-color': currentButtonStyle.value.styles.buttonTextColor,
  '--button-button-hover-text-color': currentButtonStyle.value.styles.buttonHoverTextColor || currentButtonStyle.value.styles.buttonTextColor,
  '--button-controls-gap': currentButtonStyle.value.styles.controlsGap,
  '--button-controls-padding': currentButtonStyle.value.styles.controlsPadding
}))

onMounted(() => {
  window.addEventListener('theme-changed', handleThemeChange as EventListener)
  window.addEventListener('button-style-changed', handleButtonStyleChange as EventListener)
  window.addEventListener('title-style-changed', handleTitleStyleChange as EventListener)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  loadUserRole()
  loadTheme()
  loadButtonStyle()
  loadTitleStyle()
})

onUnmounted(() => {
  window.removeEventListener('theme-changed', handleThemeChange as EventListener)
  window.removeEventListener('button-style-changed', handleButtonStyleChange as EventListener)
  window.removeEventListener('title-style-changed', handleTitleStyleChange as EventListener)
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
                ...windowStyles,
                cursor: isDragging ? 'grabbing' : 'default',
            }"
    >
      <div class="window-header" @mousedown="handleDragStart">
        <div class="window-title">{{ displayTitle }}</div>
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
            _
          </button>
          <button
              class="control-btn maximize"
              @click="toggleMaximize"
              @mousedown.stop
              :title="isMaximized ? 'Восстановить' : 'На весь экран'"
              v-if="!isModal"
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
              @mousedown.stop
              title="Закрыть"
          >
            ×
          </button>
        </div>
      </div>

      <div class="window-content">
        <div class="content">
          <slot :refreshKey="refreshKey" :windowData="windowData"/>
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
  left: 20px;
  top: 20px;
  width: calc(100vw - 40px);
  height: calc(100vh - 40px);
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
  backdrop-filter: var(--window-backdrop-blur, blur(20px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  width: 100%;
  height: 100%;
  transition: border-radius 0.2s ease;
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
  padding: 12px 15px;
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
  color: var(--button-button-hover-text-color, white);
}

.control-btn.maximize:hover {
  border-color: #0c92ff;
  color: #0c92ff;
}

.control-btn.close:hover {
  border-color: #ff0a21;
  color: #ff0a21;
}

.control-btn.minimize:hover {
  border-color: #ffc107;
  color: #ffc107;
}

.control-btn.refresh:hover {
  border-color: #1eef6f;
  color: #1eef6f;
}

.window-content {
  padding: 10px 15px;
  color: var(--window-content-text, rgba(255, 255, 255, 0.9));
  background: var(--window-content-bg, transparent);
  overflow: auto;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
}

.restore-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: brightness(0) invert(1);
  transition: filter 0.2s ease;
}

.control-btn.maximize:hover .restore-icon {
  filter: brightness(0) invert(0.5) sepia(1) saturate(30) hue-rotate(200deg);
}

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