<script setup lang="ts">
import { LayoutRegistry } from '@/utils/layoutRegistry'

interface Props {
  windowId: string
  groupId?: string
}

const props = defineProps<Props>()

const registry = LayoutRegistry.getInstance()
const Component = shallowRef()

// Функция для загрузки компонента
const loadComponent = async () => {
  const componentLoader = registry.getComponent(props.windowId, props.groupId)
  const component = defineAsyncComponent(componentLoader)
  Component.value = component
}

// Загружаем при монтировании
loadComponent()

// Перезагружаем при изменении windowId
watch(() => props.windowId, loadComponent)
</script>

<template>

</template>

<style scoped>

</style>