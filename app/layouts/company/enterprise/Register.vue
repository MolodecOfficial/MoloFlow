<script setup lang="ts">
import { ref } from 'vue'
import { useWindowManager } from '~/composables/window/useWindowManager'
import { useNotifications } from '~/composables/useNotifications'
import { useLogger } from '~/composables/useLogger'
import { useAppStore } from '~~/stores/appStore'
import { buildAuthHeaders } from '~~/server/utils/authContext'

const { openWindow } = useWindowManager()
const { addNotification } = useNotifications('Создание предприятия')
const { addLog } = useLogger('Создание предприятия')
const appStore = useAppStore()

const loading = ref(false)
const showDetails = ref(false)

// Обязательные базовые поля
const enterpriseName = ref('')
const inn = ref('')
const keypass = ref('')
const ownershipForm = ref('ООО')

// Дополнительные реквизиты (можно заполнить позже)
const kpp = ref('')
const ogrn = ref('')
const legalAddress = ref('')
const actualAddress = ref('')
const sameAddress = ref(true)
const phone = ref('')
const email = ref('')
const director = ref('')
const okved = ref('')

const ownershipOptions = ['ООО', 'ИП', 'АО', 'ПАО', 'НКО', 'Самозанятый']

const openTermsOfUse = () => {
  openWindow('terms-of-use')
}

const copyAddress = () => {
  if (sameAddress.value) {
    actualAddress.value = legalAddress.value
  } else {
    actualAddress.value = ''
  }
}

const createEnterprise = async () => {
  if (!enterpriseName.value.trim()) {
    addNotification('warning', 'Укажите название предприятия')
    return
  }
  if (!inn.value.trim()) {
    addNotification('warning', 'Укажите ИНН')
    return
  }
  if (!keypass.value.trim()) {
    addNotification('warning', 'Задайте ключ доступа')
    return
  }

  addLog('info', 'Регистрация предприятия в системе...')
  loading.value = true

  try {
    const payload = {
      enterpriseName: enterpriseName.value.trim(),
      inn: inn.value.trim(),
      keypass: keypass.value.trim(),
      ownershipForm: ownershipForm.value,
      kpp: kpp.value.trim(),
      ogrn: ogrn.value.trim(),
      legalAddress: legalAddress.value.trim(),
      actualAddress: sameAddress.value ? legalAddress.value.trim() : actualAddress.value.trim(),
      phone: phone.value.replace(/\D/g, ''),
      email: email.value.trim(),
      director: director.value.trim(),
      okved: okved.value.trim()
    }

    const response: any = await $fetch('/api/enterprises/', {
      method: 'POST',
      body: payload,
      headers: buildAuthHeaders(appStore.currentUser?._id)
    })

    addLog('success', `Предприятие «${response.enterprise?.enterpriseName}» создано`)
    addNotification('success', response.message || 'Предприятие успешно создано')

    if (response.enterprise?._id) {
      await appStore.setEnterprise(response.enterprise._id, response.enterprise)
    }

    resetForm()
  } catch (error: any) {
    const errMsg = error?.data?.statusMessage || error?.data?.message || error?.message || 'Ошибка создания предприятия'
    addNotification('error', errMsg)
    addLog('error', `Ошибка: ${errMsg}`)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  enterpriseName.value = ''
  inn.value = ''
  keypass.value = ''
  ownershipForm.value = 'ООО'
  kpp.value = ''
  ogrn.value = ''
  legalAddress.value = ''
  actualAddress.value = ''
  sameAddress.value = true
  phone.value = ''
  email.value = ''
  director.value = ''
  okved.value = ''
  showDetails.value = false
}
</script>

<template>
  <div class="enterprise-creator">
    <div class="header-banner">
      <div class="banner-title">
        <UIMoloSticker name="nomenclature" :size="24" glow />
        <h2>Новое предприятие</h2>
      </div>
      <p class="notice">
        Заполните основные данные для старта. Дополнительные реквизиты можно внести в любое время позже.
        Ознакомьтесь с <a class="tou" @click="openTermsOfUse">условиями сервиса</a>.
      </p>
    </div>

    <hr>

    <form @submit.prevent="createEnterprise" class="enterprise-form">
      <!-- Основной компактный блок -->
      <div class="form-grid primary-grid">
        <div class="form-group span-2">
          <UIMoloInput
              id="enterpriseName"
              t-label="Наименование организации / ИП"
              placeholder='Например: "МолоФлоу" или ИП Иванов И. И.'
              l-required
              i-required
              v-model="enterpriseName"
          />
        </div>

        <div class="form-group">
          <UIMoloSelect
              t-label="Форма собственности"
              l-required
              v-model="ownershipForm"
              :parent="ownershipOptions"
          />
        </div>

        <div class="form-group span-2">
          <UIMoloInput
              id="inn"
              t-label="ИНН"
              placeholder="10 или 12 цифр"
              max-length="12"
              l-required
              i-required
              v-model="inn"
          />
        </div>

        <div class="form-group">
          <UIMoloInput
              id="keypass"
              t-label="Ключ доступа к предприятию"
              type="password"
              placeholder="Секретный ключ"
              l-required
              i-required
              v-model="keypass"
          />
        </div>
      </div>

      <!-- Кнопка раскрытия расширенных реквизитов -->
      <div class="details-toggle-bar">
        <button type="button" class="toggle-btn" @click="showDetails = !showDetails">
          <UIMoloSticker name="arrow" :size="12" :class="{ rotated: showDetails }" />
          <span>{{ showDetails ? 'Скрыть дополнительные реквизиты' : 'Указать полные реквизиты (КПП, ОГРН, адреса, контакты)' }}</span>
        </button>
      </div>

      <!-- Дополнительные параметры -->
      <transition name="expand">
        <div v-if="showDetails" class="details-section">
          <div class="form-grid">
            <UIMoloInput
                id="kpp"
                t-label="КПП"
                placeholder="9 цифр"
                max-length="9"
                v-model="kpp"
            />

            <UIMoloInput
                id="ogrn"
                t-label="ОГРН / ОГРНИП"
                placeholder="13 или 15 цифр"
                max-length="15"
                v-model="ogrn"
            />

            <UIMoloInput
                id="okved"
                t-label="Основной ОКВЭД"
                placeholder="62.01"
                v-model="okved"
            />

            <div class="form-group full-width">
              <UIMoloInput
                  id="director"
                  t-label="ФИО Руководителя"
                  placeholder="Иванов Иван Иванович"
                  v-model="director"
              />
            </div>

            <div class="form-group full-width">
              <UIMoloInput
                  id="legalAddress"
                  t-label="Юридический адрес"
                  placeholder="г. Москва, ул. Ленина, д. 10"
                  v-model="legalAddress"
                  :address="true"
              />
            </div>

            <div class="form-group full-width checkbox-row">
              <label>
                <input type="checkbox" v-model="sameAddress" @change="copyAddress" />
                <span>Фактический адрес совпадает с юридическим</span>
              </label>
            </div>

            <div class="form-group full-width" v-if="!sameAddress">
              <UIMoloInput
                  id="actualAddress"
                  t-label="Фактический адрес"
                  placeholder="Фактическое местонахождение"
                  v-model="actualAddress"
                  :address="true"
              />
            </div>

            <div class="form-group span-2">
              <UIMoloInput
                  id="phone"
                  t-label="Телефон"
                  type="tel"
                  placeholder="+7 (999) 000-00-00"
                  v-model="phone"
                  :phone="true"
              />
            </div>

            <div class="form-group">
              <UIMoloInput
                  id="email"
                  t-label="Email"
                  type="email"
                  placeholder="info@company.ru"
                  v-model="email"
              />
            </div>
          </div>
        </div>
      </transition>

      <div class="actions-footer">
        <UIMoloButton type="submit" variant="confirm" :disabled="loading" class="submit-btn">
          <div v-if="loading" class="modern-loader"></div>
          <template v-else>
            <span>Создать предприятие</span>
          </template>
        </UIMoloButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.enterprise-creator {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.header-banner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.banner-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.banner-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.notice {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}

.tou {
  color: var(--accent, #1fb6ff);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.enterprise-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.span-2 {
  grid-column: span 2;
}

.full-width {
  grid-column: span 3;
}

.details-toggle-bar {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.toggle-btn {
  background: transparent;
  border: 0;
  color: var(--accent, #1fb6ff);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 0;
  transition: opacity 0.2s;
}

.toggle-btn:hover {
  opacity: 0.85;
}

.toggle-btn .rotated {
  transform: rotate(90deg);
}

.details-section {
  padding: 14px;
  border: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.checkbox-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.checkbox-row label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}

.actions-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
  border-top: 1px solid var(--half_opacity_border, rgba(255, 255, 255, 0.1));
}

.submit-btn {
  min-width: 180px;
}

.modern-loader {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 680px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .span-2, .full-width {
    grid-column: span 1;
  }
}
</style>