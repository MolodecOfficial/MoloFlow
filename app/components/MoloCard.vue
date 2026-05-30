<script lang="ts" setup>
const props = defineProps<{
  item: any
  settings: any
  fields?: any[]
}>()

const emit = defineEmits(['click', 'action'])

function formatValue(value: any) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  return value
}

function getVisibleFields() {
  if (!props.settings?.fields?.length) return []
  return props.settings.fields.slice(0, 6)
}
</script>

<template>
  <div class="molo-card" @click="emit('click', item)">
    <div class="card-top">
      <div class="card-avatar">
        {{ (item?.[settings?.title] || 'E').toString().charAt(0).toUpperCase() }}
      </div>
      <div class="card-head">
        <h3>{{ item?.[settings?.title] || 'Без названия' }}</h3>
        <p>{{ item?.[settings?.subtitle] || 'Нет описания' }}</p>
      </div>
    </div>
    <div class="card-content">
      <div v-for="field in getVisibleFields()" :key="field" class="card-field">
        <span class="field-name">{{ field }}</span>
        <span class="field-value">{{ formatValue(item[field]) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.molo-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  border-radius: 18px;
  background: var(--half_opacity_bg);
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
  transition: transform .18s ease, border-color .18s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.molo-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(100,150,255,.18), transparent 40%);
  opacity: 0;
  transition: opacity .2s ease;
  pointer-events: none;
}

.molo-card:hover {
  border-color: rgba(100,150,255,.25);
  background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
}
.molo-card:hover::before { opacity: 1; }
.card-top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.card-avatar {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6496ff, #4f74ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 10px 30px rgba(100,150,255,.25);
}
.card-head {
  min-width: 0;
}
.card-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-head p {
  margin: 5px 0 0;
  color: rgba(255,255,255,.55);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.04);
}
.field-name {
  font-size: 12px;
  color: rgba(255,255,255,.45);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.field-value {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,.88);
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255,255,255,.45);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #4ade80;
  box-shadow: 0 0 12px #4ade80;
}
.footer-date {
  margin-left: auto;
}
@media (max-width: 700px) {
  .molo-card { padding: 15px; border-radius: 16px; }
  .card-field { flex-direction: column; align-items: flex-start; }
  .field-value { max-width: 100%; text-align: left; }
}
</style>