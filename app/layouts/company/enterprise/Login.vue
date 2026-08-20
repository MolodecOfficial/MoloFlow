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
  <div class="log">
    <MoloSection>
      <template #header>
        <span>Введите данные</span>
        <section class="btns">
          <MoloButton
              class="small"
              @click="deleteToken"
              :disabled="deleting"
          >
            <span v-if="!deleting">Удалить токены</span>
            <MoloLoaders wndLoader v-else/>
          </MoloButton>
          <MoloButton
              class="small confirm"
              :disabled="loading"
              :loading="loading"
              @click="handleLogin"
          >
            <span v-if="!loading">Войти</span>
          </MoloButton>
        </section>
      </template>
      <template #main>
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
      </template>
    </MoloSection>
  </div>
</template>

<style scoped>
.log {
  padding: 20px;
}

.btns {
  display: flex;
  gap: 10px;
}
</style>