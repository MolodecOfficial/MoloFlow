<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { setGlobalComposables, useModuleCompiler } from '~/composables/useModuleCompiler'
import { useModuleService } from '~/composables/useModuleService'
import { useLogger } from '~/composables/useLogger'
import { useNotifications } from '~/composables/useNotifications'
import { useWindowManager } from '~/composables/useWindowManager'
import { useAppStore } from '~~/stores/appStore'
const props = defineProps<{
  moduleData?: any
  moduleId?: string
  additionalFiles?: any[]
  enterpriseId?: string
}>()
const emit = defineEmits(['loaded', 'error', 'moduleEvent'])
setGlobalComposables({
  useLogger,
  useNotifications,
  useWindowManager,
  useAppStore,
  useModulesStore: () => useModuleEditorStore?.()
})
const {
  compiledComponent,
  compileModule,
  compiling,
  compileError,
  dispose,
  activeKey
} = useModuleCompiler()
const { fetchFullModuleData } = useModuleService()
const error = ref<string | null>(null)
const isLoadingModule = ref(false)
const { addLog } = useLogger('Загрузчик модуля')
const appStore = useAppStore()
const getEnterpriseId = (): string | null => {
  if (props.enterpriseId) return props.enterpriseId
  if (props.moduleData?.enterpriseId) return props.moduleData.enterpriseId

  const fromStore = appStore.getEnterpriseId?.()
  if (fromStore) return fromStore
  return null
}
const getModuleId = (): string | null => {
  return props.moduleId
      || props.moduleData?._id
      || props.moduleData?.moduleId
      || props.moduleData?.id
      || null
}
async function loadModule() {
  error.value = null
  let fullData = props.moduleData
  // Идём в сеть ТОЛЬКО если код реально отсутствует.
  // Если код пришёл через props (из стора или из Creature.vue) — пропускаем сетевой запрос.
  // Это устраняет лишний round-trip при открытии модуля через меню, если данные уже загружены.
  const hasCode = fullData?.code && String(fullData.code).trim().length > 0
  if (!hasCode && getModuleId()) {
    const enterpriseId = getEnterpriseId()
    const moduleId = getModuleId()
    if (!enterpriseId || !moduleId) {
      // ФИКС БАГА №2: раньше при отсутствующем enterpriseId/moduleId код
      // просто проваливался дальше и падал на "Нет данных модуля" без
      // внятного объяснения. Теперь явно сообщаем причину.
      error.value = 'Не удалось определить предприятие или модуль для загрузки'
      emit('error', error.value)
      return
    }
    isLoadingModule.value = true
    try {
      addLog('info', 'Загружаю код модуля с сервера...')
      // ФИКС БАГА №2 (сохранён): вызываем единый эндпоинт, отдающий модуль
      // ПОЛНОСТЬЮ (мета + code + files + dependencies) за один запрос.
      //
      // НОВОЕ: fetchFullModuleData теперь кэширующий — если этот moduleId
      // уже грузился (в этом окне, в другом окне того же модуля, или его
      // прогрел фон через useModulePrefetch) — тут не будет ни одного
      // сетевого запроса, данные вернутся из памяти мгновенно.
      fullData = await fetchFullModuleData(moduleId, enterpriseId)
    } catch (e) {
      console.error('[DynamicModuleLoader] Ошибка загрузки модуля:', e)
      error.value = 'Не удалось загрузить модуль с сервера'
      emit('error', error.value)
      return
    } finally {
      isLoadingModule.value = false
    }
  }
  if (!fullData) {
    error.value = 'Нет данных модуля'
    return
  }
  const code = fullData.code || ''
  if (!code.trim()) {
    error.value = 'Нет кода модуля'
    return
  }
  const files = [...(fullData.files || []), ...(props.additionalFiles || [])]
  const deps = fullData.dependencies || {}
  addLog('info', `Компилирую модуль "${fullData.name || 'Без названия'}"`)
  // НОВОЕ: передаём version — по нему (+ хэшу code/files/deps) compileModule
  // проверяет кэш скомпилированных компонентов. Если модуль не менялся
  // с прошлого открытия (или был прогрет фоном) — компиляция (Babel +
  // vue3-sfc-loader) не запускается вообще, компонент отдаётся мгновенно.
  await compileModule(code, files, deps, props.moduleId || fullData._id, fullData.version)
}
watch(
    () => [props.moduleData?._id, props.moduleId],
    (newVals, oldVals) => {
      if (newVals[0] !== oldVals?.[0] || newVals[1] !== oldVals?.[1]) {
        loadModule()
      }
    }
)
watch(compiledComponent, (comp) => {
  if (comp) emit('loaded', true)
})
watch(compileError, (err) => {
  if (err) {
    error.value = `Ошибка компиляции: ${err}`
    emit('error', err)
  }
})
onMounted(() => loadModule())
onUnmounted(() => {
  // ФИКС БАГА СО СТИЛЯМИ: раньше здесь вызывался reset(), который безусловно
  // удалял <style id="dynamic-module-style-{moduleId}"> из DOM. Если это же
  // окно (тот же модуль) уже успело переоткрыться в другом экземпляре
  // компонента (например, при быстром закрытии/переоткрытии окна), его
  // стили удалялись этим unmount'ом чужого, уже закрытого окна.
  //
  // dispose() вместо этого уменьшает счётчик "сколько окон модуля сейчас
  // открыто" и физически убирает тег из DOM только когда счётчик дошёл
  // до нуля — то есть когда закрыты ВСЕ окна этого модуля.
  dispose()
})
</script>
<template>
  <div class="dynamic-module-loader">
    <div v-if="isLoadingModule" class="loading-state">
      <MoloLoaders wndLoader/>
      <span>Загрузка данных модуля...</span>
    </div>
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <div class="error-message">{{ error }}</div>
    </div>
    <div v-else-if="compiling" class="loading-state">
      <MoloLoaders wndLoader/>
      <span>Компиляция модуля...</span>
    </div>
    <component
        v-else-if="compiledComponent"
        :is="compiledComponent"
        :key="activeKey"
        :module-id="props.moduleId || props.moduleData?._id"
        @module-event="(e: any) => emit('moduleEvent', e)"
    />
    <div v-else class="empty-state">
      <div class="empty-icon">📦</div>
      <div>Модуль не загружен</div>
    </div>
  </div>
</template>
<style scoped>
.dynamic-module-loader {
  height: 100%;
  overflow: auto;
}
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  color: #ef4444;
}
.error-icon { font-size: 32px; }
.error-message {
  font-family: monospace;
  font-size: 14px;
  text-align: center;
  word-break: break-word;
  max-width: 100%;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: #666;
}
.empty-icon { font-size: 48px; opacity: 0.5; }
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: #666;
}
</style>