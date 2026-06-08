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

const emit = defineEmits(['updateTitle'])

const layoutsContext = import.meta.glob('../layouts/**/*.vue')
const componentsContext = import.meta.glob('../components/**/*.vue')

const moduleFiles = ref<any[]>([])
const loadingFiles = ref(false)

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

// Загрузка файлов модуля (опционально, если есть API)
const loadModuleFiles = async () => {
  const moduleId = props.windowData?._id || props.windowData?.moduleId
  const enterpriseId = props.enterpriseId || getEnterpriseIdFromLocal()
  if (!moduleId || !enterpriseId) return

  // Проверяем, есть ли уже код в windowData
  if (props.windowData?.code) {
    return // Код уже есть, не нужно загружать файлы
  }

  loadingFiles.value = true
  try {
    // Пробуем загрузить файлы, если API существует
    const response = await $fetch(`/api/enterprises/${enterpriseId}/dynamicModules/${moduleId}/files`).catch(() => null)
    if (response?.files) {
      moduleFiles.value = response.files || []
      // Если есть mainFile с кодом, обновляем windowData
      if (response.mainFile?.code && props.windowData) {
        props.windowData.code = response.mainFile.code
      }
    }
  } catch (error) {
    // Игнорируем ошибку — возможно, API не существует
    console.warn('Could not load module files:', error)
    moduleFiles.value = []
  } finally {
    loadingFiles.value = false
  }
}

// Загружаем файлы только если есть moduleId и нет кода
watch(
    () => [props.windowData?._id, props.windowData?.moduleId, props.windowData?.code],
    ([moduleId, moduleId2, code]) => {
      const id = moduleId || moduleId2
      if (id && !code) {
        loadModuleFiles()
      }
    },
    { immediate: true }
)

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
  names.push(props.windowId || '')
  names.push(toPascalCase(props.windowId || ''))
  names.push(toCamelCase(props.windowId || ''))
  if (props.subGroupId) {
    names.push(`${props.subGroupId}/${props.windowId}`)
    names.push(`${props.groupId}/${props.subGroupId}`)
    names.push(props.subGroupId)
  }
  return [...new Set(names.filter(n => n && typeof n === 'string'))]
}

const findComponent = () => {
  const possibleNames = generatePossibleNames()

  // Поиск в layouts
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

  // Поиск в components
  for (const name of possibleNames) {
    const exactPath = `../components/${name}.vue`
    if (componentsContext[exactPath]) {
      return componentsContext[exactPath]
    }
    const availableFiles = Object.keys(componentsContext)
    const found = availableFiles.find(path => {
      const filePath = path.replace('../components/', '').replace('.vue', '')
      return filePath === name || filePath.toLowerCase() === name.toLowerCase()
    })
    if (found) {
      return componentsContext[found]
    }
  }

  if (props.componentName) {
    const compName = typeof props.componentName === 'string' ? props.componentName : String(props.componentName)

    // Поиск в layouts
    let found = Object.keys(layoutsContext).find(path => {
      const fileName = path.split('/').pop()?.replace('.vue', '')
      return fileName && (fileName === compName || fileName.toLowerCase() === compName.toLowerCase())
    })
    if (found) return layoutsContext[found]

    // Поиск в components
    found = Object.keys(componentsContext).find(path => {
      const fileName = path.split('/').pop()?.replace('.vue', '')
      return fileName && (fileName === compName || fileName.toLowerCase() === compName.toLowerCase())
    })
    if (found) return componentsContext[found]
  }
  return null
}

const isDynamicModule = computed(() => {
  return !!(props.windowData?._id && (props.windowData?.format === 'vue' || props.windowData?.format === 'js' || props.windowData?.format === 'ts'))
})

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

const componentProps = computed(() => {
  const baseProps = {
    windowId: props.windowId,
    groupId: props.groupId,
    subGroupId: props.subGroupId,
    windowData: props.windowData,
    componentName: props.componentName,
    uniqueWindowId: props.uniqueWindowId,
    enterpriseId: props.enterpriseId || getEnterpriseIdFromLocal(),
    additionalFiles: moduleFiles.value
  }

  if (props.windowData && typeof props.windowData === 'object') {
    return {
      ...baseProps,
      ...props.windowData
    }
  }

  return baseProps
})

// Обработчик обновления заголовка
function handleUpdateTitle(title: string) {
  emit('updateTitle', title)
}
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
            :window-id="uniqueWindowId"
            @updateTitle="handleUpdateTitle"
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