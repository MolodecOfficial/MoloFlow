<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useWindowDrag} from '~/composables/window/useWindowDrag'
import {type PinnedItem, usePinnedItems} from '~/composables/window/usePinnedItems'

const props = defineProps<{ item: PinnedItem }>()
const {unpin, move, updateData} = usePinnedItems()

const positionRef = ref({...props.item.position})
const sizeRef = ref({width: 190, height: 190})

const {isDragging, handleDragStart, handleDrag, handleDragEnd} = useWindowDrag({
  initialPosition: positionRef,
  windowSize: sizeRef,
  onMove: (pos) => {
    positionRef.value = pos
    move(props.item.id, pos)
  }
})

const text = computed({
  get: () => props.item.data.text || '',
  set: (v: string) => updateData(props.item.id, {text: v})
})

const onMouseMove = (e: MouseEvent) => {
  if (isDragging.value) handleDrag(e)
}
const onMouseUp = () => {
  if (isDragging.value) handleDragEnd()
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
})
onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div
      class="pinned-note"
      :class="{ dragging: isDragging }"
      :style="{ left: positionRef.x + 'px', top: positionRef.y + 'px' }"
  >
    <div class="pinned-note-header" @mousedown="handleDragStart">
      <span class="drag-dot"/>
      <UIMoloButton class="remove small close" @click="unpin(item.id)">✕</UIMoloButton>
    </div>
    <textarea v-model="text" @mousedown.stop readonly placeholder="Заметка..."/>
  </div>
</template>

<style scoped>
.pinned-note {
  background: rgba(255, 220, 100, 0.06);
  border: 1px solid rgba(255, 220, 100, 0.2);
  border-radius: 8px;
  padding: 8px;
  min-height: 120px;
  position: absolute;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  z-index: 200; /* ниже минимального z-index окон (100), выше фона */
  transition: box-shadow 0.2s;
}

.pinned-note.dragging {
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.5);
}

.pinned-note-header {
  height: 20px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0 6px;
  cursor: move;
  flex-shrink: 0;
}

.drag-dot {
  flex: 1;
}

.remove {
  position: absolute;
  top: -12px;
  right: -12px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 12px;
}

.pinned-note textarea {
  flex: 1;
  background: transparent;
  border: none;
  resize: none;
  outline: none;
  color: #f0e6c0;
  font-size: 13px;
  padding: 0 10px 10px;
}
</style>