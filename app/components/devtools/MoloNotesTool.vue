<script setup lang="ts">
import {usePersistentState} from '~/composables/window/usePersistentState'
import { startDrag } from '~/composables/window/useDragPayload'

interface Note {
  id: string;
  text: string;
  createdAt: number
}

const notes = usePersistentState<Note[]>('scratch-notes', [])

function onDragStart(e: DragEvent, note: Note) {
  startDrag(e, { type: 'note', sourceId: note.id, text: note.text })
}

const addNote = () => {
  notes.value = [{id: crypto.randomUUID(), text: '', createdAt: Date.now()}, ...notes.value]
}
const removeNote = (id: string) => {
  notes.value = notes.value.filter(n => n.id !== id)
}
</script>

<template>
  <div class="tool">
    <UIMoloButton class="action" @click="addNote">+ Новая заметка</UIMoloButton>
    <div class="notes-grid">
      <div
          v-for="note in notes" :key="note.id" class="note" v-pinnable
      >
        <div class="pinned-note-header"/>
        <textarea v-model="note.text" placeholder="Текст..."/>
        <UIMoloButton class="remove small close" @click="removeNote(note.id)">✕</UIMoloButton>
      </div>
      <div v-if="!notes.length" class="empty">Пока пусто — заметки сохраняются локально и переживут перезагрузку</div>
    </div>
  </div>
</template>

<style scoped>
.tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  height: 100%;
  overflow: auto;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.note {
  position: relative;
  background: rgba(255, 220, 100, 0.06);
  border: 1px solid rgba(255, 220, 100, 0.2);
  border-radius: 8px;
  padding: 8px;
  min-height: 120px;
}

.note textarea {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  resize: none;
  color: #f0e6c0;
  font-size: 13px;
  outline: none;
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


.remove {
  width: min-content;
  position: absolute;
  top: -12px;
  right: -12px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 12px;
}


.empty {
  color: #666;
  font-size: 13px;
  grid-column: 1 / -1;
  text-align: center;
  padding: 20px;
}
</style>