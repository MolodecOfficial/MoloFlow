<!-- components/modules/DynamicModuleLoader.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useModuleCompiler } from '~/composables/useModuleCompiler'

const props = defineProps<{
  moduleData?: any
  moduleId?: string
}>()

const emit = defineEmits(['loaded', 'error', 'moduleEvent'])

const {
  compiledComponent,
  compileModule,
  compiling,
  compileError,
  reset,
  activeKey
} = useModuleCompiler()

const error = ref<string | null>(null)

async function loadModule() {
  error.value = null
  const data = props.moduleData || {}
  const code = data.code || ''
  const files = data.files || []
  const deps = data.dependencies || {}

  if (!code.trim()) {
    error.value = 'Нет кода модуля'
    emit('error', error.value)
    return
  }

  await compileModule(code, files, deps, props.moduleId || data._id)
}

watch(
    () => [props.moduleData?.code, props.moduleData?.files, props.moduleData?.dependencies, props.moduleId],
    () => loadModule(),
    { deep: true }
)

watch(compiledComponent, (comp) => {
  if (comp) emit('loaded', true)
})

watch(compileError, (err) => {
  if (err) {
    error.value = err
    emit('error', err)
  }
})

onMounted(loadModule)
onUnmounted(() => reset())
</script>

<template>
  <div class="dynamic-module-loader">
    <div v-if="error" class="error">{{ error }}</div>
    <div v-else-if="compiling" class="loading">Загрузка модуля...</div>
    <component
        v-else-if="compiledComponent"
        :is="compiledComponent"
        :key="activeKey"
        :module-id="props.moduleId"
        @module-event="(e: any) => emit('moduleEvent', e)"
    />
    <div v-else class="empty">Модуль не загружен</div>
  </div>
</template>

<style scoped>
.dynamic-module-loader { padding: 10px; }
.error { color: red; }
.loading { color: #aaa; }
.empty { color: #666; }
</style>