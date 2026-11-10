<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  collectPyFiles,
  usePythonRuntime,
  type PyLog,
  type PyRunResult
} from '~~/app/composables/compiler/usePythonRuntime'
import { useLogger } from '~~/app/composables/useLogger'

const props = withDefaults(defineProps<{
  code: string
  fileName?: string
  files?: any[]
  dependencies?: Record<string, string>
  moduleName?: string
  autoRun?: boolean
  timeoutMs?: number
  defaultEngine?: 'client' | 'server' // <-- Новый пропс
}>(), {
  fileName: 'main',
  files: () => [],
  dependencies: () => ({}),
  moduleName: 'Python',
  autoRun: false,
  timeoutMs: 30000,
  defaultEngine: 'server'
})

// Состояние выбранного движка
const selectedEngine = ref<'client' | 'server'>(props.defaultEngine)

const selectEngine = [
  {
    label: 'Сервер (Python 3 + SSL)', value: 'server'
  },
  {
    label: 'Браузер (Pyodide Wasm)', value: 'client'
  }
]

const { addLog } = useLogger(props.moduleName || 'Python')
const runtime = usePythonRuntime()

const logs = ref<PyLog[]>([])
const result = ref<PyRunResult | null>(null)
const contextText = ref('{}')
const contextError = ref('')
const showContext = ref(false)
const outputEl = ref<HTMLElement | null>(null)
const ownsRun = ref(false)

const stageText = computed(() => {
  if (!ownsRun.value) return runtime.busy.value ? 'Python занят' : ''
  if (selectedEngine.value === 'server') {
    return 'Выполнение на сервере (Node/Python)...'
  }
  switch (runtime.stage.value) {
    case 'runtime': return 'Загрузка Pyodide...'
    case 'packages': return 'Подготовка пакетов...'
    case 'running': return 'Выполняется...'
    default: return ''
  }
})
const resultText = computed(() => {
  if (!result.value?.ok || !result.value.hasResult) return ''
  try {
    return JSON.stringify(result.value.result, null, 2)
  } catch {
    return String(result.value.result)
  }
})

const durationText = computed(() => {
  const ms = result.value?.durationMs
  if (ms == null) return ''
  return ms < 1000 ? `${Math.round(ms)} мс` : `${(ms / 1000).toFixed(1)} с`
})

function scrollToEnd() {
  nextTick(() => {
    if (outputEl.value) outputEl.value.scrollTop = outputEl.value.scrollHeight
  })
}

function onLog(entry: PyLog) {
  logs.value.push(entry)
  if (entry.level === 'info') addLog('info', entry.text)
  else if (entry.level === 'error') addLog('error', entry.text)
  scrollToEnd()
}

async function run(overrideEngine?: 'client' | 'server') {
  let context: any = {}
  try {
    context = contextText.value.trim() ? JSON.parse(contextText.value) : {}
    contextError.value = ''
  } catch {
    contextError.value = 'Контекст должен быть корректным JSON'
    showContext.value = true
    return
  }

  logs.value = []
  result.value = null
  ownsRun.value = true

  const activeEngine = overrideEngine || selectedEngine.value
  const { entry, files } = collectPyFiles(props.code, props.fileName, props.files)

  try {
    // Передаем engine в usePythonRuntime
    const res = await runtime.run({
      entry,
      files,
      dependencies: props.dependencies,
      context,
      timeoutMs: props.timeoutMs,
      engine: activeEngine, // <--- ВОТ ЗДЕСЬ УКАЗЫВАЕТСЯ ENGINE
      onLog
    })
    result.value = res

    if (res.ok) addLog('success', `Выполнено за ${res.durationMs} мс (${activeEngine})`)
    else if (res.error) addLog('error', res.error.message)
  } finally {
    ownsRun.value = false
    scrollToEnd()
  }
}

function stop() {
  runtime.stop('user')
}

function clear() {
  logs.value = []
  result.value = null
}

onMounted(() => {
  void runtime.warmup().catch(() => {})
  if (props.autoRun) run()
})

onBeforeUnmount(() => {
  // Окно закрыли посреди выполнения — не оставляем воркер крутить цикл в фоне
  if (ownsRun.value) runtime.stop('unmount')
})

defineExpose({ run, stop, clear })
</script>

<template>
  <section class="py-console">
    <header class="pc-bar">
      <div class="pc-actions">
        <UIMoloButton
            class="small confirm"
            :disabled="runtime.busy.value"
            title="Запустить Python-код"
            @click="() => run()"
        >
          <UIMoloSticker name="play"/>
        </UIMoloButton>

        <!-- Селектор переключения движка прямо в консоли -->
        <UIMoloSelect
            v-model="selectedEngine"
            compact
            :parent="selectEngine"
            children="label"
            valueKey="value"
        />

        <UIMoloButton v-if="ownsRun" class="small close" @click="stop">
          <UIMoloSticker name="stop"/>
        </UIMoloButton>
        <UIMoloButton class="small" :disabled="!logs.length && !result" @click="clear">
          <UIMoloSticker name="trash"/>
        </UIMoloButton>
        <UIMoloButton class="small" @click="showContext = !showContext">
        <UIMoloSticker name="context"/>
        </UIMoloButton>
      </div>

      <div class="pc-status">
        <span v-if="stageText" class="pc-stage">{{ stageText }}</span>
        <template v-else-if="result">
          <span :class="result.ok ? 'pc-ok' : 'pc-fail'">
            {{ result.ok ? 'Выполнено' : (result.stopped ? 'Остановлено' : 'Ошибка') }}
          </span>
          <span class="pc-time">{{ result.durationMs }} мс</span>
        </template>
      </div>
    </header>

    <div ref="outputEl" class="pc-output" role="log" aria-live="polite">
      <div v-if="!logs.length && !result" class="pc-empty">
        Вывод print() и результат функции main(context) появятся здесь.
      </div>

      <div
          v-for="(l, i) in logs"
          :key="i"
          class="pc-line"
          :class="`lvl-${l.level}`"
      >{{ l.text }}</div>

      <pre v-if="result && !result.ok && result.error" class="pc-error">{{ result.error.traceback || result.error.message }}</pre>

      <div v-if="result?.ok && result.hasResult" class="pc-result">
        <span class="pc-result-label">Результат</span>
        <pre>{{ resultText }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.py-console {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: #16171f;
  border-top: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.08));
  font-size: 12px;
  color: #abb2bf;
}

.pc-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.08));
}

.pc-actions {
  display: flex;
  gap: 6px;
}

.pc-status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pc-stage {
  color: #e5c07b;
}

.pc-ok { color: #98c379; font-weight: 600; }
.pc-fail { color: #e06c75; font-weight: 600; }
.pc-time { color: #6a737d; }

.pc-context {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.08));
}

.pc-context label {
  color: #8c8c9e;
}

.pc-context textarea {
  resize: vertical;
  font: 12px/1.5 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  color: #abb2bf;
  background: #1a1b26;
  border: 1px solid #2a2e42;
  border-radius: 6px;
  padding: 6px 8px;
}

.pc-context textarea:focus-visible {
  outline: 2px solid #61afef;
  outline-offset: 1px;
}

.pc-context textarea.invalid {
  border-color: #e06c75;
}

.pc-context-error {
  color: #e06c75;
}

.pc-output {
  flex: 1 1 0%;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px;
  font: 12px/1.55 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

.pc-empty {
  color: #6a737d;
  font-family: inherit;
}

.pc-line {
  white-space: pre-wrap;
  word-break: break-word;
}

.lvl-error { color: #e06c75; }
.lvl-system { color: #6a737d; font-style: italic; }

.pc-error {
  margin: 8px 0 0;
  padding: 8px 10px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #e06c75;
  background: rgba(224, 108, 117, 0.08);
  border-left: 3px solid #e06c75;
  border-radius: 0 6px 6px 0;
  font: inherit;
}

.pc-result {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(152, 195, 121, 0.07);
  border-left: 3px solid #98c379;
  border-radius: 0 6px 6px 0;
}

.pc-result-label {
  display: block;
  margin-bottom: 4px;
  color: #98c379;
  font-family: system-ui, sans-serif;
}

.pc-result pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #abb2bf;
  font: inherit;
}
</style>