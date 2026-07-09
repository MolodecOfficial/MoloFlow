<script setup lang="ts">
import { computed, ref, watch, onErrorCaptured, onMounted } from 'vue'
import { useModuleCompiler, setGlobalComposables } from '~/composables/useModuleCompiler'
import { useLogger } from '~/composables/useLogger'
import { useNotifications } from '~/composables/useNotifications'
import { useWindowManager } from '~/composables/useWindowManager'
import { useAppStore } from "~~/stores/appStore";

const props = defineProps<{ windowData?: any }>()
const loading = ref(true)
const error = ref<string | null>(null)
const errorDetails = ref<any>(null)
const currentModuleName = ref('')
const renderKey = ref(0)
const showFullError = ref(false)
const compileLogs = ref<string[]>([]) // Добавляем логи компиляции

// Устанавливаем composables
setGlobalComposables({
  useLogger,
  useNotifications,
  useWindowManager,
  useAppStore
})

const moduleId = computed(() => props.windowData?.moduleId || '')
const { compiledComponent, compiling, compileError, compileErrorDetails, compileModule, reset } = useModuleCompiler()

// Логгер для отладки
const { addLog } = useLogger('Preview')

async function rebuild() {
  const code = props.windowData?.code

  // Логируем начало компиляции
  addLog('info', `Начинаю компиляцию модуля "${props.windowData?.moduleName || 'Без названия'}"`)
  addLog('info', `Длина кода: ${code?.length || 0} символов`)
  addLog('info', `Файлов: ${props.windowData?.files?.length || 0}`)
  addLog('info', `Зависимостей: ${Object.keys(props.windowData?.dependencies || {}).length}`)

  if (!code || !String(code).trim()) {
    reset()
    loading.value = false
    error.value = 'Нет кода для предпросмотра'
    errorDetails.value = null
    addLog('warning', 'Нет кода для компиляции')
    return
  }

  loading.value = true
  error.value = null
  errorDetails.value = null
  showFullError.value = false
  currentModuleName.value = props.windowData?.moduleName || 'Без названия'

  try {
    const startTime = performance.now()

    await compileModule(
        code,
        props.windowData?.files || [],
        props.windowData?.dependencies || {},
        moduleId.value
    )

    const endTime = performance.now()
    addLog('info', `Компиляция завершена за ${(endTime - startTime).toFixed(2)}мс`)

    if (compileError.value) {
      error.value = compileError.value
      errorDetails.value = compileErrorDetails.value
      addLog('error', `Ошибка компиляции: ${compileError.value}`)
      if (compileErrorDetails.value?.line) {
        addLog('error', `Строка ${compileErrorDetails.value.line}, колонка ${compileErrorDetails.value.column}`)
      }
    } else {
      renderKey.value++
      addLog('success', 'Компиляция успешна!')
    }
  } catch (err: any) {
    error.value = err?.message || 'Неизвестная ошибка компиляции'
    errorDetails.value = {
      message: err?.message,
      stack: err?.stack,
      raw: err
    }
    addLog('error', `Критическая ошибка: ${err?.message}`)
    console.error('[Preview] Compilation error:', err)
  } finally {
    loading.value = false
  }
}

// Следим за ошибками компиляции
watch(compileError, (err) => {
  if (err) {
    error.value = err
    errorDetails.value = compileErrorDetails.value
    addLog('error', `Обнаружена ошибка компиляции: ${err}`)
  }
})

// Пересборка при изменении данных
watch(
    () => [props.windowData?.code, props.windowData?.files, props.windowData?.dependencies, props.windowData?.moduleId],
    () => {
      rebuild()
    },
    { immediate: true, deep: true }
)

// Ловим ошибки внутри компонента
onErrorCaptured((err, instance, info) => {
  console.error('[Preview] Error captured:', err, info)
  addLog('error', `Ошибка рендеринга: ${err.message}`)
  error.value = `Ошибка рендеринга: ${err.message || 'неизвестная ошибка'}`
  errorDetails.value = {
    message: err?.message,
    stack: err?.stack,
    info: info,
    raw: err
  }
  return false
})

// Форматирование ошибки для отображения
const formattedError = computed(() => {
  if (!errorDetails.value) return error.value || 'Ошибка'

  const details = errorDetails.value
  let result = `❌ ${details.message || error.value || 'Ошибка компиляции'}\n\n`

  if (details.fileName) {
    result += `📁 Файл: ${details.fileName}\n`
  }

  if (details.line) {
    result += `📍 Строка: ${details.line}`
    if (details.column) {
      result += `, колонка: ${details.column}`
    }
    result += '\n'
  }

  if (details.codeContext) {
    result += `\n📝 Контекст:\n${details.codeContext}\n`
  }

  if (showFullError.value && details.stack) {
    result += `\n📚 Полный стек:\n${details.stack}\n`
  }

  return result
})

// Проверяем данные при монтировании
onMounted(() => {
  addLog('info', 'Preview компонент смонтирован')
  if (props.windowData?.code) {
    addLog('info', `Получен код для компиляции (${props.windowData.code.length} символов)`)
  } else {
    addLog('warning', 'Нет кода для компиляции при монтировании')
  }
})
</script>

<template>
  <div class="preview-window">
    <div class="preview-header">
      <span class="module-name">{{ currentModuleName }}</span>
      <span v-if="compiling" class="compiling-dot"></span>
      <button
          v-if="error"
          class="toggle-error-btn"
          @click="showFullError = !showFullError"
          title="Показать/скрыть детали"
      >
        {{ showFullError ? '📄 Скрыть детали' : '📄 Показать детали' }}
      </button>
    </div>
    <div class="preview-content">
      <div v-if="loading" class="loading-state">
        <MoloLoaders wndLoader />
        <span>Компиляция модуля...</span>
      </div>
      <div v-else-if="error" class="error-state">
        <div class="error-header">
          <span class="error-icon">⚠️</span>
          <span class="error-title">Ошибка компиляции</span>
          <span v-if="errorDetails?.line" class="error-location">
            Строка {{ errorDetails.line }}{{ errorDetails.column ? `, колонка ${errorDetails.column}` : '' }}
          </span>
        </div>
        <pre class="error-message">{{ formattedError }}</pre>
        <div class="error-actions">
          <button class="copy-error-btn" @click="navigator.clipboard?.writeText(formattedError)">
            📋 Копировать ошибку
          </button>
        </div>
      </div>
      <div v-else-if="compiledComponent" class="component-wrapper">
        <component :is="compiledComponent" :key="renderKey" :module-id="moduleId" />
      </div>
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
  width: 10px;
  height: 10px;
  background: #d29922;
  border-radius: 50%;
  display: inline-block;
  animation: pulse 1s infinite;
  margin-left: 8px;
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

.toggle-error-btn:hover {
  background: #30363d;
  color: #e6edf3;
}

.preview-content {
  flex: 1;
  overflow: auto;
}

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
  max-width: 100%;
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

.error-icon {
  font-size: 20px;
}

.error-title {
  font-weight: 600;
  color: #f85149;
  font-size: 14px;
}

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
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.8;
  margin: 0;
  border: 1px solid #21262d;
}

.error-message .error-line {
  color: #f85149;
  background: #2d1a1a;
  display: block;
}

.error-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

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

.copy-error-btn:hover {
  background: #30363d;
  color: #e6edf3;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: #8b949e;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.component-wrapper {
  height: 100%;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* Стили для подсветки кода в ошибке */
.error-message .highlight-line {
  background: #2d1a1a;
  border-left: 3px solid #f85149;
  padding-left: 8px;
  display: block;
}

.error-message .line-number {
  color: #8b949e;
  user-select: none;
}
</style>