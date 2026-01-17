<script setup lang="ts">
import { defineAsyncComponent, ref, onMounted, watch, nextTick } from 'vue'

interface Props {
  windowId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'content-size-changed': [size: { width: number; height: number }]
}>()

// Реф для отслеживания размера контента
const contentRef = ref<HTMLElement>()
const resizeObserver = ref<ResizeObserver>()

// Карта компонентов
const componentMap: Record<string, () => Promise<any>> = {
  'employee_tasks': () => import('../layouts/test.vue'),
  'employee_documents': () => import('../layouts/test.vue'),
  'employee_schedule': () => import('../layouts/test.vue'),
  'employee_reports': () => import('../layouts/test.vue'),
  'sfd1': () => import('../layouts/test.vue'),
  'sfd2': () => import('../layouts/test.vue'),
  'enterprise': () => import('../layouts/test.vue'),
  'test': () => import('../layouts/test2.vue')
}

const getComponent = (windowId: string) => {
  return componentMap[windowId]?.() ?? import('../layouts/NotFound.vue')
}

const Component = defineAsyncComponent(() => getComponent(props.windowId))

// Функция для обновления размера окна
const updateContentSize = () => {
  if (!contentRef.value) return

  const contentRect = contentRef.value.getBoundingClientRect()

  // Отступы окна
  const windowPadding = 48
  const headerHeight = 57

  const neededWidth = contentRect.width + windowPadding
  const neededHeight = contentRect.height + headerHeight + windowPadding

  // Ограничения
  const minWidth = 300
  const minHeight = 200
  const maxWidth = window.innerWidth - 40
  const maxHeight = window.innerHeight - 40

  const finalWidth = Math.max(minWidth, Math.min(neededWidth, maxWidth))
  const finalHeight = Math.max(minHeight, Math.min(neededHeight, maxHeight))

  emit('content-size-changed', {
    width: finalWidth,
    height: finalHeight
  })
}

// Инициализация ResizeObserver
const initResizeObserver = () => {
  if (!contentRef.value) return

  // Очищаем предыдущий observer
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }

  // Создаем новый observer с debounce
  let timeout: number
  resizeObserver.value = new ResizeObserver(() => {
    clearTimeout(timeout)
    timeout = window.setTimeout(updateContentSize, 100)
  })

  resizeObserver.value.observe(contentRef.value)
}

// Обработчик загрузки компонента
const handleComponentMounted = () => {
  nextTick(() => {
    initResizeObserver()
    updateContentSize()
  })
}

onMounted(() => {
  // Если компонент уже загружен (кеширован)
  nextTick(() => {
    if (contentRef.value?.children.length) {
      handleComponentMounted()
    }
  })
})

// Очистка
onUnmounted(() => {
  resizeObserver.value?.disconnect()
})

// Отслеживаем изменение windowId
watch(() => props.windowId, () => {
  nextTick(() => {
    // Нужно переинициализировать observer для нового контента
    setTimeout(handleComponentMounted, 50)
  })
})

defineExpose({
  updateContentSize
})
</script>

<template>
  <Suspense @resolve="handleComponentMounted">
    <template #default>
      <div ref="contentRef" class="content-wrapper">
        <component
            :is="Component"
            :window-id="windowId"
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
  width: fit-content;
  min-width: 100%;
  height: fit-content;
  display: inline-block;
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