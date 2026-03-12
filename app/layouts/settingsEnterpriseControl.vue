<script setup lang="ts">
const props = defineProps<{
  groupId?: string
  subGroupId?: string
  windowId?: string
}>()

const { openWindow, closeWindow } = useWindowManager()
const { addNotification } = useNotifications()


// Состояния
const isAuthenticated = ref(false)
const enterpriseInfo = ref<any>(null)
const activeTab = ref('overview')

// Данные
const points = ref<any[]>([])
const employees = ref<any[]>([])
const plans = ref<any[]>([])
const loading = ref({
  points: false,
  employees: false,
  plans: false
})

// Фильтры для точек
const pointFilters = ref({
  region: '',
  city: '',
  type: ''
})

// Фильтры для сотрудников
const employeeFilters = ref({
  status: '',
  position: '',
  pointId: ''
})

// Статистика
const stats = ref({
  totalPoints: 0,
  activePoints: 0,
  totalEmployees: 0,
  activeEmployees: 0,
  totalPlanProfit: 0,
  totalActualProfit: 0,
  profitDifference: 0
})

// Вычисляемые свойства для фильтров
const uniqueRegions = computed(() => {
  return [...new Set(points.value.map(p => p.region))].sort()
})

const uniqueCities = computed(() => {
  if (!pointFilters.value.region) {
    return [...new Set(points.value.map(p => p.city))].sort()
  }
  return [...new Set(points.value
      .filter(p => p.region === pointFilters.value.region)
      .map(p => p.city)
  )].sort()
})

const uniquePositions = computed(() => {
  return [...new Set(employees.value.map(e => e.position))].sort()
})

const availablePoints = computed(() => {
  return points.value.filter(p => p.status === 'Активна')
})

// Отфильтрованные данные
const filteredPoints = computed(() => {
  return points.value.filter(p => {
    if (pointFilters.value.region && p.region !== pointFilters.value.region) return false
    if (pointFilters.value.city && p.city !== pointFilters.value.city) return false
    if (pointFilters.value.type && p.type !== pointFilters.value.type) return false
    return true
  })
})

const filteredEmployees = computed(() => {
  return employees.value.filter(e => {
    if (employeeFilters.value.status && e.status !== employeeFilters.value.status) return false
    if (employeeFilters.value.position && e.position !== employeeFilters.value.position) return false
    if (employeeFilters.value.pointId && e.pointId?._id !== employeeFilters.value.pointId) return false
    return true
  })
})

// Группировка точек по регионам
const groupedPoints = computed(() => {
  return filteredPoints.value.reduce((acc, point) => {
    if (!acc[point.region]) {
      acc[point.region] = []
    }
    acc[point.region].push(point)
    return acc
  }, {} as Record<string, any[]>)
})

// Методы
function notAuth() {
  openWindow(
      'settings',
      'login',
      'enterprise',
      {
        width: 400,
        height: 450,
        minWidth: 350,
        minHeight: 400
      }
  )
}

function createPoint() {
  openWindow(
      'settings',
      'createPoint',
      'enterprise',
      {
        width: 600,
        height: 600,
        minWidth: 350,
        minHeight: 300
      }
  )
}

function createEmployee() {
  openWindow(
      'settings',
      'createEmployee',
      'enterprise',
      {
        width: 600,
        height: 600,
        minWidth: 350,
        minHeight: 300
      }
  )
}

function createPlan() {
  openWindow(
      'settings',
      'createPlan',
      'enterprise',
      {
        width: 600,
        height: 600,
        minWidth: 350,
        minHeight: 300
      }
  )
}

// Загрузка данных
async function loadPoints() {
  if (!enterpriseInfo.value?._id) return
  loading.value.points = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/points`)
    points.value = response.points
    stats.value.totalPoints = response.total
    stats.value.activePoints = response.points.filter((p: any) => p.status === 'Активна').length
  } catch (error) {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки точек')
  } finally {
    loading.value.points = false
  }
}

async function loadEmployees() {
  if (!enterpriseInfo.value?._id) return
  loading.value.employees = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/employees`)
    employees.value = response.employees
    stats.value.totalEmployees = response.stats.total
    stats.value.activeEmployees = response.stats.active
  } catch (error) {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки сотрудников')
  } finally {
    loading.value.employees = false
  }
}

async function loadPlans() {
  if (!enterpriseInfo.value?._id) return
  loading.value.plans = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/plans/analysis`, {
      query: { period: 'month' }
    })
    plans.value = response.plans
    stats.value.totalPlanProfit = response.totals.planProfit
    stats.value.totalActualProfit = response.totals.actualProfit
    stats.value.profitDifference = response.differences.profit
  } catch (error) {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки планов')
  } finally {
    loading.value.plans = false
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ru-RU')
}

onMounted(() => {
  const enterpriseDataStr = localStorage.getItem('currentEnterprise')
  const token = localStorage.getItem('enterprise_token')

  if (enterpriseDataStr && token) {
    try {
      const parsed = JSON.parse(enterpriseDataStr)
      enterpriseInfo.value = parsed
      isAuthenticated.value = true

      loadPoints()
      loadEmployees()
      loadPlans()
    } catch (e) {
      console.error('Ошибка парсинга данных предприятия', e)
      addNotification('ERROR_DEFAULT', 'Ошибка загрузки данных предприятия')
    }
  } else {
    console.warn('Не авторизован в предприятии')
  }
})
</script>

<template>
  <section class="enterprise-management">
    <h2>Управление предприятием</h2>

    <div v-if="isAuthenticated" class="content">
      <!-- Шапка с информацией -->
      <section class="header_content">
        <div class="enterprise-info">
          <h2>{{ enterpriseInfo.enterpriseName }}</h2>
          <p class="enterprise-details">
            ИНН: {{ enterpriseInfo.inn }} | ОГРН: {{ enterpriseInfo.ogrn }}
          </p>
        </div>

        <!-- Краткая статистика -->
        <div class="quick-stats">
          <div class="stat-item">
            <span class="stat-label">Точек:</span>
            <span class="stat-value">{{ stats.totalPoints }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Сотрудников:</span>
            <span class="stat-value">{{ stats.totalEmployees }}</span>
          </div>
          <div class="stat-item" :class="{ 'positive': stats.profitDifference > 0, 'negative': stats.profitDifference < 0 }">
            <span class="stat-label">Отклонение:</span>
            <span class="stat-value">{{ formatCurrency(stats.profitDifference) }}</span>
          </div>
        </div>
      </section>

      <!-- Навигация по вкладкам -->
      <div class="tabs">
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'overview' }"
            @click="activeTab = 'overview'"
        >
          Обзор
        </button>
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'points' }"
            @click="activeTab = 'points'"
        >
          Точки
        </button>
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'employees' }"
            @click="activeTab = 'employees'"
        >
          Сотрудники
        </button>
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'plans' }"
            @click="activeTab = 'plans'"
        >
          Планы и факты
        </button>
      </div>

      <!-- Контент вкладок -->
      <section class="main_content">
        <!-- Вкладка Обзор -->
        <div v-if="activeTab === 'overview'" class="tab-content">
          <div class="stats-grid">
            <div class="stat-card">
              <h3>Точки</h3>
              <div class="stat-numbers">
                <div class="stat-main">{{ stats.totalPoints }}</div>
                <div class="stat-secondary">Активных: {{ stats.activePoints }}</div>
              </div>
            </div>

            <div class="stat-card">
              <h3>Сотрудники</h3>
              <div class="stat-numbers">
                <div class="stat-main">{{ stats.totalEmployees }}</div>
                <div class="stat-secondary">Активных: {{ stats.activeEmployees }}</div>
              </div>
            </div>

            <div class="stat-card">
              <h3>Прибыль (план)</h3>
              <div class="stat-numbers">
                <div class="stat-main">{{ formatCurrency(stats.totalPlanProfit) }}</div>
              </div>
            </div>

            <div class="stat-card">
              <h3>Прибыль (факт)</h3>
              <div class="stat-numbers">
                <div class="stat-main">{{ formatCurrency(stats.totalActualProfit) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Вкладка Точки -->
        <div v-if="activeTab === 'points'" class="tab-content">
          <div class="content-header">
            <h3>Управление точками</h3>
            <button class="action-btn" @click="createPoint">
              {{ showPointForm ? 'Отмена' : '+ Добавить точку' }}
            </button>
          </div>

          <!-- Фильтры -->
          <div class="filters">
            <select v-model="pointFilters.region" class="filter-select">
              <option value="">Все регионы</option>
              <option v-for="region in uniqueRegions" :key="region" :value="region">
                {{ region }}
              </option>
            </select>

            <select v-model="pointFilters.city" class="filter-select">
              <option value="">Все города</option>
              <option v-for="city in uniqueCities" :key="city" :value="city">
                {{ city }}
              </option>
            </select>

            <select v-model="pointFilters.type" class="filter-select">
              <option value="">Все типы</option>
              <option value="Магазин">Магазин</option>
              <option value="Склад">Склад</option>
              <option value="Офис">Офис</option>
              <option value="Производство">Производство</option>
            </select>
          </div>

          <!-- Список точек -->
          <div v-if="loading.points" class="loading">
            <div class="loading-overlay">
              <div class="loading-spinner"></div>
            </div>
          </div>

          <div v-else-if="filteredPoints.length === 0" class="empty-state">
            Нет точек для отображения
          </div>

          <div v-else class="points-by-region">
            <div v-for="(regionPoints, region) in groupedPoints" :key="region" class="region-block">
              <h4 class="region-title">{{ region }}</h4>
              <div class="points-grid">
                <div v-for="point in regionPoints" :key="point._id" class="point-card">
                  <div class="point-header">
                    <h5>{{ point.name }}</h5>
                    <section class="point_set">
                      <span class="point-type">{{ point.type }} </span>
                      <button class="point-settings">⁝</button>
                    </section>

                  </div>

                  <div class="point-details">
                    <p><strong>Город:</strong> {{ point.city }}</p>
                    <p><strong>Адрес:</strong> {{ point.address }}</p>
                    <p v-if="point.contactPerson.name">
                      <strong>Контакт:</strong> {{ point.contactPerson.name }}
                    </p>
                    <p v-if="point.metadata.square">
                      <strong>Площадь:</strong> {{ point.metadata.square }} м²
                    </p>
                  </div>

                  <div class="point-footer">
                    <span class="status" :class="point.status.toLowerCase()">
                      {{ point.status }}
                    </span>
                    <span class="date">
                      {{ formatDate(point.openingDate) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Вкладка Сотрудники -->
        <div v-if="activeTab === 'employees'" class="tab-content">
          <div class="content-header">
            <h3>Управление сотрудниками</h3>
            <button class="action-btn" @click="createEmployee">
              + Добавить сотрудника
            </button>
          </div>

          <!-- Фильтры -->
          <div class="filters">
            <select v-model="employeeFilters.status" class="filter-select">
              <option value="">Все статусы</option>
              <option value="Активен">Активен</option>
              <option value="В отпуске">В отпуске</option>
              <option value="Уволен">Уволен</option>
            </select>

            <select v-model="employeeFilters.position" class="filter-select">
              <option value="">Все должности</option>
              <option v-for="position in uniquePositions" :key="position" :value="position">
                {{ position }}
              </option>
            </select>

            <select v-model="employeeFilters.pointId" class="filter-select">
              <option value="">Все точки</option>
              <option v-for="point in availablePoints" :key="point._id" :value="point._id">
                {{ point.name }}
              </option>
            </select>
          </div>
          <!-- Список сотрудников -->
          <div v-if="loading.employees" class="loading">
            <div class="loading-overlay">
              <div class="loading-spinner"></div>
            </div>
          </div>

          <div v-else-if="filteredEmployees.length === 0" class="empty-state">
            Нет сотрудников для отображения
          </div>

          <div v-else class="employees-table">
            <table>
              <thead>
              <tr>
                <th>Имя</th>
                <th>Должность</th>
                <th>Отдел</th>
                <th>Точка</th>
                <th>Статус</th>
                <th>Телефон</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="emp in filteredEmployees" :key="emp._id">
                <td>{{ emp.userId?.name }}</td>
                <td>{{ emp.position }}</td>
                <td>{{ emp.department || '-' }}</td>
                <td>{{ emp.pointId?.name || '-' }}</td>
                <td>
                    <span class="status" :class="emp.status.toLowerCase()">
                      {{ emp.status }}
                    </span>
                </td>
                <td>{{ emp.contacts?.phone || '-' }}</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Вкладка Планы и факты -->
        <div v-if="activeTab === 'plans'" class="tab-content">
          <div class="content-header">
            <h3>Планы и факты</h3>
            <button class="action-btn" @click="createPlan">
             + Создать план
            </button>
          </div>

          <!-- Сводка по планам -->
          <div class="plan-summary">
            <div class="summary-card">
              <h4>План</h4>
              <div class="summary-value">{{ formatCurrency(stats.totalPlanProfit) }}</div>
              <div class="summary-label">Прибыль</div>
            </div>
            <div class="summary-card">
              <h4>Факт</h4>
              <div class="summary-value">{{ formatCurrency(stats.totalActualProfit) }}</div>
              <div class="summary-label">Прибыль</div>
            </div>
            <div class="summary-card" :class="{ 'positive': stats.profitDifference > 0, 'negative': stats.profitDifference < 0 }">
              <h4>Отклонение</h4>
              <div class="summary-value">{{ formatCurrency(stats.profitDifference) }}</div>
              <div class="summary-label">{{ stats.profitDifference > 0 ? '+' : '' }}{{ ((stats.totalActualProfit / stats.totalPlanProfit) * 100).toFixed(1) }}%</div>
            </div>
          </div>

          <!-- Список планов -->
          <div v-if="loading.plans" class="loading">
            <div class="loading-overlay">
              <div class="loading-spinner"></div>
            </div>
          </div>

          <div v-else-if="plans.length === 0" class="empty-state">
            Нет созданных планов
          </div>

          <div v-else class="plans-table">
            <table>
              <thead>
              <tr>
                <th>Точка</th>
                <th>Период</th>
                <th>План (прибыль)</th>
                <th>Факт (прибыль)</th>
                <th>Отклонение</th>
                <th>Выполнение</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="plan in plans" :key="plan._id">
                <td>{{ plan.pointId?.name || 'Общий' }}</td>
                <td>{{ formatDate(plan.date) }} ({{ plan.period }})</td>
                <td>{{ formatCurrency(plan.metrics.profit) }}</td>
                <td>{{ formatCurrency(plan.actual.profit) }}</td>
                <td :class="{ 'positive': plan.actual.profit - plan.metrics.profit > 0, 'negative': plan.actual.profit - plan.metrics.profit < 0 }">
                  {{ formatCurrency(plan.actual.profit - plan.metrics.profit) }}
                </td>
                <td>
                  <div class="progress-bar">
                    <div class="progress" :style="{ width: Math.min(100, (plan.actual.profit / plan.metrics.profit) * 100) + '%' }"></div>
                    <span>{{ ((plan.actual.profit / plan.metrics.profit) * 100).toFixed(1) }}%</span>
                  </div>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="not-authorized">
      <p>Вы не авторизованы в предприятии</p>
      <p>Пожалуйста, <button class="login-btn" @click="notAuth">войдите</button> сначала</p>
    </div>
  </section>
</template>

<style scoped>
.enterprise-management {
  padding: 20px;
  color: white;
  height: 100%;
  overflow-y: initial;
}

h2 {
  margin: 0 0 1.5rem 0;
  color: white;
}

.not-authorized {
  padding: 2rem;
  text-align: center;
  background: rgba(255, 80, 80, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 80, 80, 0.3);
}

.login-btn {
  margin-top: 0.5rem;
  padding: 5px 10px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: #1eef6f;
  color: #020b18;
  transition: all 0.2s;
}

.login-btn:hover:not(:disabled) {
  background: #15b050;
}

.content {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 20px;
}

.header_content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.enterprise-info h2 {
  margin: 0 0 5px 0;
  font-size: 24px;
}

.enterprise-details {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.quick-stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  text-align: right;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #1eef6f;
}

.stat-value.positive {
  color: #1eef6f;
}

.stat-value.negative {
  color: #ff6b6b;
}

.tabs {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
}

.tab-btn {
  background: rgba(56, 239, 125, 0.1);
  border: 1px solid rgba(56, 239, 125, 0.3);
  color: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  background: rgba(56, 239, 125, 0.2);
  border-color: #38ef7d;
}

.tab-btn.active {
  color: #4f9d5a;
  background: rgba(30, 239, 111, 0.1);
}

.main_content {
  min-height: 400px;
}

.tab-content {
  padding: 20px 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.content-header h3 {
  margin: 0;
  color: white;
}

.action-btn {
  padding: 8px 16px;
  background: #1eef6f;
  color: #020b18;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #15b050;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-numbers {
  text-align: center;
}

.stat-main {
  font-size: 32px;
  font-weight: 600;
  color: #1eef6f;
  line-height: 1.2;
}

.stat-secondary {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 5px;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.add-form {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.add-form h4 {
  margin: 0 0 20px 0;
  color: #1eef6f;
}

.add-form h5 {
  margin: 0 0 10px 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.form-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 10px;
  background: #1eef6f;
  color: #020b18;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 10px;
  transition: all 0.2s;
}

.submit-btn:hover {
  background: #15b050;
}

.points-by-region {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.region-title {
  color: #1eef6f;
  margin: 0 0 15px 0;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(30, 239, 111, 0.3);
}

.points-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
}

.point-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 15px;
  transition: all 0.2s;
}

.point-card:hover {
  background: rgba(30, 239, 111, 0.02);
  border-color: rgba(30, 239, 111, 0.2);
}

.point-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.point-header h5 {
  margin: 0;
  font-size: 16px;
}

.point_set {
  display: flex;
  gap: 6px;
}

.point-type {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 12px;
  background: rgba(30, 239, 111, 0.1);
  color: #1eef6f;
}

.point-settings {
  border-radius: 50%;
  background: rgba(30, 239, 111, 0.1);
  color: #1eef6f;
  border: none;
  &:hover {
    cursor: pointer;
  }
}

.point-details p {
  margin: 5px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.point-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.status.активна {
  background: rgba(30, 239, 111, 0.1);
  color: #1eef6f;
}

.status.закрыта {
  background: rgba(255, 80, 80, 0.1);
  color: #ff6b6b;
}

.status.на_ремонте {
  background: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.status.активен {
  background: rgba(30, 239, 111, 0.1);
  color: #1eef6f;
}

.status.в_отпуске {
  background: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.status.уволен {
  background: rgba(255, 80, 80, 0.1);
  color: #ff6b6b;
}

.date {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.employees-table, .plans-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

td {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.positive {
  color: #1eef6f;
}

.negative {
  color: #ff6b6b;
}

.plan-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.summary-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.summary-card h4 {
  margin: 0 0 10px 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
  color: #1eef6f;
  line-height: 1.2;
}

.summary-card.positive .summary-value {
  color: #1eef6f;
}

.summary-card.negative .summary-value {
  color: #ff6b6b;
}

.summary-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 5px;
}

.progress-bar {
  position: relative;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: #1eef6f;
  transition: width 0.3s ease;
}

.progress-bar span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  color: #020b18;
  font-weight: 600;
}

.loading, .empty-state, .empty-message {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-message {
  padding: 20px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-top: 3px solid #38ef7d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>