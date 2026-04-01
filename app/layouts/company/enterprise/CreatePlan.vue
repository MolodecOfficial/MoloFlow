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
const points = ref<any[]>([])

const availablePeriod = [
  { label: 'День', value: 'day' },
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
  { label: 'Квартал', value: 'quarter' },
  { label: 'Год', value: 'year' }
]

const loading = ref({
  points: false,
  create: false
})

const newPlan = ref({
  pointId: '',
  period: 'month',
  date: new Date().toISOString().split('T')[0],
  metrics: {
    revenue: null as number | null,
    expenses: null as number | null,
    profit: null as number | null,
    customers: null as number | null,
    averageCheck: null as number | null
  }
})

async function loadPoints() {
  if (!enterpriseInfo.value?._id) return
  loading.value.points = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/points/points`)
    points.value = response.points.filter((p: any) => p.status === 'Активна')
  } catch (error) {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки точек')
  } finally {
    loading.value.points = false
  }
}

const availablePoints = computed(() => {
  return points.value
      .filter(p => p.status === 'Активна')
      .map(point => ({
        ...point,
        displayName: `${point.name}, ${point.address}`
      }))
})

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

  // Валидация периода
  if (!newPlan.value.period) {
    addNotification('ERROR_DEFAULT', 'Укажите период плана')
    return
  }

  loading.value.create = true
  try {
    // Период теперь передается в теле запроса, а не в URL
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/plans/${newPlan.value.period}`, {
      method: 'POST',
      body: {
        pointId: newPlan.value.pointId || null,
        period: newPlan.value.period,
        date: newPlan.value.date,
        metrics: {
          revenue: Number(newPlan.value.metrics.revenue) || 0,
          expenses: Number(newPlan.value.metrics.expenses) || 0,
          profit: Number(newPlan.value.metrics.profit) || 0,
          customers: Number(newPlan.value.metrics.customers) || 0,
          averageCheck: Number(newPlan.value.metrics.averageCheck) || 0
        }
      }
    })

    plans.value.unshift(response.plan)
    addNotification('NOTICE_DEFAULT', 'План успешно создан')

    // Очищаем форму после успешного создания
    newPlan.value = {
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
  const revenue = Number(newPlan.value.metrics.revenue) || 0
  const expenses = Number(newPlan.value.metrics.expenses) || 0
  newPlan.value.metrics.profit = revenue - expenses
}

// Автоматический расчет среднего чека при изменении выручки и количества клиентов
function calculateAverageCheck() {
  const revenue = Number(newPlan.value.metrics.revenue) || 0
  const customers = Number(newPlan.value.metrics.customers) || 0
  if (customers > 0) {
    newPlan.value.metrics.averageCheck = Math.round(revenue / customers)
  } else {
    newPlan.value.metrics.averageCheck = 0
  }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0)
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
    <MoloSelect
        v-model="newPlan.pointId"
        all="Общий план предприятия"
        :parent="availablePoints"
        children="displayName"
        valueKey="_id"
        tLabel="Выберите точку для плана"
        lRequired
    />

    <MoloSelect
        v-model="newPlan.period"
        :parent="availablePeriod"
        children="label"
        tLabel="Выберите период для плана"
        lRequired
        valueKey="value"
    />

    <MoloInput
        v-model="newPlan.date"
        type="date"
        tLabel="Выберите начало работы нового плана"
        lRequired
    />

    <hr>

    <div class="form-section">
      <h5>Плановые показатели</h5>
      <div class="input-group">
        <MoloInput
            tLabel="Выручка"
            lRequired
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.revenue"
            @input="newPlan.metrics.revenue = parseFloat(($event.target as HTMLInputElement).value) || null; calculateProfit(); calculateAverageCheck()"
        />
        <MoloInput
            tLabel="Расходы"
            lRequired
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.expenses"
            @input="calculateProfit()"
        />
        <MoloInput
            tLabel="Прибыль (рассчитывается автоматически)"
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.profit"
            readonly
        />

        <MoloInput
            tLabel="Количество клиентов"
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.customers"
            @input="calculateAverageCheck()"
            lRequired
        />

        <MoloInput
            tLabel="Средний чек (рассчитывается автоматически)"
            type="number"
            iRequired
            placeholder="0"
            v-model="newPlan.metrics.averageCheck"
            readonly
        />
      </div>
    </div>

    <button class="action-btn confirm" @click="addPlan">
      <div v-if="loading.create" class="modern-loader"></div>
      <span v-else>Создать план</span>
    </button>

    <div v-if="newPlan.metrics.revenue > 0 || newPlan.metrics.expenses > 0" class="preview-info">
      <p>Предварительный расчет:</p>
      <div class="preview-row">
        <span>Прибыль:</span>
        <strong :class="{ 'positive': newPlan.metrics.profit > 0, 'negative': newPlan.metrics.profit < 0 }">
          {{ formatCurrency(newPlan.metrics.profit) }}
        </strong>
      </div>
      <div v-if="newPlan.metrics.customers > 0" class="preview-row">
        <span>Средний чек:</span>
        <strong>{{ formatCurrency(newPlan.metrics.averageCheck) }}</strong>
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

.input-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
</style>