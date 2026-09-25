<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '~~/stores/appStore'
import error from '../../public/error.svg'

interface Props {
  allowedRoles?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  allowedRoles: () => []
})

const router = useRouter()
const appStore = useAppStore()

const loading = ref(true)

const activeRole = computed(() => {
  return appStore.currentMemberRole || appStore.currentUser?.role || 'Гость'
})

const hasAccess = computed(() => {
  if (loading.value) return false

  // Если список разрешенных ролей пуст — пускаем любого авторизованного
  if (props.allowedRoles.length === 0) return true

  // Администратор имеет абсолютный приоритет
  if (activeRole.value === 'Администратор') {
    return true
  }

  return props.allowedRoles.includes(activeRole.value)
})

const loadAccess = async () => {
  loading.value = true
  try {
    appStore.loadEnterpriseFromStorage()
  } catch (err) {
    console.error('[MoloGuard] Ошибка проверки прав:', err)
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

const goToLogin = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user')
    localStorage.removeItem('currentEnterprise')
    localStorage.removeItem('enterprise_token')
  }
  router.push('/')
}

onMounted(() => {
  loadAccess()
})
</script>

<template>
  <div>
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span class="loading-text">Проверка доступа...</span>
    </div>

    <div v-else-if="hasAccess">
      <slot />
    </div>

    <div v-else class="access-denied-page">
      <div class="denied-container">
        <img :src="error" alt="Доступ запрещен">
        <h1>Доступ запрещен</h1>
        <p>У вашей роли ({{ activeRole }}) недостаточно прав для входа</p>
        <div class="actions">
          <UIMoloButton @click="goBack" class="close">Назад</UIMoloButton>
          <UIMoloButton @click="goToLogin" class="confirm">На главную</UIMoloButton>
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
  align-items: center;
  justify-content: center;
}

.denied-container {
  text-align: center;
  color: white;
  max-width: 420px;
  padding: 24px;
  border-radius: 12px;
  background-color: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
}

.denied-container h1 {
  font-size: 1.8rem;
  margin: 12px 0 6px;
  color: #ff4444;
}

.denied-container p {
  font-size: 1rem;
  opacity: 0.8;
  margin: 10px 0 20px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>