<script setup lang="ts">
const props = defineProps<{
  windowId?: string
  groupId?: string
}>()

const layoutModules = import.meta.glob('../layouts/*.vue', { eager: false })
const Component = shallowRef()

const loadComponent = () => {
  if (!props.windowId) return

  // Определяем имя файла
  let fileName = props.windowId
  if (props.groupId) {
    fileName = `${props.groupId}_${props.windowId}`
        .split('_')
        .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
        .join('')
  }

  const componentPath = `../layouts/${fileName}.vue`
  const loader = layoutModules[componentPath] ||
      layoutModules['../layouts/NotFound.vue']

  Component.value = defineAsyncComponent(loader)
}

watch(() => props.windowId, loadComponent, { immediate: true })
</script>

<template>
  <Suspense>
    <template #default>
      <component
          v-if="Component"
          :is="Component"
          :window-id="windowId"
          :group-id="groupId"
      />
    </template>
    <template #fallback>
      <div>Загрузка...</div>
    </template>
  </Suspense>
</template>