<script setup lang="ts">
import { ref, onMounted, shallowRef } from 'vue'
import * as Vue from 'vue'
import * as compiler from '@vue/compiler-sfc'
import { loadModule } from 'vue3-sfc-loader'

const props = defineProps<{
  windowId: string
  groupId: string
  subGroupId?: string
  windowData?: any
}>()

const loading = ref(true)
const error = ref<string | null>(null)
const compiledComponent = shallowRef<any>(null)
const enterpriseInfo = ref<any>(null)

onMounted(async () => {
  const data = localStorage.getItem('currentEnterprise')
  if (data) {
    try {
      enterpriseInfo.value = JSON.parse(data)
    } catch (e) {
      console.error('Ошибка парсинга данных предприятия', e)
    }
  }

  try {
    const moduleId =
        props.windowData?._id ||
        props.windowId.replace('dynamic_', '')

    if (!moduleId || !enterpriseInfo.value?._id) {
      throw new Error('Нет ID модуля или предприятия')
    }

    const response = await $fetch(
        `/api/enterprises/${enterpriseInfo.value._id}/dynamicModules/${moduleId}`
    )

    const code = response.module.code

    // ВАЖНО: виртуальная файловая система
    const files: Record<string, string> = {
      'dynamic.vue': code,
    }

    const options = {
      moduleCache: {
        vue: Vue,
      },

      compiler,

      async getFile(url: string) {
        if (files[url]) {
          return files[url]
        }
        throw new Error(`Файл не найден: ${url}`)
      },

      addStyle(css: string) {
        const style = document.createElement('style')
        style.textContent = css
        document.head.appendChild(style)
      },
    }

    const module = await loadModule('dynamic.vue', options)

    compiledComponent.value = module.default || module
  } catch (err) {
    console.error('Ошибка загрузки/компиляции модуля:', err)
    error.value =
        'Ошибка загрузки модуля: ' + (err as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dynamic-module-container">
    <div v-if="loading" class="loading">
    </div>
    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div
        v-else-if="compiledComponent"
        class="module-content"
    >
      <component :is="compiledComponent" />
    </div>

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
</style>