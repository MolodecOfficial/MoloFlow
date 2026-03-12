<script setup lang="ts">
import {useNotifications} from '~/composables/useNotifications'
import {useWindowManager} from '~/composables/useWindowManager'

const {addNotification} = useNotifications()
const {closeWindow} = useWindowManager()
const emit = defineEmits<{
  (e: 'employee-added', employee: any): void
}>()

// Состояния
const loading = ref(false)
const points = ref<any[]>([])
const enterpriseInfo = ref<any>(null)

// Форма нового сотрудника
const newEmployee = ref({
  name: '',
  password: '',
  role: 'Сотрудник',
  position: '',
  department: '',
  pointId: '',
  salary: 0,
  contacts: {
    phone: '',
    email: '',
    emergencyPhone: ''
  }
})

// Доступные точки (только активные)
const availablePoints = computed(() => {
  return points.value.filter(p => p.status === 'Активна')
})

// Загрузка точек
async function loadPoints() {
  if (!enterpriseInfo.value?._id) return

  loading.value = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/points`)
    points.value = response.points
  } catch (error) {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки точек')
  } finally {
    loading.value = false
  }
}

async function addEmployee() {
  if (!newEmployee.value.name || !newEmployee.value.password || !newEmployee.value.position) {
    addNotification('ERROR_DEFAULT', 'Заполните обязательные поля: Имя, Пароль, Должность')
    return
  }

  if (!enterpriseInfo.value?._id) {
    addNotification('ERROR_DEFAULT', 'Данные предприятия не загружены')
    return
  }

  try {
    loading.value = true
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/employees`, {
      method: 'POST',
      body: newEmployee.value
    })

    emit('employee-added', response.employee)
    closeWindow()
    addNotification('NOTICE_DEFAULT', 'Сотрудник успешно добавлен')
  } catch (error: any) {
    console.log(error)
    addNotification('ERROR_DEFAULT', error.data?.message || 'Ошибка добавления сотрудника')
  } finally {
    loading.value = false
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
    addNotification('ERROR_DEFAULT', 'Не авторизован в предприятии')
  }
})
</script>
<template>
  <h1>Новый сотрудник</h1>
  <hr>
  <div class="form-grid">
    <h5>Основная информация</h5>
    <MoloForm
        tLabel="Имя"
        lRequired
        type="text"
        iRequired
        placeholder="Максим"
        v-model="newEmployee.name"
    />
    <MoloForm
        tLabel="Пароль"
        lRequired
        type="password"
        iRequired
        placeholder="Избегайте простых комбинаций для вашей безопасности"
        v-model="newEmployee.password"
    />
    <label>Роль</label>
    <select v-model="newEmployee.role">
      <option value="Сотрудник">Сотрудник</option>
      <option value="Бухгалтер">Бухгалтер</option>
      <option value="Комплектовщик">Комплектовщик</option>
      <option value="Управляющий">Управляющий</option>
    </select>
    <div class="grid-2">
      <MoloForm
          tLabel="Должность"
          lRequired
          type="text"
          iRequired
          placeholder="Специалист, Руководитель, Продавец"
          v-model="newEmployee.position"
      />
      <MoloForm
          tLabel="Отдел"
          lRequired
          type="text"
          iRequired
          placeholder="IT-отдел, Отдел продаж, Отдел маркетинга"
          v-model="newEmployee.department"
      />
    </div>
    <label>К какой точке привязан</label>
    <select v-model="newEmployee.pointId">
      <option value="">Не привязан к точке</option>
      <option v-for="point in availablePoints" :key="point._id" :value="point._id">
        {{ point.name }}
      </option>
    </select>
    <MoloForm
        tLabel="Зарплата"
        lRequired
        type="number"
        iRequired
        placeholder="Окладная заработная плата сотрудника"
        v-model="newEmployee.salary"
    />

    <div class="form-section">
      <h5>Контакты</h5>
      <div class="grid-3">
        <MoloForm
            tLabel="Телефон"
            lRequired
            type="phone"
            iRequired
            placeholder="+79875872007"
            v-model="newEmployee.contacts.phone"
        />
        <MoloForm
            tLabel="Email"
            lRequired
            type="email"
            iRequired
            placeholder="maksimkq1990@mail.ru"
            v-model="newEmployee.contacts.email"
        />
        <MoloForm
            tLabel="Экстренный телефон"
            lRequired
            type="phone"
            iRequired
            placeholder="Внутренний телефон компании, например 1234"
            v-model="newEmployee.contacts.emergencyPhone"
        />
      </div>
    </div>
    <button class="submit-btn" @click="addEmployee">
      <div v-if="loading" class="modern-loader"></div>
      <span v-else>Сохранить сотрудника</span>
    </button>
  </div>
</template>

<style scoped>


.form-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  overflow: inherit;
}

.grid-full {
  width: 100%;
  overflow: hidden;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 100%;
}

.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  width: 100%;
}

.form-input, .form-select {
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
  margin: 20px 0 20px 0;
  transition: all 0.2s;
}

.submit-btn:hover {
  background: #15b050;
}

label {
  font-size: 15px;
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

/* Адаптивность */
@media (max-width: 768px) {
  .grid-2, .grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>