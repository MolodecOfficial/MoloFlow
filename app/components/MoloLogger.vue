<script setup lang="ts">
import { useLogger } from '~/composables/useLogger'
import { ref, computed, watch, nextTick } from 'vue'

const isOpen = ref(true)
const { logs, clearLogs, removeLog } = useLogger()
const searchQuery = ref('')
const selectedType = ref<LogType | 'all'>('all')
const logsContainer = ref<HTMLElement | null>(null)

// Фильтрация логов
const filteredLogs = computed(() => {
  let result = logs.value

  if (selectedType.value !== 'all') {
    result = result.filter(log => log.type === selectedType.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(log =>
        log.text.toLowerCase().includes(query) ||
        log.timestamp.includes(query)
    )
  }

  return result
})

// АВТОПРОКРУТКА ВНИЗ при добавлении новых логов
watch(filteredLogs, async () => {
  await nextTick()
  if (logsContainer.value) {
    logsContainer.value.scrollTop = logsContainer.value.scrollHeight
  }
}, { deep: true })

const toggleLogger = () => {
  isOpen.value = !isOpen.value
}

const getLogIcon = (type: LogType) => {
  const icons = {
    info: 'ℹ',
    warning: '⚠',
    error: '×',
    success: '✓'
  }
  return icons[type]
}
</script>

<template>
  <div class="logger-wrapper" :class="{ 'logger-wrapper--collapsed': !isOpen }">
    <div class="logger-header" @click="toggleLogger">
      <div class="logger-header-left">
        <span class="logger-title">Логирование</span>
        <span class="logger-badge" v-if="logs.length">{{ logs.length }}</span>
      </div>
      <div class="logger-header-right">
        <button class="logger-clear" @click="clearLogs" title="Очистить логи">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="logger-content" v-show="isOpen">
      <div class="logger-logs" ref="logsContainer" v-if="filteredLogs.length">
        <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-entry"
            :class="`log-entry--${log.type}`"
        >
          <button class="log-remove" @click="removeLog(log.id)" title="Удалить лог">×</button>
          <span class="log-message">{{ log.text }}</span>
          <span class="log-time">{{ log.timestamp }}</span>
        </div>
      </div>
      <div class="logger-empty" v-else>
        <p>Логов пока нет</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Все стили остаются теми же */
.logger-wrapper {
  position: fixed;
  left: 15px;
  bottom: 15px;
  width: 450px;
  max-height: 400px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  background-color: var(--half_opacity_bg);
}

.logger-wrapper--collapsed {
  width: auto;
  min-width: 200px;
  background-color: var(--half_opacity_bg);
}

.logger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  border-radius: 12px;
}

.logger-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logger-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logger-wrapper--collapsed .logger-icon {
  transform: rotate(0deg);
}

.logger-title {
  color: white;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.logger-badge {
  background: #38ef7d;
  color: #111;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.logger-clear {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.logger-clear:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.logger-clear:hover {
  color: #ff6b6b;
}

.logger-content {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 300px;
  }
}

.log-remove {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.log-entry:hover .log-remove {
  opacity: 1;
}

.log-remove:hover {
  color: #ff6b6b;
}

.logger-logs {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
}

.logger-logs::-webkit-scrollbar {
  width: 6px;
}

.logger-logs::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.logger-logs::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.logger-logs::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 3px solid;
  border-radius: 6px;
  font-size: 12px;
  transition: transform 0.1s;
  position: relative;
}

.log-entry:hover {
  transform: translateX(4px);
  background: rgba(255, 255, 255, 0.05);
}

.log-entry--info {
  border-left-color: #38afef;
}

.log-entry--success {
  border-left-color: #38ef7d;
}

.log-entry--warning {
  border-left-color: #ffd93d;
}

.log-entry--error {
  border-left-color: #ff6b6b;
}

.log-time {
  color: rgba(255, 255, 255, 0.5);
  min-width: 65px;
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
  position: absolute;
  right: 0;
  top: 2px;
  font-size: 8px;
}

.log-message {
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  flex: 1;
}

.logger-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  gap: 12px;
}

.logger-empty svg {
  opacity: 0.5;
}

.logger-empty p {
  font-size: 13px;
  margin: 0;
}
</style>