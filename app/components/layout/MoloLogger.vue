<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useLogger, type LogType } from '~/composables/useLogger'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
  }>(),
  {
    embedded: false
  }
)

const isOpen = ref(false)
const drawerRef = ref<HTMLElement | null>(null)
const logsContainer = ref<HTMLElement | null>(null)

const { logs, clearLogs, removeLog } = useLogger()

const searchQuery = ref('')
const selectedType = ref<LogType | 'all'>('all')

const hasError = computed(() => logs.value.some((l) => l.type === 'error'))
const hasWarning = computed(() => logs.value.some((l) => l.type === 'warning'))

const filteredLogs = computed(() => {
  let result = logs.value

  if (selectedType.value !== 'all') {
    result = result.filter((log) => log.type === selectedType.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (log) =>
        log.text.toLowerCase().includes(query) ||
        log.timestamp.includes(query)
    )
  }

  return result
})

watch(
  filteredLogs,
  async () => {
    await nextTick()
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  },
  { deep: true }
)

const toggleLogger = () => {
  isOpen.value = !isOpen.value
}

const closeLogger = () => {
  isOpen.value = false
}

</script>

<template>
  <div
    ref="drawerRef"
    class="logger-root"
    :class="{
      'is-embedded': embedded,
      'is-open': isOpen || embedded,
      'is-closed': !isOpen && !embedded
    }"
  >
    <!-- Панель журнала -->
    <aside class="logger-panel">
      <!-- Шапка -->
      <div class="panel-header">
        <div class="header-left">
          <span class="icon-wrap">
            <UIMoloSticker name="terminal" :size="14" />
          </span>
          <span class="panel-title">Журнал логов</span>
          <span
            v-if="logs.length"
            class="count-badge"
            :class="{ 'badge-error': hasError, 'badge-warning': !hasError && hasWarning }"
          >
            {{ logs.length }}
          </span>
        </div>

        <div class="header-right">
          <button
            v-if="logs.length"
            type="button"
            class="header-btn"
            title="Очистить все логи"
            @click.stop="clearLogs"
          >
            <UIMoloSticker name="trash" :size="13" />
          </button>
        </div>
      </div>

      <!-- Список логов -->
      <div class="panel-body">
        <div v-if="filteredLogs.length" ref="logsContainer" class="logs-list">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-item"
            :class="`log-item--${log.type}`"
          >
            <button
              type="button"
              class="log-delete"
              title="Удалить запись"
              @click.stop="removeLog(log.id)"
            >
              <UIMoloSticker name="x" :size="11" />
            </button>
            <div class="log-body">
              <span class="log-text">{{ log.text }}</span>
              <span class="log-time">{{ log.timestamp }}</span>
            </div>
          </div>
        </div>

        <div v-else class="logs-empty">
          <span class="empty-icon">
            <UIMoloSticker name="terminal" :size="22" />
          </span>
          <span class="empty-text">Журнал пуст</span>
        </div>
      </div>
    </aside>

    <!-- Выступающая стрелочка-ярлык на краю экрана -->
    <button
      v-if="!embedded"
      type="button"
      class="logger-trigger-tab"
      :class="{
        'tab-open': isOpen,
        'tab-error': hasError,
        'tab-warning': !hasError && hasWarning
      }"
      @click.stop="toggleLogger"
      :title="isOpen ? 'Скрыть журнал логов' : 'Открыть журнал логов'"
      aria-label="Журнал логов"
    >
      <span class="tab-arrow">
        <UIMoloSticker :name="isOpen ? 'left' : 'right'" :size="13" />
      </span>
      <span v-if="!isOpen && logs.length" class="tab-badge">
        {{ logs.length > 99 ? '99+' : logs.length }}
      </span>
      <span v-else-if="!isOpen && (hasError || hasWarning)" class="tab-dot"></span>
    </button>
  </div>
</template>

<style scoped>
.logger-root {
  --panel-w: 360px;
  --tab-w: 24px;
  position: fixed;
  left: -2px;
  bottom: 24px;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.logger-root.is-closed {
  transform: translateX(calc(-1 * var(--panel-w)));
}

.logger-root.is-open {
  transform: translateX(0);
}

/* Встроенный режим (для документации) */
.logger-root.is-embedded {
  position: static;
  transform: none !important;
  width: 100%;
  pointer-events: auto;
}

.logger-root.is-embedded .logger-panel {
  width: 100%;
  border-left: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
}

/* Сама карточка журнала */
.logger-panel {
  width: var(--panel-w);
  height: 380px;
  max-width: calc(100vw - 48px);
  max-height: 60vh;
  background: var(--half_opacity_bg, rgba(13, 17, 28, 0.92));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  border-left: none;
  border-radius: 0 14px 0px 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
}

/* Шапка */
.panel-header {
  height: 38px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.08));
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #38bdf8;
}

.panel-title {
  color: #f1f5f9;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.count-badge {
  background: #38bdf8;
  color: #0b1120;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  line-height: 1.2;
}

.count-badge.badge-error {
  background: #ef4444;
  color: #fff;
}

.count-badge.badge-warning {
  background: #f59e0b;
  color: #000;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s ease;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

/* Тело */
.panel-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.logs-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 3px solid #38bdf8;
  border-radius: 4px;
  transition: background 0.12s ease;
}

.log-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.log-item--info { border-left-color: #38bdf8; }
.log-item--success { border-left-color: #34d399; }
.log-item--warning { border-left-color: #fbbf24; }
.log-item--error { border-left-color: #f87171; }

.log-delete {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 2px;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  flex-shrink: 0;
}

.log-item:hover .log-delete {
  opacity: 1;
}

.log-delete:hover {
  color: #f87171;
}

.log-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.log-text {
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  line-height: 1.35;
  word-break: break-word;
}

.log-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 9px;
}

.logs-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.35);
}

.empty-icon {
  opacity: 0.3;
}

.empty-text {
  font-size: 11px;
}

/* Стрелочка-ярлык на краю экрана */
.logger-trigger-tab {
  width: var(--tab-w);
  height: 42px;
  background: var(--half_opacity_bg, rgba(13, 17, 28, 0.94));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.14));
  border-left: none;
  border-radius: 0 8px 8px 0;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  padding: 0;
  pointer-events: auto;
  box-shadow: 3px 2px 14px rgba(0, 0, 0, 0.35);
  transition: all 0.18s ease;
  user-select: none;
}

.logger-trigger-tab:hover {
  background: rgba(26, 34, 52, 0.98);
  color: #38bdf8;
  width: 26px;
}

.tab-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.tab-badge {
  background: #38bdf8;
  color: #0b1120;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 3px;
  border-radius: 4px;
  line-height: 1;
}

.tab-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #38bdf8;
}

.logger-trigger-tab.tab-error {
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.logger-trigger-tab.tab-error .tab-badge,
.logger-trigger-tab.tab-error .tab-dot {
  background: #ef4444;
  color: #fff;
}

.logger-trigger-tab.tab-warning {
  border-color: rgba(245, 158, 11, 0.5);
  color: #fbbf24;
}

.logger-trigger-tab.tab-warning .tab-badge,
.logger-trigger-tab.tab-warning .tab-dot {
  background: #f59e0b;
  color: #000;
}
</style>
