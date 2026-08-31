<!-- app/components/devtools/MoloClockTool.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePersistentState } from '~/composables/window/usePersistentState'

interface City {
  id: string;
  label: string;
  tz: string
}

const now = ref(new Date())
const { addLog } = useLogger('Часы')
let tickTimer: any = null

const cities = usePersistentState<City[]>('clock-cities', [
  { id: 'local', label: 'Локально', tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { id: 'msk', label: 'Москва', tz: 'Europe/Moscow' },
  { id: 'utc', label: 'UTC', tz: 'UTC' },
])

const newLabel = ref('')
const newTz = ref('')

function timeFor(tz: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(now.value)
  } catch {
    return '--:--:--'
  }
}

function dateFor(tz: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    }).format(now.value)
  } catch {
    return ''
  }
}

function addCity() {
  if (!newLabel.value.trim() || !newTz.value.trim()) return
  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone: newTz.value })
  } catch {
    addLog('warning', 'Неизвестная таймзона. Пример: Europe/Berlin, Asia/Tokyo')
    return
  }
  cities.value = [...cities.value, { id: crypto.randomUUID(), label: newLabel.value.trim(), tz: newTz.value.trim() }]
  newLabel.value = ''
  newTz.value = ''
}

function removeCity(id: string) {
  cities.value = cities.value.filter(c => c.id !== id)
}

// --- Секундомер ---
const stopwatchMs = ref(0)
const stopwatchRunning = ref(false)
let swInterval: any = null

const stopwatchDisplay = computed(() => {
  const totalMs = stopwatchMs.value
  const min = Math.floor(totalMs / 60000)
  const sec = Math.floor((totalMs % 60000) / 1000)
  const cs = Math.floor((totalMs % 1000) / 10)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
})

function toggleStopwatch() {
  if (stopwatchRunning.value) {
    clearInterval(swInterval)
    stopwatchRunning.value = false
  } else {
    stopwatchRunning.value = true
    const start = Date.now() - stopwatchMs.value
    swInterval = setInterval(() => {
      stopwatchMs.value = Date.now() - start
    }, 10)
  }
}

function resetStopwatch() {
  clearInterval(swInterval)
  stopwatchRunning.value = false
  stopwatchMs.value = 0
}

onMounted(() => {
  tickTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})
onUnmounted(() => {
  clearInterval(tickTimer)
  clearInterval(swInterval)
})
</script>

<template>
  <!-- Добавили контекстный класс-обертку clock-tool-context -->
  <div class="tool clock-tool-context">
    <div class="cities">
      <div v-for="city in cities" :key="city.id" class="city-card" v-pinnable>
        <UIMoloButton class="remove small close" @click="removeCity(city.id)">✕</UIMoloButton>
        <div class="city-label">{{ city.label }}</div>
        <div class="city-time">{{ timeFor(city.tz) }}</div>
        <div class="city-date">{{ dateFor(city.tz) }}</div>
      </div>

      <div class="city-card add-card">
        <UIMoloInput v-model="newLabel" placeholder="Название" class="mini-input"/>
        <UIMoloInput v-model="newTz" placeholder="Europe/Berlin" class="mini-input"/>
        <UIMoloButton class="small" @click="addCity">+ Добавить город</UIMoloButton>
      </div>
    </div>
    <hr>
    <div class="stopwatch">
      <div class="sw-display">{{ stopwatchDisplay }}</div>
      <div class="sw-actions">
        <UIMoloButton @click="toggleStopwatch">{{ stopwatchRunning ? 'Пауза' : 'Старт' }}</UIMoloButton>
        <UIMoloButton class="secondary" @click="resetStopwatch">Сброс</UIMoloButton>
      </div>
    </div>
  </div>
</template>

<!-- Убран атрибут scoped. Стили изолированы через .clock-tool-context -->
<style scoped>
.clock-tool-context.tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.clock-tool-context .cities {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.clock-tool-context .city-card {
  position: relative;
  background: rgba(91, 141, 239, 0.06);
  border: 1px solid var(--half_opacity_border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.clock-tool-context .city-label {
  color: #999;
  font-size: 11px;
  text-transform: uppercase;
}

.clock-tool-context .city-time {
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  font-weight: 700;
}

.clock-tool-context .city-date {
  color: #888;
  font-size: 12px;
}

.clock-tool-context .remove {
  width: min-content;
  position: absolute;
  top: -10px;
  right: -10px;
}

.clock-tool-context .add-card {
  justify-content: center;
  gap: 6px;
  border-style: dashed;
}

.clock-tool-context .mini-input {
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
}

.clock-tool-context .stopwatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.clock-tool-context .sw-display {
  font-family: 'JetBrains Mono', monospace;
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

.clock-tool-context .sw-actions {
  display: flex;
  gap: 10px;
}
</style>
