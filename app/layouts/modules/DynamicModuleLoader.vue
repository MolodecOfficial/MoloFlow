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
} = useModuleCompiler()
const { addLog } = useLogger('Динамический загрузчик')

const error = ref<Error | null>(null)

async function loadModule() {
  if (!props.moduleData?.code) {
    error.value = new Error('Нет кода')
    return
  }
  addLog('info', 'Начинаю загрузку модуля...')
  await compileModule(
      props.moduleData.code,
      props.additionalFiles || []
  )
}

watch(compiledComponent, (c) => {
  if (c) {
    addLog('success', 'Загрузка модуля закончена')

    emit('loaded', true)
  }
})

watch(compileError, (e) => {
  if (e) {
    error.value = new Error(e)
    emit('error', e)
  }
})

onMounted(loadModule)
onUnmounted(() => {
  addLog('error', 'Загрузчик размонтируется, перезагружаю компилятор...')
  reset()
})
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
</style>