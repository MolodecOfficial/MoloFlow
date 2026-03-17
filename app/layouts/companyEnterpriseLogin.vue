<script setup lang="ts">
import { ref } from 'vue'
import { useWindowManager } from '~/composables/useWindowManager'
import { useNotifications } from '~/composables/useNotifications'

const props = defineProps<{
  groupId?: string
  subGroupId?: string
  windowId?: string
}>()



const { openWindow, closeWindow } = useWindowManager()
const { addNotification } = useNotifications()

// Состояния
const loading = ref(false)
const deleting = ref(false)

const inn = ref('')
const keypass = ref('')

// Вход в предприятие
const handleLogin = async () => {
  if (!inn.value || !keypass.value) {
    addNotification('NOTICE_DEFAULT', 'Заполните все поля')
    return
  }

  loading.value = true

  try {
    // Запрос к бекенду
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

    addNotification('NOTICE_DEFAULT', 'Успешный вход в предприятие!')


    // Закрываем окно входа
    if (props.windowId) {
      closeWindow(props.windowId)
    }

    openWindow(
        'company',
        'control',
        'enterprise',
    )

  } catch (error: any) {
    console.error('Ошибка входа:', error)
    addNotification('ERROR_DEFAULT', error.data?.message || 'Ошибка входа')
  } finally {
    loading.value = false
  }
}

async function deleteToken() {
  deleting.value = true
  await nextTick()
  try {
    localStorage.removeItem('currentEnterprise')
    localStorage.removeItem('enterprise_token')
    addNotification('NOTICE_DEFAULT', 'Токены удалены')
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
        <label for="inn">ИНН предприятия</label>
        <input
            id="inn"
            v-model="inn"
            type="text"
            placeholder="1234567890"
            maxlength="12"
            required
        />
      </div>

      <div class="form-group">
        <label for="keypass">Код доступа</label>
        <input
            id="keypass"
            v-model="keypass"
            type="password"
            placeholder="Введите код доступа"
            required
        />
      </div>

      <button
          type="submit"
          class="login-btn"
          :disabled="loading"
      >
        <span v-if="!loading">Войти</span>
        <div v-else class="loader"></div>
      </button>
    </form>
    <button
        class="login-btn"
        @click="deleteToken"
        :disabled="deleting"
    >
      <span v-if="!deleting">Удалить токены</span>
      <div v-else class="loader"></div>
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
  gap: 1.2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
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

.loader {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #020b18;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>