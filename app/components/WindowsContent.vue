<script setup lang="ts">
import { defineAsyncComponent, ref, onMounted, watch, nextTick } from 'vue'

interface Props {
  windowId: string
}

const props = defineProps<{
  windowId?: string
}>()

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
</script>

<template>
  <Suspense>
    <template #default>
      <div class="content-wrapper">
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