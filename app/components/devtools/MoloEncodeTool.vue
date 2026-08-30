<!-- app/components/devtools/DevEncodeTool.vue -->
<script setup lang="ts">
import {computed, ref} from 'vue'
import {usePersistentState} from '~/composables/window/usePersistentState'

const mode = usePersistentState<'base64' | 'url' | 'jwt'>('encode-mode', 'base64')
const input = usePersistentState('encode-input', '')
const error = ref<string | null>(null)

const base64Result = computed(() => {
  try {
    error.value = null
    return {
      encode: btoa(unescape(encodeURIComponent(input.value))),
      decode: decodeURIComponent(escape(atob(input.value)))
    }
  } catch (e: any) {
    error.value = 'Некорректная строка для base64';
    return {encode: '', decode: ''}
  }
})

const urlResult = computed(() => ({
  encode: encodeURIComponent(input.value),
  decode: (() => {
    try {
      return decodeURIComponent(input.value)
    } catch {
      return ''
    }
  })()
}))

const jwtResult = computed(() => {
  try {
    const [h, p] = input.value.split('.')
    const decode = (s: string) => JSON.stringify(JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/'))), null, 2)
    error.value = null
    return {header: decode(h), payload: decode(p)}
  } catch {
    error.value = 'Некорректный JWT';
    return {header: '', payload: ''}
  }
})
</script>

<template>
  <div class="tool">
    <div class="tabs">
      <UIMoloButton v-for="m in ['base64','url','jwt']" :key="m" class="small" :class="{confirm: mode === m}"
              @click="mode = m as any">{{ m.toUpperCase() }}
      </UIMoloButton>
    </div>
    <textarea v-model="input" class="input" placeholder="Вставь строку..."/>
    <div v-if="error" class="error">{{ error }}</div>

    <template v-if="mode === 'base64'">
      <div class="field"><span>Encode:</span>
        <pre>{{ base64Result.encode }}</pre>
      </div>
      <div class="field"><span>Decode:</span>
        <pre>{{ base64Result.decode }}</pre>
      </div>
    </template>
    <template v-else-if="mode === 'url'">
      <div class="field"><span>Encode:</span>
        <pre>{{ urlResult.encode }}</pre>
      </div>
      <div class="field"><span>Decode:</span>
        <pre>{{ urlResult.decode }}</pre>
      </div>
    </template>
    <template v-else>
      <div class="field"><span>Header:</span>
        <pre>{{ jwtResult.header }}</pre>
      </div>
      <div class="field"><span>Payload:</span>
        <pre>{{ jwtResult.payload }}</pre>
      </div>
    </template>
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

.tabs {
  display: flex;
  gap: 6px;
}

.input {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  padding: 8px;
  color: #fff;
  font-family: monospace;
  font-size: 13px;
  min-height: 70px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field span {
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
}

.field pre {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.error {
  color: #ef4444;
  font-size: 12px;
}
</style>