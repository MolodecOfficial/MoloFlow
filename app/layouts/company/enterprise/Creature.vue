<script setup lang="ts">
import {ref} from 'vue'
import {useWindowManager} from '~/composables/useWindowManager'
import {useNotifications} from '~/composables/useNotifications'

const {openWindow} = useWindowManager()
const {addNotification} = useNotifications()

const loading = ref(false)

// Данные формы
const enterpriseName = ref('')
const inn = ref('')
const kpp = ref('')
const ogrn = ref('')
const legalAddress = ref('')
const actualAddress = ref('')
const sameAddress = ref(false)
const phone = ref('')
const email = ref('')
const director = ref('')
const okved = ref('')
const keypass = ref('')
const ownershipForm = ref('ООО')

const ownershipOptions = ['ООО', 'АО', 'ПАО', 'ИП', 'НКО']

const openTermsOfUse = () => {
  openWindow('company', 'termsOfUse')
}

const copyAddress = () => {
  if (sameAddress.value) {
    actualAddress.value = legalAddress.value
  } else {
    actualAddress.value = ''
  }
}

const createEnterprise = async () => {
  loading.value = true
  try {
    const enterpriseData = {
      enterpriseName: enterpriseName.value,
      inn: Number(inn.value),
      kpp: Number(kpp.value),
      ogrn: Number(ogrn.value),
      legalAddress: legalAddress.value,
      actualAddress: sameAddress.value ? legalAddress.value : actualAddress.value,
      phone: Number(phone.value.replace(/\D/g, '')),
      email: email.value,
      director: director.value,
      okved: Number(okved.value),
      keypass: keypass.value,
      ownershipForm: ownershipForm.value
    }

    const response = await $fetch('/api/enterprises/enterprises', {
      method: 'POST',
      body: enterpriseData
    })

    addNotification('NOTICE_DEFAULT', response.message)
    resetForm()
  } catch (error: any) {
    addNotification('ERROR_DEFAULT', error.data?.message || error.message)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  enterpriseName.value = ''
  inn.value = ''
  kpp.value = ''
  ogrn.value = ''
  legalAddress.value = ''
  actualAddress.value = ''
  sameAddress.value = false
  phone.value = ''
  email.value = ''
  director.value = ''
  okved.value = ''
  keypass.value = ''
  ownershipForm.value = 'ООО'
}
</script>

<template>
  <div class="enterprise-creature">
    <h1 class="title">Создание предприятия</h1>
    <p class="notice">
      Перед созданием предприятия и внесением его в базу, просьба ознакомиться с нашими
      <a class="tou" @click="openTermsOfUse">условиями пользования</a>!
    </p>
    <hr>

    <form @submit.prevent="createEnterprise" class="enterprise-form">
      <div class="form-grid">
        <div class="form-group full-width">
          <MoloInput
              label="enterpriseName"
              tLabel="Полное наименование предприятия"
              lRequired
              type="text"
              id="enterpriseName"
              iRequired
              placeholder='"Ромашка"'
              v-model="enterpriseName"
          />
        </div>

        <!-- ИНН, КПП, ОГРН в одной строке -->
        <MoloInput
            label="inn"
            tLabel="ИНН"
            lRequired
            type="text"
            id="inn"
            iRequired
            placeholder="123456789012"
            max-length="12"
            v-model="inn"
        />

        <MoloInput
            label="kpp"
            tLabel="КПП"
            lRequired
            type="text"
            id="kpp"
            placeholder="123456789"
            max-length="9"
            v-model="kpp"
        />

        <MoloInput
            label="ogrn"
            tLabel="ОГРН"
            lRequired
            type="text"
            id="ogrn"
            iRequired
            placeholder="1234567890123"
            max-length="13"
            v-model="ogrn"
        />

        <!-- Юридический адрес с поиском -->
        <div class="form-group full-width">
          <MoloInput
              label="legalAddress"
              tLabel="Юридический адрес"
              lRequired
              type="text"
              id="legalAddress"
              iRequired
              placeholder="г. Ишимбай, ул. Пушкина, д. 1, оф. 2"
              v-model="legalAddress"
              :address="true"
          />
        </div>

        <!-- Чекбокс совпадения адресов -->
        <div class="form-group full-width checkbox-group">
          <label>
            <input type="checkbox" v-model="sameAddress" @change="copyAddress"/>
            Фактический адрес совпадает с юридическим
          </label>
        </div>

        <!-- Фактический адрес с поиском -->
        <div class="form-group full-width" v-if="!sameAddress">
          <MoloInput
              label="actualAddress"
              tLabel="Фактический адрес"
              type="text"
              v-model="actualAddress"
              placeholder="г. Ишимбай, ул. Пушкина, д. 1, оф. 2"
              :address="true"
          />
        </div>

        <!-- Телефон и Email -->
        <MoloInput
            label="phone"
            tLabel="Телефон"
            lRequired
            type="tel"
            id="phone"
            iRequired
            placeholder="+7 (999) 123-45-67"
            v-model="phone"
            :phone="true"
        />

        <MoloInput
            label="email"
            tLabel="Email"
            lRequired
            type="email"
            id="email"
            iRequired
            placeholder="info@example.ru"
            v-model="email"
        />

        <!-- Руководитель -->
        <MoloInput
            label="director"
            tLabel="Руководитель"
            lRequired
            type="text"
            id="director"
            iRequired
            placeholder="Иванов Иван Иванович"
            v-model="director"
        />

        <!-- ОКВЭД -->
        <MoloInput
            label="okved"
            tLabel="Основной ОКВЭД"
            lRequired
            type="text"
            id="okved"
            iRequired
            placeholder="62.01"
            v-model="okved"
        />

        <!-- Ключ доступа -->
        <MoloInput
            label="keypass"
            tLabel="Ключ доступа к предприятию"
            lRequired
            type="password"
            id="keypass"
            iRequired
            placeholder="Разработайте надёжный ключ, избегая простых комбинаций"
            v-model="keypass"
        />

        <!-- Форма собственности -->
        <MoloSelect
            tLabel="Форма собственности"
            lRequired
            v-model="ownershipForm"
            iRequired
            :parent="ownershipOptions"
            :children="option"
        />
      </div>

      <hr/>

      <button type="submit" class="login" :disabled="loading">
        <div v-if="loading" class="modern-loader"></div>
        <span v-else>Создать предприятие</span>
      </button>
    </form>
  </div>
</template>

<style scoped>
.enterprise-creature {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  width: 100%;
  color: white;
  overflow-y: initial;
}

.title {
  color: white;
}

.notice {
  color: rgba(255, 255, 255, 0.8);
}

.tou {
  color: #1eef6f;
  cursor: pointer;
  text-decoration: none;
  font-weight: 500;
}

.tou:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.enterprise-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-x: inherit;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group.full-width {
  grid-column: span 3;
}

.checkbox-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
  cursor: pointer;
}

input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #1eef6f;
  cursor: pointer;
}

button.login {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #1eef6f;
  transition: all 0.2s;
  background: #1eef6f;
  color: #020b18;
  width: 100%;
  margin-bottom: 20px;
}

button.login:hover:not(:disabled) {
  background: #138f43;
  border-color: #138f43;
}

button.login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

hr {
  width: 100%;
  border: 1px solid var(--half_opacity_border);
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

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: span 1;
  }
}
</style>