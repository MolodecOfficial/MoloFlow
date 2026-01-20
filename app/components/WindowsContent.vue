<script setup lang="ts">
import { useMenuConfig } from '~/composables/useMenuConfig'

const props = defineProps<{
  windowId?: string
  groupId?: string
  subGroupId?: string
}>()

const { getComponentPath } = useMenuConfig()
const layoutsContext = import.meta.glob('../layouts/*.vue', { eager: false })

const getComponentLoader = () => {
  if (!props.windowId || !props.groupId) {
    console.log('Не хватает параметров')
    return () => import('../layouts/NotFound.vue')
  }

  // Пробуем разные варианты поиска файла
  const searchPatterns = []

  // 1. Полный путь: settings_enterprise_control
  if (props.subGroupId) {
    const fullPath = `${props.groupId}_${props.subGroupId}_${props.windowId}`
        .split('_')
        .map((word, index) =>
            index === 0 ? word.toLowerCase() :
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('')
    searchPatterns.push(fullPath)  // settingsEnterpriseControl
  }

  // 2. Без подгруппы: settings_control
  const withoutSubGroup = `${props.groupId}_${props.windowId}`
      .split('_')
      .map((word, index) =>
          index === 0 ? word.toLowerCase() :
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('')
  searchPatterns.push(withoutSubGroup)  // settingsControl

  // 3. Только по windowId
  searchPatterns.push(props.windowId)  // control

  // 4. Ищем в конфиге
  const componentPath = getComponentPath(props.windowId, props.groupId)
  if (componentPath) {
    searchPatterns.push(componentPath)
  }

  console.log('Паттерны поиска:', searchPatterns)

  // Перебираем все паттерны
  for (const pattern of searchPatterns) {
    const fullPath = `../layouts/${pattern}.vue`
    if (layoutsContext[fullPath]) {
      console.log(`Нашли по паттерну: ${pattern}`)
      return layoutsContext[fullPath]
    }
  }

  // Поиск без учета регистра
  const availableFiles = Object.keys(layoutsContext)
  for (const pattern of searchPatterns) {
    const foundFile = availableFiles.find(path => {
      const fileName = path
          .replace('../layouts/', '')
          .replace('.vue', '')
          .toLowerCase()
      return fileName === pattern.toLowerCase()
    })

    if (foundFile) {
      console.log(`Нашли (без регистра): ${foundFile}`)
      return layoutsContext[foundFile]
    }
  }

  console.warn('Файл не найден ни по одному паттерну')
  return () => import('../layouts/NotFound.vue')
}

const Component = defineAsyncComponent(() => {
  const loader = getComponentLoader()
  return loader()
})
</script>

<template>
  <Suspense>
    <template #default>
      <div class="content-wrapper">
        <component
            :is="Component"
            :window-id="windowId"
            :sub-group-id="subGroupId"
            :group-id="groupId"
        />
      </div>
    </template>
    <template #fallback>
      <div class="loading">Загрузка...</div>
    </template>
  </Suspense>
</template>

<style scoped>
.content-wrapper {
  display: block;
  width: 100%;
  height: 100%;
}

.loading {
  padding: 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>