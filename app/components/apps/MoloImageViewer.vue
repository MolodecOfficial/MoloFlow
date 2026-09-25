<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue?: string
  fileName?: string
}>()

const scale = ref(1)
const rotation = ref(0)

function zoomIn() {
  scale.value = Math.min(scale.value + 0.25, 4)
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.25, 0.25)
}

function rotate() {
  rotation.value = (rotation.value + 90) % 360
}

function reset() {
  scale.value = 1
  rotation.value = 0
}

function printImage() {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`
    <html>
      <head><title>${props.fileName || 'Изображение'}</title></head>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;">
        <img src="${props.modelValue}" style="max-width:100%;max-height:100%;object-fit:contain;" onload="window.print();window.close();" />
      </body>
    </html>
  `)
  win.document.close()
}
</script>

<template>
  <div class="image-viewer-root">
    <div class="image-toolbar">

      <div class="toolbar-title">
        <span class="toolbar-badge">IMAGE РИДЕР</span>
        {{ fileName || 'Изображение' }}</div>
      <div class="toolbar-controls">
        <section class="btn-group">
          <UIMoloButton class="small" title="Увеличить" @click="zoomIn">🔍+</UIMoloButton>
          <UIMoloButton class="small" title="Уменьшить" @click="zoomOut">🔍-</UIMoloButton>
        </section>
        <UIMoloButton class="small" title="Сбросить масштаб" @click="reset">{{ Math.round(scale * 100) }}%</UIMoloButton>
        <section class="btn-group">
          <UIMoloButton class="small" title="Повернуть на 90°" @click="rotate">🔄</UIMoloButton>
          <UIMoloButton class="small" title="Печать" @click="printImage">🖨️</UIMoloButton>
        </section>
      </div>
    </div>

    <div class="image-canvas">
      <img
          :src="modelValue"
          :style="{
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          transition: 'transform 0.15s ease-out'
        }"
          alt="Скан/Фото"
          draggable="false"
      />
    </div>
  </div>
</template>

<style scoped>
.image-viewer-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #111116;
  overflow: hidden;
}

.image-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #1a1a24;
  border-bottom: 1px solid var(--half_opacity_border);
  flex-shrink: 0;
}


.toolbar-badge {
  background: #dc8726;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.toolbar-title {
  font-size: 13px;
  color: #c4c4d4;
  font-weight: 500;
}

.toolbar-controls {
  display: flex;
  gap: 6px;
}

.image-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 24px;
}

.image-canvas img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  border-radius: 4px;
}
</style>