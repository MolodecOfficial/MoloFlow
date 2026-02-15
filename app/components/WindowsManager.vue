<script setup lang="ts">
import MoloWindow from './MoloWindow.vue'
import type { WindowItem } from '~/types/window'

const props = defineProps<{
  windows: WindowItem[]
}>()

const emit = defineEmits<{
  close: [id: string]
  focus: [id: string]
  minimize: [id: string]
  move: [id: string, newPosition: { x: number; y: number }]
  resize: [id: string, newSize: { width: number; height: number }]
  maximize: [id: string]
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

const maximizeWindow = (id: string) => {
  emit('maximize', id)
}

const resizeWindow = (id: string, newSize: { width: number; height: number }) => {
  emit('resize', id, newSize)
}

// Функция для восстановления окна с анимацией
const restoreWindowWithAnimation = (id: string) => {
  const window = props.windows.find(w => w.id === id)
  if (window && window.isMinimized) {
    emit('focus', id)

  }
}
</script>

<template>
  <div class="window-manager">
    <MoloWindow
        v-for="window in windows.filter(w => !w.isMinimized)"
        :key="window.id"
        :window-id="window.itemId"
        :group-id="window.groupId"
        :sub-group-id="window.subGroupId"
        :window="window"
        :isVisible="true"
        @close="closeWindow(window.id)"
        @minimize="minimizeWindow(window.id)"
        @move="(pos) => moveWindow(window.id, pos)"
        @resize="(size) => resizeWindow(window.id, size)"
        @maximize="() => maximizeWindow(window.id)"
        @mousedown="focusWindow(window.id)"
        class="draggable-window"
    >
      <WindowsContent
          :window-id="window.itemId"
          :group-id="window.groupId"
          :sub-group-id="window.subGroupId"
      />
    </MoloWindow>

    <div v-if="windows.some(w => w.isMinimized)" class="minimized-windows">
      <div class="minimized-title">Свернутые окна:</div>
      <div class="minimized-list">
        <button
            v-for="window in windows.filter(w => w.isMinimized)"
            :key="window.id"
            class="minimized-tab"
            @click="restoreWindowWithAnimation(window.id)"
        >
          {{ window.fullTitle }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.window-manager {
  position: absolute;
  width: 100%;
  min-height: 500px;
  overflow: visible;
  border: 1px solid red;
  z-index: 0;
}

.draggable-window {
  position: absolute;
  animation: windowAppear 0.3s ease-out;
}

@keyframes windowAppear {
  from {
    opacity: 0;
    transform: translateY(250px) scale(0.95);
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
  background: rgb(26, 26, 26);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 10px 15px;
  backdrop-filter: blur(10px);
  z-index: 999;
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