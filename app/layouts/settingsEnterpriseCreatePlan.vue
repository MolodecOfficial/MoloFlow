<!-- createPlan.vue -->
<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {useNotifications} from '~/composables/useNotifications'

const props = defineProps<{
  windowId?: string
  groupId?: string
  subGroupId?: string
}>()

const plans = ref<any[]>([])
const {addNotification} = useNotifications()

const enterpriseInfo = ref<any>(null)
const availablePoints = ref<any[]>([])

const loading = ref({
  points: false,
  create: false
})

const newPlan = ref({
  pointId: '',
  period: 'month',
  date: new Date().toISOString().split('T')[0],
  metrics: {
    revenue: null,
    expenses: null,
    profit: null,
    customers: null,
    averageCheck: null
  }
})

async function loadPoints() {
  if (!enterpriseInfo.value?._id) return
  loading.value.points = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/points`)
    availablePoints.value = response.points.filter((p: any) => p.status === 'Активна')
  } catch (error) {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки точек')
  } finally {
    loading.value.points = false
  }
}

async function addPlan() {
  if (!enterpriseInfo.value?._id) {
    addNotification('ERROR_DEFAULT', 'Информация о предприятии не найдена')
    return
  }

  // Валидация
  if (!newPlan.value.date) {
    addNotification('ERROR_DEFAULT', 'Укажите дату плана')
    return
  }

  loading.value.create = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/plans/${newPlan.value.period}`, {
      method: 'POST',
      body: newPlan.value
    })

    plans.value.unshift(response.plan)
    addNotification('NOTICE_DEFAULT', 'План успешно создан')

    // Очищаем форму после успешного создания
    newPlan.value = {
      pointId: '',
      period: 'month',
      date: new Date().toISOString().split('T')[0],
      metrics: {
        revenue: 0,
        expenses: 0,
        profit: 0,
        customers: 0,
        averageCheck: 0
      }
    }
  } catch (error: any) {
    console.error('Error creating plan:', error)
    addNotification('ERROR_DEFAULT', error.data?.message || error.message || 'Ошибка создания плана')
  } finally {
    loading.value.create = false
  }
}

// Автоматический расчет прибыли при изменении выручки и расходов
function calculateProfit() {
  newPlan.value.metrics.profit = newPlan.value.metrics.revenue - newPlan.value.metrics.expenses
}

// Автоматический расчет среднего чека при изменении выручки и количества клиентов
function calculateAverageCheck() {
  if (newPlan.value.metrics.customers > 0) {
    newPlan.value.metrics.averageCheck = Math.round(newPlan.value.metrics.revenue / newPlan.value.metrics.customers)
  }
}

onMounted(() => {
  const enterpriseDataStr = localStorage.getItem('currentEnterprise')
  const token = localStorage.getItem('enterprise_token')

  if (enterpriseDataStr && token) {
    try {
      const parsed = JSON.parse(enterpriseDataStr)
      enterpriseInfo.value = parsed
      loadPoints()
    } catch (e) {
      console.error('Ошибка парсинга данных предприятия', e)
      addNotification('ERROR_DEFAULT', 'Ошибка загрузки данных предприятия')
    }
  } else {
    console.warn('Не авторизован в предприятии')
    addNotification('ERROR_DEFAULT', 'Не авторизован в предприятии')
  }
})
</script>

<template>
  <h1>Новый план</h1>
  <hr>
  <div class="form-grid">
    <h5>Основная информация</h5>
    <select v-model="newPlan.pointId" class="form-select">
      <option value="">Общий план предприятия</option>
      <option v-for="point in availablePoints" :key="point._id" :value="point._id">
        {{ point.name }}
      </option>
    </select>

    <select v-model="newPlan.period" class="form-select">
      <option value="day">День</option>
      <option value="week">Неделя</option>
      <option value="month">Месяц</option>
      <option value="quarter">Квартал</option>
      <option value="year">Год</option>
    </select>

    <input v-model="newPlan.date" type="date" class="form-input">

    <div class="form-section">
      <h5>Плановые показатели</h5>

      <div class="input-group">
        <MoloForm
            tLabel="Выручка"
            lRequired
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.revenue"
            @input="calculateProfit(); calculateAverageCheck()"
        />

      </div>

      <div class="input-group">
        <MoloForm
            tLabel="Расходы"
            lRequired
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.expenses"
            @input="calculateProfit()"
        />
      </div>

      <div class="input-group">
        <MoloForm
            tLabel="Прибыль (рассчитывается автоматически)"
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.profit"
            readonly
        />
      </div>

      <div class="input-group">
        <label></label>
        <MoloForm
            tLabel="Количество клиентов"
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.customers"
            @input="calculateAverageCheck()"
        />
      </div>

      <div class="input-group">
        <label></label>
        <MoloForm
            tLabel="Средний чек (рассчитывается автоматически)"
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.averageCheck"
            readonly
        />
      </div>
    </div>


    <button class="submit-btn" @click="addPlan">
      <div v-if="loading.create" class="modern-loader"></div>
      <span v-else>Создать план</span>
    </button>

    <div v-if="newPlan.metrics.revenue > 0 || newPlan.metrics.expenses > 0" class="preview-info">
      <p>Предварительный расчет:</p>
      <div class="preview-row">
        <span>Прибыль:</span>
        <strong :class="{ 'positive': newPlan.metrics.profit > 0, 'negative': newPlan.metrics.profit < 0 }">
          {{ new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB'}).format(newPlan.metrics.profit) }}
        </strong>
      </div>
      <div v-if="newPlan.metrics.customers > 0" class="preview-row">
        <span>Средний чек:</span>
        <strong>{{
            new Intl.NumberFormat('ru-RU', {
              style: 'currency',
              currency: 'RUB'
            }).format(newPlan.metrics.averageCheck)
          }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  overflow: hidden;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  margin-bottom: 12px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-select {
  width: 100%;
  padding: 8px 2px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  margin-bottom: 10px;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #1eef6f;
  background: rgba(255, 255, 255, 0.08);
}

.input-group {
  margin-bottom: 15px;
}

.form-section {
  margin: 20px 0;
  padding: 20px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: #1eef6f;
  color: #020b18;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #15b050;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


.preview-info {
  margin-top: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: rgba(30, 239, 111, 0.05);
  border: 1px solid rgba(30, 239, 111, 0.1);
  border-radius: 4px;
}

.preview-info p {
  margin: 0 0 10px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 14px;
}

.preview-row span {
  color: rgba(255, 255, 255, 0.7);
}

.preview-row strong {
  font-size: 16px;
}

.preview-row strong.positive {
  color: #1eef6f;
}

.preview-row strong.negative {
  color: #ff6b6b;
}

.modern-loader {
  width: 12px;
  height: 12px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #020b18;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}


</style>