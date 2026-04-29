<script setup lang="ts">
const {addNotification} = useNotifications('Создание точки')
const {addLog} = useLogger("Создание точки")
const {closeWindow} = useWindowManager()

const emit = defineEmits<{
  (e: 'point-added', point: any): void
}>()

const enterpriseInfo = ref<any>(null)
const loading = ref(false)

const pointFormat = ['Магазин', 'Склад', 'Офис', 'Производство', 'Другое']

// Поля для динамического добавления
const newPosition = ref('')
const newDepartment = ref('')

const newPoint = ref({
  name: '',
  region: '',
  city: '',
  address: '',
  type: 'Магазин',
  positions: [] as string[],
  departments: [] as string[],
  contactPerson: {name: '', phone: '', email: ''},
  metadata: {square: '', employeeCount: ''}
})

// Функции для добавления должностей
function addPosition() {
  if (newPosition.value.trim() && !newPoint.value.positions.includes(newPosition.value.trim())) {
    newPoint.value.positions.push(newPosition.value.trim())
    newPosition.value = ''
  }
}

function removePosition(index: number) {
  newPoint.value.positions.splice(index, 1)
}

// Функции для добавления отделов
function addDepartment() {
  if (newDepartment.value.trim() && !newPoint.value.departments.includes(newDepartment.value.trim())) {
    newPoint.value.departments.push(newDepartment.value.trim())
    newDepartment.value = ''
  }
}

function removeDepartment(index: number) {
  newPoint.value.departments.splice(index, 1)
}

// Обработка выбора адреса из компонента MoloInput
function handleAddressSelected(address: any) {
  const data = address.data
  newPoint.value.region = data.region_with_type || data.region || ''
  if (data.city_with_type) {
    newPoint.value.city = data.city_with_type
  } else if (data.settlement_with_type) {
    newPoint.value.city = data.settlement_with_type
  } else if (data.city) {
    newPoint.value.city = data.city
  } else {
    newPoint.value.city = ''
  }
}

onMounted(() => {
  const data = localStorage.getItem('currentEnterprise')
  if (data) {
    try {
      enterpriseInfo.value = JSON.parse(data)
    } catch (e) {
      addLog('error', `Ошибка парсинга данных предприятия - ${e}`)
    }
  }
})

async function addPoint() {
  if (!enterpriseInfo.value?._id) {
    addNotification('warning', 'Данные предприятия не загружены')
    return
  }

  if (!newPoint.value.name || !newPoint.value.region || !newPoint.value.city || !newPoint.value.address) {
    addNotification('warning', 'Заполните все обязательные поля')
    return
  }

  if (!newPoint.value.contactPerson.name || !newPoint.value.contactPerson.phone || !newPoint.value.contactPerson.email) {
    addNotification('warning', 'Заполните поля о контактной информации')
    return
  }

  loading.value = true
  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/points/points`, {
      method: 'POST',
      body: newPoint.value
    })
    emit('point-added', response.point)
    closeWindow()
    addNotification('info', 'Точка успешно добавлена')
    addLog('success', 'Точка успешно добавлена')
  } catch (error: any) {
    addLog('error', `Ошибка добавления точки - ${error.data?.message}`)
    addNotification('error',  'Ошибка добавления точки')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="form-grid">
    <h1>Основная информация</h1>

    <MoloInput
        tLabel="Номер точки"
        lRequired
        type="text"
        iRequired
        placeholder="12345"
        v-model="newPoint.name"
    />

    <!-- Поиск адреса через MoloInput -->
    <MoloInput
        tLabel="Полный адрес точки"
        lRequired
        iRequired
        placeholder="Введите адрес полностью..."
        v-model="newPoint.address"
        :address="true"
        @address-selected="handleAddressSelected"
    />

    <!-- Отображение разобранных полей (для информации) -->
    <div class="address-preview" v-if="newPoint.region || newPoint.city">
      <div class="preview-item" v-if="newPoint.region">
        <span class="preview-label">Регион:</span>
        <span class="preview-value">{{ newPoint.region }}</span>
      </div>
      <div class="preview-item" v-if="newPoint.city">
        <span class="preview-label">Населённый пункт:</span>
        <span class="preview-value">{{ newPoint.city }}</span>
      </div>
    </div>

    <MoloSelect
        v-model="newPoint.type"
        lRequired
        tLabel="Формат точки"
        :parent="pointFormat"
        :children="format"
    />

    <hr>

    <!-- Динамические должности -->
    <div class="form-section">
      <h2>Должности для точки</h2>
      <div class="dynamic-list">
        <div class="add-item">
          <MoloInput
              lRequired
              tLabel="Новая должность"
              type="text"
              placeholder="Например: Продавец-консультант"
              v-model="newPosition"
              @keyup.enter="addPosition"
          />
          <button type="button" class="add-btn" @click="addPosition">+ Добавить</button>
        </div>

        <div v-if="newPoint.positions.length > 0" class="items-list">
          <div v-for="(position, idx) in newPoint.positions" :key="idx" class="item-tag">
            <span>{{ position }}</span>
            <button type="button" class="remove-btn" @click="removePosition(idx)">×</button>
          </div>
        </div>
        <div v-else class="empty-hint">Добавьте хотя бы одну должность</div>
      </div>
    </div>

    <!-- Динамические отделы -->
    <div class="form-section">
      <h2>Отделы для точки</h2>
      <div class="dynamic-list">
        <div class="add-item">
          <MoloInput
              lRequired
              tLabel="Новый отдел"
              type="text"
              placeholder="Например: Отдел продаж"
              v-model="newDepartment"
              @keyup.enter="addDepartment"
          />
          <button type="button" class="add-btn" @click="addDepartment">+ Добавить</button>
        </div>

        <div v-if="newPoint.departments.length > 0" class="items-list">
          <div v-for="(dept, idx) in newPoint.departments" :key="idx" class="item-tag">
            <span>{{ dept }}</span>
            <button type="button" class="remove-btn" @click="removeDepartment(idx)">×</button>
          </div>
        </div>
        <div v-else class="empty-hint">Добавьте хотя бы один отдел</div>
      </div>
    </div>

    <hr>

    <!-- Контактное лицо -->
    <div class="grid-full">
      <div class="form-section">
        <h2>Контактное лицо</h2>
        <div class="grid-3">
          <MoloInput tLabel="ФИО"
                     type="text"
                     placeholder="Ширков Максим Андреевич"
                     v-model="newPoint.contactPerson.name"
                     lRequired
                     iRequired
          />
          <MoloInput tLabel="Телефон"
                     type="text"
                     placeholder="+79875872007"
                     v-model="newPoint.contactPerson.phone"
                     lRequired
                     iRequired
                     :phone="true"
          />
          <MoloInput tLabel="Email"
                     type="text"
                     placeholder="maksimkq1990@mail.ru"
                     v-model="newPoint.contactPerson.email"
                     lRequired
                     iRequired/>
        </div>
      </div>
    </div>
    <hr>

    <!-- Дополнительно -->
    <div class="grid-full">
      <div class="form-section">
        <h2>Дополнительно</h2>
        <div class="grid-2">
          <MoloInput
              tLabel="Площадь (м²)"
              type="text"
              placeholder="40.2"
              v-model="newPoint.metadata.square"
          />
          <MoloInput
              tLabel="Кол-во сотрудников"
              type="number"
              placeholder="6"
              v-model="newPoint.metadata.employeeCount"
          />
        </div>
      </div>
    </div>
    <button class="action-btn confirm" @click="addPoint" :disabled="loading">
      <MoloLoaders btnLoader v-if="loading"/>
      <span v-else>Сохранить точку</span>
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

.address-preview {
  background: rgba(30, 239, 111, 0.05);
  border: 1px solid rgba(30, 239, 111, 0.2);
  border-radius: 4px;
  padding: 10px;
  margin: 5px 0;
}

.preview-item {
  display: flex;
  gap: 10px;
  font-size: 13px;
  padding: 2px 0;
}

.preview-label {
  color: rgba(255, 255, 255, 0.5);
  min-width: 120px;
}

.preview-value {
  color: #1eef6f;
}

.form-section h5 {
  margin: 0 0 15px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.dynamic-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.add-item {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.add-item > *:first-child {
  flex: 1;
}

.add-btn {
  padding: 10px 20px;
  background: rgba(30, 239, 111, 0.1);
  border: 1px solid rgba(30, 239, 111, 0.3);
  color: #1eef6f;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.add-btn:hover {
  background: rgba(30, 239, 111, 0.2);
}

.items-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.item-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  font-size: 13px;
}

.item-tag span {
  color: white;
}

.remove-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  transition: color 0.2s;
}

.remove-btn:hover {
  color: #ff6b6b;
}

.empty-hint {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  font-style: italic;
  padding: 10px;
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .grid-2, .grid-3 {
    grid-template-columns: 1fr;
  }

  .add-item {
    flex-direction: column;
  }

  .add-btn {
    width: 100%;
  }
}
</style>