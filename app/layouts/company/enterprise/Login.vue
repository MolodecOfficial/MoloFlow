<script setup lang="ts">
import {ref} from 'vue'
import {useWindowManager} from '~/composables/useWindowManager'
import {useNotifications} from '~/composables/useNotifications'
import {useLogger} from '~/composables/useLogger'

const props = defineProps<{
  groupId?: string
  subGroupId?: string
  windowId?: string
}>()

const {openWindow, closeWindow} = useWindowManager()
const {addNotification} = useNotifications('Вход в предприятие')
const {addLog} = useLogger('Вход в предприятие')

// Состояния
const loading = ref(false)
const deleting = ref(false)

const inn = ref('')
const keypass = ref('')

// Вход в предприятие
const handleLogin = async () => {
  if (!inn.value || !keypass.value) {
    addNotification('warning', 'Заполните все поля')
    return
  }
  loading.value = true
  try {
    addLog('info', 'Отправляю данные на сервер...')
    const response = await $fetch('/api/enterprises/login', {
      method: 'POST',
      body: {
        inn: inn.value,
        keypass: keypass.value
      }
    })

    // Сохраняем данные о предприятии
    localStorage.setItem('currentEnterprise', JSON.stringify(response.enterprise))
    localStorage.setItem('enterprise_token', response.token)

    window.dispatchEvent(new Event('enterprise-login'))

    addNotification('info', 'Успешный вход в предприятие!')

    if (props.windowId) {
      closeWindow(props.windowId)
    }

    // ПОТОМ ОТКРЫВАЕМ НОВОЕ (с небольшой задержкой)
    setTimeout(() => {
      openWindow(
          'company',
          'control',
          'enterprise',
          { width: 800, height: 600 }
      )
    }, 50)
  } catch (error: any) {
    addLog('error', `Ошибка входа - ${error.data?.message}`)
    addNotification('error', 'Ошибка входа')
  } finally {
    loading.value = false
    addLog('success', 'Успешный вход в прдеприятие')
  }
}

async function deleteToken() {
  deleting.value = true
  try {
    localStorage.removeItem('currentEnterprise')
    localStorage.removeItem('enterprise_token')

    // Диспатчим событие для обновления меню
    window.dispatchEvent(new Event('enterprise-logout'))
    addNotification('info', 'Токены удалены')
  } finally {
    deleting.value = false
  }
}
</script>


<template>
  <div class="enterprise-login">
    <h2 class="title">Вход в предприятие</h2>
    <hr>
    <form @submit.prevent="handleLogin" class="login-form">
      <div class="form-group">
        <MoloInput
            lRequired
            type="text"
            tLabel="ИНН предприятия"
            v-model="inn"
            placeholder="1234567890"
            maxLength="12"
            iRequired
        />
        <MoloInput
            lRequired
            tLabel="Код доступа"
            type="password"
            placeholder="Введите код доступа"
            v-model="keypass"
            iRequired
        />
      </div>
      <hr>
      <button
          type="submit"
          class="login-btn"
          :disabled="loading"
      >
        <span v-if="!loading">Войти</span>
        <MoloLoaders btnLoader v-else/>
      </button>
    </form>
    <button
        class="login-btn"
        @click="deleteToken"
        :disabled="deleting"
    >
      <span v-if="!deleting">Удалить токены</span>
      <MoloLoaders wndLoader v-else/>
    </button>
  </div>
</template>

<style scoped>
.enterprise-login {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  color: white;
  box-sizing: border-box;
}


.login-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

input {
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 6px;
  padding: 10px 12px;
  color: white;
  font-size: 0.95rem;
  transition: all 0.2s;
  outline: none;
}

input:focus {
  border-color: #1eef6f;
  box-shadow: 0 0 0 2px rgba(30, 239, 111, 0.2);
}

input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.login-btn {
  margin-top: 0.5rem;
  padding: 12px;
  border-radius: 6px;
  font-size: 1rem;
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

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

</style>