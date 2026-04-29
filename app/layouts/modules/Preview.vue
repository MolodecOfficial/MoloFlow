<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useModuleCompiler } from '~/composables/useModuleCompiler'

const props = defineProps<{
  windowData?: any
}>()

const loading = ref(true)
const error = ref<string | null>(null)
const currentModuleName = ref('')
const renderKey = ref(0)

const {
  compiledComponent,
  compiling,
  compileError,
  compileModule
} = useModuleCompiler()

// Сброс и загрузка при изменении кода или файлов
watch(
    () => [props.windowData?.code, props.windowData?.files],
    async ([newCode, newFiles]) => {
      if (!newCode) {
        loading.value = false
        return
      }

      loading.value = true
      error.value = null
      currentModuleName.value = props.windowData?.moduleName || 'Без названия'

      // Принудительно увеличиваем ключ, чтобы компонент пересоздался
      renderKey.value++

      await compileModule(newCode as string, (newFiles as any[]) || [])
      loading.value = false
    },
    { immediate: true, deep: true }
)

// Отслеживаем ошибки компиляции
watch(compileError, (err) => {
  if (err) error.value = err
})
</script>

<template>
  <div class="preview-window">
    <div class="preview-header">
      <span class="module-name">{{ currentModuleName }}</span>
      <span v-if="compiling" class="compiling-dot"></span>
    </div>

    <div class="preview-content">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>Загрузка модуля...</span>
      </div>

      <div v-else-if="compiling" class="compiling-state">
        <div class="spinner"></div>
        <span>Компиляция...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <pre>{{ error }}</pre>
      </div>

      <div v-else-if="compiledComponent" class="component-wrapper">
        <component :is="compiledComponent" :key="renderKey" />
      </div>

      <div v-else class="empty-state">
        Нет модуля для отображения
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
}

.preview-header {
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.module-name {
  border: 1px solid var(--half_opacity_border);
  font-size: 11px;
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 10px;
  border-radius: 16px;
  color: #ccc;
}

.compiling-dot {
  width: 8px;
  height: 8px;
  background: #ffaa00;
  border-radius: 50%;
  display: inline-block;
  margin-left: 8px;
  animation: pulse 1s infinite;
}

.preview-content {
  flex: 1;
  overflow: auto;
}

.loading-state, .compiling-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #3c3c3c;
  border-top-color: #3a6ea5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.error-state pre {
  background: #2a1e1e;
  color: #ffaaaa;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
  max-width: 90%;
  white-space: pre-wrap;
  font-size: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>