<script setup lang="ts">
import MoloWindow from './MoloWindow.vue'
import WindowContentFactory from '../components/WindowsContent.vue'
import type { WindowItem } from '~/types/window'

const props = defineProps<{
  windows: WindowItem[]
}>()

// Добавьте отладку
watch(() => props.windows, (newWindows) => {
  console.log('WindowsManager получил окна:', newWindows)
  newWindows.forEach(w => {
    console.log(`Окно: ${w.fullTitle}, itemId: ${w.itemId}`)
  })
}, { immediate: true })

const emit = defineEmits<{
  close: [id: string]
  focus: [id: string]
  minimize: [id: string]
  move: [id: string, newPosition: { x: number; y: number }]
  resize: [id: string, newSize: { width: number; height: number }]
}>()

const closeWindow = (id: string) => {
  emit('close', id)
}

const focusWindow = (id: string) => {
  emit('focus', id)
}

const minimizeWindow = (id: string) => {
  emit('minimize', id)
}

const moveWindow = (id: string, newPosition: { x: number; y: number }) => {
  emit('move', id, newPosition)
}

const getWindowStyle = (window: WindowItem) => {
  return {
    left: `${window.position.x}px`,
    top: `${window.position.y}px`,
    width: `${window.size.width}px`,
    height: `${window.size.height}px`,
    zIndex: window.zIndex
  }
}

const resizeWindow = (id: string, newSize: { width: number; height: number }) => {
  emit('resize', id, newSize)
}
</script>

<template>
  <div class="window-manager">
    <!-- Активные окна -->
    <MoloWindow
        v-for="window in windows.filter(w => !w.isMinimized)"
        :key="window.id"
        :window="window"
        :isVisible="true"
        @close="closeWindow(window.id)"
        @minimize="minimizeWindow(window.id)"
        @move="(pos) => moveWindow(window.id, pos)"
        @resize="(size) => resizeWindow(window.id, size)"
        @mousedown="focusWindow(window.id)"
        class="draggable-window"
    >
      <WindowContentFactory
          :window-id="window.itemId"
          @content-size-changed="(size) => resizeWindow(window.id, size)"
      />
    </MoloWindow>

    <!-- Панель свернутых окон -->
    <div v-if="windows.some(w => w.isMinimized)" class="minimized-windows">
      <div class="minimized-title">Свернутые окна:</div>
      <div class="minimized-list">
        <button
            v-for="window in windows.filter(w => w.isMinimized)"
            :key="window.id"
            class="minimized-tab"
            @click="focusWindow(window.id)"
        >
          {{ window.fullTitle }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.window-manager {
  position: relative;
  width: 100%;
  min-height: 500px;
  overflow: visible;
}

.draggable-window {
  position: absolute;
  animation: windowAppear 0.3s ease-out;
}

@keyframes windowAppear {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.minimized-windows {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 30, 48, 0.9);
  border: 1px solid rgba(56, 239, 125, 0.2);
  border-radius: 8px;
  padding: 10px 15px;
  backdrop-filter: blur(10px);
  z-index: 1000;
}

.minimized-title {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  margin-bottom: 8px;
  text-align: center;
}

.minimized-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.minimized-tab {
  background: rgba(56, 239, 125, 0.1);
  border: 1px solid rgba(56, 239, 125, 0.3);
  color: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.minimized-tab:hover {
  background: rgba(56, 239, 125, 0.2);
  border-color: #38ef7d;
}
</style>