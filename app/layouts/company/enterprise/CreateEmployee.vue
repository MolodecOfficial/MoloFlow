<script setup lang="ts">
import {useNotifications} from '~/composables/useNotifications'
import {useWindowManager} from '~/composables/useWindowManager'

const {addNotification} = useNotifications()
const {closeWindow} = useWindowManager()
const emit = defineEmits<{
  (e: 'employee-added', employee: any): void
}>()

const loading = ref(false)
const points = ref<any[]>([])
const enterpriseInfo = ref<any>(null)
const users = ref<any[]>([])
const searchQuery = ref('')
const selectedUser = ref<any>(null)
const addMode = ref<'new' | 'existing'>('new')
const showUserList = ref(false)

const availableRoles = ['Сотрудник', 'Бухгалтер', 'Комплектовщик', 'Управляющий']
const availableDepartment = ['IT-Отдел', 'Отдел продаж', 'Отдел безопасности', 'Юридический отдел']

// Функция для форматирования телефона
function formatPhone(value: string) {
  if (!value) return '+7';

  // Удаляем все нецифровые символы
  let numbers = value.replace(/\D/g, '');

  // Если номер начинается с 7 или 8, заменяем на +7
  if (numbers.startsWith('8')) {
    numbers = '7' + numbers.substring(1);
  }
  if (!numbers.startsWith('7')) {
    numbers = '7' + numbers;
  }

  // Ограничиваем длину до 11 цифр (включая 7)
  numbers = numbers.substring(0, 11);

  // Форматируем по маске +7 (XXX) XXX-XX-XX
  let formatted = '+7';
  if (numbers.length > 1) {
    formatted += ' (' + numbers.substring(1, 4);
  }
  if (numbers.length >= 5) {
    formatted += ') ' + numbers.substring(4, 7);
  }
  if (numbers.length >= 8) {
    formatted += '-' + numbers.substring(7, 9);
  }
  if (numbers.length >= 10) {
    formatted += '-' + numbers.substring(9, 11);
  }

  return formatted;
}

// Обработчик ввода телефона
function onPhoneInput(field: 'phone' | 'emergencyPhone', event: Event) {
  const input = event.target as HTMLInputElement;
  const cursorPosition = input.selectionStart || 0;
  const oldValue = newEmployee.value.contacts[field];

  // Форматируем новое значение
  const newValue = formatPhone(input.value);

  // Вычисляем новую позицию курсора
  let newCursorPosition = cursorPosition;

  // Если добавились автоматические символы, сдвигаем курсор
  if (newValue.length > oldValue.length) {
    newCursorPosition += newValue.length - oldValue.length;
  }

  // Обновляем значение
  newEmployee.value.contacts[field] = newValue;

  // Восстанавливаем позицию курсора после обновления DOM
  nextTick(() => {
    input.setSelectionRange(newCursorPosition, newCursorPosition);
  });
}

// Очистка телефона при фокусе
function onPhoneFocus(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.value === '+7') {
    input.setSelectionRange(2, 2);
  }
}

const newEmployee = ref({
  name: '',
  password: '',
  role: 'Сотрудник',
  position: '',
  department: '',
  pointId: '',
  salary: 0,
  contacts: {
    phone: '+7',
    emergencyPhone: '+7'
  }
})

const filteredUsers = computed(() => {
  const query = (searchQuery.value || '').toString().trim().toLowerCase()

  if (!query) return []

  return users.value
      .filter(user => {
        const name = (user.name || user.displayName || '')
            .toString()
            .toLowerCase()

        const phone = (user.phone || user.phoneNumber || '')
            .toString()
            .toLowerCase()

        return name.includes(query) || phone.includes(query)
      })
      .slice(0, 10)
})

const availablePoints = computed(() => {
  return points.value
      .filter(p => p.status === 'Активна')
      .map(point => ({
        ...point,
        displayName: `${point.name}, ${point.address}`
      }))
})

// Вычисляемое свойство для доступных должностей выбранной точки
const availablePositions = computed(() => {
  const selectedPoint = points.value.find(p => p._id === newEmployee.value.pointId)
  return selectedPoint?.positions || []
})

// Вычисляемое свойство для доступных отделов выбранной точки
const availableDepartments = computed(() => {
  const selectedPoint = points.value.find(p => p._id === newEmployee.value.pointId)
  return selectedPoint?.departments || []
})

async function loadPoints() {
  if (!enterpriseInfo.value?._id) return
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/points/points`)
    points.value = response.points
  } catch {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки точек')
  }
}

async function loadUsers() {
  try {
    const response = await $fetch('/api/users/users')
    users.value = response.users
  } catch {
    addNotification('ERROR_DEFAULT', 'Ошибка загрузки пользователей')
  }
}

function selectUser(user: any) {
  selectedUser.value = user
  newEmployee.value.name = user.name || user.displayName || ''
  newEmployee.value.contacts.phone = user.phone || user.phoneNumber || '+7'
  searchQuery.value = ''
  showUserList.value = false
}

function clearSelectedUser() {
  selectedUser.value = null
  newEmployee.value.name = ''
  newEmployee.value.contacts.phone = '+7'
  newEmployee.value.password = ''
  searchQuery.value = ''
  showUserList.value = false
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.user-search')) {
    showUserList.value = false
  }
}

function handleSearchInput(value: string) {
  searchQuery.value = value

  if (selectedUser.value && value !== (selectedUser.value.name || selectedUser.value.displayName || '')) {
    selectedUser.value = null
    newEmployee.value.name = ''
    newEmployee.value.contacts.phone = '+7'
  }

  if (value.trim().length >= 1) {
    showUserList.value = true
  } else {
    showUserList.value = false
  }
}

function handleSearchFocus() {
  if (searchQuery.value?.trim().length >= 1) {
    showUserList.value = true
  }
}

async function addEmployee() {
  if (addMode.value === 'new') {
    if (!newEmployee.value.name || !newEmployee.value.password || !newEmployee.value.position) {
      addNotification('ERROR_DEFAULT', 'Заполните обязательные поля: Имя, Пароль, Должность')
      return
    }
  } else {
    if (!selectedUser.value) {
      addNotification('ERROR_DEFAULT', 'Выберите пользователя из списка')
      return
    }
    if (!newEmployee.value.position) {
      addNotification('ERROR_DEFAULT', 'Заполните обязательное поле: Должность')
      return
    }
  }

  if (!enterpriseInfo.value?._id) {
    addNotification('ERROR_DEFAULT', 'Данные предприятия не загружены')
    return
  }

  try {
    loading.value = true

    const baseData = {
      role: newEmployee.value.role,
      position: newEmployee.value.position,
      department: newEmployee.value.department || '',
      pointId: newEmployee.value.pointId || null,
      salary: Number(newEmployee.value.salary) || 0,
      contacts: {
        phone: newEmployee.value.contacts.phone || '',
        emergencyPhone: newEmployee.value.contacts.emergencyPhone || ''
      }
    }

    const employeeData = addMode.value === 'new'
        ? { ...baseData, name: newEmployee.value.name, password: newEmployee.value.password }
        : { ...baseData, userId: selectedUser.value._id }

    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/employees/employees`, {
      method: 'POST',
      body: employeeData
    })

    emit('employee-added', response.employee)
    closeWindow()
    addNotification('NOTICE_DEFAULT', 'Сотрудник успешно добавлен')
  } catch (error: any) {
    const message = error.response?._data?.message || 'Ошибка добавления сотрудника'
    addNotification('ERROR_DEFAULT', message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const enterpriseDataStr = localStorage.getItem('currentEnterprise')
  const token = localStorage.getItem('enterprise_token')

  if (enterpriseDataStr && token) {
    try {
      enterpriseInfo.value = JSON.parse(enterpriseDataStr)
      loadPoints()
      loadUsers()
      document.addEventListener('click', handleClickOutside)
    } catch {
      addNotification('ERROR_DEFAULT', 'Ошибка загрузки данных предприятия')
    }
  } else {
    addNotification('ERROR_DEFAULT', 'Не авторизован в предприятии')
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(() => newEmployee.value.pointId, (newPointId) => {
  if (newPointId) {
    const selectedPoint = points.value.find(p => p._id === newPointId)
    // Очищаем только если выбранная должность или отдел не входят в списки точки
    if (newEmployee.value.position && !selectedPoint?.positions?.includes(newEmployee.value.position)) {
      newEmployee.value.position = ''
    }
    if (newEmployee.value.department && !selectedPoint?.departments?.includes(newEmployee.value.department)) {
      newEmployee.value.department = ''
    }
  }
})
</script>

<template>
  <div class="mode-selector">
    <button
        class="mode-btn"
        :class="{ active: addMode === 'new' }"
        @click="addMode = 'new'; clearSelectedUser()"
    >
      Новый пользователь
    </button>
    <button
        class="mode-btn"
        :class="{ active: addMode === 'existing' }"
        @click="addMode = 'existing'"
    >
      Существующий пользователь
    </button>
  </div>

  <div class="form-grid">
    <h1>Основная информация</h1>

    <template v-if="addMode === 'existing'">
      <div class="user-search">
        <div class="search-container">
          <MoloInput
              tLabel="Поиск пользователя"
              type="text"
              :modelValue="searchQuery"
              @update:modelValue="(val) => handleSearchInput(val)"
              @focus="handleSearchFocus"
              placeholder="Введите имя, email или телефон..."
          />
        </div>

        <div v-if="showUserList && filteredUsers.length > 0" class="users-dropdown">
          <div class="users-list">
            <div
                v-for="user in filteredUsers"
                :key="user._id"
                class="user-item"
                :class="{ selected: selectedUser?._id === user._id }"
                @click="selectUser(user)"
            >
              <div class="user-name">{{ user.name || user.displayName || 'Без имени' }}</div>
              <div class="user-details">
                <span v-if="user.email">{{ user.email }}</span>
                <span v-if="user.phone || user.phoneNumber">{{ user.phone || user.phoneNumber }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="showUserList && searchQuery && filteredUsers.length === 0" class="no-results-dropdown">
          Пользователи не найдены
        </div>
      </div>

      <div v-if="selectedUser" class="selected-user-info">
        <h5>Выбранный пользователь</h5>
        <p><strong>Имя:</strong> {{ selectedUser.name || selectedUser.displayName }}</p>
        <p><strong>Телефон:</strong> {{ selectedUser.phone || selectedUser.phoneNumber || 'Не указан' }}</p>
        <button v-if="selectedUser || searchQuery"
                @click="clearSelectedUser"
                class="edit-choice"
        >
          Изменить выбор
        </button>
      </div>
    </template>

    <template v-else>
      <MoloInput
          tLabel="Имя"
          lRequired
          type="text"
          iRequired
          placeholder="Максим"
          v-model="newEmployee.name"
      />
      <MoloInput
          tLabel="Пароль"
          lRequired
          type="password"
          iRequired
          placeholder="Избегайте простых комбинаций"
          v-model="newEmployee.password"
      />
    </template>

    <MoloSelect
        v-model="newEmployee.role"
        lRequired
        tLabel="Роль"
        :parent="availableRoles"
        :children="role"
        disabled="Выберите роль"
    />

    <MoloSelect
        v-model="newEmployee.pointId"
        lRequired
        tLabel="Точка"
        :parent="availablePoints"
        children="displayName"
        valueKey="_id"
        disabled="Выберите точку"
        iRequired
    />

    <div class="grid-2">
      <MoloSelect
          v-model="newEmployee.position"
          lRequired
          tLabel="Должность"
          :parent="availablePositions"
          :children="position"
          disabled="Выберите должность"
          iRequired
      />
      <MoloSelect
          v-model="newEmployee.department"
          lRequired
          tLabel="Отдел"
          :parent="availableDepartments"
          :children="department"
          disabled="Выберите отдел"
      />
    </div>
    <hr>
    <div class="form-section">
      <h2>Контакты</h2>
      <div class="grid-2">
        <div class="phone-input-container">
          <MoloInput
              lRequired
              iRequired
              tLabel="Телефон"
              type="tel"
              placeholder="+7 (987) 587-20-07"
              :modelValue="newEmployee.contacts.phone"
              @update:modelValue="(val) => {
                newEmployee.contacts.phone = val;
              }"
              @input="(e) => onPhoneInput('phone', e)"
              @focus="onPhoneFocus"
              maxLength="18"
          />
        </div>
        <div class="phone-input-container">
          <MoloInput
              lRequired
              iRequired
              tLabel="Экстренный телефон"
              type="tel"
              placeholder="+7 (987) 587-20-07"
              :modelValue="newEmployee.contacts.emergencyPhone"
              @update:modelValue="(val) => {
                newEmployee.contacts.emergencyPhone = val;
              }"
              @input="(e) => onPhoneInput('emergencyPhone', e)"
              @focus="onPhoneFocus"
              maxlength="18"
          />
        </div>
      </div>
    </div>

    <button class="action-btn confirm" @click="addEmployee" :disabled="loading">
      <div v-if="loading" class="modern-loader"></div>
      <span v-else>Сохранить сотрудника</span>
    </button>
  </div>
</template>

<style scoped>
.search-container {
  position: relative;
  width: 100%;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.mode-selector {
  display: flex;
  gap: 10px;
  padding: 5px;
  background: var(--half_opacity_bg);
  border-radius: 8px;
}

.mode-btn {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: rgba(30, 239, 111, 0.1);
  border-color: #1eef6f;
}

.mode-btn.active {
  background: #1eef6f;
  color: #020b18;
  border-color: #1eef6f;
}

.user-search {
  position: relative;
  margin-bottom: 15px;
}

.edit-choice {
  border: 1px solid #2e7247;
  border-radius: 4px;
  background-color: var(--half_opacity_bg);
  padding: 6px 12px;
  color: grey;
  transition: all 0.2s ease-in-out;
  &:hover {
    border: 1px solid var(--half_opacity_border_hover);
    color: lightgrey;
  }
}

.users-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  margin-top: 4px;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.no-results-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  margin-top: 4px;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.users-list {
  max-height: 250px;
  overflow-y: auto;
}

.user-item {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s;
}

.user-item:hover {
  background: rgba(30, 239, 111, 0.1);
}

.user-item.selected {
  background: rgba(30, 239, 111, 0.2);
  border-left: 3px solid #1eef6f;
}

.user-name {
  font-weight: 500;
  margin-bottom: 3px;
  color: white;
}

.user-details {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.selected-user-info {
  background: rgba(30, 239, 111, 0.05);
  border: 1px solid rgba(30, 239, 111, 0.2);
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
}

.selected-user-info h5 {
  margin: 0 0 10px 0;
  color: #1eef6f;
}

.selected-user-info p {
  margin: 5px 0;
  font-size: 14px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 100%;
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

.phone-input-container {
  width: 100%;
}

@media (max-width: 768px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>