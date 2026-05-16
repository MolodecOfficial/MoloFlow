<!-- components/modules/preview.vue -->
<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useModuleCompiler} from '~/composables/useModuleCompiler'

const props = defineProps<{ windowData?: any }>()
const loading = ref(true)
const error = ref<string | null>(null)
const currentModuleName = ref('')
const renderKey = ref(0)

const moduleId = computed(() => props.windowData?.moduleId || '')
const {compiledComponent, compiling, compileError, compileModule, reset} = useModuleCompiler()

async function rebuild() {
  const code = props.windowData?.code
  if (!code || !String(code).trim()) {
    reset()
    loading.value = false
    error.value = 'Нет кода для предпросмотра'
    return
  }

  loading.value = true
  error.value = null
  currentModuleName.value = props.windowData?.moduleName || 'Без названия'

  await compileModule(
      code,
      props.windowData?.files || [],
      props.windowData?.dependencies || {},
      moduleId.value
  )
  renderKey.value++
  loading.value = false
}

watch(
    () => [props.windowData?.code, props.windowData?.files, props.windowData?.dependencies, props.windowData?.moduleId],
    rebuild,
    {immediate: true, deep: true}
)

watch(compileError, (err) => {
  error.value = err
})
</script>

<template>
  <div class="preview-window">
    <div class="preview-header">
      <span class="module-name">{{ currentModuleName }}</span>
      <span v-if="compiling" class="compiling-dot"></span>
    </div>
    <div class="preview-content">
      <div v-if="loading">Загрузка...</div>
      <div v-else-if="error" class="error-state">
        <pre>{{ error }}</pre>
      </div>
      <div v-else-if="compiledComponent" class="component-wrapper">
        <component :is="compiledComponent" :key="renderKey" :module-id="moduleId"/>
      </div>
      <div v-else>Нет модуля для отображения</div>
    </div>
  </div>
</template>

<style scoped>
/* стили без изменений */
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

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}
</style>