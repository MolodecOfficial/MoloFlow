<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { setGlobalComposables, useModuleCompiler } from '~/composables/useModuleCompiler'
import { useLogger } from '~/composables/useLogger'
import { useNotifications } from '~/composables/useNotifications'
import { useWindowManager } from '~/composables/useWindowManager'

const props = defineProps<{
  moduleData?: any
  moduleId?: string
  additionalFiles?: any[]
  enterpriseId?: string
}>()

const emit = defineEmits(['loaded', 'error', 'moduleEvent'])

// Устанавливаем реальные composables
setGlobalComposables({
  useLogger,
  useNotifications,
  useWindowManager,
})

const {
  compiledComponent,
  compileModule,
  compiling,
  compileError,
  reset,
  activeKey
} = useModuleCompiler()

const error = ref<string | null>(null)
const loadedModuleData = ref<any>(null)
const isLoadingModule = ref(false)
const { addLog } = useLogger('Загрузчик модуля')

// Получение enterpriseId из разных источников
const getEnterpriseId = (): string | null => {
  // 1. Из пропсов
  if (props.enterpriseId) return props.enterpriseId

  // 2. Из moduleData
  if (props.moduleData?.enterpriseId) return props.moduleData.enterpriseId

  // 3. Из глобальной переменной
  if ((window as any).__currentEnterprise?._id) return (window as any).__currentEnterprise._id

  // 4. Из localStorage
  try {
    const enterpriseStr = localStorage.getItem('currentEnterprise')
    if (enterpriseStr) {
      const enterprise = JSON.parse(enterpriseStr)
      if (enterprise?._id) return enterprise._id
    }
  } catch (e) {}

  // 5. Из sessionStorage
  try {
    const tokenData = sessionStorage.getItem('enterprise_data')
    if (tokenData) {
      const data = JSON.parse(tokenData)
      if (data?._id) return data._id
    }
  } catch (e) {}

  return null
}

const getModuleId = (): string | null => {
  if (props.moduleId) return props.moduleId
  if (props.moduleData?._id) return props.moduleData._id
  if (props.moduleData?.moduleId) return props.moduleData.moduleId
  if (props.moduleData?.id) return props.moduleData.id
  return null
}

// Загрузка полных данных модуля с сервера
async function fetchFullModuleData() {
  // Если есть код в переданных данных
  if (props.moduleData?.code && props.moduleData?.code.trim()) {
    addLog('info', 'Использую переданные данные')
    return props.moduleData
  }

  const id = getModuleId()
  if (!id) {
    addLog('error', 'Нет ID модуля')
    return null
  }

  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) {
    addLog('error', 'Нет ID предприятия')
    return null
  }

  try {
    isLoadingModule.value = true
    const response = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${id}/files`)

    if (response?.mainFile?.code) {
      return {
        _id: id,
        name: response.mainFile.name || 'Модуль',
        format: response.mainFile.format || 'vue',
        code: response.mainFile.code,
        files: response.files || []
      }
    }
    return null
  } catch (err) {
    addLog('error', 'Ошибка:', err)
    return null
  } finally {
    isLoadingModule.value = false
  }
}
async function loadModule() {
  error.value = null

  // Сначала пробуем получить полные данные
  let fullData = props.moduleData

  if (!fullData?.code || !fullData.code.trim()) {
    fullData = await fetchFullModuleData()
  }

  if (!fullData) {
    error.value = 'Не удалось загрузить модуль. Проверьте, что модуль сохранен и содержит код.'
    emit('error', error.value)
    return
  }

  const code = fullData.code || ''
  const files = props.additionalFiles || fullData.files || []
  const deps = fullData.dependencies || {}

  addLog('info', 'Компиляция модуля...')

  if (!code.trim()) {
    error.value = 'Нет кода модуля. Пожалуйста, сохраните модуль с кодом.'
    emit('error', error.value)
    return
  }

  loadedModuleData.value = fullData
  await compileModule(code, files, deps, props.moduleId || fullData._id)
}

// Следим за изменением пропсов
watch(
    () => [props.moduleData, props.moduleId, props.enterpriseId],
    () => {
      loadModule()
    },
    { deep: true, immediate: false }
)

watch(compiledComponent, (comp) => {
  if (comp) {
    addLog('success', 'Компиляция успешна')
    emit('loaded', true)
  }
})

watch(compileError, (err) => {
  if (err) {
    error.value = `Ошибка компиляции: ${err}`
    emit('error', err)
  }
})

onMounted(() => {
  addLog('info', 'Монтирование, загрузка модуля...')
  loadModule()
})

onUnmounted(() => {
  addLog('info', 'Размонтирование, сброс...')
  reset()
})
</script>

<template>
  <div class="dynamic-module-loader">
    <div v-if="isLoadingModule" class="loading-state">
      <MoloLoaders wndLoader/>
    </div>
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <div class="error-message">{{ error }}</div>
    </div>
    <div v-else-if="compiling" class="loading-state">
      <MoloLoaders wndLoader/>
      <span>Компиляция модуля...</span>
    </div>
    <component
        v-else-if="compiledComponent"
        :is="compiledComponent"
        :key="activeKey"
        :module-id="props.moduleId || loadedModuleData?._id"
        @module-event="(e: any) => emit('moduleEvent', e)"
    />
    <div v-else class="empty-state">
      <div class="empty-icon">📦</div>
      <div>Модуль не загружен</div>
    </div>
  </div>
</template>

<style scoped>
.dynamic-module-loader {
  padding: 10px;
  height: 100%;
  overflow: auto;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  color: #ef4444;
}

.error-icon {
  font-size: 32px;
}

.error-message {
  font-family: monospace;
  font-size: 14px;
  text-align: center;
  word-break: break-word;
  max-width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: #666;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}


</style>