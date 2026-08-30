<script setup lang="ts">
import { defineAsyncComponent, computed } from 'vue'
import { getSystemWindow } from '~/composables/window/systemWindows'
import DynamicModuleLoader from '~/layouts/modules/DynamicModuleLoader.vue'
import Preview from '~/layouts/modules/Preview.vue'

const props = defineProps<{
  windowKey: string
  data?: any
  uniqueWindowId?: string
}>()

const emit = defineEmits(['updateTitle'])

// Окна превью открываются через openPreviewWindow() с ключом 'preview:' + fileName
// (см. useWindowManager.ts) — им нужен ИМЕННО Preview.vue: он реактивен ко ВСЕМ
// полям windowData (code/files/dependencies/moduleId) через watch + debounce.
// DynamicModuleLoader для этого не годится — его watch реагирует только на смену
// moduleId/_id, поэтому живое редактирование кода в Creature.vue никогда не
// долетало бы до предпросмотра, если пустить его через DynamicModuleLoader.
const isPreviewWindow = computed(() => !!props.windowKey?.startsWith('preview:'))

// Модуль считается динамическим, если есть код ИЛИ есть id, по которому
// DynamicModuleLoader сам дозагрузит код (он уже это умеет — см. его
// собственный fetchFullModuleData). Раньше проверка держалась только на
// data.code — если бэкенд отдаёт список модулей без code (чтобы не
// раздувать ответ), окно молча не находило контент.
const isDynamicModule = computed(() => !isPreviewWindow.value && !!(props.data?.code || props.data?._id || props.data?.moduleId))

const systemDef = computed(() => isDynamicModule.value ? null : getSystemWindow(props.windowKey))

const SystemComponent = computed(() => {
  if (!systemDef.value) return null
  return defineAsyncComponent({
    loader: systemDef.value.component,
    loadingComponent: { template: '<div class="loading-spinner"><UIMoloLoaders wndLoader /></div>' },
    errorComponent: { template: '<div class="error-component">Ошибка загрузки экрана</div>' },
    delay: 200,
    timeout: 10000
  })
})

const componentProps = computed(() => {
  const base = {
    windowData: props.data,
    moduleData: props.data,
    moduleId: props.data?._id || props.data?.moduleId || props.windowKey,
    uniqueWindowId: props.uniqueWindowId,
  }
  if (props.data && typeof props.data === 'object') {
    return { ...base, ...props.data }
  }
  return base
})
</script>

<template>
  <Suspense>
    <template #default>
      <div class="content-wrapper">
        <Preview
            v-if="isPreviewWindow"
            :window-data="props.data"
        />
        <DynamicModuleLoader
            v-else-if="isDynamicModule"
            v-bind="componentProps"
            @updateTitle="(title) => emit('updateTitle', title)"
        />
        <component
            v-else-if="SystemComponent"
            :is="SystemComponent"
            v-bind="componentProps"
            @updateTitle="(title) => emit('updateTitle', title)"
        />
        <div v-else class="error-component">
          Не удалось открыть окно «{{ windowKey }}»: нет ни кода модуля (data.code),
          ни системного экрана с таким ключом в systemWindows.ts
        </div>
      </div>
    </template>
    <template #fallback>
      <UIMoloLoaders wndLoader />
    </template>
  </Suspense>
</template>

<style scoped>
.content-wrapper {
  display: block;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100%;
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