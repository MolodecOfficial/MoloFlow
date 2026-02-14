<script setup lang="ts">
import {ref} from 'vue'
import {useWindowManager} from '~/composables/useWindowManager'

const {openWindow} = useWindowManager()

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
const ownershipForm = ref('')

const ownershipOptions = ['ООО', 'АО', 'ПАО', 'ИП', 'НКО']

const openTermsOfUse = () => {
  console.log('🖱️ Opening termsOfUse directly')
  openWindow('settings', 'termsOfUse', 'Общие настройки', 'Условия пользования')
}

const createEnterprise = () => {
  console.log('Создание предприятия:', {
    enterpriseName: enterpriseName.value,
    inn: inn.value,
    kpp: kpp.value,
    ogrn: ogrn.value,
    legalAddress: legalAddress.value,
    actualAddress: sameAddress.value ? legalAddress.value : actualAddress.value,
    phone: phone.value,
    email: email.value,
    director: director.value,
    okved: okved.value,
    ownershipForm: ownershipForm.value
  })
  // ...надо будет создать логику
}

const copyAddress = () => {
  if (sameAddress.value) {
    actualAddress.value = legalAddress.value
  } else {
    actualAddress.value = ''
  }
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
          <MoloForm
              label="enterpriseName"
              tLabel="Полное наименование предприятия"
              lRequired
              type="text"
              id="enterpriseName"
              iRequired
              placeholder='ООО "Ромашка"'
              max-length="9"
              v-model="enterpriseName"
          />
        </div>

        <!-- ИНН, КПП, ОГРН в одной строке -->
        <MoloForm
            label="inn"
            tLabel="ИНН"
            lRequired
            type="text"
            id="inn"
            iRequired
            placeholder="1234567890"
            max-length="12"
            v-model="inn"
        />

        <MoloForm
            label="kpp"
            tLabel="КПП"
            lRequired
            type="text"
            id="kpp"
            iRequired
            placeholder="123456789"
            max-length="9"
            v-model="kpp"
        />

        <MoloForm
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

        <!-- Юридический адрес -->
        <div class="form-group full-width">
          <MoloForm
              label="legalAddress"
              tLabel="Юридический адрес"
              lRequired
              type="text"
              id="legalAddress"
              iRequired
              placeholder="г. Ишимбай, ул. Пушкина, д. 1, оф. 2"
              v-model="legalAddress"
          />
        </div>

        <!-- Чекбокс совпадения адресов -->
        <div class="form-group full-width checkbox-group">
          <label>
            <input type="checkbox" v-model="sameAddress" @change="copyAddress"/>
            Фактический адрес совпадает с юридическим
          </label>
        </div>

        <!-- Фактический адрес -->
        <div class="form-group full-width" v-if="!sameAddress">
          <MoloForm v-if="!sameAddress"
                    label="actualAddress"
                    tLabel="Фактический адрес"
                    type="text"
                    id="actualAddress"
                    v-model="actualAddress"
                    placeholder="г. Ишимбай, ул. Пушкина, д. 1, оф. 2"
          />
        </div>

        <!-- Телефон и Email -->
        <MoloForm
            label="phone"
            tLabel="Телефон"
            lRequired
            type="tel"
            id="phone"
            iRequired
            placeholder="+7 (999) 123-45-67"
            v-model="phone"
        />

        <MoloForm
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
        <MoloForm
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
        <MoloForm
            label="okved"
            tLabel="Основной ОКВЭД"
            lRequired
            type="text"
            id="okved"
            iRequired
            placeholder="62.01"
            v-model="okved"
        />
        <!-- Форма собственности -->
        <div class="form-group">
          <label for="ownershipForm">Форма собственности</label>
          <select id="ownershipForm" v-model="ownershipForm">
            <option v-for="option in ownershipOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
      </div>

      <hr>

      <div class="form-actions">
        <button type="submit" class="btn primary">Создать предприятие</button>
      </div>
    </form>
  </div>
</template>

<style scoped>


.enterprise-creature {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  width: 100%;
  color: white;
  overflow: hidden;
}

.title {
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: white;
}

.notice {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 1rem;
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
  overflow-x: hidden;
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

label {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.required {
  color: #ff4d4d;
  margin-left: 2px;
}

input, select {
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 8px;
  padding: 10px 12px;
  color: white;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

input:focus, select:focus {
  border-color: #1eef6f;
  box-shadow: 0 0 0 2px rgba(30, 239, 111, 0.2);
}

input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 20px;
}

select option {
  background: #1a2634;
  color: white;
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
}

.btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  background: transparent;
  color: white;

}

.btn.primary {
  background: #1eef6f;
  color: #020b18;
  border-color: #1eef6f;
  &:hover {
    border: 1px solid black;
    background: #138f43;

  }
}

hr {
  width: 100%;
  border: 1px solid var(--half_opacity_border);
}

/* Медиа-запросы для мобильных */
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: span 1;
  }
}
</style>