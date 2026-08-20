<script setup lang="ts">
import { computed, ref, watch, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { useModuleCompiler, setGlobalComposables } from '~/composables/useModuleCompiler'
import { useLogger } from '~/composables/useLogger'
import { useNotifications } from '~/composables/useNotifications'
import { useWindowManager } from '~/composables/useWindowManager'
import { useAppStore } from '~~/stores/appStore'

const props = defineProps<{ windowData?: any }>()

const loading = ref(true)
const error = ref<string | null>(null)
const errorDetails = ref<any>(null)
const currentModuleName = ref('')
const renderKey = ref(0)
const showFullError = ref(false)

setGlobalComposables({
  useLogger,
  useNotifications,
  useWindowManager,
  useAppStore
})

// =============================================
// РЕАКТИВНЫЕ ПРОКСИ НА ДАННЫЕ ОКНА
// =============================================
// Вместо ручного копирования в локальные переменные — computed,
// которые всегда отдают актуальное содержимое windowData.
const moduleId   = computed(() => props.windowData?.moduleId || '')
const moduleName = computed(() => props.windowData?.moduleName || 'Без названия')
const code       = computed(() => props.windowData?.code || '')
const files      = computed(() => props.windowData?.files || [])
const dependencies = computed(() => props.windowData?.dependencies || {})

const {
  compiledComponent,
  compiling,
  compileError,
  compileErrorDetails,
  compileModule,
  reset,
  dispose
} = useModuleCompiler()

const { addLog } = useLogger('Preview')

// =============================================
// СБОРКА / КОМПИЛЯЦИЯ
// =============================================
async function rebuild() {
  const currentCode = code.value
  const currentFiles = files.value
  const currentDeps = dependencies.value
  const modId = moduleId.value

  if (!currentCode || !String(currentCode).trim()) {
    reset()
    loading.value = false
    error.value = 'Нет кода для предпросмотра'
    errorDetails.value = null
    return
  }

  loading.value = true
  error.value = null
  errorDetails.value = null
  showFullError.value = false
  currentModuleName.value = moduleName.value

  try {
    const startTime = performance.now()
    await compileModule(currentCode, currentFiles, currentDeps, modId)
    const ms = (performance.now() - startTime).toFixed(0)
    addLog('info', `Компиляция за ${ms}мс`)

    if (compileError.value) {
      error.value = compileError.value
      errorDetails.value = compileErrorDetails.value
    } else {
      // Форсируем полный ре-рендер скомпилированного компонента,
      // даже если ссылка на компонент в кэше не изменилась.
      renderKey.value++
    }
  } catch (err: any) {
    error.value = err?.message || 'Неизвестная ошибка'
    errorDetails.value = { message: err?.message, stack: err?.stack }
  } finally {
    loading.value = false
  }
}

// =============================================
// DEBOUNCE + ДЕДУПЛИКАЦИЯ
// =============================================
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSignature = ''

function scheduleRebuild() {
  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(() => {
    debounceTimer = null

    // Сигнатура охватывает ВСЁ, что влияет на результат:
    // код, файлы, зависимости и ID модуля.
    const signature = JSON.stringify({
      code: code.value,
      files: (files.value || []).map((f: any) => ({
        path: f.path,
        len: f.code?.length,
        fmt: f.format
      })),
      deps: dependencies.value,
      mod: moduleId.value
    })

    if (signature === lastSignature) return
    lastSignature = signature
    rebuild()
  }, 350) // 350 мс — комфортный debounce для печати
}

// =============================================
// ЕДИНЫЙ WATCH НА ВСЕ ИСТОЧНИКИ ДАННЫХ
// =============================================
// Следим за всеми значимыми полями windowData.
// Как только ЧТО-ЛИБО из этого меняется — планируем перекомпиляцию.
watch(
    [code, files, dependencies, moduleId],
    () => scheduleRebuild(),
    { immediate: false }
)

// При первом монтировании — сразу компилируем (без debounce),
// но сбрасываем сигнатуру, чтобы точно не отсечь валидный запуск.
onMounted(() => {
  lastSignature = ''
  rebuild()
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  dispose()
})

onErrorCaptured((err, _instance, info) => {
  error.value = `Ошибка рендеринга: ${err.message || 'неизвестная ошибка'}`
  errorDetails.value = { message: err?.message, stack: err?.stack, info }
  return false
})

// =============================================
// UI
// =============================================
const formattedError = computed(() => {
  if (!errorDetails.value) return error.value || 'Ошибка'
  const d = errorDetails.value
  let r = `❌ ${d.message || error.value}\n`
  if (d.fileName) r += `\n📁 Файл: ${d.fileName}`
  if (d.line)     r += `\n📍 Строка: ${d.line}${d.column ? `, кол. ${d.column}` : ''}`
  if (d.codeContext) r += `\n\n📝 Контекст:\n${d.codeContext}`
  if (showFullError.value && d.stack) r += `\n\n📚 Стек:\n${d.stack}`
  return r
})
</script>

<template>
  <div class="preview-window">
    <div class="preview-header">
      <span class="module-name">{{ currentModuleName }}</span>
      <span v-if="compiling" class="compiling-dot" title="Компилируется…" />
      <button
          v-if="error"
          class="toggle-error-btn"
          @click="showFullError = !showFullError"
      >
        {{ showFullError ? '📄 Скрыть детали' : '📄 Показать детали' }}
      </button>
    </div>

    <div class="preview-content">
      <!-- Загрузка -->
      <div v-if="loading" class="loading-state">
        <MoloLoaders wndLoader />
        <span>Компиляция…</span>
      </div>

      <!-- Ошибка -->
      <div v-else-if="error" class="error-state">
        <div class="error-header">
          <span class="error-icon">⚠️</span>
          <span class="error-title">Ошибка компиляции</span>
          <span v-if="errorDetails?.line" class="error-location">
            Строка {{ errorDetails.line }}{{ errorDetails.column ? `, кол. ${errorDetails.column}` : '' }}
          </span>
        </div>
        <pre class="error-message">{{ formattedError }}</pre>
        <div class="error-actions">
          <button class="copy-error-btn" @click="navigator.clipboard?.writeText(formattedError)">
            📋 Копировать
          </button>
        </div>
      </div>

      <!-- Успех -->
      <div v-else-if="compiledComponent" class="component-wrapper">
        <component :is="compiledComponent" :key="renderKey" :module-id="moduleId" />
      </div>

      <!-- Пусто -->
      <div v-else class="empty-state">
        <span class="empty-icon">📦</span>
        <span>Нет модуля для отображения</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #e6edf3;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}
.module-name {
  font-size: 13px;
  color: #8b949e;
  font-weight: 500;
}
.compiling-dot {
  width: 8px;
  height: 8px;
  background: #d29922;
  border-radius: 50%;
  animation: pulse 1s infinite;
}
.toggle-error-btn {
  padding: 4px 12px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #8b949e;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.toggle-error-btn:hover { background: #30363d; color: #e6edf3; }
.preview-content { flex: 1; overflow: auto; }
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: #8b949e;
}
.error-state {
  background: #1c1a1a;
  border: 1px solid #f85149;
  border-radius: 8px;
  padding: 16px;
  margin: 16px;
}
.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #30363d;
  flex-wrap: wrap;
}
.error-icon { font-size: 20px; }
.error-title { font-weight: 600; color: #f85149; font-size: 14px; }
.error-location {
  font-size: 12px;
  color: #8b949e;
  background: #21262d;
  padding: 2px 10px;
  border-radius: 4px;
  margin-left: auto;
}
.error-message {
  background: #0d1117;
  color: #f0f6fc;
  padding: 12px 16px;
  border-radius: 6px;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.8;
  margin: 0;
  border: 1px solid #21262d;
}
.error-actions { margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; }
.copy-error-btn {
  padding: 6px 14px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #8b949e;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.copy-error-btn:hover { background: #30363d; color: #e6edf3; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: #8b949e;
}
.empty-icon { font-size: 48px; opacity: 0.5; }
.component-wrapper { height: 100%; }
@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}
</style>