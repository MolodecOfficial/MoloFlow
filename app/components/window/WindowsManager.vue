<script setup lang="ts">
import MoloWindow from './MoloWindow.vue'
import WindowsContent from './WindowsContent.vue'
import type { WindowItem } from '~/types/window'

defineOptions({
  inheritAttrs: false
})

const props = defineProps<{
  windows?: WindowItem[]
}>()

const emit = defineEmits<{
  close: [id: string]
  focus: [id: string]
  minimize: [id: string]
  move: [id: string, newPosition: { x: number; y: number }]
  resize: [id: string, newSize: { width: number; height: number }]
  maximize: [id: string]
  'update-title': [id: string, title: string]
}>()

const restoreWindowWithAnimation = (id: string) => {
  const win = props.windows?.find(w => w.id === id)
  if (win && win.isMinimized) {
    emit('focus', id)
  }
}
</script>

<template>
  <div class="window-manager">
    <MoloWindow
        v-for="win in windows.filter(w => !w.isMinimized)"
        :key="win.id"
        :window="win"
        :is-visible="true"
        :is-modal="win.isModal"
        @close="emit('close', win.id)"
        @minimize="emit('minimize', win.id)"
        @move="(pos) => emit('move', win.id, pos)"
        @resize="(size) => emit('resize', win.id, size)"
        @maximize="emit('maximize', win.id)"
        @mousedown="emit('focus', win.id)"
        class="draggable-window"
    >
      <template #default="{ refreshKey }">
        <WindowsContent
            :key="refreshKey"
            :window-key="win.key"
            :data="win.data"
            :unique-window-id="win.id"
            @updateTitle="(title) => emit('update-title', win.id, title)"
        />
      </template>
    </MoloWindow>

    <div v-if="windows.some(w => w.isMinimized)" class="minimized-windows">
      <div class="minimized-title">Свернутые окна:</div>
      <div class="minimized-list">
        <button
            v-for="win in windows.filter(w => w.isMinimized)"
            :key="win.id"
            class="minimized-tab"
            @click="restoreWindowWithAnimation(win.id)"
        >
          {{ win.title }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.window-manager {
  position: absolute;
  overflow: visible;
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
  background: var(--half_opacity_bg);
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
  background: rgba(56, 71, 239, 0.1);
  border: 1px solid var(--border-color_hover);
  color: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.minimized-tab:hover {
  background: rgba(56, 114, 239, 0.2);
  border-color: var(--borber-color_main);
}
</style>