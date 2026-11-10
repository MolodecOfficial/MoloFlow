<script setup lang="ts">
import {computed} from 'vue'
import {usePersistentState} from '~/composables/window/usePersistentState'

const pattern = usePersistentState('regex-pattern', '')
const flags = usePersistentState('regex-flags', 'g')
const testString = usePersistentState('regex-test-string', '')

const result = computed(() => {
  if (!pattern.value) return {matches: [], error: null}
  try {
    const re = new RegExp(pattern.value, flags.value)
    const matches = [...testString.value.matchAll(re.global ? re : new RegExp(re, flags.value + 'g'))]
    return {matches, error: null}
  } catch (e: any) {
    return {matches: [], error: e.message}
  }
})

const highlighted = computed(() => {
  if (result.value.error || !pattern.value) return testString.value
  let out = ''
  let lastIndex = 0
  for (const m of result.value.matches) {
    if (m.index === undefined) continue
    out += escapeHtml(testString.value.slice(lastIndex, m.index))
    out += `<mark>${escapeHtml(m[0])}</mark>`
    lastIndex = m.index + m[0].length
  }
  out += escapeHtml(testString.value.slice(lastIndex))
  return out
})

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
</script>

<template>
  <div class="tool">
    <div class="row">
      <span>/</span>
      <input v-model="pattern" placeholder="паттерн" class="pattern-input"/>
      <span>/</span>
      <input v-model="flags" placeholder="флаги" class="flags-input"/>
    </div>
    <div v-if="result.error" class="error">{{ result.error }}</div>
    <textarea v-model="testString" placeholder="Тестовая строка..." class="input"/>
    <div class="highlighted" v-html="highlighted"/>
    <div class="meta">Совпадений: {{ result.matches.length }}</div>
  </div>
</template>

<style scoped>
.tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  height: 100%;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  color: #999;
}

.pattern-input {
  flex: 1;
}

.flags-input {
  width: 60px;
}

.pattern-input, .flags-input, .input {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  padding: 8px;
  color: #fff;
  font-family: monospace;
  font-size: 13px;
}

.input {
  min-height: 90px;
  resize: vertical;
}

.highlighted {
  flex: 1;
  overflow: auto;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
}

.highlighted :deep(mark) {
  background: rgba(91, 141, 239, 0.4);
  color: #fff;
  border-radius: 3px;
}

.error {
  color: #ef4444;
  font-size: 12px;
  font-family: monospace;
}

.meta {
  color: #888;
  font-size: 12px;
}
</style>