<script setup lang="ts">
const { addNotification } = useNotifications()
const { closeWindow } = useWindowManager()

const emit = defineEmits<{
  (e: 'point-added', point: any): void
}>()

const enterpriseInfo = ref<any>(null)

// Единый поиск адреса
const addressSearch = ref('')
const showAddressDropdown = ref(false)
const selectedAddress = ref<any>(null)

const newPoint = ref({
  name: '',
  region: '',
  city: '',
  address: '',
  type: 'Магазин',
  contactPerson: { name: '', phone: '', email: '' },
  metadata: { square: '', employeeCount: '' }
})

const suggestions = ref<any[]>([])
const loading = ref(false)

// Загрузка подсказок адреса
async function loadAddresses() {
  if (!addressSearch.value || addressSearch.value.length < 3) return

  loading.value = true
  try {
    const response = await $fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Token 92342561939d6fa40d4b834a390cac4c5b2d4d7e'
      },
      body: {
        query: addressSearch.value,
        count: 10,
        locations: [{ country: 'Россия' }]
      }
    })
    suggestions.value = response.suggestions
    showAddressDropdown.value = suggestions.value.length > 0
  } catch (error) {
    console.error('Ошибка загрузки адресов:', error)
  } finally {
    loading.value = false
  }
}

// Debounce
let timeout: NodeJS.Timeout
const onAddressSearch = () => {
  clearTimeout(timeout)
  timeout = setTimeout(loadAddresses, 300)
}

// Выбор адреса
const selectAddress = (address: any) => {
  selectedAddress.value = address

  // Разбираем адрес на составляющие
  const data = address.data

  // Регион
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

  // Полный адрес
  newPoint.value.address = address.value

  addressSearch.value = address.value
  showAddressDropdown.value = false
}

// Клик вне дропдауна
onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.search-container')) {
      showAddressDropdown.value = false
    }
  })
})

onMounted(() => {
  const data = localStorage.getItem('currentEnterprise')
  if (data) {
    try {
      enterpriseInfo.value = JSON.parse(data)
    } catch (e) {
      console.error('Ошибка парсинга данных предприятия', e)
    }
  }
})

async function addPoint() {
  if (!enterpriseInfo.value?._id) {
    addNotification('ERROR_DEFAULT', 'Данные предприятия не загружены')
    return
  }

  if (!newPoint.value.name || !newPoint.value.region || !newPoint.value.city || !newPoint.value.address) {
    addNotification('ERROR_DEFAULT', 'Заполните все обязательные поля')
    return
  }

  try {
    const response = await $fetch(`/api/enterprises/${enterpriseInfo.value._id}/points`, {
      method: 'POST',
      body: newPoint.value
    })
    emit('point-added', response.point)
    closeWindow()
    addNotification('NOTICE_DEFAULT', 'Точка успешно добавлена')
  } catch (error: any) {
    addNotification('ERROR_DEFAULT', error.data?.message || 'Ошибка добавления точки')
  }
}
</script>

<template>
  <h1>Создание новой точки</h1>
  <hr>
  <div class="form-grid">
    <h5>Основная информация</h5>

    <MoloForm
        tLabel="Номер точки"
        lRequired
        type="text"
        iRequired
        placeholder="12345"
        v-model="newPoint.name"
    />

    <!-- Единый поиск адреса -->
    <div class="search-container">
      <div class="search-wrapper">
        <MoloForm
            tLabel="Полный адрес точки"
            lRequired
            type="text"
            iRequired
            placeholder="Введите адрес полностью..."
            v-model="addressSearch"
            @input="onAddressSearch"
            @focus="addressSearch.length > 2 && loadAddresses()"
        />
        <div v-if="loading" class="search-spinner"></div>
        <div v-if="showAddressDropdown && suggestions.length > 0" class="dropdown">
          <div
              v-for="item in suggestions"
              :key="item.data?.kladr_id"
              class="dropdown-item"
              @click="selectAddress(item)"
          >
            <span>{{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>

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

    <!-- Тип точки -->
    <label>Формат точки</label>
    <select v-model="newPoint.type" class="form-select">
      <option value="Магазин">Магазин</option>
      <option value="Склад">Склад</option>
      <option value="Офис">Офис</option>
      <option value="Производство">Производство</option>
      <option value="Другое">Другое</option>
    </select>

    <!-- Контактное лицо -->
    <div class="grid-full">
      <div class="form-section">
        <h5>Контактное лицо</h5>
        <div class="grid-3">
          <MoloForm tLabel="ФИО" type="text" placeholder="Ширков Максим Андреевич" v-model="newPoint.contactPerson.name" />
          <MoloForm tLabel="Телефон" type="text" placeholder="+79875872007" v-model="newPoint.contactPerson.phone" />
          <MoloForm tLabel="Email" type="text" placeholder="maksimkq1990@mail.ru" v-model="newPoint.contactPerson.email" />
        </div>
      </div>
    </div>

    <!-- Дополнительно -->
    <div class="grid-full">
      <div class="form-section">
        <h5>Дополнительно</h5>
        <div class="grid-2">
          <MoloForm tLabel="Площадь (м²)" type="text" placeholder="40.2" v-model="newPoint.metadata.square" />
          <MoloForm tLabel="Кол-во сотрудников" type="number" placeholder="6" v-model="newPoint.metadata.employeeCount" />
        </div>
      </div>
    </div>
  </div>


  <button class="submit-btn" @click="addPoint">
    <div v-if="loading" class="modern-loader"></div>
    <span v-else>Сохранить точку</span>
  </button>
</template>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  overflow: inherit;
}

.grid-full { width: 100%; overflow: hidden; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; width: 100%; }

.form-section { border-top: 1px solid rgba(255, 255, 255, 0.1); }

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

.submit-btn {
  width: 100%;
  padding: 10px;
  background: #1eef6f;
  color: #020b18;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  margin: 20px 0;
  transition: all 0.2s;
}

.submit-btn:hover { background: #15b050; }

.search-container { position: relative; width: 100%; }
.search-wrapper { position: relative; }


.search-spinner {
  position: absolute;
  right: 12px;
  top: 8px;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(30, 239, 111, 0.2);
  border-top: 2px solid #1eef6f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: #1a1a2e;
  border: 1px solid rgba(30, 239, 111, 0.3);
  border-radius: 4px;
  margin-top: 2px;
  z-index: 1000;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.dropdown-item:hover { background: rgba(30, 239, 111, 0.1); }

.form-select {
  width: 100%;
  padding: 8px 2px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  margin-bottom: 10px;
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
  to { transform: rotate(360deg); }
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

@media (max-width: 768px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
</style>