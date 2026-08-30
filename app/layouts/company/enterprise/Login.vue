<script setup lang="ts">
import { ref } from 'vue'
import { useWindowManager } from '~/composables/window/useWindowManager'
import { useNotifications } from '~/composables/useNotifications'
import { useLogger } from '~/composables/useLogger'
import { useEnterprise } from '~/composables/useEnterprise'

const props = defineProps<{
  groupId?: string
  subGroupId?: string
  windowId?: string
}>()

const { openWindow, closeWindow } = useWindowManager()
const { addNotification } = useNotifications('Вход в предприятие')
const { addLog } = useLogger('Вход в предприятие')

// Используем композабл
const enterprise = useEnterprise()

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

    // Используем композабл для сохранения
    enterprise.login({
      enterprise: response.enterprise,
      token: response.token
    })

    addNotification('info', 'Успешный вход в предприятие!')

    if (props.windowId) {
      closeWindow(props.windowId)
    }

    // Открываем новое окно
    setTimeout(() => {
      openWindow('control')
    }, 50)
  } catch (error: any) {
    addLog('error', `Ошибка входа - ${error.data?.message}`)
    addNotification('error', 'Ошибка входа')
  } finally {
    loading.value = false
    addLog('success', 'Успешный вход в предприятие')
  }
}

async function deleteToken() {
  deleting.value = true
  try {
    enterprise.logout()
    addNotification('info', 'Токены удалены')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="log">
    <UIMoloSection>
      <template #header>
        <span>Введите данные</span>
        <section class="btns">
          <UIMoloButton
              class="small"
              @click="deleteToken"
              :disabled="deleting"
          >
            <span v-if="!deleting">Удалить токены</span>
            <UIMoloLoaders wndLoader v-else/>
          </UIMoloButton>
          <UIMoloButton
              class="small confirm"
              :disabled="loading"
              :loading="loading"
              @click="handleLogin"
          >
            <span v-if="!loading">Войти</span>
          </UIMoloButton>
        </section>
      </template>
      <template #main>
        <UIMoloInput
            lRequired
            type="text"
            tLabel="ИНН предприятия"
            v-model="inn"
            placeholder="1234567890"
            maxLength="12"
            iRequired
        />
        <UIMoloInput
            lRequired
            tLabel="Код доступа"
            type="password"
            placeholder="Введите код доступа"
            v-model="keypass"
            iRequired
        />
      </template>
    </UIMoloSection>
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