<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useModuleCompiler } from '~/composables/useModuleCompiler'

const props = defineProps<{
  moduleData?: any
  moduleName?: string
  additionalFiles?: any[]
}>()

const emit = defineEmits(['loaded', 'error', 'moduleEvent'])

const {
  compiledComponent,
  compileModule,
  compiling,
  compileError,
  reset,
  activeKey
} = useModuleCompiler() // 💥 FIX

const error = ref<Error | null>(null)

async function loadModule() {
  if (!props.moduleData?.code) {
    error.value = new Error('Нет кода')
    return
  }

  await compileModule(
      props.moduleData.code,
      props.additionalFiles || []
  )
}

watch(compiledComponent, (c) => {
  if (c) emit('loaded', true)
})

watch(compileError, (e) => {
  if (e) {
    error.value = new Error(e)
    emit('error', e)
  }
})

onMounted(loadModule)
onUnmounted(reset)
</script>

<template>
  <div class="dynamic-module-loader">

    <div v-if="error">{{ error.message }}</div>

    <div v-else-if="compiling">loading...</div>

    <component
        v-else-if="compiledComponent"
        :is="compiledComponent"
        :key="activeKey"
        @module-event="(e:any)=>emit('moduleEvent', e)"
    />

  </div>
</template>

<style scoped>
.dynamic-module-loader {
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.module-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
  color: #888;
}

.module-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
}

.module-error button {
  margin-top: 8px;
  padding: 4px 12px;
  cursor: pointer;
  background: #3a6ea5;
  color: white;
  border: none;
  border-radius: 4px;
}

.modern-loader {
  width: 40px;
  height: 40px;
  border: 3px solid #3c3c3c;
  border-top-color: #3a6ea5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>