<!-- components/DynamicComponentLoader.vue -->
<script setup lang="ts">
import { defineAsyncComponent, computed } from 'vue'

const props = defineProps<{
  windowId: string
  groupId: string
  subGroupId?: string
  componentName?: string
  isModal?: boolean
  windowData?: any
}>()

// Получаем все файлы .vue из папки layouts и всех подпапок
const layoutsContext = import.meta.glob('../layouts/**/*.vue', { eager: false })

/**
 * Преобразует строку в PascalCase
 */
const toPascalCase = (str: string): string => {
  return str
      .split('_')
      .map((word, i) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
}

/**
 * Преобразует строку в camelCase
 */
const toCamelCase = (str: string): string => {
  return str
      .split('_')
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
}

/**
 * Генерирует возможные имена файлов для поиска
 */
const generatePossibleNames = (): string[] => {
  const names: string[] = []

  // 1. Если указан componentName, используем его в первую очередь
  if (props.componentName) {
    names.push(props.componentName)
  }

  // 2. Генерация по паттернам
  if (props.subGroupId) {
    // Полный путь: groupId/subGroupId/windowId
    const fullPath = `${props.groupId}/${props.subGroupId}/${props.windowId}`
    names.push(fullPath)

    // PascalCase версия: GroupIdSubGroupIdWindowId
    const pascalFull = `${props.groupId}_${props.subGroupId}_${props.windowId}`
    names.push(toPascalCase(pascalFull))

    // camelCase версия: groupIdSubGroupIdWindowId
    names.push(toCamelCase(pascalFull))
  }

  // 3. Путь: groupId/windowId
  const groupPath = `${props.groupId}/${props.windowId}`
  names.push(groupPath)

  // PascalCase: GroupIdWindowId
  const pascalGroup = `${props.groupId}_${props.windowId}`
  names.push(toPascalCase(pascalGroup))

  // camelCase: groupIdWindowId
  names.push(toCamelCase(pascalGroup))

  // 4. Только windowId
  names.push(props.windowId)
  names.push(toPascalCase(props.windowId))
  names.push(toCamelCase(props.windowId))

  // 5. Если есть subGroupId, добавляем варианты с ним
  if (props.subGroupId) {
    // subGroupId/windowId
    names.push(`${props.subGroupId}/${props.windowId}`)

    // groupId/subGroupId
    names.push(`${props.groupId}/${props.subGroupId}`)

    // Просто subGroupId
    names.push(props.subGroupId)
  }

  return [...new Set(names)] // Убираем дубликаты
}

/**
 * Находит компонент по различным путям и именам
 */
const findComponent = (): (() => Promise<any>) | null => {
  const possibleNames = generatePossibleNames()

  // Сначала ищем по точному совпадению пути
  for (const name of possibleNames) {
    // Ищем по точному пути
    const exactPath = `../layouts/${name}.vue`
    if (layoutsContext[exactPath]) {
      return layoutsContext[exactPath]
    }

    // Ищем с учётом регистра
    const availableFiles = Object.keys(layoutsContext)
    const found = availableFiles.find(path => {
      // Убираем '../layouts/' и '.vue' для сравнения
      const filePath = path.replace('../layouts/', '').replace('.vue', '')
      return filePath === name || filePath.toLowerCase() === name.toLowerCase()
    })

    if (found) {
      console.log(`Found component at: ${found}`)
      return layoutsContext[found]
    }
  }

  // Если не нашли, пробуем найти по componentName в любом месте
  if (props.componentName) {
    const availableFiles = Object.keys(layoutsContext)
    const found = availableFiles.find(path => {
      const fileName = path.split('/').pop()?.replace('.vue', '')
      return fileName === props.componentName ||
          fileName?.toLowerCase() === props.componentName.toLowerCase()
    })

    if (found) {
      console.log(`Found component by name in subfolder: ${found}`)
      return layoutsContext[found]
    }
  }

  console.warn(`Component not found for: ${props.groupId}/${props.windowId}`)
  return null
}

/**
 * Получает загрузчик компонента
 */
const getComponentLoader = () => {
  const loader = findComponent()

  if (loader) {
    return loader
  }

  // Если ничего не найдено – компонент заглушка
  console.warn('Using NotFound component as fallback')
  return () => import('../layouts/NotFound.vue')
}

// Создаём асинхронный компонент
const Component = defineAsyncComponent({
  loader: getComponentLoader(),
  loadingComponent: {
    template: '<div class="loading-spinner"></div>'
  },
  errorComponent: {
    template: '<div class="error-component">Ошибка загрузки компонента</div>'
  },
  delay: 200,
  timeout: 10000
})

// Данные для передачи в дочерний компонент
const componentProps = computed(() => ({
  windowId: props.windowId,
  groupId: props.groupId,
  subGroupId: props.subGroupId,
  windowData: props.windowData
}))
</script>

<template>
  <Suspense>
    <template #default>
      <div class="content-wrapper">
        <component
            :is="Component"
            v-bind="componentProps"
        />
      </div>
    </template>
    <template #fallback>
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    </template>
  </Suspense>
</template>

<style scoped>
.content-wrapper {
  display: block;
  width: 100%;
  height: 100%;
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>