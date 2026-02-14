<script setup lang="ts">
import {useUserStore} from "~~/stores/userStore";
import error from "../../public/error.svg";

interface Props {
  allowedRoles?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  allowedRoles: () => []
})

const router = useRouter()
const userStore = useUserStore()

const loading = ref(true) // начинаем с true
const userRole = ref('')
const userName = ref('')

const loadUserData = async () => {
  loading.value = true

  // Даем время на гидратацию стора и DOM
  await new Promise(resolve => setTimeout(resolve, 0))

  try {
    if (userStore.userName && userStore.userRole) {
      userName.value = userStore.userName
      userRole.value = userStore.userRole
    } else {
      const storageUser = localStorage.getItem('user')
      if (storageUser) {
        const user = JSON.parse(storageUser)
        userName.value = user.name || 'Гость'
        userRole.value = user.role || ''
      } else {
        userName.value = 'Гость'
        userRole.value = ''
      }
    }
  } catch (error) {
    console.error('Ошибка получения пользователя:', error)
    userName.value = 'Гость'
    userRole.value = ''
  } finally {
    loading.value = false
  }
}

const hasAccess = computed(() => {
  if (loading.value) return false

  if (props.allowedRoles.length === 0) return true

  return props.allowedRoles.includes(userRole.value)
})

const goBack = () => {
  router.back()
}

const goToLogin = () => {
  localStorage.removeItem('user')
  router.push('/')
}

onMounted(() => {
  loadUserData()
})
</script>

<template>
  <div>
    <!-- Пока загружаемся, показываем только спиннер -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span class="loading-text">Проверка доступа...</span>
    </div>

    <!-- После загрузки показываем либо контент, либо запрет -->
    <div v-else-if="hasAccess">
      <slot />
    </div>

    <div v-else class="access-denied-page">
      <div class="denied-container">
        <img :src="error" alt="">
        <h1>Доступ запрещен</h1>
        <p>У вас недостаточно прав для просмотра этой страницы</p>
        <div class="actions">
          <button @click="goBack" class="btn-back">Назад</button>
          <button @click="goToLogin" class="btn-login">На главную</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-overlay {
  background-color: #111111;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-top: 3px solid #38ef7d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: #6c757d;
  font-size: 16px;
  font-weight: 500;
  margin-top: 16px;
}

.access-denied-page {
  background-color: #020b18;
  min-height: 100vh;
  display: flex;
  align-items: start;
  justify-content: center;
}

.denied-container {
  text-align: center;
  color: white;
  max-width: 400px;
  padding: 20px;
  margin: 20px;
  border-radius: 10px;
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
}

.denied-container h1 {
  font-size: 2rem;
  margin: 0 0;
  color: #ff4444;
}

.denied-container p {
  font-size: 1.1rem;
  opacity: 0.8;
  margin: 10px 0;
}

.user-info {
  font-size: 0.9rem !important;
  opacity: 0.6 !important;
}

.actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 20px;
}

.actions button {
  cursor: pointer;
  color: white;
  text-decoration: none;
  padding: 10px 15px;
  border: 1px solid var(--half_opacity_border);
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  min-height: 40px;
  transition: all 0.3s ease;
  font-family: inherit;
  font-size: inherit;
  flex-shrink: 0;
}

.btn-back {
  background-color: #6c757d;
  color: white;
}

.btn-back:hover {
  background-color: #5a6268;
}

.btn-login {
  background-color: #38ef7d;
  color: #020b18;
}

.btn-login:hover {
  background-color: #2bd16a;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>