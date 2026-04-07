<script setup lang="ts">
import {ref, watch} from 'vue'
import {useModuleCompiler} from '~/composables/useModuleCompiler'


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
  compileModuleDebounced
} = useModuleCompiler()

// 🔥 ТОЛЬКО КОД
watch(
    () => props.windowData?.code,
    (code) => {
      if (!code) return

      loading.value = false
      error.value = null
      currentModuleName.value =
          props.windowData?.moduleName || 'Без названия'

      compileModuleDebounced(code)
    },
    { immediate: true }
)

// ошибки
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
        <p>Загрузка...</p>
      </div>

      <div v-else-if="compiling" class="compiling-state">
        <div class="spinner"></div>
        <p>Компиляция...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <pre>{{ error }}</pre>
      </div>

      <div v-else-if="compiledComponent" class="component-wrapper">
        <component :is="compiledComponent" :key="renderKey" />
      </div>

      <div v-else class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.module-name {
  top: 70px;
  position: absolute;
  right: 10px;
  width: fit-content;
  display: flex;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 10px;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.5px;
  white-space: nowrap;
  backdrop-filter: blur(2px);
  border: 1px solid var(--half_opacity_border);
  font-weight: 500;
  gap: 8px;
  transition: all 0.15s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-top: 3px solid #38ef7d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

</style>