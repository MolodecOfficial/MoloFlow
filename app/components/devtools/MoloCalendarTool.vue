<!-- app/components/devtools/MoloCalendarTool.vue -->
<script setup lang="ts">
import {ref, computed} from 'vue'
import {usePersistentState} from '~/composables/window/usePersistentState'

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth()) // 0-11
const selectedDate = ref(formatKey(today))

// { "2026-08-30": ["Созвон в 15:00", "..."] }
const events = usePersistentState<Record<string, string[]>>('calendar-events', {})

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function formatKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const monthLabel = computed(() => `${MONTHS[viewMonth.value]} ${viewYear.value}`)

const days = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  // 0 = Вс -> сдвигаем так, чтобы неделя начиналась с Пн
  const firstWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()

  const cells: { date: Date | null; key: string | null }[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({date: null, key: null})
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear.value, viewMonth.value, d)
    cells.push({date, key: formatKey(date)})
  }
  return cells
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value--
  } else viewMonth.value--
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value++
  } else viewMonth.value++
}

function goToday() {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
  selectedDate.value = formatKey(today)
}

function selectDay(key: string | null) {
  if (key) selectedDate.value = key
}

const isToday = (key: string | null) => key === formatKey(today)
const isSelected = (key: string | null) => key === selectedDate.value
const hasEvents = (key: string | null) => !!key && (events.value[key]?.length ?? 0) > 0

const selectedEvents = computed(() => events.value[selectedDate.value] || [])
const newEvent = ref('')

function addEvent() {
  if (!newEvent.value.trim()) return
  const list = events.value[selectedDate.value] || []
  events.value = {...events.value, [selectedDate.value]: [...list, newEvent.value.trim()]}
  newEvent.value = ''
}

function removeEvent(idx: number) {
  const list = [...(events.value[selectedDate.value] || [])]
  list.splice(idx, 1)
  events.value = {...events.value, [selectedDate.value]: list}
}

const selectedLabel = computed(() => {
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  return `${d} ${MONTHS[m - 1].toLowerCase()} ${y}`
})
</script>

<template>
  <div class="tool">
    <div class="calendar">
      <div class="cal-header">
        <UIMoloButton class="nav small" @click="prevMonth">‹</UIMoloButton>
        <div class="month-label" @click="goToday">{{ monthLabel }}</div>
        <UIMoloButton class="nav small" @click="nextMonth">›</UIMoloButton>
      </div>

      <div class="weekdays">
        <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
      </div>

      <div class="days-grid">
        <button
            v-for="(cell, i) in days" :key="i"
            class="day-cell"
            :class="{ empty: !cell.date, today: isToday(cell.key), selected: isSelected(cell.key) }"
            :disabled="!cell.date"
            @click="selectDay(cell.key)"
        >
          <span v-if="cell.date">{{ cell.date.getDate() }}</span>
          <span v-if="hasEvents(cell.key)" class="dot"/>
        </button>
      </div>
    </div>

    <div class="day-panel">
      <div class="day-panel-title">{{ selectedLabel }}</div>
      <div v-if="!selectedEvents.length" class="empty">Событий нет</div>
      <div v-for="(ev, idx) in selectedEvents" :key="idx" class="event-item">
        <span>{{ ev }}</span>
        <UIMoloButton class="remove small close" @click="removeEvent(idx)">✕</UIMoloButton>
      </div>
      <div class="add-event">
        <input v-model="newEvent" placeholder="Новое событие..." @keydown.enter="addEvent"/>
        <UIMoloButton class="small" @click="addEvent">+</UIMoloButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool {
  display: flex;
  gap: 16px;
  padding: 12px;
  height: 100%;
}

.calendar {
  flex: 1.3;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.month-label {
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
}

.nav {
  width: 30px;
  height: 30px;
  padding: 0;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
  text-align: center;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  position: relative;
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: #ddd;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-cell.empty {
  background: transparent;
  cursor: default;
}

.day-cell:not(.empty):hover {
  background: rgba(91, 141, 239, 0.12);
}

.day-cell.today {
  border-color: #5b8def;
  color: #5b8def;
  font-weight: 700;
}

.day-cell.selected {
  background: #5b8def;
  color: #fff;
  font-weight: 700;
}

.dot {
  position: absolute;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #d29922;
}

.day-cell.selected .dot {
  background: #fff;
}

.day-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 1px solid var(--half_opacity_border);
  padding-left: 14px;
  overflow-y: auto;
}

.day-panel-title {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  text-transform: capitalize;
}

.event-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 10px;
  color: #eee;
  font-size: 13px;
}

.add-event {
  display: flex;
  gap: 6px;
  margin-top: auto;
}

.add-event input {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  padding: 6px 8px;
  color: #fff;
  font-size: 12px;
}

.empty {
  color: #666;
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}
</style>