<script setup lang="ts">
import { defineAsyncComponent, computed, ref, watch } from 'vue'
import DynamicModuleLoader from '~~/app/layouts/modules/DynamicModuleLoader.vue'

const props = defineProps<{
  windowId?: string
  groupId?: string
  subGroupId?: string
  componentName?: string
  isModal?: boolean
  windowData?: any
  uniqueWindowId?: string
  enterpriseId?: string
}>()

const layoutsContext = import.meta.glob('../layouts/**/*.vue')

// Состояние для файлов динамического модуля
const moduleFiles = ref<any[]>([])
const loadingFiles = ref(false)

// Получение enterpriseId из localStorage
const getEnterpriseIdFromLocal = (): string | null => {
  const data = localStorage.getItem('currentEnterprise')
  if (data) {
    try {
      const enterprise = JSON.parse(data)
      return enterprise._id
    } catch (e) {
      return null
    }
  }
  return null
}

// Загрузка файлов модуля
const loadModuleFiles = async () => {
  const moduleId = props.windowData?._id
  const enterpriseId = props.enterpriseId || getEnterpriseIdFromLocal()

  if (!moduleId || !enterpriseId) {
    return
  }

  loadingFiles.value = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`)
    moduleFiles.value = response.files || []
  } catch (error) {
    moduleFiles.value = []
  } finally {
    loadingFiles.value = false
  }
}

// Следим за изменением moduleId и подгружаем файлы для Vue-модулей
watch(
    () => props.windowData?._id,
    (newId) => {
      if (newId && props.windowData?.format === 'vue') {
        loadModuleFiles()
      }
    },
    { immediate: true }
)

// Вспомогательные функции для поиска компонентов
const toPascalCase = (str: string): string =>
    str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')

const toCamelCase = (str: string): string =>
    str.split('_').map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')

const generatePossibleNames = (): string[] => {
  const names: string[] = []
  if (props.componentName && typeof props.componentName === 'string') {
    names.push(props.componentName)
  }
  if (props.subGroupId) {
    names.push(`${props.groupId}/${props.subGroupId}/${props.windowId}`)
    names.push(toPascalCase(`${props.groupId}_${props.subGroupId}_${props.windowId}`))
    names.push(toCamelCase(`${props.groupId}_${props.subGroupId}_${props.windowId}`))
  }
  names.push(`${props.groupId}/${props.windowId}`)
  names.push(toPascalCase(`${props.groupId}_${props.windowId}`))
  names.push(toCamelCase(`${props.groupId}_${props.windowId}`))
  names.push(props.windowId)
  names.push(toPascalCase(props.windowId))
  names.push(toCamelCase(props.windowId))
  if (props.subGroupId) {
    names.push(`${props.subGroupId}/${props.windowId}`)
    names.push(`${props.groupId}/${props.subGroupId}`)
    names.push(props.subGroupId)
  }
  return [...new Set(names.filter(n => n && typeof n === 'string'))]
}

const findComponent = () => {
  const possibleNames = generatePossibleNames()
  for (const name of possibleNames) {
    const exactPath = `../layouts/${name}.vue`
    if (layoutsContext[exactPath]) {
      return layoutsContext[exactPath]
    }
    const availableFiles = Object.keys(layoutsContext)
    const found = availableFiles.find(path => {
      const filePath = path.replace('../layouts/', '').replace('.vue', '')
      return filePath === name || filePath.toLowerCase() === name.toLowerCase()
    })
    if (found) {
      return layoutsContext[found]
    }
  }
  if (props.componentName) {
    const compName = typeof props.componentName === 'string' ? props.componentName : String(props.componentName)
    const availableFiles = Object.keys(layoutsContext)
    const found = availableFiles.find(path => {
      const fileName = path.split('/').pop()?.replace('.vue', '')
      return fileName && (fileName === compName || fileName.toLowerCase() === compName.toLowerCase())
    })
    if (found) {
      return layoutsContext[found]
    }
  }
  return null
}

// Является ли компонент динамическим модулем
const isDynamicModule = computed(() => {
  return !!(props.windowData?._id && props.windowData?.format)
})

// Статический компонент (из layouts)
const staticComponentLoader = computed(() => {
  if (isDynamicModule.value) return null
  const loader = findComponent()
  if (!loader) {
    return () => import('../layouts/NotFound.vue')
  }
  return loader
})

const Component = computed(() => {
  if (isDynamicModule.value) {
    return DynamicModuleLoader
  }
  if (!staticComponentLoader.value) {
    return null
  }
  return defineAsyncComponent({
    loader: staticComponentLoader.value,
    loadingComponent: {
      template: '<div class="loading-spinner"><MoloLoaders wndLoader /></div>'
    },
    errorComponent: {
      template: '<div class="error-component">Ошибка загрузки компонента</div>'
    },
    delay: 200,
    timeout: 10000
  })
})

// Пропсы для компонента
const componentProps = computed(() => {
  if (isDynamicModule.value) {
    return {
      moduleId: props.windowData?._id || null,
      moduleName: props.windowData?.name || '',
      moduleData: props.windowData,
      enterpriseId: props.enterpriseId || getEnterpriseIdFromLocal(),
      additionalFiles: moduleFiles.value      // ← ключевое: передаём файлы
    }
  }
  return {
    windowId: props.windowId,
    groupId: props.groupId,
    subGroupId: props.subGroupId,
    windowData: props.windowData,
    componentName: props.componentName,
  }
})
</script>

<template>
  <Suspense>
    <template #default>
      <div class="content-wrapper">
        <div v-if="loadingFiles" class="loading-files">
          <MoloLoaders wndLoader />
        </div>
        <component
            v-else-if="Component"
            :is="Component"
            v-bind="componentProps"
            :unique-window-id="uniqueWindowId"
        />
        <div v-else class="error-component">
          Компонент не найден: {{ componentName || windowId }}
        </div>
      </div>
    </template>
    <template #fallback>
      <MoloLoaders wndLoader />
    </template>
  </Suspense>
</template>

<style scoped>
.content-wrapper {
  display: block;
  width: 100%;
  height: 100%;
}
.loading-files {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.error-component {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fa5252;
  font-size: 14px;
  padding: 20px;
  text-align: center;
}
</style>