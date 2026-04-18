<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useModuleCompiler } from '~~/app/composables/useModuleCompiler'
import { executeScript } from '~~/app/composables/useScriptCompiler'

const props = defineProps<{
  windowId: string
  groupId: string
  subGroupId?: string
  windowData?: any
}>()

const {
  compiledComponent,
  compileModule,
  compileError,
  compiling
} = useModuleCompiler()

const loading = ref(true)
const error = ref<string | null>(null)
const scriptResult = ref<any>(null)
const enterpriseInfo = ref<any>(null)

onMounted(async () => {
  try {
    // 👉 получаем предприятие
    const data = localStorage.getItem('currentEnterprise')
    if (data) {
      enterpriseInfo.value = JSON.parse(data)
    }

    const moduleId = props.windowData?._id

    if (!moduleId || !enterpriseInfo.value?._id) {
      throw new Error('Нет ID модуля или предприятия')
    }

    // 👉 загружаем модуль
    const response = await $fetch(
        `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${moduleId}`
    )

    const code = response.module.code
    const format = response.module.format

    if (format === 'vue') {
      await compileModule(code)
    } else {
      const result = await executeScript(code, format, {
        onError: (err) => console.error('[Module Error]', err)
      })

      scriptResult.value = result

      // если вернули Vue компонент
      if (result && typeof result === 'object' && (result.render || result.setup)) {
        compiledComponent.value = result
      }
    }

  } catch (err: any) {
    console.error('Ошибка загрузки модуля:', err)
    error.value = err.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dynamic-module-container">

    <!-- ⏳ загрузка -->
    <div v-if="loading || compiling" class="loading">
      <div class="loading-spinner"></div>
    </div>

    <div v-else-if="error" class="error">
      <span>{{ error }}</span>
    </div>

    <div v-else-if="compileError" class="error">
      <pre>{{ compileError }}</pre>
    </div>

    <div v-else-if="compiledComponent" class="module-content">
      <component :is="compiledComponent" />
    </div>

    <div v-else-if="scriptResult" class="script-result">
      <div class="result-header">
        <span>Модуль выполнен</span>
      </div>
      <pre class="result-content">
{{ JSON.stringify(scriptResult, null, 2) }}
      </pre>
    </div>

    <!-- 🤷 fallback -->
    <div v-else class="module-content">
      Нет данных для отображения
    </div>

  </div>
</template>

<style scoped>
.dynamic-module-container {
  height: 100%;
  overflow: auto;
}

.loading,
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
}

.error {
  color: #fa5252;
}

.module-content {
  color: white;
}

.script-result {
  padding: 10px;
  color: #fff;
}

.result-header {
  font-weight: bold;
  margin-bottom: 10px;
}
</style>