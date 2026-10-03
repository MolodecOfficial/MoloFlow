<!-- WindowsContent.vue -->
<script setup lang="ts">
import { defineAsyncComponent, computed, ref, watch } from 'vue'
import { getSystemWindow } from '~/composables/window/systemWindows'
import DynamicModuleLoader from '~/layouts/modules/DynamicModuleLoader.vue'
import Preview from '~/layouts/modules/Preview.vue'

const props = defineProps<{
  windowKey: string
  data?: any
  uniqueWindowId?: string
}>()

const emit = defineEmits(['updateTitle'])

const rawUrl = computed(() => {
  return props.data?.url || props.data?.src || null
})

const isExternalUrl = computed(() => !!rawUrl.value)
const isPreviewWindow = computed(() => !isExternalUrl.value && !!props.windowKey?.startsWith('preview:'))
const isDynamicModule = computed(() =>
    !isExternalUrl.value && !isPreviewWindow.value && !!(props.data?.code || props.data?._id || props.data?.moduleId)
)

const systemDef = computed(() => {
  if (isExternalUrl.value || isDynamicModule.value) return null
  return getSystemWindow(props.windowKey)
})

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

// Состояние внешнего фрейма
const useProxyMode = ref(false)
const isFrameLoaded = ref(false)
const hasBlockedWarning = ref(false)
let blockDetectionTimer: any = null

const resolvedIframeSrc = computed(() => {
  if (!rawUrl.value) return ''
  if (useProxyMode.value) {
    return `/api/embed-proxy?url=${encodeURIComponent(rawUrl.value)}`
  }
  return rawUrl.value
})

function onFrameLoad() {
  isFrameLoaded.value = true
  if (blockDetectionTimer) clearTimeout(blockDetectionTimer)
}

function handleOpenTab() {
  if (rawUrl.value) {
    window.open(rawUrl.value, '_blank', 'noopener,noreferrer')
  }
}

function toggleProxyEngine() {
  useProxyMode.value = !useProxyMode.value
  isFrameLoaded.value = false
  hasBlockedWarning.value = false
}

// При смене ссылки перезапускаем детектор блокировки CSP / Frame-Ancestors
watch(rawUrl, () => {
  isFrameLoaded.value = false
  hasBlockedWarning.value = false
  if (blockDetectionTimer) clearTimeout(blockDetectionTimer)

  if (isExternalUrl.value) {
    blockDetectionTimer = setTimeout(() => {
      // Если сайт не дал сигнал onload за 4 секунды (типично для X-Frame-Options Deny браузера)
      if (!isFrameLoaded.value) {
        hasBlockedWarning.value = true
      }
    }, 4000)
  }
}, { immediate: true })
</script>

<template>
  <div class="content-wrapper">
    <!-- Продвинутый веб-просмотр с защитой от пустых экранов -->
    <div v-if="isExternalUrl" class="external-frame-container">
      <div class="frame-subbar">
        <div class="frame-badges">
          <span class="url-display" :title="rawUrl">{{ rawUrl }}</span>
          <span v-if="useProxyMode" class="badge-proxy">Proxy Bypass</span>
        </div>

        <div class="frame-actions">
          <button
              class="action-btn toggle-btn"
              @click="toggleProxyEngine"
              :title="useProxyMode ? 'Переключить на прямое подключение' : 'Включить обход защиты от встраивания'"
          >
            {{ useProxyMode ? '⚡ Прямой' : '🛡 Обход X-Frame' }}
          </button>

          <button class="action-btn open-tab-btn" @click="handleOpenTab" title="Открыть во внешней вкладке браузера">
            ↗ Новая вкладка
          </button>
        </div>
      </div>

      <!-- Предупреждение о строгой защите сайта (Ozon, Google, VK) -->
      <div v-if="hasBlockedWarning && !isFrameLoaded" class="csp-warning-banner">
        <div class="warning-text">
          <span>Сайт защищен политикой <code>X-Frame-Options</code> или <code>CSP</code>. Если страница не отобразилась:</span>
        </div>
        <div class="warning-buttons">
          <button class="banner-btn" @click="toggleProxyEngine">Попробовать прокси-обход</button>
          <button class="banner-btn primary" @click="handleOpenTab">Открыть во внешней вкладке</button>
        </div>
      </div>

      <iframe
          :key="resolvedIframeSrc"
          :src="resolvedIframeSrc"
          class="external-frame"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; clipboard-read; encrypted-media; gyroscope; picture-in-picture; web-share; camera; microphone"
          allowfullscreen
          @load="onFrameLoad"
      />
    </div>

    <!-- Системные окна и динамические модули -->
    <Suspense v-else>
      <template #default>
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
          Не удалось открыть окно «{{ windowKey }}»
        </div>
      </template>
      <template #fallback>
        <UIMoloLoaders wndLoader />
      </template>
    </Suspense>
  </div>
</template>

<style scoped>
.content-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.external-frame-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #121214;
  position: relative;
}

.frame-subbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  background: rgba(18, 18, 20, 0.95);
  font-size: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 8px;
}

.frame-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.url-display {
  color: #8c8c93;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
  font-family: monospace;
}

.badge-proxy {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.frame-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #e4e4e7;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 10.5px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.csp-warning-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(245, 158, 11, 0.12);
  border-bottom: 1px solid rgba(245, 158, 11, 0.3);
  font-size: 11px;
  color: #fbbf24;
}

.csp-warning-banner code {
  background: rgba(0, 0, 0, 0.3);
  padding: 1px 4px;
  border-radius: 3px;
}

.warning-buttons {
  display: flex;
  gap: 6px;
}

.banner-btn {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fef3c7;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 10.5px;
}

.banner-btn.primary {
  background: #d97706;
  border-color: #f59e0b;
  color: #fff;
}

.banner-btn:hover {
  filter: brightness(1.15);
}

.external-frame {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: none;
  background: #fff;
}
</style>