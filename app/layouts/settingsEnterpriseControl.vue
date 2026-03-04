<script setup lang="ts">
const props = defineProps<{
  groupId?: string
  subGroupId?: string
  windowId?: string
}>()

const { openWindow, closeWindow } = useWindowManager()
const { addNotification } = useNotifications()

const isAuthenticated = ref(false)
const enterpriseInfo = ref<any>(null) // или типизировать интерфейс

function notAuth() {
  openWindow(
      'settings',
      'login',
      'enterprise',
      {
        width: 400,
        height: 400,
        minWidth: 350,
        minHeight: 300
      }
  )
}

onMounted(() => {
  const enterpriseDataStr = localStorage.getItem('currentEnterprise')
  const token = localStorage.getItem('enterprise_token')

  if (enterpriseDataStr && token) {
    try {
      const parsed = JSON.parse(enterpriseDataStr)
      enterpriseInfo.value = parsed
      isAuthenticated.value = true
      // Можно показать приветствие
    } catch (e) {
      console.error('Ошибка парсинга данных предприятия', e)
      addNotification('ERROR_DEFAULT', 'Ошибка загрузки данных предприятия')
    }
  } else {
    console.warn('Не авторизован в предприятии')
  }
})
</script>
<template>
  <section class="enterprise-management">
    <h2>Управление предприятием</h2>

    <div v-if="isAuthenticated" class="content">
      <p>Тут будет интерфейс управления предприятием</p>
      <p>Название: {{ enterpriseInfo?.enterpriseName }}</p>
      <p>ИНН: {{ enterpriseInfo?.inn }}</p>

    </div>

    <div v-else class="not-authorized">
        <p>Вы не авторизованы в предприятии</p>
        <p>Пожалуйста, <button class="login-btn" @click="notAuth">войдите</button> сначала</p>
    </div>
  </section>
</template>

<style scoped>
.enterprise-management {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  color: white;
}

h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.not-authorized {
  padding: 2rem;
  text-align: center;
  background: rgba(255, 80, 80, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 80, 80, 0.3);
}

.not-authorized a {
  color: #1eef6f;
  text-decoration: none;
}

.not-authorized a:hover {
  text-decoration: underline;
}

.login-btn {
  margin-top: 0.5rem;
  padding: 5px 10px;
  border-radius: 6px;
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