<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useLogger, type LogType } from '~/composables/useLogger'

const isOpen = ref(false)

const { logs, clearLogs, removeLog } = useLogger()

const searchQuery = ref('')
const selectedType = ref<LogType | 'all'>('all')
const logsContainer = ref<HTMLElement | null>(null)

// Фильтрация логов
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

// Автопрокрутка вниз при новых логах
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
</script>

<template>
  <div class="logger-wrapper" :class="{ 'logger-wrapper--collapsed': !isOpen }">
    <!-- Шапка панели -->
    <div class="logger-header" @click="toggleLogger">
      <div class="logger-header-left">
        <span class="logger-title">Журнал логов</span>
        <!-- Бейдж количества логов -->
        <span v-if="logs.length" class="logger-badge">{{ logs.length }}</span>
      </div>

      <div class="logger-header-right" @click.stop>
        <div class="btn-group">
          <UIMoloButton
              v-if="isOpen"
              class="small transparent"
              title="Очистить логи"
              @click="clearLogs"
          >
            <UIMoloSticker name="trash" size="16px"/>
          </UIMoloButton>

          <!-- Кнопка сворачивания/разворачивания -->
          <UIMoloButton class="small transparent" @click="toggleLogger">
            <UIMoloSticker v-if="isOpen" name="down"/>
            <UIMoloSticker v-else name="up"/>
          </UIMoloButton>
        </div>
      </div>
    </div>

    <!-- Тело панели -->
    <div v-show="isOpen" class="logger-content">
      <div class="logs-view">
        <div v-if="filteredLogs.length" ref="logsContainer" class="logger-logs">
          <div
              v-for="log in filteredLogs"
              :key="log.id"
              class="log-entry"
              :class="`log-entry--${log.type}`"
          >
            <button class="log-remove" title="Удалить лог" @click="removeLog(log.id)"><UIMoloSticker name="x" :size="14" /></button>
            <span class="log-message">{{ log.text }}</span>
            <span class="log-time">{{ log.timestamp }}</span>
          </div>
        </div>
        <div v-else class="logger-empty">
          <p>Логов пока нет</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logger-wrapper {
  position: fixed;
  left: 20px;
  bottom: 20px;
  width: 420px;
  max-height: 440px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  background-color: var(--half_opacity_bg);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.logger-wrapper--collapsed {
  width: auto;
  min-width: 260px;
  background-color: var(--half_opacity_bg, rgba(14, 16, 24, 0.6));
}

.logger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  border-radius: 12px;
  flex-shrink: 0;
}

.logger-header:hover {
  background: rgba(255, 255, 255, 0.04);
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

.logger-title {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.process-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #4ade80;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-dot 1.4s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.logger-badge {
  background: #38bdf8;
  color: #0b1120;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
}

.tab-toggles {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.tab-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  font-weight: 600;
}

.tab-btn:hover:not(.active) {
  color: #fff;
}

.logger-clear,
.toggle-btn-icon {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.logger-clear:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.12);
}

.toggle-btn-icon:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.logger-content {
  border-top: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.08));
  overflow: hidden;
  max-height: 360px;
  display: flex;
  flex-direction: column;
}

/* ── ВКЛАДКА ПРОЦЕССОВ ── */
.processes-view {
  overflow-y: auto;
  padding: 8px;
  max-height: 320px;
}

.processes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.process-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  gap: 8px;
  transition: all 0.15s ease;
}

.process-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.process-card.proc-running {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.05);
}

.proc-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.proc-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.proc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.proc-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.proc-name {
  color: #fff;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-indicator {
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.status-indicator.running {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.status-indicator.idle {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}

.status-indicator.success {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
}

.status-indicator.error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.proc-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: #94a3b8;
  overflow: hidden;
}

.meta-tag {
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.proc-msg {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proc-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.btn-act {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s ease;
}

.btn-act:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.btn-act.play:hover {
  background: rgba(34, 197, 94, 0.25);
  color: #4ade80;
  border-color: #22c55e;
}

.btn-act.stop:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #f87171;
  border-color: #ef4444;
}

.btn-act.restart:hover {
  background: rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  border-color: #38bdf8;
}

/* ── ВКЛАДКА ЛОГОВ ── */
.logs-view {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.logger-logs {
  max-height: 280px;
  overflow-y: auto;
  padding: 8px;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 6px 10px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.025);
  border-left: 3px solid #38bdf8;
  border-radius: 4px;
  font-size: 11.5px;
  position: relative;
}

.log-entry--info { border-left-color: #38bdf8; }
.log-entry--success { border-left-color: #34d399; }
.log-entry--warning { border-left-color: #fbbf24; }
.log-entry--error { border-left-color: #f87171; }

.log-message {
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  flex: 1;
}

.log-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 8.5px;
  position: absolute;
  right: 6px;
  top: 3px;
}

.log-remove {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 14px;
  padding: 0 3px;
  opacity: 0;
  transition: opacity 0.2s;
}

.log-entry:hover .log-remove {
  opacity: 1;
}

.log-remove:hover {
  color: #f87171;
}

.logger-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 16px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}
</style>