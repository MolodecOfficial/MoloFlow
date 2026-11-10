<script setup lang="ts">
import {computed, ref} from 'vue'
import {usePersistentState} from '~/composables/window/usePersistentState'

const raw = usePersistentState('json-tool-input', '')
const error = ref<string | null>(null)

const formatted = computed(() => {
  if (!raw.value.trim()) {
    error.value = null;
    return ''
  }
  try {
    const parsed = JSON.parse(raw.value)
    error.value = null
    return JSON.stringify(parsed, null, 2)
  } catch (e: any) {
    error.value = e.message
    return ''
  }
})

const minify = () => {
  try {
    raw.value = JSON.stringify(JSON.parse(raw.value))
    error.value = null
  } catch (e: any) {
    error.value = e.message
  }
}

const copy = () => navigator.clipboard.writeText(formatted.value || raw.value)
</script>

<template>
  <div class="tool">
    <UIMoloInput v-model="raw" placeholder="Вставь JSON..." class="input"/>
    <div class="actions">
      <UIMoloButton class="small" @click="minify">Минифицировать</UIMoloButton>
      <UIMoloButton class="small" @click="copy">Копировать</UIMoloButton>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <pre v-else class="output">{{ formatted }}</pre>
  </div>
</template>

<style scoped>
.tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 12px;
}

.output {
  width: 100%;
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 10px;
  color: #e2e2e2;
  resize: none;
  overflow: auto;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--half_opacity_border);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}

.btn:hover {
  background: rgba(91, 141, 239, 0.15);
}

.error {
  color: #ef4444;
  font-family: monospace;
  font-size: 12px;
}
</style>