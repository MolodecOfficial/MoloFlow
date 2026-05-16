<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useHead } from '#imports'
import { useUserStore } from '~~/stores/userStore'
import { useNotifications } from '~/composables/useNotifications'
import { useWindowManager } from '~/composables/useWindowManager'
import { useLogger } from '~/composables/useLogger'
import logo from '~~/public/logo.ico'

const name = ref('')
const role = ref('')
const enterpriseName = ref('')
const isLoading = ref(true)

const {
  windows,
  openWindow,
  closeWindow,
  focusWindow,
  minimizeWindow,
  moveWindow,
  resizeWindow,
  maximizeWindow
} = useWindowManager()

const userStore = useUserStore()
const router = useRouter()
const { notifications, removeNotification } = useNotifications('Главная страница')
const { addLog } = useLogger()

useHead({
  title: computed(() => `Предприятие — ${enterpriseName.value || 'Загрузка...'}`)
})

// Функция загрузки данных (будет вызываться при монтировании и при событиях)
const loadUserData = () => {
  let userName = ''
  let userRole = ''

  // Данные из Pinia
  if (userStore.userName && userStore.userRole) {
    userName = userStore.userName
    userRole = userStore.userRole
  }

  // Название предприятия из localStorage
  const storageEnterprise = localStorage.getItem('currentEnterprise')
  if (storageEnterprise) {
    try {
      const enterprise = JSON.parse(storageEnterprise)
      const newName = enterprise.enterpriseName || enterprise.name || 'Без названия'

      // Обновляем только если изменилось
      if (enterpriseName.value !== newName) {
        enterpriseName.value = newName
        addLog('info', `Название предприятия обновлено: ${newName}`)
      }
    } catch {
      enterpriseName.value = 'Ошибка загрузки'
    }
  } else {
    enterpriseName.value = 'Без названия'
  }

  // Пользователь из localStorage (если Pinia пуст)
  if (!userName || !userRole) {
    const storageUser = localStorage.getItem('user')

    if (storageUser) {
      try {
        const user = JSON.parse(storageUser)
        userName = user.name || 'Гость'
        userRole = user.role || 'Пользователь'
      } catch (e) {
        console.error('Ошибка парсинга user:', e)
        userName = 'Гость'
        userRole = 'Пользователь'
      }
    } else {
      userName = 'Гость'
      userRole = 'Пользователь'
    }
  }

  name.value = userName
  role.value = userRole
  isLoading.value = false
}

// Слушатель изменений в localStorage (для других вкладок)
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'currentEnterprise' || e.key === 'user') {
    loadUserData()
  }
}

// Пользовательское событие для обновления в той же вкладке
const handleEnterpriseUpdate = () => {
  loadUserData()
}

onMounted(() => {
  loadUserData()

  // Слушаем изменения localStorage из других вкладок
  window.addEventListener('storage', handleStorageChange)

  // Слушаем пользовательские события обновления предприятия
  window.addEventListener('enterprise-login', handleEnterpriseUpdate)
  window.addEventListener('enterprise-logout', handleEnterpriseUpdate)
  window.addEventListener('enterprise-updated', handleEnterpriseUpdate)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('enterprise-login', handleEnterpriseUpdate)
  window.removeEventListener('enterprise-logout', handleEnterpriseUpdate)
  window.removeEventListener('enterprise-updated', handleEnterpriseUpdate)
})

function deleteUser() {
  localStorage.removeItem('user')
  localStorage.removeItem('currentEnterprise')
  localStorage.removeItem('enterprise_token')

  // Оповещаем об изменении
  window.dispatchEvent(new Event('enterprise-logout'))

  router.push('/')
}
</script>

<template>
  <MoloGuard :allowedRoles="['Управляющий', 'Сотрудник', 'Пользователь']">
    <div class="enterprise-container">
      <!-- Фон -->
      <div class="background">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <img :src="logo" class="background-logo" alt="Logo" />
      </div>

      <!-- Уведомления -->
      <div class="notifications-wrapper">
        <MoloNotice
            v-for="(notification, index) in notifications"
            :key="notification.id"
            :notice_type="notification.type"
            :notice_title="notification.title"
            :notice_text="notification.text"
            :index="index"
            :total="notifications.length"
            @close="removeNotification(notification.id)"
        />
      </div>

      <!-- Логгер -->
      <div class="logger-wrapper">
        <MoloLogger />
      </div>

      <!-- Загрузка -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-card">
          <div class="loading-spinner"></div>
          <span class="loading-text">Загружаем рабочее пространство...</span>
        </div>
      </div>

      <!-- Контент -->
      <div v-else class="content">
        <!-- Верхняя панель -->
        <header class="topbar">
          <div class="brand">
            <div class="brand-dot"></div>
            <div class="brand-text">
              <h1 class="enterprise-title">MF:Предприятие</h1>
              <p class="enterprise-subtitle">{{ enterpriseName }}</p>
            </div>
          </div>

          <div class="user-section">
            <div class="user-card">
              <div class="user-avatar">
                {{ name?.charAt(0)?.toUpperCase() || 'U' }}
              </div>

              <div class="user-info">
                <p class="greeting">Добро пожаловать</p>
                <p class="user-name">{{ name }}</p>
              </div>
            </div>

            <button @click="deleteUser" class="logout-btn">
              <span>Выйти</span>
            </button>
          </div>
        </header>

        <!-- Основная рабочая зона -->
        <main class="workspace">
          <MoloMenu
              :role="role"
              @open-window="openWindow"
          />

          <WindowsManager
              :windows="windows"
              @close="closeWindow"
              @focus="focusWindow"
              @minimize="minimizeWindow"
              @move="moveWindow"
              @resize="resizeWindow"
              @maximize="maximizeWindow"
              @open-window="openWindow"
          />
        </main>
      </div>
    </div>
  </MoloGuard>
</template>

<style scoped>
/* ========================================
   БАЗОВЫЙ КОНТЕЙНЕР
======================================== */
.enterprise-container {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
      radial-gradient(circle at top left, rgba(56, 114, 239, 0.08), transparent 40%),
      radial-gradient(circle at bottom right, rgba(120, 119, 198, 0.08), transparent 40%),
      linear-gradient(135deg, #09090b 0%, #111827 45%, #0f172a 100%);
  color: #ffffff;
}

/* ========================================
   ФОН
======================================== */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.background-logo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(34vw, 420px);
  transform: translate(-50%, -50%);
  opacity: 0.035;
  filter: grayscale(1) blur(1px);
  user-select: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.18;
  animation: float 18s ease-in-out infinite;
}

.orb-1 {
  width: 320px;
  height: 320px;
  top: 8%;
  left: 6%;
  background: #3872ef;
}

.orb-2 {
  width: 260px;
  height: 260px;
  right: 10%;
  top: 15%;
  background: #7c3aed;
  animation-delay: -6s;
}

.orb-3 {
  width: 340px;
  height: 340px;
  bottom: 8%;
  left: 30%;
  background: #0ea5e9;
  animation-delay: -12s;
}

@keyframes float {
  0%, 100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -20px, 0) scale(1.06);
  }
}

/* ========================================
   УВЕДОМЛЕНИЯ
======================================== */
.notifications-wrapper {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  z-index: 1000;
  pointer-events: none;
}

.notifications-wrapper > * {
  pointer-events: auto;
}

/* ========================================
   ЛОГГЕР
======================================== */
.logger-wrapper {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 1000;
  animation: slideInLeft 0.35s ease-out;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ========================================
   СОСТОЯНИЕ ЗАГРУЗКИ
======================================== */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 32px 36px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.loading-spinner {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: #3872ef;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  letter-spacing: 0.02em;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ========================================
   ОСНОВНОЙ КОНТЕНТ
======================================== */
.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ========================================
   ВЕРХНЯЯ ПАНЕЛЬ
======================================== */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 24px 28px;
  margin: 20px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);

}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.brand-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3872ef, #7c3aed);
  box-shadow:
      0 0 20px rgba(56, 114, 239, 0.5),
      0 0 40px rgba(124, 58, 237, 0.25);
  flex-shrink: 0;
}

.brand-text {
  min-width: 0;
}

.enterprise-title {
  margin: 0;
  font-size: clamp(1.55rem, 3vw, 2.35rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.enterprise-subtitle {
  margin: 6px 0 0;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.3s ease; /* Плавное обновление */
}

/* ========================================
   БЛОК ПОЛЬЗОВАТЕЛЯ
======================================== */
.user-section {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 8px 8px;
  border-radius: 18px;
  border: 1px solid var(--half_opacity_border);
}

.user-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  color: #ffffff;
  background: linear-gradient(135deg, #3872ef, #7c3aed);
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.greeting {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.user-name {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
}

/* ========================================
   КНОПКА ВЫХОДА
======================================== */
.logout-btn {
  height: 42px;
  padding: 0 18px;
  border: 1px solid var(--half_opacity_border);
  border-radius: 14px;
  background: rgba(208, 0, 22, 0.34);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
      transform 0.2s ease,
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
}

.logout-btn:hover {
  background: rgba(245, 0, 26, 0.55);
  border-color: rgba(220, 53, 69, 0.35);
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(220, 53, 69, 0.15);
}

/* ========================================
   РАБОЧАЯ ОБЛАСТЬ
======================================== */
.workspace {
  position: relative;
  flex: 1;
  min-height: calc(100vh - 160px);
  padding: 0 20px 20px;
  box-sizing: border-box;
  overflow: hidden;
}

/* ========================================
   АДАПТИВНОСТЬ
======================================== */
@media (max-width: 1024px) {
  .topbar {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }

  .user-section {
    justify-content: space-between;
  }
}

@media (max-width: 768px) {
  .topbar {
    margin: 12px;
    padding: 18px;
    border-radius: 22px;
  }

  .workspace {
    padding: 0 12px 12px;
    min-height: calc(100vh - 220px);
  }

  .user-section {
    flex-direction: column;
    align-items: stretch;
  }

  .logout-btn {
    width: 100%;
  }

  .logger-wrapper {
    left: 12px;
    bottom: 12px;
  }

  .notifications-wrapper {
    right: 12px;
    bottom: 12px;
  }

  .background-logo {
    width: 60vw;
  }
}

@media (max-width: 480px) {
  .enterprise-title {
    font-size: 1.4rem;
  }

  .enterprise-subtitle {
    font-size: 0.85rem;
  }

  .user-card {
    width: 100%;
  }

  .user-info {
    min-width: 0;
  }

  .user-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>